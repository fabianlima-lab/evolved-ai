import { isTrialExpired, stripHtml } from '../utils/helpers.js';
import { compileSoulMd } from '../prompts/soul.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { sendTypingIndicator } from './baileys.js';
import { callAI, isAIConfigured } from './ai-client.js';
import { callOpenClawWithContext, isOpenClawConfigured } from './openclaw-bridge.js';
import { buildLiveContext } from './context-builder.js';
import { parseReminderFromText } from '../utils/reminder-parser.js';
import { createReminder } from './reminders.js';
import { parseActions, stripActionTags, hasActions } from '../utils/action-parser.js';
import { executeAllActions } from './action-executor.js';
import { estimateTokens, truncateConversation, checkBudget } from '../utils/token-budget.js';
import { assertTenantAccess } from '../utils/tenant-guard.js';
import prisma from '../lib/prisma.js';

// Track OpenClaw availability (checked once at first message)
let openclawChecked = false;
let openclawEnabled = false;

const MAX_MESSAGE_LENGTH = 4000;

// User-friendly error messages by AI error type
const ERROR_MESSAGES = {
  ai_not_configured: "⚙️ My AI connection is being set up. I'll be fully operational soon — check back shortly!",
  timeout: "⏳ I'm thinking extra hard on this one... but I timed out. Could you try again or rephrase?",
  rate_limited: "🛡️ I'm getting a lot of requests right now. Give me a moment and try again.",
  auth_failed: "🔑 There's an issue with my AI connection. The team has been notified — try again later.",
  server_error: "⚔️ The AI service is temporarily down. Try again in a few minutes.",
  empty_response: "🤔 I drew a blank on that one. Could you rephrase your question?",
  empty_content: "🤔 I drew a blank on that one. Could you rephrase your question?",
  unknown: "⚠️ Something went wrong on my end. Try again in a moment.",
  openclaw_error: "⚠️ Something went wrong on my end. Try again in a moment.",
  openclaw_tool_error: "⚠️ Something went wrong on my end. Try again in a moment.",
};

/**
 * Main message routing function.
 * Called by webhook handlers after parsing channel-specific payload.
 *
 * 7-step pipeline:
 * 1. RECEIVE → Identify subscriber by channel + channel_id
 * 2. VALIDATE → Check tier (trial expiry)
 * 3. LOAD → Get active agent config + system prompt
 * 4. CONTEXT → Load last 20 messages for conversation history
 * 5. CALL → Send to AI with SOUL.md + live context
 * 6. EXECUTE → Parse and run any [ACTION:...] tags in AI response
 * 7. RESPOND → Save message to DB, send response to channel
 */
export async function routeIncomingMessage({ channel, channelId, text, senderName }) {
  if (!text || text.trim().length === 0) {
    return; // Ignore empty messages
  }

  const cleanText = stripHtml(text).slice(0, MAX_MESSAGE_LENGTH);

  console.log(`[MSG_IN] ${channel}:${channelId} - len:${cleanText.length}`);

  try {
    // ── Step 1: RECEIVE — Identify subscriber ──
    const subscriber = await findSubscriberByChannel(channel, channelId);

    if (!subscriber) {
      await sendChannelReply(channel, channelId,
        "👋 I don't recognize you yet.\n\nTo connect this channel to your Evolved AI account:\n1. Sign up at evolved.ai\n2. Deploy an agent\n3. Send your 6-digit connection code here\n\nOr sign up at evolved.ai to get started!"
      );
      return;
    }

    // ── Step 2: VALIDATE — Check trial expiry ──
    if (isTrialExpired(subscriber)) {
      await sendChannelReply(channel, channelId,
        "⏳ Your trial period has ended. Reactivate by choosing a plan at evolved.ai/dashboard"
      );
      return;
    }

    // ── Step 3: LOAD — Get active agent (tenant-scoped) ──
    const agent = await prisma.agent.findFirst({
      where: { subscriberId: subscriber.id, isActive: true },
    });

    if (!agent) {
      await sendChannelReply(channel, channelId,
        "🤖 You don't have an active agent deployed.\n\nVisit evolved.ai to deploy one!"
      );
      return;
    }

    // ── Tenant isolation check — verify agent belongs to this subscriber ──
    assertTenantAccess(subscriber.id, agent.subscriberId, `agent:${agent.id}`);

    // ── Step 4: CONTEXT — Save incoming THEN load history ──
    await prisma.message.create({
      data: {
        subscriberId: subscriber.id,
        agentId: agent.id,
        role: 'user',
        channel,
        content: cleanText,
      },
    });

    const recentMessages = await prisma.message.findMany({
      where: { subscriberId: subscriber.id, agentId: agent.id },
      orderBy: { createdAt: 'desc' },
      take: 30, // Fetch more than needed, token budget will trim
    });

    const rawHistory = recentMessages.reverse().map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Apply token budget truncation
    const { messages: conversationHistory, truncated } = truncateConversation(rawHistory);
    if (truncated) {
      console.log(`[MSG] Conversation truncated for subscriber:${subscriber.id} (${rawHistory.length} → ${conversationHistory.length} messages)`);
    }

    // ── Step 4.5: Show "typing..." indicator while AI thinks ──
    if (channel === 'whatsapp') {
      sendTypingIndicator(channelId, 'composing').catch(() => {});
    }

    // ── Step 5: CALL — Send to AI (compile SOUL.md fresh from template) ──
    let aiResponse = await generateAIResponse(agent, subscriber, conversationHistory, {
      userMessage: cleanText,
    });

    // ── Step 6: EXECUTE — Parse and run any action tags ──
    if (hasActions(aiResponse)) {
      const actions = parseActions(aiResponse);
      console.log(`[ACTION] Found ${actions.length} action(s) in response:`, actions.map((a) => a.action));

      const { results } = await executeAllActions(actions, subscriber, { agentId: agent.id });

      // Strip action tags from the user-facing message
      let cleanResponse = stripActionTags(aiResponse);

      // Append any error messages from failed actions
      const errors = results.filter((r) => !r.success && r.result);
      if (errors.length > 0) {
        cleanResponse += '\n\n' + errors.map((e) => e.result).join('\n');
      }

      // Append any info results (like search results, free slots)
      const infoResults = results.filter((r) => r.success && r.result);
      if (infoResults.length > 0) {
        cleanResponse += '\n\n' + infoResults.map((r) => r.result).join('\n');
      }

      aiResponse = cleanResponse;
    }

    // ── Step 7: RESPOND — Save + send (PARALLEL) ──
    await Promise.all([
      prisma.message.create({
        data: {
          subscriberId: subscriber.id,
          agentId: agent.id,
          role: 'assistant',
          channel,
          content: aiResponse,
        },
      }),
      sendChannelReply(channel, channelId, aiResponse),
    ]);

    // ── Clear typing indicator ──
    if (channel === 'whatsapp') {
      sendTypingIndicator(channelId, 'paused').catch(() => {});
    }

  } catch (error) {
    console.error(`[ERROR] message routing failed: ${error.message}`);
    await sendChannelReply(channel, channelId,
      "⚠️ Something went wrong. Your agent is recovering — try again in a moment."
    ).catch(() => {});
  }
}

/**
 * Find a subscriber by their channel type and channel ID.
 */
async function findSubscriberByChannel(channel, channelId) {
  if (channel === 'whatsapp') {
    return prisma.subscriber.findFirst({
      where: { whatsappJid: channelId },
    });
  }
  return null;
}

/**
 * Send a reply via the appropriate channel.
 */
async function sendChannelReply(channel, channelId, text) {
  if (channel === 'whatsapp') {
    return sendWhatsAppMessage(channelId, text);
  }
  console.error(`[ERROR] unknown channel: ${channel}`);
}

/**
 * Generate AI response using OpenClaw (primary) or direct AI call (fallback).
 *
 * Pipeline:
 *   1. Try OpenClaw agent — Claude Sonnet via OpenClaw Gateway
 *   2. If OpenClaw fails → fallback to direct callAI() (Groq/NVIDIA)
 *   3. If both fail → friendly error message
 *
 * OpenClaw handles: SOUL.md personality, session memory, model routing
 * Our code handles: Live context (calendar/email), action tags, tool execution
 */
async function generateAIResponse(agent, subscriber, conversationHistory, options = {}) {
  // Check OpenClaw availability once
  if (!openclawChecked) {
    openclawChecked = true;
    openclawEnabled = await isOpenClawConfigured();
    console.log(`[MSG] OpenClaw engine: ${openclawEnabled ? '✅ enabled' : '❌ disabled (using direct AI)'}`);
  }

  const FALLBACK_PROMPT = 'You are a helpful personal assistant. Be concise, friendly, and proactive.';

  // Build live context (calendar, email, reminders) — fresh every message
  let liveContext = '';
  try {
    liveContext = await buildLiveContext(subscriber);
  } catch (err) {
    console.error(`[MSG] Live context build failed: ${err.message}`);
  }

  // Compile SOUL.md FRESH on every call (used by both paths)
  let systemPrompt;
  try {
    systemPrompt = compileSoulMd({
      assistantName: agent.name,
      profileData: subscriber.profileData,
      subscriber,
      liveContext,
    });
  } catch (err) {
    console.error('[MSG] SOUL.md compilation failed, using DB fallback:', err.message);
    systemPrompt = agent.soulMd || agent.systemPrompt || FALLBACK_PROMPT;
  }

  // Log token budget check
  const budget = checkBudget(systemPrompt, conversationHistory);
  if (budget.warning) {
    console.warn(`[MSG] Token budget: ${budget.totalTokens} tokens (system:${budget.systemTokens} history:${budget.historyTokens})`);
  }

  // Reminder parser still runs as backup for simple "remind me" messages
  if (options.userMessage) {
    try {
      const tz = subscriber.profileData?.timezone || 'America/New_York';
      const parsed = parseReminderFromText(options.userMessage, tz);
      if (parsed) {
        await createReminder(subscriber.id, {
          title: parsed.title,
          dueAt: parsed.dueAt,
          agentId: agent.id,
        });
      }
    } catch (err) {
      console.error(`[MSG] Reminder parse/create failed: ${err.message}`);
    }
  }

  // ── Try OpenClaw first (if available) ──
  if (openclawEnabled) {
    console.log(`[MSG] Trying OpenClaw for agent:${agent.id}`);
    const ocResult = await callOpenClawWithContext(
      systemPrompt,
      conversationHistory,
      {
        userMessage: options.userMessage,
        subscriberPhone: subscriber.whatsappJid?.replace('@s.whatsapp.net', ''),
        sessionId: `sub-${subscriber.id}`,
      },
    );

    if (ocResult.content) {
      console.log(`[MSG_OUT] agent:${agent.id} engine:openclaw model:${ocResult.model} time:${ocResult.responseTimeMs}ms len:${ocResult.content.length}`);
      return ocResult.content;
    }

    // OpenClaw failed — log and fall through to direct AI
    console.warn(`[MSG] OpenClaw failed: ${ocResult.error}${ocResult.rawError ? ` (${ocResult.rawError})` : ''} — falling back to direct AI`);
  }

  // ── Fallback: Direct AI call (Anthropic → Groq → NVIDIA) ──
  if (!isAIConfigured()) {
    console.log(`[MSG_OUT] AI not configured, using stub for agent:${agent.id}`);
    return ERROR_MESSAGES.ai_not_configured;
  }

  const { content, error, tier, model, responseTimeMs } = await callAI(
    systemPrompt,
    conversationHistory,
    { userMessage: options.userMessage },
  );

  if (error) {
    console.error(`[ERROR] AI response error for agent:${agent.id} - ${error} (tier:${tier} model:${model})`);
    return ERROR_MESSAGES[error] || ERROR_MESSAGES.unknown;
  }

  console.log(`[MSG_OUT] agent:${agent.id} engine:direct tier:${tier} model:${model} time:${responseTimeMs}ms len:${content.length}`);
  return content;
}

export { findSubscriberByChannel, generateAIResponse };
