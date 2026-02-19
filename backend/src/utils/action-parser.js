// ─────────────────────────────────────────────────────
// Action Tag Parser
//
// Detects [ACTION:type key=value key=value] tags in AI
// responses and parses them into executable action objects.
//
// The AI is trained (via SOUL.md) to emit these tags
// when the user asks it to DO something (create event,
// send email, etc.). The message router intercepts them,
// executes them, and replaces the tag with a result.
//
// Tag format:
//   [ACTION:action_name key="value" key2="value2"]
//
// Examples:
//   [ACTION:create_event title="Dentist appointment" start="2026-02-19T14:00:00" end="2026-02-19T15:00:00"]
//   [ACTION:send_email to="john@example.com" subject="Meeting tomorrow" body="Hey John, ..."]
//   [ACTION:create_draft to="boss@work.com" subject="Sick day" body="Hi, I won't be..."]
//   [ACTION:mark_read ids="msg123,msg456"]
//   [ACTION:create_reminder title="Call dentist" due="2026-02-19T10:00:00"]
// ─────────────────────────────────────────────────────

// Regex to find action tags — handles multiline content in quoted values
// Uses [\s\S]*? instead of [^"]*? so values containing newlines (like doc content) get matched
const ACTION_TAG_RE = /\[ACTION:(\w+)((?:\s+\w+="[\s\S]*?")*)\]/g;

// Parse key="value" pairs — also multiline safe
const PARAM_RE = /(\w+)="([\s\S]*?)"/g;

/**
 * Extract all action tags from an AI response.
 *
 * @param {string} text - Raw AI response text
 * @returns {Array<{action: string, params: object, raw: string}>}
 */
export function parseActions(text) {
  if (!text) return [];

  const actions = [];
  let match;

  // Reset lastIndex for global regex
  ACTION_TAG_RE.lastIndex = 0;

  while ((match = ACTION_TAG_RE.exec(text)) !== null) {
    const actionType = match[1];
    const paramString = match[2];
    const raw = match[0]; // Full matched tag for replacement

    const params = {};
    let paramMatch;
    PARAM_RE.lastIndex = 0;

    while ((paramMatch = PARAM_RE.exec(paramString)) !== null) {
      params[paramMatch[1]] = paramMatch[2];
    }

    actions.push({ action: actionType, params, raw });
  }

  return actions;
}

/**
 * Strip all action tags from text (after execution).
 *
 * @param {string} text - AI response with action tags
 * @returns {string} Clean text without action tags
 */
export function stripActionTags(text) {
  if (!text) return '';
  ACTION_TAG_RE.lastIndex = 0;
  return text.replace(ACTION_TAG_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Check if text contains any action tags.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function hasActions(text) {
  if (!text) return false;
  ACTION_TAG_RE.lastIndex = 0;
  return ACTION_TAG_RE.test(text);
}
