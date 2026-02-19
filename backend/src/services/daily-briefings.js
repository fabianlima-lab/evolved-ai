import { buildLiveContext } from './context-builder.js';
import { compileSoulMd } from '../prompts/soul.js';
import { callAI, isAIConfigured } from './ai-client.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { isQuietHours } from '../utils/quiet-hours.js';
import prisma from '../lib/prisma.js';

// ─────────────────────────────────────────────────────
// Daily Briefings Scheduler
//
// Sends proactive morning briefings and evening wraps
// to subscribers via WhatsApp. Checks every 60 seconds
// if it's any subscriber's briefing/wrap time.
//
// Requirements:
// - Subscriber must have whatsappJid (WhatsApp connected)
// - Subscriber must have googleAccessToken (Google connected)
// - AI must be configured
// ─────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds
let intervalHandle = null;

// Track sent briefings to prevent duplicates within the same day
// Key: `${subscriberId}_${type}_${dateStr}` → true
const sentBriefings = new Map();

// Clean up old entries daily
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Start the daily briefing scheduler.
 * Call once at server startup.
 */
export function startBriefingScheduler() {
  if (intervalHandle) {
    console.warn('[BRIEFING-SCHEDULER] Already running');
    return;
  }

  if (!isAIConfigured()) {
    console.warn('[BRIEFING-SCHEDULER] AI not configured — skipping briefing scheduler');
    return;
  }

  console.log('[STARTUP] Briefing scheduler started');

  intervalHandle = setInterval(async () => {
    try {
      await processBriefings();
    } catch (err) {
      console.error(`[BRIEFING-SCHEDULER] Tick error: ${err.message}`);
    }
  }, CHECK_INTERVAL_MS);

  // Clean up old tracking entries daily
  setInterval(() => {
    const cutoff = Date.now() - CLEANUP_INTERVAL_MS;
    for (const [key, timestamp] of sentBriefings) {
      if (timestamp < cutoff) sentBriefings.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Stop the scheduler.
 */
export function stopBriefingScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[BRIEFING-SCHEDULER] Stopped');
  }
}

/**
 * Process all subscribers — check if it's their briefing or wrap time.
 */
async function processBriefings() {
  // Find all subscribers with WhatsApp connected
  const subscribers = await prisma.subscriber.findMany({
    where: {
      whatsappJid: { not: null },
    },
    select: {
      id: true,
      whatsappJid: true,
      profileData: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      googleAccessTokenExpiry: true,
      googleScopes: true,
      name: true,
      assistantName: true,
    },
  });

  const now = new Date();

  for (const subscriber of subscribers) {
    // Fetch active agent separately (Prisma select doesn't support take on relations)
    const agent = await prisma.agent.findFirst({
      where: { subscriberId: subscriber.id, isActive: true },
      select: { id: true, name: true },
    });
    if (!agent) continue;

    const tz = subscriber.profileData?.timezone || 'America/New_York';
    const briefingTime = subscriber.profileData?.briefingTime || '7:00 AM';
    const wrapTime = subscriber.profileData?.wrapTime || '8:00 PM';

    // Skip if in quiet hours
    if (isQuietHours(tz)) continue;

    // Check morning briefing
    if (isWithinTimeWindow(now, briefingTime, tz)) {
      await sendBriefing(subscriber, agent, 'morning', tz);
    }

    // Check evening wrap
    if (isWithinTimeWindow(now, wrapTime, tz)) {
      await sendBriefing(subscriber, agent, 'evening', tz);
    }
  }
}

/**
 * Send a briefing to a subscriber if not already sent today.
 */
async function sendBriefing(subscriber, agent, type, timezone) {
  const dateStr = new Date().toLocaleDateString('en-US', { timeZone: timezone });
  const trackingKey = `${subscriber.id}_${type}_${dateStr}`;

  // Already sent today
  if (sentBriefings.has(trackingKey)) return;

  // Mark as sent immediately to prevent duplicates during this tick
  sentBriefings.set(trackingKey, Date.now());

  try {
    // Build live context
    const liveContext = await buildLiveContext(subscriber);

    // Compile SOUL.md with context
    const systemPrompt = compileSoulMd({
      assistantName: agent.name,
      profileData: subscriber.profileData,
      subscriber,
      liveContext,
    });

    // Create a briefing-specific user message
    const briefingPrompt = type === 'morning'
      ? 'Send a morning briefing. Include today\'s schedule highlights, any urgent emails, and upcoming reminders. Keep it short and warm — 3-5 lines max.'
      : 'Send an evening wrap-up. Summarize what was on today\'s schedule, mention any unread emails, and preview tomorrow. Keep it short — 2-4 lines.';

    const { content, error } = await callAI(
      systemPrompt,
      [{ role: 'user', content: briefingPrompt }],
      { userMessage: briefingPrompt },
    );

    if (error || !content) {
      console.error(`[BRIEFING] AI failed for ${type} briefing, subscriber:${subscriber.id}: ${error}`);
      return;
    }

    // Send via WhatsApp
    await sendWhatsAppMessage(subscriber.whatsappJid, content);
    console.log(`[BRIEFING] Sent ${type} briefing to subscriber:${subscriber.id} (${subscriber.whatsappJid})`);

    // Save to message history
    await prisma.message.create({
      data: {
        subscriberId: subscriber.id,
        agentId: agent.id,
        role: 'assistant',
        channel: 'whatsapp',
        content,
      },
    });
  } catch (err) {
    console.error(`[BRIEFING] Failed ${type} briefing for subscriber:${subscriber.id}: ${err.message}`);
    // Remove tracking so it retries next tick
    sentBriefings.delete(trackingKey);
  }
}

/**
 * Check if the current time is within ±90 seconds of the target time.
 * This gives a 3-minute window to account for the 60s check interval.
 *
 * @param {Date} now
 * @param {string} targetTime - e.g. "7:00 AM" or "8:00 PM"
 * @param {string} timezone
 * @returns {boolean}
 */
function isWithinTimeWindow(now, targetTime, timezone) {
  try {
    // Parse target time
    const match = targetTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return false;

    let targetHour = parseInt(match[1], 10);
    const targetMinute = parseInt(match[2], 10);
    const ampm = (match[3] || '').toUpperCase();

    if (ampm === 'PM' && targetHour < 12) targetHour += 12;
    if (ampm === 'AM' && targetHour === 12) targetHour = 0;

    // Get current hour/minute in subscriber's timezone
    const currentHour = parseInt(
      now.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }),
      10,
    );
    const currentMinute = parseInt(
      now.toLocaleString('en-US', { timeZone: timezone, minute: 'numeric' }),
      10,
    );

    // Convert both to minutes since midnight and compare
    const targetMinutes = targetHour * 60 + targetMinute;
    const currentMinutes = currentHour * 60 + currentMinute;

    // Within ±1 minute (check runs every 60s, so 1 minute window is sufficient)
    return Math.abs(currentMinutes - targetMinutes) <= 1;
  } catch {
    return false;
  }
}
