import { isTrialExpired, stripHtml } from '../utils/helpers.js';
import { compileSoulMd } from '../prompts/soul.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { sendTypingIndicator } from './baileys.js';
import { callOpenClawWithContext, isOpenClawConfigured } from './openclaw-bridge.js';
import { buildLiveContext } from './context-builder.js';
import { parseReminderFromText } from '../utils/reminder-parser.js';
import { createReminder } from './reminders.js';
import { parseActions, stripActionTags, hasActions } from '../utils/action-parser.js';
import { executeAllActions } from './action-executor.js';
import { truncateConversation, checkBudget } from '../utils/token-budget.js';
import { assertTenantAccess } from '../utils/tenant-guard.js';
import prisma from '../lib/prisma.js';

// Track OpenClaw availability (checked once at first message)
let openclawChecked = false;
let openclawEnabled = false;

const MAX_MESSAGE_LENGTH = 4000;

// User-friendly error messages — OpenClaw only, no fallback
const ERROR_MESSAGES = {
  not_available: "⚙️ I'm starting up — give me a minute and try again.",
  timeout: "⏳ I'm thinking extra hard on this one... but I timed out. Could you try again or rephrase?",
  rate_limited: "🛡️ I'm getting a lot of requests right now. Give me a moment and try again.",
  empty_response: "🤔 I drew a blank on that one. Could you rephrase your question?",
  unknown: "⚠️ Something went wrong on my end. Try again in a moment.",
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

    // ── Trait recalculation (fire-and-forget, every ~10 messages) ──
    try {
      const msgCount = await prisma.message.count({ where: { subscriberId: subscriber.id } });
      if (msgCount % 10 === 0) {
        import('./companion.js').then(({ updateTraits }) => {
          updateTraits(agent.id, subscriber.id).catch(() => {});
        });
      }
    } catch (_) { /* non-fatal */ }

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
 * Generate AI response via OpenClaw Gateway. No fallback — OpenClaw or nothing.
 *
 * OpenClaw handles: SOUL.md personality, session memory, model routing, tools
 * Our code handles: Live context injection (calendar/email), reminder parsing
 */
async function generateAIResponse(agent, subscriber, conversationHistory, options = {}) {
  // Check OpenClaw availability once
  if (!openclawChecked) {
    openclawChecked = true;
    openclawEnabled = await isOpenClawConfigured();
    console.log(`[MSG] OpenClaw engine: ${openclawEnabled ? '✅ online' : '❌ offline'}`);
  }

  if (!openclawEnabled) {
    console.error(`[MSG] OpenClaw not available — cannot process message for agent:${agent.id}`);
    return ERROR_MESSAGES.not_available;
  }

  // Build live context (calendar, email, reminders) — fresh every message
  let liveContext = '';
  try {
    liveContext = await buildLiveContext(subscriber);
  } catch (err) {
    console.error(`[MSG] Live context build failed: ${err.message}`);
  }

  // Compile SOUL.md FRESH on every call
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
    systemPrompt = agent.soulMd || agent.systemPrompt || 'You are a helpful personal assistant.';
  }

  // Log token budget check
  const budget = checkBudget(systemPrompt, conversationHistory);
  if (budget.warning) {
    console.warn(`[MSG] Token budget: ${budget.totalTokens} tokens (system:${budget.systemTokens} history:${budget.historyTokens})`);
  }

  // Reminder parser still runs for simple "remind me" messages
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

  // ── Call OpenClaw ──
  console.log(`[MSG] Calling OpenClaw for agent:${agent.id}`);
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

  // OpenClaw failed — return error, no fallback
  console.error(`[MSG] OpenClaw failed: ${ocResult.error}${ocResult.rawError ? ` (${ocResult.rawError})` : ''}`);
  return ERROR_MESSAGES[ocResult.error] || ERROR_MESSAGES.unknown;
}

export { findSubscriberByChannel, generateAIResponse };
