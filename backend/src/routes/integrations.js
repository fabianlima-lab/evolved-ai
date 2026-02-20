import { getIntegrations, connectIntegration } from '../services/evolution.js';
import prisma from '../lib/prisma.js';

async function integrationsRoutes(app) {
  // GET /api/integrations — all integrations with status
  app.get('/', {
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

      const integrations = await getIntegrations(agent.id);
      return reply.send(integrations);
    } catch (error) {
      console.error('[ERROR] integrations fetch failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/integrations/:slug/connect — initiate connection
  app.post('/:slug/connect', {
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

      const integration = await connectIntegration(agent.id, subscriberId, slug);

      if (!integration) {
        return reply.code(404).send({ error: 'Integration not found' });
      }

      return reply.send(integration);
    } catch (error) {
      console.error('[ERROR] integration connect failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

export default integrationsRoutes;
