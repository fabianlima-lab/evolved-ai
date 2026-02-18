import { isTrialExpired, stripHtml } from '../utils/helpers.js';
import { compileSoulMd } from '../prompts/soul.js';
import { callAI, isAIConfigured } from '../services/ai-client.js';
import { buildLiveContext } from '../services/context-builder.js';
import { parseReminderFromText } from '../utils/reminder-parser.js';
import { createReminder } from '../services/reminders.js';
import { parseActions, stripActionTags, hasActions } from '../utils/action-parser.js';
import { executeAllActions } from '../services/action-executor.js';
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

      // Build live context (calendar, email, reminders) — fresh every message
      let liveContext = '';
      try {
        liveContext = await buildLiveContext(subscriber);
      } catch (err) {
        console.error(`[CHAT] Live context build failed: ${err.message}`);
      }

      // Compile SOUL.md FRESH from template + subscriber profile + live context
      // This ensures template updates are immediately reflected
      const FALLBACK_PROMPT = 'You are a helpful personal assistant. Be concise, friendly, and proactive.';
      let systemPrompt;
      try {
        systemPrompt = compileSoulMd({
          assistantName: agent.name,
          profileData: subscriber.profileData,
          subscriber,
          liveContext,
        });
      } catch (err) {
        console.error('[CHAT] SOUL.md compilation failed, using DB fallback:', err.message);
        systemPrompt = agent.soulMd || agent.systemPrompt || FALLBACK_PROMPT;
      }

      // Check for reminder intent in user message (background)
      try {
        const tz = subscriber.profileData?.timezone || 'America/New_York';
        const parsed = parseReminderFromText(cleanMessage, tz);
        if (parsed) {
          await createReminder(subscriberId, {
            title: parsed.title,
            dueAt: parsed.dueAt,
            agentId: agent.id,
          });
        }
      } catch (err) {
        console.error(`[CHAT] Reminder parse/create failed: ${err.message}`);
      }

      const { content, error, tier, model, responseTimeMs } = await callAI(
        systemPrompt,
        conversationHistory,
        { userMessage: cleanMessage },
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

      // Execute any action tags in the AI response
      let finalContent = content;
      if (hasActions(content)) {
        const actions = parseActions(content);
        console.log(`[CHAT:ACTION] Found ${actions.length} action(s):`, actions.map((a) => a.action));

        const { results } = await executeAllActions(actions, subscriber, { agentId: agent.id });

        // Strip action tags from user-facing message
        finalContent = stripActionTags(content);

        // Append error messages from failed actions
        const errors = results.filter((r) => !r.success && r.result);
        if (errors.length > 0) {
          finalContent += '\n\n' + errors.map((e) => e.result).join('\n');
        }

        // Append info results (search results, links, etc.)
        const infoResults = results.filter((r) => r.success && r.result);
        if (infoResults.length > 0) {
          finalContent += '\n\n' + infoResults.map((r) => r.result).join('\n');
        }
      }

      // Save AI response
      await prisma.message.create({
        data: {
          subscriberId,
          agentId: agent.id,
          role: 'assistant',
          channel: 'web',
          content: finalContent,
        },
      });

      console.log(`[CHAT:WEB] agent:${agent.id} tier:${tier} model:${model} time:${responseTimeMs}ms`);

      return reply.send({
        response: finalContent,
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
