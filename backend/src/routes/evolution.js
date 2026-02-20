import { getEvolutionTimeline, getSkills, activateSkill } from '../services/evolution.js';
import prisma from '../lib/prisma.js';

async function evolutionRoutes(app) {
  // GET /api/evolution/timeline — agent journey events
  app.get('/timeline', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 60, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);
    const offset = parseInt(request.query.offset || '0', 10);

    try {
      const agent = await prisma.agent.findUnique({
        where: { subscriberId },
      });

      if (!agent) {
        return reply.code(404).send({ error: 'No active agent found' });
      }

      const events = await getEvolutionTimeline(agent.id, { limit, offset });
      return reply.send(events);
    } catch (error) {
      console.error('[ERROR] evolution timeline failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // GET /api/evolution/skills — all skills (active + available)
  app.get('/skills', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 60, timeWindow: '1 minute' },
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

      const skills = await getSkills(agent.id);
      return reply.send(skills);
    } catch (error) {
      console.error('[ERROR] evolution skills failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/evolution/skills/:slug/activate — activate a skill
  app.post('/skills/:slug/activate', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const { slug } = request.params;

    try {
      const agent = await prisma.agent.findUnique({
        where: { subscriberId },
      });

      if (!agent) {
        return reply.code(404).send({ error: 'No active agent found' });
      }

      const skill = await activateSkill(agent.id, subscriberId, slug);

      if (!skill) {
        return reply.code(404).send({ error: 'Skill not found' });
      }

      return reply.send(skill);
    } catch (error) {
      console.error('[ERROR] skill activation failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

export default evolutionRoutes;
