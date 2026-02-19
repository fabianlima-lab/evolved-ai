/**
 * USER.md Generator for OpenClaw Workspace
 *
 * Generates the USER.md file that OpenClaw injects into the agent context.
 * This file should ONLY contain user-specific data — personality, rules,
 * actions, and behavior all live in SOUL.md and AGENTS.md (managed in
 * the OpenClaw workspace, NOT here).
 *
 * OpenClaw loads ALL workspace files (SOUL.md, AGENTS.md, USER.md,
 * IDENTITY.md, TOOLS.md) into the context window on every session start.
 * Duplicating content across files wastes tokens and confuses the model.
 *
 * Template variables:
 *   {{USER_NAME}} - subscriber profile name
 *   {{USER_ROLE}} - subscriber profile role
 *   {{USER_PRIORITIES}} - comma-separated priorities
 *   {{USER_DESIRED_FEELING}} - how they want their weeks to feel
 *   {{USER_DRAINS}} - biggest energy drains from onboarding
 *   {{USER_PREFERENCES}} - preferences or "None yet"
 *   {{BRIEFING_TIME}} - morning briefing time (default 7:00 AM)
 *   {{WRAP_TIME}} - end of day wrap time (default 8:00 PM)
 *   {{USER_TIMEZONE}} - timezone (default America/New_York)
 *   {{LIVE_CONTEXT}} - real-time data from Calendar, Gmail, Reminders
 */

// ─────────────────────────────────────────────────────
// USER.md Template (user context only — no personality duplication)
// ─────────────────────────────────────────────────────
const USER_MD_TEMPLATE = `# User Profile

Name: {{USER_NAME}}
Role: {{USER_ROLE}}
Timezone: {{USER_TIMEZONE}}
Biggest drains: {{USER_DRAINS}}
Priorities: {{USER_PRIORITIES}}
Desired feeling: {{USER_DESIRED_FEELING}}
Preferences: {{USER_PREFERENCES}}
Briefing: {{BRIEFING_TIME}} / Wrap: {{WRAP_TIME}}

# Live Context (refreshed this message)

{{LIVE_CONTEXT}}

If a service says "not connected" — tell the user it's not connected yet.
Only reference personal data that is ACTUALLY shown above. If you don't see it, you don't have it.
The current date and year are in the 🕐 RIGHT NOW line — always use THAT year.`;

// ─────────────────────────────────────────────────────
// Compiler
// ─────────────────────────────────────────────────────

/**
 * Compile a USER.md for an OpenClaw agent workspace.
 * Only contains user-specific data — personality and behavior
 * are defined in SOUL.md and AGENTS.md in the workspace.
 *
 * @param {object} options
 * @param {string} options.assistantName - The name chosen for the assistant (unused — comes from IDENTITY.md)
 * @param {object|null} [options.profileData] - Subscriber's profileData JSON
 * @param {object} [options.subscriber] - Subscriber record
 * @param {string} [options.liveContext] - Real-time context (calendar, email, reminders)
 * @returns {string} Complete USER.md ready to write to workspace
 */
// Human-readable labels for drain IDs from onboarding
const DRAIN_LABELS = {
  schedule_chaos: 'Schedule chaos (back-to-back shifts, no recovery time)',
  admin_overload: 'Admin overload (emails, forms, follow-ups piling up)',
  decision_fatigue: 'Decision fatigue (too many small choices)',
  mental_load: 'Mental load (carrying everything in your head)',
};

export function compileSoulMd({ assistantName, profileData = null, subscriber = null, liveContext = '' }) {
  const userName = profileData?.name || subscriber?.name || 'there';
  const userRole = profileData?.role || 'Not specified yet';
  const userDrains = Array.isArray(profileData?.drains)
    ? profileData.drains.map((d) => DRAIN_LABELS[d] || d).join(', ')
    : 'Not shared yet';
  const userPriorities = Array.isArray(profileData?.priorities)
    ? profileData.priorities.join(', ')
    : profileData?.priorities || 'Not specified yet';
  const desiredFeeling = profileData?.desiredFeeling || 'Not shared yet — learning over time';
  const preferences = profileData?.preferences || 'None yet — learning over time';
  const briefingTime = profileData?.briefingTime || '7:00 AM';
  const wrapTime = profileData?.wrapTime || '8:00 PM';
  const timezone = profileData?.timezone || 'America/New_York';

  return USER_MD_TEMPLATE
    .replace(/\{\{USER_NAME\}\}/g, userName)
    .replace(/\{\{USER_ROLE\}\}/g, userRole)
    .replace(/\{\{USER_DRAINS\}\}/g, userDrains)
    .replace(/\{\{USER_PRIORITIES\}\}/g, userPriorities)
    .replace(/\{\{USER_DESIRED_FEELING\}\}/g, desiredFeeling)
    .replace(/\{\{USER_PREFERENCES\}\}/g, preferences)
    .replace(/\{\{BRIEFING_TIME\}\}/g, briefingTime)
    .replace(/\{\{WRAP_TIME\}\}/g, wrapTime)
    .replace(/\{\{USER_TIMEZONE\}\}/g, timezone)
    .replace(/\{\{LIVE_CONTEXT\}\}/g, liveContext || 'No live data available — integrations not yet connected.');
}

/**
 * Get the raw template for display or preview.
 * @returns {string}
 */
export function getSoulTemplate() {
  return USER_MD_TEMPLATE;
}

// Legacy export name kept for backward compatibility
export { USER_MD_TEMPLATE as SOUL_MD_TEMPLATE, USER_MD_TEMPLATE };
