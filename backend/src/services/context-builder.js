import { getTodaySchedule, formatEventsForContext } from './google-calendar.js';
import { getEmailSummary, formatEmailsForContext } from './gmail.js';
import { getPendingReminders, formatRemindersForContext } from './reminders.js';
import { getMemories, formatMemoriesForContext } from './memory.js';

// ─────────────────────────────────────────────────────
// Context Builder
//
// Assembles live context from all data sources
// (Calendar, Gmail, Reminders) into a plain text block
// that gets injected into the SOUL.md system prompt
// via the {{LIVE_CONTEXT}} template variable.
//
// Called on EVERY message — data is always fresh.
// ─────────────────────────────────────────────────────

/**
 * Build the live context string for a subscriber.
 * This is injected into SOUL.md as {{LIVE_CONTEXT}}.
 *
 * @param {object} subscriber - Full subscriber record from Prisma
 * @returns {Promise<string>} Plain text context block
 */
export async function buildLiveContext(subscriber) {
  const sections = [];
  const tz = subscriber.profileData?.timezone || 'America/New_York';

  // ── Current date/time (always included) ──
  sections.push(formatCurrentTime(tz));

  // ── Google Calendar (if connected) ──
  if (subscriber.googleAccessToken && subscriber.googleRefreshToken) {
    try {
      const { events, connected, error } = await getTodaySchedule(subscriber);
      if (!connected) {
        sections.push('📅 Calendar: not connected (connect Google in settings)');
      } else if (error) {
        sections.push('📅 Calendar: unable to fetch right now');
      } else {
        sections.push(formatEventsForContext(events, tz));
      }
    } catch (err) {
      console.error(`[CONTEXT] Calendar error for subscriber:${subscriber.id}: ${err.message || err}`);
      sections.push('📅 Calendar: unable to fetch right now');
    }
  } else {
    sections.push('📅 Calendar: not connected');
  }

  // ── Gmail (if connected) ──
  if (subscriber.googleAccessToken && subscriber.googleRefreshToken) {
    try {
      const { emails, unreadCount, connected, error } = await getEmailSummary(subscriber);
      if (!connected) {
        sections.push('📧 Email: not connected (connect Google in settings)');
      } else if (error) {
        sections.push('📧 Email: unable to fetch right now');
      } else {
        sections.push(formatEmailsForContext(emails, unreadCount));
      }
    } catch (err) {
      console.error(`[CONTEXT] Gmail error for subscriber:${subscriber.id}: ${err.message || err}`);
      sections.push('📧 Email: unable to fetch right now');
    }
  } else {
    sections.push('📧 Email: not connected');
  }

  // ── Reminders (always available — no Google needed) ──
  try {
    const reminders = await getPendingReminders(subscriber.id);
    sections.push(formatRemindersForContext(reminders, tz));
  } catch (err) {
    console.error(`[CONTEXT] Reminders error for subscriber:${subscriber.id}: ${err.message}`);
    sections.push('⏳ Reminders: unable to load');
  }

  // ── Long-term Memory (always available — no Google needed) ──
  try {
    const memories = await getMemories(subscriber.id);
    const memoryContext = formatMemoriesForContext(memories);
    if (memoryContext) {
      sections.push(memoryContext);
    }
  } catch (err) {
    console.error(`[CONTEXT] Memory error for subscriber:${subscriber.id}: ${err.message}`);
    sections.push('🧠 Memory: unable to load');
  }

  const context = sections.join('\n\n');
  console.log(`[CONTEXT] Built for subscriber:${subscriber.id} len:${context.length}`);
  return context;
}

// ── Helpers ──

/**
 * Format the current date and time in the subscriber's timezone.
 */
function formatCurrentTime(timezone) {
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `🕐 RIGHT NOW: ${dateStr}, ${timeStr} (${timezone})`;
  } catch {
    return `🕐 RIGHT NOW: ${new Date().toISOString()}`;
  }
}
