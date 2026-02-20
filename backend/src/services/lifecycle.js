import prisma from '../lib/prisma.js';
import { sendWhatsAppMessage } from './whatsapp.js';

// ─────────────────────────────────────────────────────
// Subscription Lifecycle Service
//
// Handles lifecycle messages for the AI assistant:
//   - Day 2 check-in during trial
//   - Trial → paid conversion congrats
//   - Payment failed (grace period)
//   - Cancellation farewell
//   - Reactivation welcome-back
//
// Also runs a daily check for trial Day 2 messages.
// ─────────────────────────────────────────────────────

const LIFECYCLE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

// Track sent lifecycle messages to prevent duplicates
// Key: `${subscriberId}_${type}` → timestamp
const sentLifecycle = new Map();

/**
 * Start the lifecycle scheduler.
 * Runs hourly to check for Day 2 trial messages and trial expirations.
 */
export function startLifecycleScheduler() {
  console.log('[STARTUP] Lifecycle scheduler started (checks hourly)');

  // Run immediately on startup, then hourly
  checkTrialLifecycle().catch((err) => {
    console.error(`[LIFECYCLE] Startup check error: ${err.message}`);
  });

  setInterval(async () => {
    try {
      await checkTrialLifecycle();
    } catch (err) {
      console.error(`[LIFECYCLE] Scheduler error: ${err.message}`);
    }
  }, LIFECYCLE_CHECK_INTERVAL_MS);
}

/**
 * Check for trial lifecycle events (Day 2 check-ins, trial expirations).
 */
async function checkTrialLifecycle() {
  const now = new Date();

  // Find all trial subscribers with WhatsApp connected
  const trialSubscribers = await prisma.subscriber.findMany({
    where: {
      tier: 'trial',
      whatsappJid: { not: null },
    },
    include: {
      agent: true,
    },
  });

  for (const sub of trialSubscribers) {
    if (!sub.agent || !sub.agent.isActive) continue;
    const agentName = sub.agent.name || sub.assistantName || 'your assistant';
    const name = sub.profileData?.name || sub.name || 'there';

    // ── Day 2 check-in ──
    const hoursSinceCreation = (now - new Date(sub.createdAt)) / (1000 * 60 * 60);

    if (hoursSinceCreation >= 24 && hoursSinceCreation < 48) {
      await sendLifecycleMessage(sub, 'day2_checkin',
        `Hey ${name}! Hope your first couple days have been helpful. Your full access continues — just wanted you to know I'm here whenever you need me ✨`
      );
    }

    // ── Trial expired without conversion ──
    if (sub.trialEndsAt && new Date(sub.trialEndsAt) < now) {
      await sendLifecycleMessage(sub, 'trial_expired',
        `Hey ${name}, your trial has ended. I've really enjoyed getting to know you. If you'd like to continue, you can resubscribe anytime. I'll remember everything if you come back 💙`
      );

      // Deactivate
      await prisma.subscriber.update({
        where: { id: sub.id },
        data: { tier: 'cancelled' },
      });

      await prisma.agent.updateMany({
        where: { subscriberId: sub.id, isActive: true },
        data: { isActive: false },
      });

      console.log(`[LIFECYCLE] Trial expired for subscriber:${sub.id} — deactivated`);
    }
  }
}

/**
 * Send a lifecycle message (with deduplication).
 */
async function sendLifecycleMessage(subscriber, type, message) {
  const key = `${subscriber.id}_${type}`;

  if (sentLifecycle.has(key)) return; // Already sent
  sentLifecycle.set(key, Date.now());

  if (!subscriber.whatsappJid) return;

  try {
    await sendWhatsAppMessage(subscriber.whatsappJid, message);
    console.log(`[LIFECYCLE] Sent ${type} to subscriber:${subscriber.id}`);

    // Save to message history if agent exists
    const agent = subscriber.agent || subscriber.agents?.[0];
    if (agent) {
      await prisma.message.create({
        data: {
          subscriberId: subscriber.id,
          agentId: agent.id,
          role: 'assistant',
          channel: 'whatsapp',
          content: message,
        },
      });
    }
  } catch (err) {
    console.error(`[LIFECYCLE] Failed to send ${type} to subscriber:${subscriber.id}: ${err.message}`);
    sentLifecycle.delete(key); // Allow retry
  }
}

// ─── Webhook-triggered lifecycle messages ───

/**
 * Handle trial → paid conversion.
 * Called from Kajabi purchase webhook when an existing trial subscriber pays.
 */
export async function onTrialConverted(subscriber) {
  const name = subscriber.profileData?.name || subscriber.name || 'there';

  await sendLifecycleMessage(
    { ...subscriber, agents: subscriber.agent ? [subscriber.agent] : [] },
    'converted',
    `Quick heads up — your trial converted and you're officially a full member. Nothing changes on my end — I'm still here handling everything for you 💙`
  );
}

/**
 * Handle payment failure.
 * Called from Kajabi webhook when payment fails.
 */
export async function onPaymentFailed(subscriber) {
  const name = subscriber.profileData?.name || subscriber.name || 'there';

  await sendLifecycleMessage(
    { ...subscriber, agents: subscriber.agent ? [subscriber.agent] : [] },
    'payment_failed',
    `Hey ${name}, heads up — there was an issue with your payment. I'm still here but wanted to let you know so you can update your billing info. No rush, you've got a few days 💙`
  );
}

/**
 * Handle cancellation.
 * Called from Kajabi cancel webhook.
 */
export async function onCancelled(subscriber) {
  const name = subscriber.profileData?.name || subscriber.name || 'there';

  await sendLifecycleMessage(
    { ...subscriber, agents: subscriber.agent ? [subscriber.agent] : [] },
    'cancelled',
    `I've loved being your chief of staff, ${name}. Your data is saved — if you ever want to come back, I'll remember everything. Take care of yourself ✨`
  );
}

/**
 * Handle reactivation.
 * Called from Kajabi purchase webhook when a cancelled subscriber resubscribes.
 */
export async function onReactivated(subscriber) {
  const name = subscriber.profileData?.name || subscriber.name || 'there';

  await sendLifecycleMessage(
    { ...subscriber, agents: subscriber.agent ? [subscriber.agent] : [] },
    'reactivated',
    `Hey ${name}! I'm back, and I remember everything. Let me pull up where we left off... ✨`
  );
}

// Clean up old tracking entries daily
setInterval(() => {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
  for (const [key, timestamp] of sentLifecycle) {
    if (timestamp < cutoff) sentLifecycle.delete(key);
  }
}, 24 * 60 * 60 * 1000);
