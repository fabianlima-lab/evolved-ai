import { readFile } from 'node:fs/promises';
import { isTrialExpired, stripHtml } from '../utils/helpers.js';
import { callOpenClaw, isOpenClawConfigured } from '../services/openclaw-bridge.js';
import env from '../config/env.js';
import prisma from '../lib/prisma.js';

const OPENCLAW_WORKSPACE = env.OPENCLAW_WORKSPACE || process.env.HOME + '/clawd';

/**
 * Read the agent name from the OpenClaw workspace IDENTITY.md.
 * Falls back to the DB agent name or 'Luna' if not found.
 */
async function getAgentNameFromWorkspace(fallback = 'Luna') {
  try {
    const identity = await readFile(`${OPENCLAW_WORKSPACE}/IDENTITY.md`, 'utf-8');
    const match = identity.match(/\*\*Name:\*\*\s*(.+)/);
    if (match && match[1].trim()) return match[1].trim();
  } catch { /* ignore */ }
  return fallback;
}

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

      // ── Route to the SAME OpenClaw session as WhatsApp ──
      // Find the WhatsApp-connected phone number. This ensures the web
      // chat talks to the exact same agent session (same memory, same
      // conversation history) as WhatsApp messages.
      let subscriberPhone = subscriber.whatsappJid?.replace('@s.whatsapp.net', '');

      // If this subscriber doesn't have WhatsApp linked, look for the
      // connected phone on any subscriber (single-tenant: one phone serves all)
      if (!subscriberPhone) {
        const waSubscriber = await prisma.subscriber.findFirst({
          where: { whatsappJid: { not: null } },
          select: { whatsappJid: true },
        });
        subscriberPhone = waSubscriber?.whatsappJid?.replace('@s.whatsapp.net', '') || null;
      }

      // Call OpenClaw directly — no USER.md overwrite.
      // The OpenClaw workspace already has SOUL.md, IDENTITY.md, USER.md
      // managed by the gateway. We just route to the right session.
      const startTime = Date.now();
      const ocResult = await callOpenClaw(cleanMessage, {
        subscriberPhone,
        sessionId: subscriberPhone ? undefined : `sub-${subscriber.id}`,
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

      // Use the workspace agent name (from IDENTITY.md) for consistency
      // with WhatsApp — the DB agent name is just a fallback.
      const agentDisplayName = await getAgentNameFromWorkspace(agent.name);

      return reply.send({
        messages,
        agent: {
          id: agent.id,
          name: agentDisplayName,
        },
      });
    } catch (error) {
      console.error('[ERROR] chat history failed:', error.message);
      return reply.code(500).send({ error: 'Failed to load chat history' });
    }
  });
}

export default chatRoutes;
