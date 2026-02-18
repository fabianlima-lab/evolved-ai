import OpenAI from 'openai';
import env from '../config/env.js';
import { PRIMARY_CONFIG, FALLBACK_CONFIG, MODEL_CONFIG, NVIDIA_BASE_URL } from '../config/models.js';

// ─────────────────────────────────────────────────────
// AI Client — Primary: NVIDIA NIMs + Fallback: Groq
// Both OpenAI-compatible. Auto-fallback on failure.
// ─────────────────────────────────────────────────────

/**
 * Strip Llama chat template tokens that can leak into output.
 */
function stripLlamaTokens(text) {
  return text
    .replace(/<\|[a-z_]+\|>/gi, '')         // all <|...|> tokens
    .replace(/^\s*assistant\s*/i, '')        // leading "assistant" role label
    .replace(/\nassistant\s*$/i, '')         // trailing "assistant" role label
    .trim();
}

/** Cached OpenAI clients (one per provider) */
const clients = {};

function getClient(provider) {
  if (clients[provider]) return clients[provider];

  if (provider === 'groq') {
    if (!env.GROQ_API_KEY || env.GROQ_API_KEY === 'gsk-xxx') return null;
    clients.groq = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: env.GROQ_API_KEY,
      timeout: 30000,
    });
    return clients.groq;
  }

  if (provider === 'nvidia') {
    if (!env.NVIDIA_API_KEY || env.NVIDIA_API_KEY === 'nvapi-xxx') return null;
    clients.nvidia = new OpenAI({
      baseURL: 'https://integrate.api.nvidia.com/v1',
      apiKey: env.NVIDIA_API_KEY,
      timeout: 30000,
    });
    return clients.nvidia;
  }

  return null;
}

/**
 * Try a single AI call against a specific provider config.
 * Returns { content, error, model, responseTimeMs }
 */
async function tryProvider(config, messages) {
  const ai = getClient(config.provider);
  if (!ai) {
    return { content: null, error: `${config.provider}_not_configured` };
  }

  const startTime = Date.now();

  try {
    const response = await ai.chat.completions.create({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    });

    const responseTimeMs = Date.now() - startTime;
    const choice = response.choices?.[0];

    if (!choice || !choice.message || !choice.message.content?.trim()) {
      return { content: null, error: 'empty_response', model: config.model, responseTimeMs };
    }

    const content = stripLlamaTokens(choice.message.content);
    if (!content) {
      return { content: null, error: 'empty_content', model: config.model, responseTimeMs };
    }

    return { content, error: null, model: config.model, responseTimeMs };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorType = categorizeError(error);
    return { content: null, error: errorType, model: config.model, responseTimeMs, rawError: error.message };
  }
}

/**
 * Call the AI with automatic fallback.
 *
 * Flow: NVIDIA NIMs → Groq (if primary fails)
 *
 * @param {string} systemPrompt - Compiled SOUL.md or agent system prompt
 * @param {Array<{role: string, content: string}>} conversationHistory - Recent messages
 * @param {object} options
 * @returns {Promise<{content: string, error: string|null, tier: number, model: string, responseTimeMs: number}>}
 */
export async function callAI(systemPrompt, conversationHistory, options = {}) {
  const userMessage = options.userMessage
    || conversationHistory.filter((m) => m.role === 'user').pop()?.content
    || '';

  const soulCheck = systemPrompt.includes('SOUL.md') || systemPrompt.includes('chief of staff');
  console.log(`[AI] soulMd:${soulCheck} sysPromptLen:${systemPrompt.length} msg:"${userMessage.slice(0, 60)}"`);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];

  // ── Try Primary (NVIDIA NIMs) ──
  console.log(`[AI] trying primary: ${PRIMARY_CONFIG.model} (${PRIMARY_CONFIG.provider})`);
  const primary = await tryProvider(PRIMARY_CONFIG, messages);

  if (primary.content) {
    console.log(`[AI] ✅ primary ok model:${primary.model} time:${primary.responseTimeMs}ms len:${primary.content.length}`);
    return { content: primary.content, error: null, tier: 1, model: primary.model, responseTimeMs: primary.responseTimeMs };
  }

  // Primary failed — log and try fallback
  console.warn(`[AI] ⚠️ primary failed: ${primary.error}${primary.rawError ? ` (${primary.rawError})` : ''} — trying fallback`);

  // ── Try Fallback (Groq) ──
  console.log(`[AI] trying fallback: ${FALLBACK_CONFIG.model} (${FALLBACK_CONFIG.provider})`);
  const fallback = await tryProvider(FALLBACK_CONFIG, messages);

  if (fallback.content) {
    console.log(`[AI] ✅ fallback ok model:${fallback.model} time:${fallback.responseTimeMs}ms len:${fallback.content.length}`);
    return { content: fallback.content, error: null, tier: 2, model: fallback.model, responseTimeMs: fallback.responseTimeMs };
  }

  // Both failed
  console.error(`[AI] ❌ all providers failed. primary:${primary.error} fallback:${fallback.error}`);
  return {
    content: null,
    error: `all_providers_failed (primary:${primary.error}, fallback:${fallback.error})`,
    tier: 0,
    model: null,
    responseTimeMs: (primary.responseTimeMs || 0) + (fallback.responseTimeMs || 0),
  };
}

/**
 * Stream a response from the AI (with fallback).
 */
export async function callAIStream(systemPrompt, conversationHistory, options = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];

  // Try primary first
  const primaryClient = getClient('nvidia');
  if (primaryClient) {
    try {
      console.log(`[AI:STREAM] trying primary: ${PRIMARY_CONFIG.model}`);
      const stream = await primaryClient.chat.completions.create({
        model: PRIMARY_CONFIG.model,
        messages,
        max_tokens: PRIMARY_CONFIG.maxTokens,
        temperature: PRIMARY_CONFIG.temperature,
        stream: true,
      });
      return { stream, tier: 1, model: PRIMARY_CONFIG.model };
    } catch (err) {
      console.warn(`[AI:STREAM] ⚠️ primary failed: ${err.message} — trying fallback`);
    }
  }

  // Fallback to Groq
  const groqClient = getClient('groq');
  if (!groqClient) {
    throw new Error('All AI providers unavailable');
  }

  console.log(`[AI:STREAM] trying fallback: ${FALLBACK_CONFIG.model}`);
  const stream = await groqClient.chat.completions.create({
    model: FALLBACK_CONFIG.model,
    messages,
    max_tokens: FALLBACK_CONFIG.maxTokens,
    temperature: FALLBACK_CONFIG.temperature,
    stream: true,
  });
  return { stream, tier: 2, model: FALLBACK_CONFIG.model };
}

/**
 * Categorize an error into a known type.
 */
function categorizeError(error) {
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) return 'timeout';
  if (error.status === 429) return 'rate_limited';
  if (error.status === 401 || error.status === 403) return 'auth_failed';
  if (error.status >= 500) return 'server_error';
  return 'unknown';
}

/**
 * Check if at least one AI provider is configured.
 */
export function isAIConfigured() {
  return !!(
    (env.NVIDIA_API_KEY && env.NVIDIA_API_KEY !== 'nvapi-xxx') ||
    (env.GROQ_API_KEY && env.GROQ_API_KEY !== 'gsk-xxx')
  );
}

// ── Legacy exports for backward compatibility ──
export const callKimi = callAI;
export { MODEL_CONFIG as MODEL_TIERS };
export { stripLlamaTokens };
