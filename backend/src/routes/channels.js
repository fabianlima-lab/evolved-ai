import crypto from 'crypto';
import prisma from '../lib/prisma.js';

// In-memory store for connection codes (short-lived, <10min)
// Maps code → { subscriberId, expiresAt }
const pendingConnections = new Map();

// Clean expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of pendingConnections) {
    if (data.expiresAt < now) {
      pendingConnections.delete(code);
    }
  }
}, 5 * 60 * 1000);

async function channelRoutes(app) {
  // ─────────────────────────────────────────────
  // POST /api/channels/connect/request
  // Generates a 6-digit connection code for the subscriber
  // Subscriber then sends this code to the bot on WhatsApp
  // ─────────────────────────────────────────────
  app.post('/connect/request', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;

    try {
      // Generate 6-digit code
      const code = crypto.randomInt(100000, 999999).toString();

      pendingConnections.set(code, {
        subscriberId,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      console.log(`[CHANNEL] connection code generated for subscriber:${subscriberId}`);

      return reply.send({
        code,
        expires_in: 600, // 10 minutes in seconds
        instructions: `Send this code to the Evolved AI WhatsApp number: ${code}`,
      });
    } catch (error) {
      console.error('[ERROR] connection request failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // ─────────────────────────────────────────────
  // POST /api/channels/connect/verify
  // Called internally when a bot receives a connection code
  // Verifies the code and links WhatsApp to the subscriber
  // ─────────────────────────────────────────────
  app.post('/connect/verify', {
    config: {
      rateLimit: { max: 20, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { code, whatsappJid } = request.body || {};

    if (!code || !whatsappJid) {
      return reply.code(400).send({ error: 'code and whatsappJid are required' });
    }

    try {
      const pending = pendingConnections.get(code);

      if (!pending) {
        return reply.code(404).send({ error: 'Invalid or expired connection code' });
      }

      if (pending.expiresAt < Date.now()) {
        pendingConnections.delete(code);
        return reply.code(410).send({ error: 'Connection code has expired' });
      }

      // Check if this whatsappJid is already linked to another subscriber
      const existing = await prisma.subscriber.findFirst({
        where: { whatsappJid },
      });

      if (existing) {
        if (existing.id !== pending.subscriberId) {
          return reply.code(409).send({
            error: 'This WhatsApp account is already linked to a different subscriber',
          });
        }
        // Already linked to the same subscriber — treat as success
        pendingConnections.delete(code);
        return reply.send({ status: 'already_connected' });
      }

      // Link WhatsApp to subscriber
      await prisma.subscriber.update({
        where: { id: pending.subscriberId },
        data: { whatsappJid },
      });

      pendingConnections.delete(code);

      console.log(`[CHANNEL] connected: whatsapp:${whatsappJid} → subscriber:${pending.subscriberId}`);

      return reply.send({
        status: 'connected',
      });
    } catch (error) {
      console.error('[ERROR] connection verify failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // ─────────────────────────────────────────────
  // DELETE /api/channels/whatsapp
  // Disconnect WhatsApp from the subscriber's account
  // ─────────────────────────────────────────────
  app.delete('/whatsapp', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;

    try {
      const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } });

      if (!subscriber.whatsappJid) {
        return reply.code(404).send({ error: 'WhatsApp not connected' });
      }

      await prisma.subscriber.update({
        where: { id: subscriberId },
        data: { whatsappJid: null },
      });

      console.log(`[CHANNEL] disconnected: whatsapp from subscriber:${subscriberId}`);

      return reply.send({ status: 'disconnected' });
    } catch (error) {
      console.error('[ERROR] channel disconnect failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // ─────────────────────────────────────────────
  // GET /api/channels/status
  // Returns the subscriber's connected channels
  // ─────────────────────────────────────────────
  app.get('/status', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;

    try {
      const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } });

      return reply.send({
        whatsapp_connected: !!subscriber.whatsappJid,
        whatsapp_jid: subscriber.whatsappJid || null,
      });
    } catch (error) {
      console.error('[ERROR] channel status failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

// Export for use by webhook handlers (code verification from bot messages)
export { pendingConnections };
export default channelRoutes;
