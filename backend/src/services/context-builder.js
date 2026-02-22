import { getPendingReminders, formatRemindersForContext } from './reminders.js';

// ─────────────────────────────────────────────────────
// Context Builder
//
// Assembles live context from available data sources
// into a plain text block for the USER.md {{LIVE_CONTEXT}}.
//
// Google Calendar/Gmail/Drive are NOT available as OpenClaw
// plugins, so they are not included here.
// ─────────────────────────────────────────────────────

/**
 * Build the live context string for a subscriber.
 * This is injected into USER.md as {{LIVE_CONTEXT}}.
 *
 * @param {object} subscriber - Full subscriber record from Prisma
 * @returns {Promise<string>} Plain text context block
 */
export async function buildLiveContext(subscriber) {
  const sections = [];
  const tz = subscriber.profileData?.timezone || 'America/New_York';

  // ── Current date/time (always included) ──
  sections.push(formatCurrentTime(tz));

  // ── WhatsApp status ──
  sections.push(`💬 WhatsApp: ${subscriber.whatsappJid ? 'connected' : 'not connected'}`);

  // ── Reminders (always available) ──
  try {
    const reminders = await getPendingReminders(subscriber.id);
    sections.push(formatRemindersForContext(reminders, tz));
  } catch (err) {
    console.error(`[CONTEXT] Reminders error for subscriber:${subscriber.id}: ${err.message}`);
    sections.push('⏳ Reminders: unable to load');
  }

  // Note: Long-term memory is handled natively by OpenClaw (MEMORY.md + SQLite FTS)

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
