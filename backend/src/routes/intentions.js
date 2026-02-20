import { getTodayIntention, setDailyIntention } from '../services/companion.js';

async function intentionsRoutes(app) {
  // GET /api/intention/today — today's daily intention
  app.get('/today', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 60, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;

    try {
      const intention = await getTodayIntention(subscriberId);

      if (!intention) {
        return reply.send({ intention: null });
      }

      return reply.send({
        intention: {
          feeling: intention.feeling,
          source: intention.source,
          optionsOffered: intention.optionsOffered,
          wasCustom: intention.wasCustom,
          setAt: intention.setAt,
        },
      });
    } catch (error) {
      console.error('[ERROR] intention fetch failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/intention — set today's intention
  app.post('/', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const { feeling, source, optionsOffered, wasCustom } = request.body || {};

    if (!feeling) {
      return reply.code(400).send({ error: 'feeling is required' });
    }

    try {
      const intention = await setDailyIntention(subscriberId, {
        feeling: String(feeling).slice(0, 200),
        source,
        optionsOffered,
        wasCustom,
      });

      return reply.send(intention);
    } catch (error) {
      console.error('[ERROR] intention set failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

export default intentionsRoutes;
