import { getCompanion, updateTraits, getTodayIntention, setDailyIntention } from '../services/companion.js';
import prisma from '../lib/prisma.js';

async function companionRoutes(app) {
  // GET /api/companion — full companion profile
  app.get('/', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 60, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;

    try {
      const companion = await getCompanion(subscriberId);

      if (!companion) {
        return reply.code(404).send({ error: 'No active agent found' });
      }

      return reply.send(companion);
    } catch (error) {
      console.error('[ERROR] companion fetch failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/companion/refresh-traits — recalculate traits from usage data
  app.post('/refresh-traits', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;

    try {
      const agent = await prisma.agent.findUnique({
        where: { subscriberId },
      });

      if (!agent) {
        return reply.code(404).send({ error: 'No active agent found' });
      }

      const result = await updateTraits(agent.id, subscriberId);
      return reply.send(result);
    } catch (error) {
      console.error('[ERROR] trait refresh failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

export default companionRoutes;
