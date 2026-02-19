import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import env from '../config/env.js';
import { PRIMARY_CONFIG, FALLBACK_CONFIG, SAFETY_NET_CONFIG, MODEL_CONFIG, NVIDIA_BASE_URL } from '../config/models.js';

// ─────────────────────────────────────────────────────
// AI Client — Primary: Anthropic Claude + Fallback: Groq + Safety Net: NVIDIA
// Anthropic uses its own SDK. Groq/NVIDIA are OpenAI-compatible.
// Auto-fallback on failure.
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

/** Cached clients (one per provider) */
const clients = {};

function getClient(provider) {
  if (clients[provider]) return clients[provider];

  if (provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY === 'sk-ant-xxx') return null;
    clients.anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      timeout: 30000,
    });
    return clients.anthropic;
  }

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
 * Try a single AI call against Anthropic.
 * Anthropic uses a different API format:
 * - System prompt goes in a separate `system` parameter
 * - Messages array must NOT contain system messages
 * - Response is in response.content[0].text
 */
async function tryAnthropic(config, messages) {
  const client = getClient('anthropic');
  if (!client) {
    return { content: null, error: 'anthropic_not_configured' };
  }

  const startTime = Date.now();

  // Extract system prompt from messages (first message with role 'system')
  const systemMessage = messages.find((m) => m.role === 'system');
  const systemPrompt = systemMessage?.content || '';

  // Filter out system messages — Anthropic wants them separate
  const userMessages = messages.filter((m) => m.role !== 'system');

  try {
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: systemPrompt,
      messages: userMessages,
    });

    const responseTimeMs = Date.now() - startTime;

    const textBlock = response.content?.find((b) => b.type === 'text');
    if (!textBlock || !textBlock.text?.trim()) {
      return { content: null, error: 'empty_response', model: config.model, responseTimeMs };
    }

    return { content: textBlock.text.trim(), error: null, model: config.model, responseTimeMs };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorType = categorizeError(error);
    return { content: null, error: errorType, model: config.model, responseTimeMs, rawError: error.message };
  }
}

/**
 * Try a single AI call against an OpenAI-compatible provider (Groq / NVIDIA).
 * Returns { content, error, model, responseTimeMs }
 */
async function tryOpenAIProvider(config, messages) {
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
 * Route to the correct provider handler.
 */
async function tryProvider(config, messages) {
  if (config.provider === 'anthropic') {
    return tryAnthropic(config, messages);
  }
  return tryOpenAIProvider(config, messages);
}

/**
 * Call the AI with automatic fallback.
 *
 * Flow: Anthropic Claude → Groq 70B → NVIDIA 8B
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

  // ── Try Primary (Anthropic Claude) ──
  console.log(`[AI] trying primary: ${PRIMARY_CONFIG.model} (${PRIMARY_CONFIG.provider})`);
  const primary = await tryProvider(PRIMARY_CONFIG, messages);

  if (primary.content) {
    console.log(`[AI] ✅ primary ok model:${primary.model} time:${primary.responseTimeMs}ms len:${primary.content.length}`);
    return { content: primary.content, error: null, tier: 1, model: primary.model, responseTimeMs: primary.responseTimeMs };
  }

  // Primary failed — log and try fallback
  console.warn(`[AI] ⚠️ primary failed: ${primary.error}${primary.rawError ? ` (${primary.rawError})` : ''} — trying fallback`);

  // ── Try Fallback (Groq 70B) ──
  console.log(`[AI] trying fallback: ${FALLBACK_CONFIG.model} (${FALLBACK_CONFIG.provider})`);
  const fallback = await tryProvider(FALLBACK_CONFIG, messages);

  if (fallback.content) {
    console.log(`[AI] ✅ fallback ok model:${fallback.model} time:${fallback.responseTimeMs}ms len:${fallback.content.length}`);
    return { content: fallback.content, error: null, tier: 2, model: fallback.model, responseTimeMs: fallback.responseTimeMs };
  }

  console.warn(`[AI] ⚠️ fallback failed: ${fallback.error}${fallback.rawError ? ` (${fallback.rawError})` : ''} — trying safety net`);

  // ── Try Safety Net (NVIDIA 8B) ──
  console.log(`[AI] trying safety net: ${SAFETY_NET_CONFIG.model} (${SAFETY_NET_CONFIG.provider})`);
  const safetyNet = await tryProvider(SAFETY_NET_CONFIG, messages);

  if (safetyNet.content) {
    console.log(`[AI] ✅ safety net ok model:${safetyNet.model} time:${safetyNet.responseTimeMs}ms len:${safetyNet.content.length}`);
    return { content: safetyNet.content, error: null, tier: 3, model: safetyNet.model, responseTimeMs: safetyNet.responseTimeMs };
  }

  // All failed
  console.error(`[AI] ❌ all providers failed. primary:${primary.error} fallback:${fallback.error} safetyNet:${safetyNet.error}`);
  return {
    content: null,
    error: `all_providers_failed (primary:${primary.error}, fallback:${fallback.error}, safetyNet:${safetyNet.error})`,
    tier: 0,
    model: null,
    responseTimeMs: (primary.responseTimeMs || 0) + (fallback.responseTimeMs || 0) + (safetyNet.responseTimeMs || 0),
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

  // Try Anthropic first (streaming)
  const anthropicClient = getClient('anthropic');
  if (anthropicClient) {
    try {
      console.log(`[AI:STREAM] trying primary: ${PRIMARY_CONFIG.model}`);

      const systemMessage = messages.find((m) => m.role === 'system');
      const userMessages = messages.filter((m) => m.role !== 'system');

      const stream = anthropicClient.messages.stream({
        model: PRIMARY_CONFIG.model,
        max_tokens: PRIMARY_CONFIG.maxTokens,
        temperature: PRIMARY_CONFIG.temperature,
        system: systemMessage?.content || '',
        messages: userMessages,
      });
      return { stream, tier: 1, model: PRIMARY_CONFIG.model, provider: 'anthropic' };
    } catch (err) {
      console.warn(`[AI:STREAM] ⚠️ primary failed: ${err.message} — trying fallback`);
    }
  }

  // Fallback to Groq
  const groqClient = getClient('groq');
  if (groqClient) {
    try {
      console.log(`[AI:STREAM] trying fallback: ${FALLBACK_CONFIG.model}`);
      const stream = await groqClient.chat.completions.create({
        model: FALLBACK_CONFIG.model,
        messages,
        max_tokens: FALLBACK_CONFIG.maxTokens,
        temperature: FALLBACK_CONFIG.temperature,
        stream: true,
      });
      return { stream, tier: 2, model: FALLBACK_CONFIG.model, provider: 'groq' };
    } catch (err) {
      console.warn(`[AI:STREAM] ⚠️ fallback failed: ${err.message} — trying safety net`);
    }
  }

  // Safety net: NVIDIA
  const nvidiaClient = getClient('nvidia');
  if (!nvidiaClient) {
    throw new Error('All AI providers unavailable');
  }

  console.log(`[AI:STREAM] trying safety net: ${SAFETY_NET_CONFIG.model}`);
  const stream = await nvidiaClient.chat.completions.create({
    model: SAFETY_NET_CONFIG.model,
    messages,
    max_tokens: SAFETY_NET_CONFIG.maxTokens,
    temperature: SAFETY_NET_CONFIG.temperature,
    stream: true,
  });
  return { stream, tier: 3, model: SAFETY_NET_CONFIG.model, provider: 'nvidia' };
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
    (env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY !== 'sk-ant-xxx') ||
    (env.NVIDIA_API_KEY && env.NVIDIA_API_KEY !== 'nvapi-xxx') ||
    (env.GROQ_API_KEY && env.GROQ_API_KEY !== 'gsk-xxx')
  );
}

// ── Legacy exports for backward compatibility ──
export const callKimi = callAI;
export { MODEL_CONFIG as MODEL_TIERS };
export { stripLlamaTokens };
