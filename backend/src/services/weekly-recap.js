// ─────────────────────────────────────────────────────
// Weekly Recap Scheduler
//
// Sends a weekly recap message every Sunday at 7 PM
// to each active subscriber via WhatsApp.
//
// Recap includes:
//   - Number of messages exchanged
//   - Actions taken (events created, emails sent, etc.)
//   - Reminders completed
//   - Memories saved
//   - Encouraging note for the week ahead
// ─────────────────────────────────────────────────────

import prisma from '../lib/prisma.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { getCurrentDayOfWeek, getCurrentHour, isQuietHours } from '../utils/quiet-hours.js';

const WEEKLY_RECAP_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

// Track sent recaps to prevent duplicates
const sentRecaps = new Map();

/**
 * Start the weekly recap scheduler.
 * Checks every hour if it's Sunday 7 PM in any subscriber's timezone.
 */
export function startWeeklyRecapScheduler() {
  console.log('[WEEKLY-RECAP] Starting weekly recap scheduler (checks hourly)');

  setInterval(async () => {
    try {
      await checkAndSendRecaps();
    } catch (err) {
      console.error(`[WEEKLY-RECAP] Scheduler error: ${err.message}`);
    }
  }, WEEKLY_RECAP_INTERVAL_MS);
}

/**
 * Check if it's recap time and send to eligible subscribers.
 * Now timezone-aware: checks each subscriber's timezone individually.
 */
async function checkAndSendRecaps() {
  const subscribers = await prisma.subscriber.findMany({
    where: {
      whatsappJid: { not: null },
      tier: { in: ['trial', 'active', 'past_due'] },
    },
    include: {
      agents: { where: { isActive: true }, take: 1 },
    },
  });

  for (const sub of subscribers) {
    if (!sub.agents[0]) continue;

    const tz = sub.profileData?.timezone || 'America/New_York';

    // Check if it's Sunday 7PM in THEIR timezone
    const dayInTz = getCurrentDayOfWeek(tz);
    const hourInTz = getCurrentHour(tz);

    if (dayInTz !== 0 || hourInTz !== 19) continue; // Only Sunday at 7 PM local

    // Don't send during quiet hours
    if (isQuietHours(tz)) continue;

    // Dedup: one recap per subscriber per week
    const weekKey = `${sub.id}_${new Date().toISOString().slice(0, 10)}`;
    if (sentRecaps.has(weekKey)) continue;
    sentRecaps.set(weekKey, Date.now());

    try {
      const recap = await buildRecap(sub, sub.agents[0]);
      if (recap) {
        await sendWhatsAppMessage(sub.whatsappJid, recap);
        console.log(`[WEEKLY-RECAP] Sent recap to subscriber:${sub.id} (tz:${tz})`);
      }
    } catch (err) {
      console.error(`[WEEKLY-RECAP] Error for subscriber:${sub.id}: ${err.message}`);
      sentRecaps.delete(weekKey); // Allow retry
    }
  }

  // Clean old tracking entries
  const cutoff = Date.now() - 8 * 24 * 60 * 60 * 1000;
  for (const [key, ts] of sentRecaps) {
    if (ts < cutoff) sentRecaps.delete(key);
  }
}

/**
 * Build a weekly recap message for a subscriber.
 */
async function buildRecap(subscriber, agent) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const name = subscriber.profileData?.name || subscriber.name || 'there';
  const assistantName = agent.name || 'Luna';

  // Count messages this week
  const messageCount = await prisma.message.count({
    where: {
      subscriberId: subscriber.id,
      createdAt: { gte: oneWeekAgo },
    },
  });

  if (messageCount === 0) {
    return `Hey ${name}! 👋 We didn't chat much this week. I'm here whenever you need me — just text! ✨`;
  }

  // Count user vs assistant messages
  const userMessages = await prisma.message.count({
    where: {
      subscriberId: subscriber.id,
      role: 'user',
      createdAt: { gte: oneWeekAgo },
    },
  });

  // Count reminders created
  const remindersCreated = await prisma.reminder.count({
    where: {
      subscriberId: subscriber.id,
      createdAt: { gte: oneWeekAgo },
    },
  });

  // Count memories saved
  const memoriesSaved = await prisma.memory.count({
    where: {
      subscriberId: subscriber.id,
      createdAt: { gte: oneWeekAgo },
    },
  });

  // Build the recap
  let recap = `✨ Your week with ${assistantName}\n\n`;
  recap += `💬 ${messageCount} messages exchanged\n`;

  if (remindersCreated > 0) {
    recap += `⏳ ${remindersCreated} reminder${remindersCreated > 1 ? 's' : ''} set\n`;
  }

  if (memoriesSaved > 0) {
    recap += `🧠 ${memoriesSaved} thing${memoriesSaved > 1 ? 's' : ''} I remembered about you\n`;
  }

  recap += `\nHave an amazing week ahead! 💙`;

  return recap;
}

export { buildRecap };
