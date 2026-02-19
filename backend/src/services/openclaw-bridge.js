import { writeFile } from 'node:fs/promises';
import env from '../config/env.js';

// ─────────────────────────────────────────────────────
// OpenClaw Bridge (Gateway HTTP API)
//
// Sends messages to the OpenClaw Gateway via its
// OpenAI-compatible Chat Completions HTTP endpoint.
// This is 3-5x faster than the old CLI approach because
// the Gateway stays warm — no process spawn per message.
//
// Architecture:
//   WhatsApp msg → our backend → OpenClaw Gateway HTTP → AI
//   OpenClaw response → our backend parses actions → WhatsApp
// ─────────────────────────────────────────────────────

const GATEWAY_URL = 'http://127.0.0.1:18789/v1/chat/completions';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'evo-luna-gw-2026-secret';
const AGENT_ID = 'main';
const DEFAULT_TIMEOUT_MS = 45000; // 45s for Claude Sonnet responses
const OPENCLAW_WORKSPACE = process.env.HOME + '/clawd';
const USER_MD_PATH = OPENCLAW_WORKSPACE + '/USER.md';

// Rate limit cooldown: skip OpenClaw for 5 minutes after a rate limit hit
let rateLimitedUntil = 0;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if OpenClaw Gateway is available.
 * Probes the health endpoint instead of spawning a CLI process.
 */
let openclawAvailable = null;

export async function isOpenClawConfigured() {
  if (openclawAvailable !== null) return openclawAvailable;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('http://127.0.0.1:18789/health', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    openclawAvailable = res.ok;
    console.log(`[OPENCLAW] Gateway ${openclawAvailable ? '✅ online' : '❌ offline'} (HTTP API mode)`);
    return openclawAvailable;
  } catch (err) {
    // Health endpoint might not exist — try the completions endpoint with empty body
    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 5000);

      const res2 = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GATEWAY_TOKEN}`,
          'Content-Type': 'application/json',
          'x-openclaw-agent-id': AGENT_ID,
        },
        body: JSON.stringify({ model: 'openclaw', messages: [] }),
        signal: controller2.signal,
      });
      clearTimeout(timeout2);

      // Even a 400 error means the gateway is running
      openclawAvailable = res2.status < 500;
      console.log(`[OPENCLAW] Gateway ${openclawAvailable ? '✅ online' : '❌ offline'} (HTTP probe status:${res2.status})`);
      return openclawAvailable;
    } catch (err2) {
      console.warn(`[OPENCLAW] Gateway not available: ${err2.message}`);
      openclawAvailable = false;
      return false;
    }
  }
}

/**
 * Call the Luna agent via OpenClaw Gateway HTTP API.
 *
 * Uses the OpenAI-compatible /v1/chat/completions endpoint.
 * The Gateway stays warm so there's no process spawn overhead.
 *
 * @param {string} message - The user's message
 * @param {object} options
 * @param {string} [options.sessionId] - Session ID for conversation continuity
 * @param {string} [options.subscriberPhone] - Phone number for session routing
 * @param {Array<{role: string, content: string}>} [options.conversationHistory] - Recent messages
 * @returns {Promise<{content: string, error: string|null, model: string, responseTimeMs: number, tier: number}>}
 */
export async function callOpenClaw(message, options = {}) {
  const startTime = Date.now();

  // Skip if we're in a rate limit cooldown period
  if (Date.now() < rateLimitedUntil) {
    const secsLeft = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
    console.log(`[OPENCLAW] Skipping — rate limit cooldown (${secsLeft}s remaining)`);
    return { content: null, error: 'rate_limited', model: 'openclaw', responseTimeMs: 0, tier: 0 };
  }

  // Build messages array — include conversation history if available
  const messages = [];
  if (options.conversationHistory && options.conversationHistory.length > 0) {
    // Add recent history (last few messages for context)
    const recent = options.conversationHistory.slice(-10);
    for (const msg of recent) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  // The current user message (may already be in history, but ensure it's last)
  if (!messages.length || messages[messages.length - 1]?.content !== message) {
    messages.push({ role: 'user', content: message });
  }

  // Build session user ID for continuity
  const userId = options.subscriberPhone || options.sessionId || 'default';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
        'x-openclaw-agent-id': AGENT_ID,
      },
      body: JSON.stringify({
        model: 'openclaw',
        messages,
        user: userId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - startTime;

    if (res.status === 429) {
      rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      console.log(`[OPENCLAW] Rate limited — cooling down for 5 min`);
      return { content: null, error: 'rate_limited', model: 'openclaw', responseTimeMs, tier: 0 };
    }

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[OPENCLAW] ❌ HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      return { content: null, error: 'openclaw_error', model: null, responseTimeMs, tier: 0, rawError: `HTTP ${res.status}` };
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';

    if (!text) {
      return { content: null, error: 'empty_response', model: 'openclaw', responseTimeMs, tier: 0 };
    }

    // Check for tool-calling error messages
    if (text.includes('Failed to call a function') || text.includes('tool call validation failed')) {
      console.warn(`[OPENCLAW] ⚠️ tool call error in response, treating as failure`);
      return { content: null, error: 'openclaw_tool_error', model: 'openclaw', responseTimeMs, tier: 0 };
    }

    const model = data.model || 'openclaw';
    console.log(`[OPENCLAW] ✅ response ok time:${responseTimeMs}ms len:${text.length} model:${model}`);

    return {
      content: text,
      error: null,
      model,
      responseTimeMs,
      tier: 3, // Tier 3 = OpenClaw
    };
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;

    if (err.name === 'AbortError') {
      console.error(`[OPENCLAW] ❌ timeout after ${responseTimeMs}ms`);
      return { content: null, error: 'timeout', model: null, responseTimeMs, tier: 0 };
    }

    console.error(`[OPENCLAW] ❌ failed: ${err.message}`);
    return {
      content: null,
      error: 'openclaw_error',
      model: null,
      responseTimeMs,
      tier: 0,
      rawError: err.message,
    };
  }
}

/**
 * Call OpenClaw with full context injection.
 *
 * Main entry point from message router. Writes our compiled system prompt
 * (SOUL.md + live context) into the workspace USER.md before calling the
 * Gateway HTTP API.
 *
 * @param {string} systemPrompt - Pre-compiled SOUL.md with live context
 * @param {Array<{role: string, content: string}>} conversationHistory - Recent messages
 * @param {object} options
 * @returns {Promise<{content: string, error: string|null, model: string, responseTimeMs: number, tier: number}>}
 */
export async function callOpenClawWithContext(systemPrompt, conversationHistory, options = {}) {
  const userMessage = options.userMessage
    || conversationHistory.filter((m) => m.role === 'user').pop()?.content
    || '';

  if (!userMessage) {
    return { content: null, error: 'empty_message', model: null, responseTimeMs: 0, tier: 0 };
  }

  // Inject our compiled system prompt into USER.md so OpenClaw picks it up.
  // OpenClaw reads SOUL.md (personality) + USER.md (per-user context) on each call.
  try {
    await writeFile(USER_MD_PATH, systemPrompt, 'utf-8');
  } catch (err) {
    console.error(`[OPENCLAW] Failed to write USER.md: ${err.message}`);
  }

  return callOpenClaw(userMessage, {
    sessionId: options.sessionId,
    subscriberPhone: options.subscriberPhone,
    conversationHistory,
  });
}

export default { callOpenClaw, callOpenClawWithContext, isOpenClawConfigured };
