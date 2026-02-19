// ─────────────────────────────────────────────────────
// Token Budget Manager
//
// Prevents context window overflow by:
//   1. Estimating token counts (1 token ≈ 4 chars)
//   2. Enforcing budgets for each context section
//   3. Progressively truncating when over budget
//
// Budget allocation (target: under 20K tokens):
//   SOUL.md system prompt:   ~4,000 tokens
//   Live context:            ~2,000 tokens
//   Memory:                  ~1,500 tokens (6,000 chars max already)
//   Conversation history:    ~8,000 tokens (20 messages)
//   Response headroom:       ~4,500 tokens
//   ─────────────────────────────────────────────
//   Total:                   ~20,000 tokens
//
// Hard cap: 50,000 tokens — if exceeded, aggressively truncate
// ─────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;

// Budget limits in tokens
const BUDGET = {
  systemPrompt: 5000,       // SOUL.md + live context
  conversationHistory: 8000, // Messages
  totalHardCap: 50000,      // Absolute max
  totalTarget: 20000,       // Target max
};

// Message count limits
const MAX_MESSAGES_DEFAULT = 20;
const MAX_MESSAGES_REDUCED = 10;
const MAX_MESSAGES_MINIMAL = 5;

/**
 * Estimate token count from a string.
 * Approximation: 1 token ≈ 4 characters.
 *
 * @param {string} text
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncate conversation history to fit within token budget.
 * Keeps the most recent messages, drops oldest first.
 *
 * @param {Array<{role: string, content: string}>} messages - Conversation history (chronological)
 * @param {number} systemPromptTokens - Tokens used by system prompt
 * @returns {{ messages: Array, truncated: boolean, originalCount: number, finalCount: number }}
 */
export function truncateConversation(messages, systemPromptTokens = 0) {
  if (!messages || messages.length === 0) {
    return { messages: [], truncated: false, originalCount: 0, finalCount: 0 };
  }

  const originalCount = messages.length;
  const remainingBudget = BUDGET.totalTarget - systemPromptTokens;
  const historyBudget = Math.min(remainingBudget, BUDGET.conversationHistory * CHARS_PER_TOKEN);

  // First pass: try with all messages
  let totalChars = messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);

  if (totalChars <= historyBudget) {
    return { messages, truncated: false, originalCount, finalCount: originalCount };
  }

  // Need to truncate — keep most recent messages
  // Determine max messages based on how tight the budget is
  let maxMessages = MAX_MESSAGES_DEFAULT;
  if (systemPromptTokens > BUDGET.systemPrompt) {
    maxMessages = MAX_MESSAGES_REDUCED; // System prompt is large, reduce history
  }

  let truncated = [...messages];

  // Start by limiting message count
  if (truncated.length > maxMessages) {
    truncated = truncated.slice(-maxMessages);
  }

  // Check if still over budget
  totalChars = truncated.reduce((sum, m) => sum + (m.content?.length || 0), 0);

  while (totalChars > historyBudget && truncated.length > MAX_MESSAGES_MINIMAL) {
    truncated = truncated.slice(1); // Remove oldest message
    totalChars = truncated.reduce((sum, m) => sum + (m.content?.length || 0), 0);
  }

  // If individual messages are very long, truncate their content
  if (totalChars > historyBudget && truncated.length <= MAX_MESSAGES_MINIMAL) {
    const maxPerMessage = Math.floor(historyBudget / truncated.length);
    truncated = truncated.map((m) => ({
      ...m,
      content: m.content?.length > maxPerMessage
        ? m.content.slice(-maxPerMessage) + '...[truncated]'
        : m.content,
    }));
  }

  const finalCount = truncated.length;

  if (finalCount < originalCount) {
    console.log(`[TOKEN-BUDGET] Truncated conversation: ${originalCount} → ${finalCount} messages`);
  }

  return { messages: truncated, truncated: finalCount < originalCount, originalCount, finalCount };
}

/**
 * Check if total context is within budget and log warnings.
 *
 * @param {string} systemPrompt - Full system prompt
 * @param {Array} conversationHistory - Messages array
 * @returns {{ totalTokens: number, withinBudget: boolean, warning: string|null }}
 */
export function checkBudget(systemPrompt, conversationHistory) {
  const systemTokens = estimateTokens(systemPrompt);
  const historyTokens = conversationHistory.reduce(
    (sum, m) => sum + estimateTokens(m.content), 0
  );
  const totalTokens = systemTokens + historyTokens;

  let warning = null;

  if (totalTokens > BUDGET.totalHardCap) {
    warning = `CRITICAL: ${totalTokens} tokens exceeds hard cap of ${BUDGET.totalHardCap}`;
    console.error(`[TOKEN-BUDGET] ${warning}`);
  } else if (totalTokens > BUDGET.totalTarget) {
    warning = `WARNING: ${totalTokens} tokens exceeds target of ${BUDGET.totalTarget}`;
    console.warn(`[TOKEN-BUDGET] ${warning}`);
  }

  return {
    totalTokens,
    systemTokens,
    historyTokens,
    withinBudget: totalTokens <= BUDGET.totalHardCap,
    warning,
  };
}

export { BUDGET, MAX_MESSAGES_DEFAULT, MAX_MESSAGES_REDUCED };
