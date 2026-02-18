import prisma from '../lib/prisma.js';

// ─────────────────────────────────────────────────────
// Reminder Service
//
// CRUD operations for user reminders.
// Reminders don't need Google — they're stored in our DB
// and sent via WhatsApp when due.
// ─────────────────────────────────────────────────────

/**
 * Create a new reminder.
 *
 * @param {string} subscriberId
 * @param {object} data
 * @param {string} data.title - What to remind about
 * @param {Date} data.dueAt - When the reminder is due
 * @param {string} [data.channel='whatsapp'] - Delivery channel
 * @param {string} [data.agentId] - Associated agent
 * @returns {Promise<object>} Created reminder record
 */
export async function createReminder(subscriberId, { title, dueAt, channel = 'whatsapp', agentId = null }) {
  const reminder = await prisma.reminder.create({
    data: {
      subscriberId,
      agentId,
      title,
      dueAt,
      channel,
      status: 'pending',
    },
  });

  console.log(`[REMINDER] Created: "${title}" due ${dueAt.toISOString()} for subscriber:${subscriberId}`);
  return reminder;
}

/**
 * Get pending (upcoming) reminders for a subscriber.
 *
 * @param {string} subscriberId
 * @param {number} [limit=10]
 * @returns {Promise<Array>}
 */
export async function getPendingReminders(subscriberId, limit = 10) {
  return prisma.reminder.findMany({
    where: {
      subscriberId,
      status: 'pending',
    },
    orderBy: { dueAt: 'asc' },
    take: limit,
  });
}

/**
 * Get all reminders that are due (past their dueAt) and still pending.
 * Used by the scheduler to find reminders that need to be sent.
 *
 * @returns {Promise<Array>} Reminders with subscriber included
 */
export async function getDueReminders() {
  return prisma.reminder.findMany({
    where: {
      status: 'pending',
      dueAt: { lte: new Date() },
    },
    include: {
      subscriber: true,
    },
    orderBy: { dueAt: 'asc' },
    take: 50, // Safety limit per tick
  });
}

/**
 * Mark a reminder as sent.
 *
 * @param {string} reminderId
 * @returns {Promise<object>}
 */
export async function markReminderSent(reminderId) {
  return prisma.reminder.update({
    where: { id: reminderId },
    data: { status: 'sent' },
  });
}

/**
 * Dismiss a reminder (user chose to cancel it).
 *
 * @param {string} reminderId
 * @param {string} subscriberId - For ownership validation
 * @returns {Promise<object|null>}
 */
export async function dismissReminder(reminderId, subscriberId) {
  return prisma.reminder.updateMany({
    where: {
      id: reminderId,
      subscriberId,
      status: 'pending',
    },
    data: { status: 'dismissed' },
  });
}

/**
 * Format pending reminders as plain text for the SOUL.md context.
 *
 * @param {Array} reminders - Array of reminder records
 * @param {string} [timezone='America/New_York']
 * @returns {string}
 */
export function formatRemindersForContext(reminders, timezone = 'America/New_York') {
  if (!reminders || reminders.length === 0) {
    return '⏳ No upcoming reminders';
  }

  const lines = reminders.map((r) => {
    const dueStr = formatDueDate(r.dueAt, timezone);
    return `- ${r.title} (due: ${dueStr})`;
  });

  return `⏳ UPCOMING REMINDERS:\n${lines.join('\n')}`;
}

// ── Helpers ──

/**
 * Format a due date as a human-friendly relative string.
 * "today at 3pm", "tomorrow", "March 12", "Thursday"
 */
function formatDueDate(dueAt, timezone = 'America/New_York') {
  try {
    const due = new Date(dueAt);
    const now = new Date();

    // Get dates in the subscriber's timezone
    const dueDate = due.toLocaleDateString('en-US', { timeZone: timezone });
    const todayDate = now.toLocaleDateString('en-US', { timeZone: timezone });
    const tomorrowDate = new Date(now.getTime() + 86400000).toLocaleDateString('en-US', { timeZone: timezone });

    const timeStr = due.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (dueDate === todayDate) {
      return `today at ${timeStr}`;
    }
    if (dueDate === tomorrowDate) {
      return `tomorrow at ${timeStr}`;
    }

    // Within the next 7 days — show day name
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000);
    if (diffDays <= 7 && diffDays > 0) {
      const dayName = due.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'long' });
      return dayName;
    }

    // Further out — show month + day
    return due.toLocaleDateString('en-US', {
      timeZone: timezone,
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dueAt.toString();
  }
}
