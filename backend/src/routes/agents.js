import { isTrialExpired, getFeaturesByTier, stripHtml } from '../utils/helpers.js';
import { compileSoulMd, buildLiveContext } from '../prompts/soul.js';
import { seedDefaults } from '../services/evolution.js';
import { provisionWorkspace, updateUserContext, deprovisionWorkspace } from '../services/openclaw-provisioner.js';
import prisma from '../lib/prisma.js';

async function agentRoutes(app) {
  // POST /api/agents/deploy
  // Single-agent model: upserts the subscriber's one agent
  // Auto-compiles SOUL.md personality from template + subscriber profile
  app.post('/deploy', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { name, systemPrompt: providedPrompt } = request.body || {};
    const subscriberId = request.user.userId;

    // Name is just a DB label — the AI names itself via WhatsApp conversation.
    // "Assistant" is a neutral placeholder; IDENTITY.md starts with "Luna" which
    // triggers the Level 0 onboarding flow in AGENTS.md.
    const cleanName = name ? stripHtml(String(name)).slice(0, 100) : 'Assistant';

    const FALLBACK_PROMPT = 'You are a helpful personal assistant. Be concise, friendly, and proactive.';

    try {
      const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } });

      // Require WhatsApp connection before deployment
      if (!subscriber.whatsappJid) {
        return reply.code(400).send({ error: 'Connect WhatsApp before deploying your assistant.' });
      }

      // Check trial expiry
      if (isTrialExpired(subscriber)) {
        return reply.code(403).send({ error: 'Trial expired. Upgrade to continue.' });
      }

      // Check if subscriber's tier allows agents
      const features = getFeaturesByTier(subscriber.tier);
      if (features.max_active_agents < 1) {
        return reply.code(403).send({ error: 'Your subscription does not include an active assistant.' });
      }

      // Compile SOUL.md from production template + subscriber profile data
      let soulMd;
      try {
        soulMd = compileSoulMd({
          assistantName: cleanName,
          profileData: subscriber.profileData,
          subscriber,
          liveContext: buildLiveContext(subscriber),
        });
      } catch (err) {
        console.error('[AGENT] SOUL.md compilation failed, using fallback:', err.message);
        soulMd = FALLBACK_PROMPT;
      }

      // Use provided prompt, or compiled SOUL.md, or hardcoded fallback
      const systemPrompt = providedPrompt || soulMd || FALLBACK_PROMPT;

      // Upsert: update existing agent or create new one (1:1 model)
      const existingAgent = await prisma.agent.findUnique({
        where: { subscriberId },
      });

      if (existingAgent) {
        const updated = await prisma.agent.update({
          where: { id: existingAgent.id },
          data: { name: cleanName, systemPrompt, soulMd: soulMd || FALLBACK_PROMPT, isActive: true },
        });

        // Refresh USER.md in existing OpenClaw workspace
        if (updated.openclawAgentId) {
          try {
            await updateUserContext(subscriberId, soulMd || FALLBACK_PROMPT);
          } catch (err) {
            console.error(`[AGENT] OpenClaw context refresh failed (non-fatal): ${err.message}`);
          }
        }

        console.log(`[AGENT] updated: ${updated.id} (${cleanName}) for subscriber:${subscriberId}`);

        return reply.send({
          agent_id: updated.id,
          name: cleanName,
        });
      }

      const agent = await prisma.agent.create({
        data: {
          subscriberId,
          name: cleanName,
          systemPrompt,
          soulMd: soulMd || FALLBACK_PROMPT,
        },
      });

      // Provision isolated OpenClaw workspace for this subscriber
      try {
        // Convert JID to E.164 phone if available
        let phone = null;
        if (subscriber.whatsappJid) {
          const num = subscriber.whatsappJid.replace('@s.whatsapp.net', '');
          phone = num.startsWith('+') ? num : `+${num}`;
        }

        const openclawAgentId = await provisionWorkspace(subscriberId, {
          assistantName: cleanName,
          soulMd: soulMd || FALLBACK_PROMPT,
          whatsappPhone: phone,
        });

        await prisma.agent.update({
          where: { id: agent.id },
          data: { openclawAgentId },
        });

        console.log(`[AGENT] OpenClaw workspace provisioned: ${openclawAgentId}`);
      } catch (err) {
        console.error(`[AGENT] OpenClaw provisioning failed (non-fatal): ${err.message}`);
      }

      // Seed default skills, integrations, and record milestone event
      // Note: Long-term memory is now handled by OpenClaw natively (MEMORY.md)
      try {
        await seedDefaults(agent.id, subscriberId, {
          whatsappConnected: !!subscriber.whatsappJid,
        });
      } catch (err) {
        console.error(`[AGENT] Evolution seeding failed (non-fatal): ${err.message}`);
      }

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

      // Clean up OpenClaw workspace
      if (agent.openclawAgentId) {
        try {
          await deprovisionWorkspace(subscriberId);
        } catch (err) {
          console.error(`[AGENT] OpenClaw deprovisioning failed (non-fatal): ${err.message}`);
        }
      }

      console.log(`[AGENT] deactivated: ${id} for subscriber:${subscriberId}`);

      return reply.send({ status: 'deactivated', agent_id: id });
    } catch (error) {
      console.error('[ERROR] agent deactivate failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

export default agentRoutes;
