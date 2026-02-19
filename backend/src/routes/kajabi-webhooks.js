import crypto from 'node:crypto';
import env from '../config/env.js';
import prisma from '../lib/prisma.js';
import { onTrialConverted, onPaymentFailed, onCancelled, onReactivated } from '../services/lifecycle.js';

/**
 * Kajabi Webhook Routes
 *
 * Kajabi fires outbound webhooks for:
 *   - order.created      → "Cart Purchase" — subscriber provisioning (trial → active)
 *   - payment.succeeded  → "Payment Succeeded" — recurring payment confirmation
 *   - purchase            → legacy event name (also accepted)
 *
 * Cancellation is handled via the Kajabi API:
 *   - cancel_subscription:purchases scope lets us cancel via API
 *   - Or use Kajabi automations to POST to our cancel endpoint
 *
 * Payload structure (Kajabi sends JSON with top-level id, event, payload):
 *   { id: "hash_id", event: "order.created"|"payment.succeeded"|..., payload: { ... } }
 *
 * All endpoints return 200 to prevent Kajabi retries.
 */

const CANCEL_TAG = 'cancelled';

/**
 * Verify Kajabi webhook signature (HMAC-SHA256).
 * Kajabi sends the signature in the `x-kajabi-signature` header.
 * If KAJABI_WEBHOOK_SECRET is not configured, skip verification (dev mode).
 */
function verifySignature(rawBody, signature) {
  if (!env.KAJABI_WEBHOOK_SECRET) {
    return true; // Skip in dev when secret not configured
  }

  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', env.KAJABI_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex'),
  );
}

async function kajabiWebhookRoutes(app) {
  // Add raw body hook for signature verification
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      req.rawBody = body;
      const json = JSON.parse(body);
      done(null, json);
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // ─────────────────────────────────────────────
  // POST /api/webhooks/kajabi/purchase
  // Fires when a customer completes a Kajabi purchase.
  // Provisions or activates the subscriber.
  // ─────────────────────────────────────────────
  app.post('/purchase', async (request, reply) => {
    try {
      // Verify signature
      if (!verifySignature(request.rawBody, request.headers['x-kajabi-signature'])) {
        console.error('[KAJABI] invalid webhook signature on /purchase');
        return reply.code(200).send({ received: true, error: 'invalid_signature' });
      }

      const { id: eventId, event, payload } = request.body || {};

      // Accept both Kajabi's actual event name and legacy name
      const PURCHASE_EVENTS = ['purchase', 'order.created', 'payment.succeeded'];
      if (!PURCHASE_EVENTS.includes(event)) {
        console.warn(`[KAJABI] unexpected event type on /purchase: ${event}`);
        return reply.code(200).send({ received: true });
      }

      // Extract contact info from payload
      // Kajabi purchase payload contains member info at top level
      const email = payload?.email || payload?.member?.email;
      const name = payload?.name || payload?.first_name
        ? `${payload?.first_name || ''} ${payload?.last_name || ''}`.trim()
        : payload?.member?.name;
      const kajabiContactId = String(payload?.id || payload?.member?.id || eventId);
      const kajabiOfferId = payload?.offer_id ? String(payload.offer_id) : null;

      if (!email) {
        console.error('[KAJABI] purchase webhook missing email', { eventId, payload: JSON.stringify(payload).slice(0, 500) });
        return reply.code(200).send({ received: true, error: 'missing_email' });
      }

      console.log(`[KAJABI] purchase webhook: ${email} (contact: ${kajabiContactId})`);

      // Check if subscriber already exists (by email or kajabiContactId)
      let subscriber = await prisma.subscriber.findFirst({
        where: {
          OR: [
            { email },
            ...(kajabiContactId ? [{ kajabiContactId }] : []),
          ],
        },
      });

      if (subscriber) {
        const wasCancelled = subscriber.tier === 'cancelled';
        const wasTrial = subscriber.tier === 'trial';

        // Existing subscriber — activate
        subscriber = await prisma.subscriber.update({
          where: { id: subscriber.id },
          data: {
            tier: 'active',
            kajabiContactId,
            kajabiOfferId,
            kajabiPurchaseDate: new Date(),
            kajabiCancelDate: null, // Clear any previous cancellation
          },
          include: { agent: true },
        });

        // Reactivate agent if it was deactivated
        if (wasCancelled) {
          await prisma.agent.updateMany({
            where: { subscriberId: subscriber.id, isActive: false },
            data: { isActive: true },
          });
        }

        // Send lifecycle messages
        if (wasCancelled) {
          onReactivated(subscriber).catch((e) => console.error(`[LIFECYCLE] reactivation msg failed: ${e.message}`));
          console.log(`[KAJABI] reactivated subscriber: ${subscriber.id} (${email})`);
        } else if (wasTrial) {
          onTrialConverted(subscriber).catch((e) => console.error(`[LIFECYCLE] conversion msg failed: ${e.message}`));
          console.log(`[KAJABI] trial converted subscriber: ${subscriber.id} (${email})`);
        } else {
          console.log(`[KAJABI] payment confirmed subscriber: ${subscriber.id} (${email})`);
        }
      } else {
        // New subscriber — provision with 3-day trial
        subscriber = await prisma.subscriber.create({
          data: {
            email,
            name: name || null,
            tier: 'trial',
            trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3-day trial
            kajabiContactId,
            kajabiOfferId,
            kajabiPurchaseDate: new Date(),
            onboardingStep: 'pending',
          },
        });

        console.log(`[KAJABI] provisioned new subscriber: ${subscriber.id} (${email})`);
      }

      return reply.code(200).send({
        received: true,
        subscriber_id: subscriber.id,
        status: subscriber.tier,
      });
    } catch (error) {
      console.error('[KAJABI] purchase webhook error:', error.message);
      // Always return 200 to prevent Kajabi retries
      return reply.code(200).send({ received: true, error: 'internal' });
    }
  });

  // ─────────────────────────────────────────────
  // POST /api/webhooks/kajabi/cancel
  // Kajabi doesn't have a native cancellation event.
  // This endpoint handles:
  //   1. Tag-based: Kajabi fires "tag_added" with "cancelled" tag
  //   2. Direct: Manual cancellation via admin or Kajabi automation
  // Always returns 200 to prevent retries.
  // ─────────────────────────────────────────────
  app.post('/cancel', async (request, reply) => {
    try {
      // Verify signature
      if (!verifySignature(request.rawBody, request.headers['x-kajabi-signature'])) {
        console.error('[KAJABI] invalid webhook signature on /cancel');
        return reply.code(200).send({ received: true, error: 'invalid_signature' });
      }

      const { id: eventId, event, payload } = request.body || {};

      // Accept both "tag_added" (with cancelled tag) and direct cancel calls
      const email = payload?.email || payload?.member?.email;
      const kajabiContactId = payload?.id ? String(payload.id) : (payload?.member?.id ? String(payload.member.id) : null);

      if (!email && !kajabiContactId) {
        console.error('[KAJABI] cancel webhook missing identifier', { eventId });
        return reply.code(200).send({ received: true, error: 'missing_identifier' });
      }

      console.log(`[KAJABI] cancel webhook: ${email || kajabiContactId} (event: ${event})`);

      // Find subscriber
      const subscriber = await prisma.subscriber.findFirst({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(kajabiContactId ? [{ kajabiContactId }] : []),
          ],
        },
      });

      if (!subscriber) {
        console.warn(`[KAJABI] cancel webhook — subscriber not found: ${email || kajabiContactId}`);
        return reply.code(200).send({ received: true, error: 'subscriber_not_found' });
      }

      // Send farewell message BEFORE deactivating
      const subWithAgent = await prisma.subscriber.findUnique({
        where: { id: subscriber.id },
        include: { agent: true },
      });
      onCancelled(subWithAgent || subscriber).catch((e) => console.error(`[LIFECYCLE] cancel msg failed: ${e.message}`));

      // Deactivate subscriber
      await prisma.subscriber.update({
        where: { id: subscriber.id },
        data: {
          tier: 'cancelled',
          kajabiCancelDate: new Date(),
        },
      });

      // Deactivate their agent
      await prisma.agent.updateMany({
        where: { subscriberId: subscriber.id, isActive: true },
        data: { isActive: false },
      });

      console.log(`[KAJABI] cancelled subscriber: ${subscriber.id} (${subscriber.email})`);

      return reply.code(200).send({
        received: true,
        subscriber_id: subscriber.id,
        status: 'cancelled',
      });
    } catch (error) {
      console.error('[KAJABI] cancel webhook error:', error.message);
      return reply.code(200).send({ received: true, error: 'internal' });
    }
  });
  // ─────────────────────────────────────────────
  // POST /api/webhooks/kajabi/payment-failed
  // Fires when a recurring payment fails.
  // Sets subscriber to past_due with 7-day grace period.
  // ─────────────────────────────────────────────
  app.post('/payment-failed', async (request, reply) => {
    try {
      if (!verifySignature(request.rawBody, request.headers['x-kajabi-signature'])) {
        console.error('[KAJABI] invalid webhook signature on /payment-failed');
        return reply.code(200).send({ received: true, error: 'invalid_signature' });
      }

      const { payload } = request.body || {};
      const email = payload?.email || payload?.member?.email;
      const kajabiContactId = payload?.id ? String(payload.id) : null;

      if (!email && !kajabiContactId) {
        return reply.code(200).send({ received: true, error: 'missing_identifier' });
      }

      const subscriber = await prisma.subscriber.findFirst({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(kajabiContactId ? [{ kajabiContactId }] : []),
          ],
        },
        include: { agent: true },
      });

      if (!subscriber) {
        return reply.code(200).send({ received: true, error: 'subscriber_not_found' });
      }

      // Set to past_due — agent continues working during 7-day grace
      await prisma.subscriber.update({
        where: { id: subscriber.id },
        data: { tier: 'past_due' },
      });

      // Send payment failed message
      onPaymentFailed(subscriber).catch((e) => console.error(`[LIFECYCLE] payment failed msg: ${e.message}`));

      console.log(`[KAJABI] payment failed for subscriber: ${subscriber.id} (${subscriber.email})`);

      return reply.code(200).send({
        received: true,
        subscriber_id: subscriber.id,
        status: 'past_due',
      });
    } catch (error) {
      console.error('[KAJABI] payment-failed webhook error:', error.message);
      return reply.code(200).send({ received: true, error: 'internal' });
    }
  });
}

export default kajabiWebhookRoutes;
export { verifySignature };
