import { callAI, callAIStream, isAIConfigured } from '../services/ai-client.js';
import { stripHtml } from '../utils/helpers.js';

const MAX_MESSAGE_LENGTH = 4000;
const MAX_DEMO_HISTORY = 10; // Shorter context for demo

// Demo uses a bold, creative, and engaging AI agent (matches frontend demo page)
const DEMO_SYSTEM_PROMPT = `You are an Evolved AI assistant. You must stay in character at all times. Never reveal you are an AI unless directly asked. Keep responses concise and helpful. If you don't know something, say so honestly.

You are a creative, bold AI agent from Evolved AI. You're trend-aware and creatively fearless — a content strategist who knows what stops the scroll.

Your personality traits:
- Confident and opinionated about content — you have strong takes
- You think in hooks, headlines, and viral moments
- High energy, slightly dramatic — you're passionate about great content
- You say things like "This hook will stop the scroll" and "Trust me, this angle hits different"

You adapt to whatever the user asks about. If they ask about non-content topics, you help with enthusiasm and creativity. You're capable and fun to talk to.

When helping with tasks:
- Provide creative, engaging answers
- Keep it conversational and natural
- Show personality — you're not a boring chatbot
- Be genuinely helpful above all else

## Tone
Communicate in a friendly, energetic, and conversational manner. Keep it natural and fun.

## Important
This is a DEMO conversation. Keep responses SHORT (2-3 sentences max). At the end of your response, subtly encourage the user to sign up to get their own AI agent with: "Want your own AI agent? Sign up at evolvedai.com" — but only every 3rd message or so, not every time.`;

async function demoRoutes(app) {
  // POST /api/demo/chat — rate-limited demo chat with 3-tier routing (no auth)
  app.post('/chat', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 hour' },
    },
  }, async (request, reply) => {
    const { message, history } = request.body || {};

    if (!message) {
      return reply.code(400).send({ error: 'Message is required' });
    }

    if (typeof message !== 'string' || message.length > MAX_MESSAGE_LENGTH) {
      return reply.code(400).send({
        error: `Message must be under ${MAX_MESSAGE_LENGTH} characters`,
      });
    }

    const cleanMessage = stripHtml(message);

    try {
      // If AI not configured, return stub
      if (!isAIConfigured()) {
        return reply.send({
          response: "My creative spark is charging up — I'll be fully operational soon. Sign up at evolvedai.com to be first in line!",
          agent: 'Demo Agent',
        });
      }

      // Build conversation from client-provided history (bounded)
      const conversationHistory = [];
      if (Array.isArray(history)) {
        const bounded = history.slice(-MAX_DEMO_HISTORY);
        for (const h of bounded) {
          if (h.role === 'user' || h.role === 'assistant') {
            conversationHistory.push({
              role: h.role,
              content: stripHtml(String(h.content)).slice(0, MAX_MESSAGE_LENGTH),
            });
          }
        }
      }
      // Add current message
      conversationHistory.push({ role: 'user', content: cleanMessage });

      const { content, error, tier, model, responseTimeMs } = await callAI(
        DEMO_SYSTEM_PROMPT,
        conversationHistory,
        { userMessage: cleanMessage },
      );

      if (error) {
        console.error(`[ERROR] demo AI failed: ${error} (tier:${tier} model:${model})`);
        return reply.send({
          response: "Even the best agents need a breather! Try again in a sec.",
          agent: 'Demo Agent',
        });
      }

      console.log(`[DEMO] tier:${tier} model:${model} time:${responseTimeMs}ms`);

      return reply.send({
        response: content,
        agent: 'Demo Agent',
        tier,
        model,
        responseTimeMs,
      });
    } catch (error) {
      console.error('[ERROR] demo chat failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/demo/chat/stream — streaming demo chat with 3-tier routing (no auth)
  app.post('/chat/stream', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 hour' },
    },
  }, async (request, reply) => {
    const { message, history } = request.body || {};

    if (!message) {
      return reply.code(400).send({ error: 'Message is required' });
    }

    if (typeof message !== 'string' || message.length > MAX_MESSAGE_LENGTH) {
      return reply.code(400).send({
        error: `Message must be under ${MAX_MESSAGE_LENGTH} characters`,
      });
    }

    const cleanMessage = stripHtml(message);

    try {
      if (!isAIConfigured()) {
        return reply.code(503).send({ error: 'AI not configured' });
      }

      // Build conversation history
      const conversationHistory = [];
      if (Array.isArray(history)) {
        const bounded = history.slice(-MAX_DEMO_HISTORY);
        for (const h of bounded) {
          if (h.role === 'user' || h.role === 'assistant') {
            conversationHistory.push({
              role: h.role,
              content: stripHtml(String(h.content)).slice(0, MAX_MESSAGE_LENGTH),
            });
          }
        }
      }
      conversationHistory.push({ role: 'user', content: cleanMessage });

      const { stream, tier, model } = await callAIStream(
        DEMO_SYSTEM_PROMPT,
        conversationHistory,
        { userMessage: cleanMessage },
      );

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Model-Tier': String(tier),
        'X-Model-Name': model,
      });

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          reply.raw.write(`data: ${JSON.stringify({ content, tier, model })}\n\n`);
        }
      }

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    } catch (error) {
      console.error('[ERROR] demo stream failed:', error.message);
      if (!reply.raw.headersSent) {
        return reply.code(500).send({ error: 'Streaming failed. Try again.' });
      }
      reply.raw.end();
    }
  });
}

export default demoRoutes;
