import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import env from '../config/env.js';

const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────
// OpenClaw Bridge (Gateway CLI)
//
// Sends messages to the OpenClaw Gateway via the
// `openclaw agent` CLI command. The Gateway runs as a
// sandboxed systemd service (openclaw user), CLI connects
// over WebSocket and returns the agent's response as JSON.
//
// Architecture:
//   WhatsApp msg → our backend → openclaw agent CLI → Gateway WS → AI
//   OpenClaw response → our backend parses actions → WhatsApp
// ─────────────────────────────────────────────────────

const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'main';
const DEFAULT_TIMEOUT_S = 120; // 120s for complex agent turns (builds pages, etc.)
const OPENCLAW_WORKSPACE = env.OPENCLAW_WORKSPACE || process.env.HOME + '/clawd';
const OPENCLAW_HOME = OPENCLAW_WORKSPACE.replace(/\/clawd$/, '') || process.env.HOME;
const USER_MD_PATH = OPENCLAW_WORKSPACE + '/USER.md';

// Rate limit cooldown: skip OpenClaw for 5 minutes after a rate limit hit
let rateLimitedUntil = 0;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if OpenClaw Gateway is available.
 * Probes via `openclaw health --json`.
 */
let openclawAvailable = null;

export async function isOpenClawConfigured() {
  if (openclawAvailable !== null) return openclawAvailable;

  try {
    const { stdout } = await execFileAsync(OPENCLAW_BIN, ['health', '--json'], {
      timeout: 8000,
      env: { ...process.env, NO_COLOR: '1', HOME: OPENCLAW_HOME },
    });

    const data = JSON.parse(stdout);
    openclawAvailable = data.status === 'ok' || data.healthy === true;
    console.log(`[OPENCLAW] Gateway ${openclawAvailable ? '✅ online' : '❌ offline'} (CLI mode)`);
    return openclawAvailable;
  } catch (err) {
    // Fallback: try HTTP health probe (gateway serves an HTML page at /)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('http://127.0.0.1:18789/', { signal: controller.signal });
      clearTimeout(timeout);

      // Any response means the gateway is running
      openclawAvailable = res.status < 500;
      console.log(`[OPENCLAW] Gateway ${openclawAvailable ? '✅ online' : '❌ offline'} (HTTP probe)`);
      return openclawAvailable;
    } catch {
      console.warn(`[OPENCLAW] Gateway not available: ${err.message}`);
      openclawAvailable = false;
      return false;
    }
  }
}

/**
 * Call the AI agent via `openclaw agent` CLI.
 *
 * Uses: openclaw agent --message "..." --to <phone> --agent <id> --json --timeout <s>
 * The CLI connects to the running Gateway over WebSocket.
 *
 * @param {string} message - The user's message
 * @param {object} options
 * @param {string} [options.sessionId] - Session ID for conversation continuity
 * @param {string} [options.subscriberPhone] - Phone number for session routing
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

  // Build CLI args
  const args = ['agent', '--message', message, '--json'];

  // Route to the right session via phone number
  if (options.subscriberPhone) {
    args.push('--to', options.subscriberPhone.startsWith('+') ? options.subscriberPhone : `+${options.subscriberPhone}`);
  } else if (options.sessionId) {
    args.push('--session-id', options.sessionId);
  }

  // Use specific agent if not default
  if (AGENT_ID && AGENT_ID !== 'main') {
    args.push('--agent', AGENT_ID);
  }

  args.push('--timeout', String(DEFAULT_TIMEOUT_S));

  try {
    const { stdout, stderr } = await execFileAsync(OPENCLAW_BIN, args, {
      timeout: (DEFAULT_TIMEOUT_S + 10) * 1000, // CLI timeout + 10s buffer
      env: { ...process.env, NO_COLOR: '1', HOME: OPENCLAW_HOME },
      maxBuffer: 1024 * 1024, // 1MB for large responses (pages, dashboards)
    });

    const responseTimeMs = Date.now() - startTime;

    // Parse JSON response
    let data;
    try {
      data = JSON.parse(stdout);
    } catch {
      // Sometimes the CLI outputs non-JSON lines before the JSON
      const jsonStart = stdout.indexOf('{');
      if (jsonStart >= 0) {
        data = JSON.parse(stdout.slice(jsonStart));
      } else {
        console.error(`[OPENCLAW] ❌ non-JSON output: ${stdout.slice(0, 200)}`);
        return { content: null, error: 'openclaw_error', model: null, responseTimeMs, tier: 0, rawError: 'non-JSON response' };
      }
    }

    if (data.status !== 'ok') {
      const errMsg = data.error || data.summary || 'unknown error';
      console.error(`[OPENCLAW] ❌ agent error: ${errMsg}`);

      // Check for rate limiting
      if (errMsg.includes('rate') || errMsg.includes('429') || errMsg.includes('quota')) {
        rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        console.log(`[OPENCLAW] Rate limited — cooling down for 5 min`);
        return { content: null, error: 'rate_limited', model: 'openclaw', responseTimeMs, tier: 0 };
      }

      return { content: null, error: 'openclaw_error', model: null, responseTimeMs, tier: 0, rawError: errMsg };
    }

    // Extract text from payloads
    const payloads = data.result?.payloads || [];
    const text = payloads.map((p) => p.text).filter(Boolean).join('\n\n').trim();

    if (!text) {
      return { content: null, error: 'empty_response', model: 'openclaw', responseTimeMs, tier: 0 };
    }

    const model = data.result?.meta?.agentMeta?.model || 'openclaw';
    const durationMs = data.result?.meta?.durationMs || responseTimeMs;

    console.log(`[OPENCLAW] ✅ response ok time:${durationMs}ms len:${text.length} model:${model}`);

    return {
      content: text,
      error: null,
      model,
      responseTimeMs: durationMs,
      tier: 3, // Tier 3 = OpenClaw
    };
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;

    if (err.killed || err.signal === 'SIGTERM') {
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
 * Gateway via CLI.
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
  });
}

export default { callOpenClaw, callOpenClawWithContext, isOpenClawConfigured };
