import { isTrialExpired, getFeaturesByTier, stripHtml } from '../utils/helpers.js';
import prisma from '../lib/prisma.js';

async function agentRoutes(app) {
  // POST /api/agents/deploy
  app.post('/deploy', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { name, systemPrompt } = request.body || {};
    const subscriberId = request.user.userId;

    if (!name) {
      return reply.code(400).send({ error: 'name is required' });
    }

    if (!systemPrompt) {
      return reply.code(400).send({ error: 'systemPrompt is required' });
    }

    const cleanName = stripHtml(String(name)).slice(0, 100);

    try {
      const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } });

      // Check trial expiry
      if (isTrialExpired(subscriber)) {
        return reply.code(403).send({ error: 'Trial expired. Upgrade to continue.' });
      }

      const features = getFeaturesByTier(subscriber.tier);

      // Check active agent limit
      const activeCount = await prisma.agent.count({
        where: { subscriberId, isActive: true },
      });
      if (activeCount >= features.max_active_agents) {
        // Deactivate oldest agents if at limit
        await prisma.agent.updateMany({
          where: { subscriberId, isActive: true },
          data: { isActive: false },
        });
      }

      const agent = await prisma.agent.create({
        data: {
          subscriberId,
          name: cleanName,
          systemPrompt,
        },
      });

      console.log(`[AGENT] deployed: ${agent.id} (${cleanName}) for subscriber:${subscriberId}`);

      return reply.code(201).send({
        agent_id: agent.id,
        name: cleanName,
      });
    } catch (error) {
      console.error('[ERROR] agent deploy failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // GET /api/agents/mine
  app.get('/mine', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;

    try {
      const agents = await prisma.agent.findMany({
        where: { subscriberId, isActive: true },
        take: 10,
      });

      if (agents.length === 0) {
        return reply.code(404).send({ error: 'No active agents found' });
      }

      return reply.send(agents);
    } catch (error) {
      console.error('[ERROR] agent fetch failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // PATCH /api/agents/:id
  app.patch('/:id', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, systemPrompt } = request.body || {};
    const subscriberId = request.user.userId;

    try {
      const agent = await prisma.agent.findFirst({
        where: { id, subscriberId },
      });

      if (!agent) {
        return reply.code(404).send({ error: 'Agent not found' });
      }

      const updateData = {};
      if (name !== undefined) {
        updateData.name = stripHtml(String(name)).slice(0, 100);
      }
      if (systemPrompt !== undefined) {
        updateData.systemPrompt = systemPrompt;
      }

      const updated = await prisma.agent.update({
        where: { id },
        data: updateData,
      });

      return reply.send(updated);
    } catch (error) {
      console.error('[ERROR] agent update failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/agents/:id/restart — clear conversation history
  app.post('/:id/restart', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const subscriberId = request.user.userId;

    try {
      const agent = await prisma.agent.findFirst({
        where: { id, subscriberId },
      });

      if (!agent) {
        return reply.code(404).send({ error: 'Agent not found' });
      }

      // Delete conversation history for this agent
      await prisma.message.deleteMany({
        where: { subscriberId, agentId: agent.id },
      });

      console.log(`[AGENT] restarted: ${id} for subscriber:${subscriberId}`);

      return reply.send({ status: 'restarted', agent_id: id });
    } catch (error) {
      console.error('[ERROR] agent restart failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // DELETE /api/agents/:id — deactivate agent
  app.delete('/:id', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const subscriberId = request.user.userId;

    try {
      const agent = await prisma.agent.findFirst({
        where: { id, subscriberId },
      });

      if (!agent) {
        return reply.code(404).send({ error: 'Agent not found' });
      }

      await prisma.agent.update({
        where: { id },
        data: { isActive: false },
      });

      console.log(`[AGENT] deactivated: ${id} for subscriber:${subscriberId}`);

      return reply.send({ status: 'deactivated', agent_id: id });
    } catch (error) {
      console.error('[ERROR] agent deactivate failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

export default agentRoutes;
