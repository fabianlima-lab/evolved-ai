import { stripHtml } from '../utils/helpers.js';
import prisma from '../lib/prisma.js';

async function subscriberRoutes(app) {
  // POST /api/subscribers/goals — save onboarding goals
  app.post('/goals', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const { goals } = request.body || {};

    if (!goals || (typeof goals !== 'string' && !Array.isArray(goals))) {
      return reply.code(400).send({ error: 'goals is required (string or array)' });
    }

    const goalsStr = Array.isArray(goals)
      ? goals.map((g) => stripHtml(String(g)).slice(0, 100)).join(',')
      : stripHtml(String(goals)).slice(0, 500);

    try {
      await prisma.subscriber.update({
        where: { id: subscriberId },
        data: { goals: goalsStr },
      });

      console.log(`[SUBSCRIBER] goals saved for subscriber:${subscriberId} → ${goalsStr}`);
      return reply.send({ success: true, goals: goalsStr });
    } catch (error) {
      console.error('[ERROR] save goals failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

export default subscriberRoutes;
