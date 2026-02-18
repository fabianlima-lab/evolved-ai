import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import env from '../config/env.js';

const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────
// OpenClaw Bridge
//
// Sends messages to the OpenClaw Gateway's Luna agent
// and returns responses. Uses the `openclaw agent` CLI
// in --local mode to avoid tool-calling format issues
// with Groq/Llama. Our backend continues to handle
// action tags, Google integrations, and tool execution.
//
// Architecture:
//   WhatsApp msg → our backend → OpenClaw (AI brain)
//   OpenClaw response → our backend parses actions → WhatsApp
// ─────────────────────────────────────────────────────

const OPENCLAW_CLI = 'openclaw';
const AGENT_ID = 'luna';
const DEFAULT_TIMEOUT_MS = 60000; // 60s timeout for AI calls

/**
 * Check if OpenClaw is available and configured.
 */
let openclawAvailable = null;

export async function isOpenClawConfigured() {
  if (openclawAvailable !== null) return openclawAvailable;

  try {
    const { stdout } = await execFileAsync(OPENCLAW_CLI, ['--version'], {
      timeout: 5000,
      env: { ...process.env, GROQ_API_KEY: env.GROQ_API_KEY },
    });
    openclawAvailable = !!stdout.trim();
    console.log(`[OPENCLAW] Available: v${stdout.trim()}`);
    return openclawAvailable;
  } catch (err) {
    console.warn(`[OPENCLAW] Not available: ${err.message}`);
    openclawAvailable = false;
    return false;
  }
}

/**
 * Call the Luna agent via OpenClaw.
 *
 * Uses `openclaw agent --local --agent luna --json` to get a response.
 * The --local flag runs the agent embedded (no gateway tool injection),
 * which avoids Groq/Llama tool-calling format issues.
 *
 * The response text may contain [ACTION:...] tags — our backend
 * parses and executes those separately.
 *
 * @param {string} message - The user's message
 * @param {object} options
 * @param {string} [options.sessionId] - Session ID for conversation continuity
 * @param {string} [options.subscriberPhone] - E.164 phone number for session routing
 * @returns {Promise<{content: string, error: string|null, model: string, responseTimeMs: number, tier: number}>}
 */
export async function callOpenClaw(message, options = {}) {
  const startTime = Date.now();

  // Note: we do NOT use --json here because in plain text mode,
  // OpenClaw outputs the response directly (more reliable with Groq/Llama).
  // With --json, tool-calling failures produce error JSON instead of text.
  const args = [
    'agent',
    '--agent', AGENT_ID,
    '--message', message,
    '--local',
  ];

  // Use subscriber phone for session routing (creates per-subscriber sessions)
  if (options.subscriberPhone) {
    args.push('--to', options.subscriberPhone);
  } else if (options.sessionId) {
    args.push('--session-id', options.sessionId);
  }

  try {
    const { stdout, stderr } = await execFileAsync(OPENCLAW_CLI, args, {
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: 1024 * 1024, // 1MB
      env: {
        ...process.env,
        GROQ_API_KEY: env.GROQ_API_KEY,
        // Ensure OpenClaw can find its config
        HOME: process.env.HOME,
        PATH: process.env.PATH,
      },
    });

    const responseTimeMs = Date.now() - startTime;

    if (stderr && stderr.includes('rate limit')) {
      return {
        content: null,
        error: 'rate_limited',
        model: 'groq/llama-3.3-70b-versatile',
        responseTimeMs,
        tier: 0,
      };
    }

    // Plain text output mode — response is directly usable
    const text = stdout.trim();

    if (!text) {
      return {
        content: null,
        error: 'empty_response',
        model: 'groq/llama-3.3-70b-versatile',
        responseTimeMs,
        tier: 0,
      };
    }

    // Check for tool-calling error messages from OpenClaw
    if (text.includes('Failed to call a function') || text.includes('tool call validation failed')) {
      console.warn(`[OPENCLAW] ⚠️ tool call error in response, treating as failure`);
      return {
        content: null,
        error: 'openclaw_tool_error',
        model: 'groq/llama-3.3-70b-versatile',
        responseTimeMs,
        tier: 0,
      };
    }

    console.log(`[OPENCLAW] ✅ response ok time:${responseTimeMs}ms len:${text.length}`);

    return {
      content: text,
      error: null,
      model: 'groq/llama-3.3-70b-versatile',
      responseTimeMs,
      tier: 3, // Tier 3 = OpenClaw
    };
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;

    if (err.killed || err.signal === 'SIGTERM') {
      return { content: null, error: 'timeout', model: null, responseTimeMs, tier: 0 };
    }

    // Check stderr for specific errors
    const stderr = err.stderr || '';
    if (stderr.includes('rate limit')) {
      return { content: null, error: 'rate_limited', model: 'groq/llama-3.3-70b-versatile', responseTimeMs, tier: 0 };
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
 * This is the main entry point from the message router.
 * It compiles SOUL.md + live context, injects it into the
 * USER.md workspace file, then calls the Luna agent.
 *
 * @param {string} systemPrompt - Pre-compiled SOUL.md with live context
 * @param {Array<{role: string, content: string}>} conversationHistory - Recent messages
 * @param {object} options
 * @returns {Promise<{content: string, error: string|null, model: string, responseTimeMs: number, tier: number}>}
 */
export async function callOpenClawWithContext(systemPrompt, conversationHistory, options = {}) {
  // Build the full message with conversation context
  // OpenClaw manages its own session state, but we pass recent history
  // as part of the message for context on first interaction
  const userMessage = options.userMessage
    || conversationHistory.filter((m) => m.role === 'user').pop()?.content
    || '';

  if (!userMessage) {
    return { content: null, error: 'empty_message', model: null, responseTimeMs: 0, tier: 0 };
  }

  return callOpenClaw(userMessage, {
    sessionId: options.sessionId,
    subscriberPhone: options.subscriberPhone,
  });
}

export default { callOpenClaw, callOpenClawWithContext, isOpenClawConfigured };
