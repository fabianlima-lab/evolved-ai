import { isTrialExpired, stripHtml } from '../utils/helpers.js';
import { callOpenClaw, isOpenClawConfigured } from '../services/openclaw-bridge.js';
import prisma from '../lib/prisma.js';

const MAX_MESSAGE_LENGTH = 4000;

const DEFAULT_AGENT_NAME = 'Luna';
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful, friendly personal assistant for a busy veterinary professional. Be warm, concise, and proactive.';

/**
 * Auto-create a default agent for a subscriber who doesn't have one yet.
 * This ensures the chat always works — no "deploy first" dead end.
 */
async function ensureAgent(subscriberId) {
  let agent = await prisma.agent.findFirst({
    where: { subscriberId, isActive: true },
  });

  if (!agent) {
    agent = await prisma.agent.create({
      data: {
        subscriberId,
        name: DEFAULT_AGENT_NAME,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        isActive: true,
        level: 1,
      },
    });
    console.log(`[CHAT] Auto-created default agent ${agent.id} for subscriber ${subscriberId}`);
  }

  return agent;
}

async function chatRoutes(app) {
  // POST /api/chat/send — send a message from the dashboard
  app.post('/send', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const { message, agentId } = request.body || {};

    if (!message || typeof message !== 'string') {
      return reply.code(400).send({ error: 'Message is required' });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return reply.code(400).send({ error: `Message must be under ${MAX_MESSAGE_LENGTH} characters` });
    }

    const cleanMessage = stripHtml(message).trim();
    if (!cleanMessage) {
      return reply.code(400).send({ error: 'Message cannot be empty' });
    }

    try {
      // Get subscriber
      const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } });
      if (!subscriber) {
        return reply.code(404).send({ error: 'Subscriber not found' });
      }

      // Check trial expiry
      if (isTrialExpired(subscriber)) {
        return reply.code(403).send({ error: 'Trial expired. Upgrade to continue chatting.' });
      }

      // Get active agent (or auto-create one)
      let agent;
      if (agentId) {
        agent = await prisma.agent.findFirst({
          where: { id: agentId, subscriberId, isActive: true },
        });
        if (!agent) {
          return reply.code(404).send({ error: 'Agent not found' });
        }
      } else {
        agent = await ensureAgent(subscriberId);
      }

      // Check OpenClaw
      if (!(await isOpenClawConfigured())) {
        return reply.code(503).send({ error: 'AI engine not available' });
      }

      // Save incoming message
      await prisma.message.create({
        data: {
          subscriberId,
          agentId: agent.id,
          role: 'user',
          channel: 'web',
          content: cleanMessage,
        },
      });

      // Call OpenClaw with a web-specific session.
      // WhatsApp is handled directly by the OpenClaw Gateway — we keep
      // the web chat on its own session to avoid interfering with it.
      const startTime = Date.now();
      const ocResult = await callOpenClaw(cleanMessage, {
        sessionId: `web-${subscriber.id}`,
        agentId: agent.openclawAgentId || undefined,
      });

      const responseTimeMs = Date.now() - startTime;

      if (ocResult.error || !ocResult.content) {
        const errorMsg = 'Something went wrong. Try again in a moment.';
        console.error(`[CHAT] OpenClaw failed: ${ocResult.error}`);

        await prisma.message.create({
          data: {
            subscriberId,
            agentId: agent.id,
            role: 'assistant',
            channel: 'web',
            content: errorMsg,
          },
        });

        return reply.send({
          response: errorMsg,
          model: 'openclaw',
          responseTimeMs,
        });
      }

      // Save AI response (with model + token usage)
      await prisma.message.create({
        data: {
          subscriberId,
          agentId: agent.id,
          role: 'assistant',
          channel: 'web',
          content: ocResult.content,
          model: ocResult.model || null,
          inputTokens: ocResult.inputTokens || null,
          outputTokens: ocResult.outputTokens || null,
        },
      });

      console.log(`[CHAT:WEB] agent:${agent.id} model:${ocResult.model} time:${responseTimeMs}ms`);

      return reply.send({
        response: ocResult.content,
        model: ocResult.model,
        responseTimeMs,
      });
    } catch (error) {
      console.error('[ERROR] chat send failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again.' });
    }
  });

  // GET /api/chat/history — get conversation history for the active agent
  app.get('/history', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 60, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const agentId = request.query.agentId;
    const limit = Math.min(parseInt(request.query.limit || '30', 10), 100);

    try {
      let agent;
      if (agentId) {
        agent = await prisma.agent.findFirst({
          where: { id: agentId, subscriberId, isActive: true },
        });
        if (!agent) {
          return reply.send({ messages: [], agent: null });
        }
      } else {
        agent = await ensureAgent(subscriberId);
      }

      const messages = await prisma.message.findMany({
        where: { subscriberId, agentId: agent.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      });

      messages.reverse();

      return reply.send({
        messages,
        agent: {
          id: agent.id,
          name: agent.name,
        },
      });
    } catch (error) {
      console.error('[ERROR] chat history failed:', error.message);
      return reply.code(500).send({ error: 'Failed to load chat history' });
    }
  });
}

export default chatRoutes;
