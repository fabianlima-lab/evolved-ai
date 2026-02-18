import OpenAI from 'openai';
import env from '../config/env.js';
import { MODEL_CONFIG, NVIDIA_BASE_URL } from '../config/models.js';

// ─────────────────────────────────────────────────────
// AI Client — Single model: meta/llama-3.1-8b-instruct
// via NVIDIA NIMs (OpenAI-compatible)
// ─────────────────────────────────────────────────────

/**
 * Strip Llama chat template tokens that can leak into output.
 * Matches: <|start_header_id|>, <|end_header_id|>, <|eot_id|>,
 * <|begin_of_text|>, <|end_of_text|>, <|finetune_right_pad_id|>,
 * and any similar <|...|> patterns. Also strips "assistant" role
 * labels that appear right after header tokens.
 */
function stripLlamaTokens(text) {
  return text
    .replace(/<\|[a-z_]+\|>/gi, '')         // all <|...|> tokens
    .replace(/^\s*assistant\s*/i, '')        // leading "assistant" role label
    .replace(/\nassistant\s*$/i, '')         // trailing "assistant" role label
    .trim();
}

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
      timeout: MODEL_CONFIG.timeoutMs,
    });
  }
  return client;
}

/**
 * Call the AI with the compiled SOUL.md as system prompt.
 *
 * Single model — no tier routing. The systemPrompt (compiled SOUL.md)
 * is always messages[0] with role: 'system'.
 *
 * @param {string} systemPrompt - Compiled SOUL.md or agent system prompt
 * @param {Array<{role: string, content: string}>} conversationHistory - Recent messages
 * @param {object} options
 * @param {string} [options.userMessage] - The latest user message (for logging)
 * @returns {Promise<{content: string, error: string|null, tier: number, model: string, responseTimeMs: number}>}
 */
export async function callAI(systemPrompt, conversationHistory, options = {}) {
  const ai = getClient();

  if (!ai) {
    console.error('[ERROR] AI client not configured — NVIDIA_API_KEY missing');
    return { content: null, error: 'ai_not_configured', tier: 0, model: null, responseTimeMs: 0 };
  }

  const userMessage = options.userMessage
    || conversationHistory.filter((m) => m.role === 'user').pop()?.content
    || '';

  // Debug: confirm SOUL.md is loaded as system prompt
  const soulCheck = systemPrompt.includes('SOUL.md') || systemPrompt.includes('chief of staff');
  console.log(`[AI] model:${MODEL_CONFIG.model} soulMd:${soulCheck} sysPromptLen:${systemPrompt.length} msg:"${userMessage.slice(0, 60)}"`);

  const startTime = Date.now();

  try {
    // SOUL.md is ALWAYS the system message (messages[0])
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ];

    const response = await ai.chat.completions.create({
      model: MODEL_CONFIG.model,
      messages,
      max_tokens: MODEL_CONFIG.maxTokens,
      temperature: MODEL_CONFIG.temperature,
    });

    const responseTimeMs = Date.now() - startTime;
    const choice = response.choices?.[0];

    if (!choice || !choice.message) {
      console.error(`[ERROR] AI empty response (${responseTimeMs}ms)`);
      return { content: null, error: 'empty_response', tier: 1, model: MODEL_CONFIG.model, responseTimeMs };
    }

    const rawContent = choice.message.content;
    if (!rawContent || rawContent.trim().length === 0) {
      console.error(`[ERROR] AI empty content (${responseTimeMs}ms)`);
      return { content: null, error: 'empty_content', tier: 1, model: MODEL_CONFIG.model, responseTimeMs };
    }

    // Strip Llama special tokens that can leak into output
    const content = stripLlamaTokens(rawContent);

    if (!content) {
      console.error(`[ERROR] AI content empty after stripping tokens (${responseTimeMs}ms)`);
      return { content: null, error: 'empty_content', tier: 1, model: MODEL_CONFIG.model, responseTimeMs };
    }

    // Log if tokens were stripped (for monitoring)
    if (content.length !== rawContent.trim().length) {
      console.warn(`[AI] stripped Llama tokens: ${rawContent.trim().length} → ${content.length} chars`);
    }

    console.log(`[AI] ok model:${MODEL_CONFIG.model} time:${responseTimeMs}ms len:${content.length}`);
    return { content, error: null, tier: 1, model: MODEL_CONFIG.model, responseTimeMs };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorType = categorizeError(error);
    console.error(`[ERROR] AI call failed: ${errorType} - ${error.message} (${responseTimeMs}ms)`);
    return { content: null, error: errorType, tier: 1, model: MODEL_CONFIG.model, responseTimeMs };
  }
}

/**
 * Stream a response from the AI for the frontend chat endpoint.
 *
 * @param {string} systemPrompt - Compiled SOUL.md
 * @param {Array} conversationHistory
 * @param {object} options
 * @returns {Promise<{stream: AsyncIterable, tier: number, model: string}>}
 */
export async function callAIStream(systemPrompt, conversationHistory, options = {}) {
  const ai = getClient();

  if (!ai) {
    throw new Error('AI client not configured');
  }

  console.log(`[AI:STREAM] model:${MODEL_CONFIG.model}`);

  // SOUL.md is ALWAYS the system message (messages[0])
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];

  const stream = await ai.chat.completions.create({
    model: MODEL_CONFIG.model,
    messages,
    max_tokens: MODEL_CONFIG.maxTokens,
    temperature: MODEL_CONFIG.temperature,
    stream: true,
  });

  return { stream, tier: 1, model: MODEL_CONFIG.model };
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

// ── Legacy exports for backward compatibility ──
export const callKimi = callAI;
export { MODEL_CONFIG as MODEL_TIERS };
export { stripLlamaTokens };
