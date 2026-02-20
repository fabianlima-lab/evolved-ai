import { isTrialExpired, stripHtml } from '../utils/helpers.js';
import { compileSoulMd } from '../prompts/soul.js';
import { callOpenClawWithContext, isOpenClawConfigured } from '../services/openclaw-bridge.js';
import { buildLiveContext } from '../services/context-builder.js';
import prisma from '../lib/prisma.js';

const MAX_MESSAGE_LENGTH = 4000;

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

      // Get active agent
      const whereClause = agentId
        ? { id: agentId, subscriberId, isActive: true }
        : { subscriberId, isActive: true };

      const agent = await prisma.agent.findFirst({ where: whereClause });

      if (!agent) {
        return reply.code(404).send({ error: 'No active agent found. Deploy one first.' });
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

      // Load conversation history (last 20 messages)
      const recentMessages = await prisma.message.findMany({
        where: { subscriberId, agentId: agent.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const conversationHistory = recentMessages.reverse().map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Build live context (calendar, email, reminders)
      let liveContext = '';
      try {
        liveContext = await buildLiveContext(subscriber);
      } catch (err) {
        console.error(`[CHAT] Live context build failed: ${err.message}`);
      }

      // Compile system prompt (USER.md for OpenClaw)
      let systemPrompt;
      try {
        systemPrompt = compileSoulMd({
          assistantName: agent.name,
          profileData: subscriber.profileData,
          subscriber,
          liveContext,
        });
      } catch (err) {
        console.error('[CHAT] SOUL.md compilation failed:', err.message);
        systemPrompt = 'You are a helpful personal assistant.';
      }

      // Call OpenClaw
      const startTime = Date.now();
      const ocResult = await callOpenClawWithContext(
        systemPrompt,
        conversationHistory,
        {
          userMessage: cleanMessage,
          subscriberPhone: subscriber.whatsappJid?.replace('@s.whatsapp.net', ''),
          sessionId: `sub-${subscriber.id}`,
        },
      );

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

      // Save AI response
      await prisma.message.create({
        data: {
          subscriberId,
          agentId: agent.id,
          role: 'assistant',
          channel: 'web',
          content: ocResult.content,
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
      const whereClause = agentId
        ? { id: agentId, subscriberId, isActive: true }
        : { subscriberId, isActive: true };

      const agent = await prisma.agent.findFirst({ where: whereClause });

      if (!agent) {
        return reply.send({ messages: [], agent: null });
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
