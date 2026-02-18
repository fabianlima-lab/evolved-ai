import { getDueReminders, markReminderSent } from './reminders.js';
import { sendWhatsAppMessage } from './whatsapp.js';

// ─────────────────────────────────────────────────────
// Reminder Scheduler
//
// Background loop that checks for due reminders every 60s
// and sends them via WhatsApp. Called once at server startup.
// ─────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds
let intervalHandle = null;

/**
 * Start the reminder scheduler background loop.
 * Call once at server startup (like initBaileys).
 */
export function startReminderScheduler() {
  if (intervalHandle) {
    console.warn('[REMINDER-SCHEDULER] Already running');
    return;
  }

  console.log('[STARTUP] Reminder scheduler started');

  intervalHandle = setInterval(async () => {
    try {
      await processReminders();
    } catch (err) {
      console.error(`[REMINDER-SCHEDULER] Tick error: ${err.message}`);
    }
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the scheduler (for graceful shutdown or testing).
 */
export function stopReminderScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[REMINDER-SCHEDULER] Stopped');
  }
}

/**
 * Process all due reminders — fetch, send, mark as sent.
 */
async function processReminders() {
  const dueReminders = await getDueReminders();

  if (dueReminders.length === 0) return;

  console.log(`[REMINDER-SCHEDULER] Processing ${dueReminders.length} due reminders`);

  for (const reminder of dueReminders) {
    const { subscriber } = reminder;

    if (!subscriber) {
      console.error(`[REMINDER-SCHEDULER] No subscriber for reminder:${reminder.id}`);
      await markReminderSent(reminder.id); // Mark sent to avoid retry loop
      continue;
    }

    // Build the reminder message
    const message = `⏰ Reminder: ${reminder.title}`;

    // Send via WhatsApp if connected
    if (subscriber.whatsappJid) {
      try {
        await sendWhatsAppMessage(subscriber.whatsappJid, message);
        console.log(`[REMINDER-SCHEDULER] Sent to ${subscriber.whatsappJid}: "${reminder.title}"`);
      } catch (err) {
        console.error(`[REMINDER-SCHEDULER] WhatsApp send failed for reminder:${reminder.id}: ${err.message}`);
        // Still mark as sent to avoid infinite retry — the user missed it
      }
    } else {
      console.log(`[REMINDER-SCHEDULER] No WhatsApp for subscriber:${subscriber.id}, skipping reminder:${reminder.id}`);
    }

    // Mark as sent regardless of delivery success
    await markReminderSent(reminder.id);
  }
}
