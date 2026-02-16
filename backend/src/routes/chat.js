import { isTrialExpired, getFeaturesByTier, stripHtml } from '../utils/helpers.js';
import { callAI, isAIConfigured } from '../services/ai-client.js';
import prisma from '../lib/prisma.js';

const MAX_MESSAGE_LENGTH = 4000;

// User-friendly error messages
const ERROR_MESSAGES = {
  ai_not_configured: "My AI connection is being set up. Check back shortly!",
  timeout: "I timed out on that one. Could you try again?",
  rate_limited: "I'm getting a lot of requests. Give me a moment.",
  auth_failed: "There's an issue with my connection. Try again later.",
  server_error: "The AI service is temporarily down. Try again in a few minutes.",
  empty_response: "I drew a blank. Could you rephrase?",
  empty_content: "I drew a blank. Could you rephrase?",
  unknown: "Something went wrong. Try again in a moment.",
};

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

      // Get active agent (use specified agentId or default to active)
      const whereClause = agentId
        ? { id: agentId, subscriberId, isActive: true }
        : { subscriberId, isActive: true };

      const agent = await prisma.agent.findFirst({
        where: whereClause,
      });

      if (!agent) {
        return reply.code(404).send({ error: 'No active agent found. Deploy one first.' });
      }

      // Check AI config
      if (!isAIConfigured()) {
        return reply.code(503).send({ error: 'AI not configured' });
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

      // Call AI with 3-tier routing
      const features = getFeaturesByTier(subscriber.tier);
      const { content, error, tier, model, responseTimeMs } = await callAI(
        agent.systemPrompt,
        conversationHistory,
        { webSearch: features.web_search, userMessage: cleanMessage },
      );

      if (error) {
        console.error(`[ERROR] chat AI failed for agent:${agent.id} - ${error} (tier:${tier})`);
        const errorMsg = ERROR_MESSAGES[error] || ERROR_MESSAGES.unknown;

        // Still save the error response so it appears in history
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
          tier,
          model,
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
          content,
        },
      });

      console.log(`[CHAT:WEB] agent:${agent.id} tier:${tier} model:${model} time:${responseTimeMs}ms`);

      return reply.send({
        response: content,
        tier,
        model,
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
      // Get active agent
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

      // Reverse to chronological order
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
