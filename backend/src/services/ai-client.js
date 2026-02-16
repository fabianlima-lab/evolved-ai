import OpenAI from 'openai';
import env from '../config/env.js';
import { MODEL_TIERS, FALLBACK_CHAIN, NVIDIA_BASE_URL } from '../config/models.js';
import { classifyQuery } from '../utils/query-analyzer.js';

// ─────────────────────────────────────────────────────
// 3-Tier AI Client via NVIDIA NIMs (OpenAI-compatible)
// ─────────────────────────────────────────────────────

/** Reusable OpenAI client (one per process) */
let client = null;

function getClient() {
  if (!client) {
    if (!env.NVIDIA_API_KEY || env.NVIDIA_API_KEY === 'nvapi-xxx') {
      return null;
    }
    client = new OpenAI({
      baseURL: NVIDIA_BASE_URL,
      apiKey: env.NVIDIA_API_KEY,
      timeout: 60000, // max timeout, per-request timeout handled below
    });
  }
  return client;
}

/**
 * Call the AI with intelligent tier routing.
 *
 * Classifies the user's latest message, selects the right model tier,
 * and falls back to the next tier on failure.
 *
 * @param {string} systemPrompt - Agent system prompt
 * @param {Array<{role: string, content: string}>} conversationHistory - Recent messages
 * @param {object} options
 * @param {boolean} [options.webSearch=false] - Enable web search tool (Tier 3 only)
 * @param {string} [options.userMessage] - The latest user message (for routing). If omitted, uses last message in history.
 * @returns {Promise<{content: string, error: string|null, tier: number, model: string, responseTimeMs: number}>}
 */
export async function callAI(systemPrompt, conversationHistory, options = {}) {
  const ai = getClient();

  if (!ai) {
    console.error('[ERROR] AI client not configured — NVIDIA_API_KEY missing');
    return { content: null, error: 'ai_not_configured', tier: 0, model: null, responseTimeMs: 0 };
  }

  // Determine which message to classify
  const userMessage = options.userMessage
    || conversationHistory.filter((m) => m.role === 'user').pop()?.content
    || '';

  const { tier, reason } = classifyQuery(userMessage);
  console.log(`[ROUTING] tier:${tier} reason:"${reason}" msg:"${userMessage.slice(0, 60)}"`);

  // Try the selected tier, then fall back through the chain
  return callWithFallback(ai, tier, systemPrompt, conversationHistory, options);
}

/**
 * Attempt to call the selected tier's model, falling back on failure.
 */
async function callWithFallback(ai, tier, systemPrompt, conversationHistory, options, attempt = 1) {
  const tierConfig = MODEL_TIERS[tier];
  if (!tierConfig) {
    return { content: null, error: 'invalid_tier', tier, model: null, responseTimeMs: 0 };
  }

  const startTime = Date.now();

  try {
    const result = await callModel(ai, tierConfig, systemPrompt, conversationHistory, options);
    const responseTimeMs = Date.now() - startTime;

    if (result.error) {
      console.error(`[ERROR] Tier ${tier} (${tierConfig.model}) failed: ${result.error}`);

      // Try fallback
      const nextTier = FALLBACK_CHAIN[tier];
      if (nextTier && attempt <= 3) {
        console.log(`[ROUTING] Falling back: tier ${tier} → tier ${nextTier}`);
        return callWithFallback(ai, nextTier, systemPrompt, conversationHistory, options, attempt + 1);
      }

      return { ...result, tier, model: tierConfig.model, responseTimeMs };
    }

    console.log(`[ROUTING] ✓ tier:${tier} model:${tierConfig.model} time:${responseTimeMs}ms`);
    return { ...result, tier, model: tierConfig.model, responseTimeMs };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorType = categorizeError(error);
    console.error(`[ERROR] Tier ${tier} (${tierConfig.model}) exception: ${errorType} - ${error.message}`);

    // Try fallback
    const nextTier = FALLBACK_CHAIN[tier];
    if (nextTier && attempt <= 3) {
      console.log(`[ROUTING] Falling back: tier ${tier} → tier ${nextTier}`);
      return callWithFallback(ai, nextTier, systemPrompt, conversationHistory, options, attempt + 1);
    }

    return { content: null, error: errorType, tier, model: tierConfig.model, responseTimeMs };
  }
}

/**
 * Call a specific model with the given tier configuration.
 */
async function callModel(ai, tierConfig, systemPrompt, conversationHistory, options = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];

  const requestParams = {
    model: tierConfig.model,
    messages,
    max_tokens: tierConfig.maxTokens,
    temperature: tierConfig.temperature,
  };

  // Kimi K2.5 instant mode (thinking: false)
  if (tierConfig.extraBody) {
    requestParams.extra_body = tierConfig.extraBody;
  }

  // Web search tool — only for Tier 3 (Kimi supports it)
  if (options.webSearch && tierConfig.model === 'moonshotai/kimi-k2.5') {
    requestParams.tools = [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for current information',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
            },
            required: ['query'],
          },
        },
      },
    ];
  }

  const response = await ai.chat.completions.create(requestParams);

  const choice = response.choices?.[0];
  if (!choice || !choice.message) {
    return { content: null, error: 'empty_response' };
  }

  // Handle tool calls (web search) — auto-handle the search loop
  if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
    return handleToolCalls(ai, messages, choice.message, requestParams);
  }

  const content = choice.message.content;
  if (!content || content.trim().length === 0) {
    return { content: null, error: 'empty_content' };
  }

  return { content: content.trim(), error: null };
}

/**
 * Stream a response from the AI for the demo/frontend endpoint.
 *
 * @param {string} systemPrompt
 * @param {Array} conversationHistory
 * @param {object} options
 * @param {string} [options.userMessage] - For routing classification
 * @returns {Promise<{stream: AsyncIterable, tier: number, model: string}>}
 */
export async function callAIStream(systemPrompt, conversationHistory, options = {}) {
  const ai = getClient();

  if (!ai) {
    throw new Error('AI client not configured');
  }

  const userMessage = options.userMessage
    || conversationHistory.filter((m) => m.role === 'user').pop()?.content
    || '';

  const { tier, reason } = classifyQuery(userMessage);
  const tierConfig = MODEL_TIERS[tier];

  console.log(`[ROUTING:STREAM] tier:${tier} reason:"${reason}" model:${tierConfig.model}`);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];

  const requestParams = {
    model: tierConfig.model,
    messages,
    max_tokens: tierConfig.maxTokens,
    temperature: tierConfig.temperature,
    stream: true,
  };

  if (tierConfig.extraBody) {
    requestParams.extra_body = tierConfig.extraBody;
  }

  const stream = await ai.chat.completions.create(requestParams);

  return { stream, tier, model: tierConfig.model };
}

/**
 * Handle tool calls from the AI (e.g., web search).
 */
async function handleToolCalls(ai, originalMessages, assistantMessage, requestParams) {
  try {
    const toolResults = assistantMessage.tool_calls.map((tc) => ({
      role: 'tool',
      tool_call_id: tc.id,
      content: JSON.stringify({
        note: 'Web search executed by the model internally.',
      }),
    }));

    const followUpMessages = [
      ...originalMessages,
      assistantMessage,
      ...toolResults,
    ];

    const followUp = await ai.chat.completions.create({
      ...requestParams,
      messages: followUpMessages,
    });

    const content = followUp.choices?.[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      return { content: null, error: 'empty_tool_response' };
    }

    return { content: content.trim(), error: null };
  } catch (error) {
    console.error(`[ERROR] AI tool call follow-up failed: ${error.message}`);
    return { content: null, error: 'tool_call_failed' };
  }
}

/**
 * Categorize an error into a known type for upstream handling.
 */
function categorizeError(error) {
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'timeout';
  }
  if (error.status === 429) {
    return 'rate_limited';
  }
  if (error.status === 401 || error.status === 403) {
    return 'auth_failed';
  }
  if (error.status >= 500) {
    return 'server_error';
  }
  return 'unknown';
}

/**
 * Check if the AI client is properly configured.
 */
export function isAIConfigured() {
  return !!(env.NVIDIA_API_KEY && env.NVIDIA_API_KEY !== 'nvapi-xxx');
}

// ── Legacy export for backward compatibility ──
export const callKimi = callAI;

export { MODEL_TIERS };
