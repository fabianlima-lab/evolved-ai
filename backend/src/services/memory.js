import prisma from '../lib/prisma.js';

// ─────────────────────────────────────────────────────
// Memory Service
//
// Long-term memory for Luna. Stores structured facts
// about each subscriber across all conversations.
//
// The AI emits [ACTION:memory_save category="..." fact="..."]
// tags. These are silently saved — the user never sees
// memory operations in the chat.
//
// On each message, stored memories are loaded and injected
// into the system prompt via {{LIVE_CONTEXT}}.
// ─────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'relationships',
  'preferences',
  'schedule_patterns',
  'active_tasks',
  'career',
  'financial',
  'recent_context',
];

// Priority order for display in context
const CATEGORY_ORDER = [
  'relationships',
  'preferences',
  'schedule_patterns',
  'active_tasks',
  'career',
  'financial',
  'recent_context',
];

const CATEGORY_LABELS = {
  relationships: 'Relationships & People',
  preferences: 'Preferences',
  schedule_patterns: 'Schedule Patterns',
  active_tasks: 'Active Tasks & Goals',
  career: 'Career & Work',
  financial: 'Financial',
  recent_context: 'Recent Context',
};

const MAX_FACT_LENGTH = 200;
const MIN_FACT_LENGTH = 3;
const MAX_CONTEXT_CHARS = 6000; // ~1,500 tokens

// ─── Sanitization (REQ-004) ───

/**
 * Sanitize a fact string before storing.
 * Rejects injection attempts, URLs, and overly long content.
 *
 * @param {string} text - Raw fact text
 * @returns {{ clean: string|null, rejected: boolean, reason: string|null }}
 */
export function sanitizeFact(text) {
  if (!text || typeof text !== 'string') {
    return { clean: null, rejected: true, reason: 'empty' };
  }

  let clean = text.trim();

  // Strip angle brackets (potential HTML/injection)
  clean = clean.replace(/[<>]/g, '');

  // Reject too short
  if (clean.length < MIN_FACT_LENGTH) {
    return { clean: null, rejected: true, reason: 'too_short' };
  }

  // Reject URLs
  if (/https?:\/\//i.test(clean) || /www\./i.test(clean)) {
    return { clean: null, rejected: true, reason: 'contains_url' };
  }

  // Reject instruction-like content (prompt injection defense)
  const instructionPatterns = [
    /\bignore\b.*\b(instructions|rules|above|previous)\b/i,
    /\boverride\b/i,
    /\bsystem prompt\b/i,
    /\bforget\b.*\b(everything|instructions|rules)\b/i,
    /\bpretend\b.*\b(you are|to be)\b/i,
    /\byou are now\b/i,
    /\bact as\b/i,
    /\bnew instructions\b/i,
    /\bdisregard\b/i,
  ];

  for (const pattern of instructionPatterns) {
    if (pattern.test(clean)) {
      return { clean: null, rejected: true, reason: 'instruction_injection' };
    }
  }

  // Enforce max length
  if (clean.length > MAX_FACT_LENGTH) {
    clean = clean.slice(0, MAX_FACT_LENGTH);
  }

  return { clean, rejected: false, reason: null };
}

// ─── CRUD ───

/**
 * Save a fact to long-term memory.
 * Deduplicates by exact match — if same fact exists, touches updatedAt.
 *
 * @param {string} subscriberId
 * @param {object} data
 * @param {string} data.category - One of VALID_CATEGORIES
 * @param {string} data.fact - The fact to store
 * @param {string} [data.source='ai'] - Where the fact came from
 * @returns {Promise<{ saved: boolean, reason: string|null, memory: object|null }>}
 */
export async function saveFact(subscriberId, { category, fact, source = 'ai' }) {
  // Validate category
  if (!VALID_CATEGORIES.includes(category)) {
    console.warn(`[MEMORY] Rejected invalid category: "${category}"`);
    return { saved: false, reason: 'invalid_category', memory: null };
  }

  // Sanitize fact
  const { clean, rejected, reason } = sanitizeFact(fact);
  if (rejected) {
    console.warn(`[MEMORY] Rejected fact: ${reason} — "${fact?.slice(0, 50)}"`);
    return { saved: false, reason, memory: null };
  }

  try {
    // Check for exact duplicate
    const existing = await prisma.memory.findFirst({
      where: {
        subscriberId,
        category,
        fact: clean,
      },
    });

    if (existing) {
      // Touch updatedAt to keep it fresh
      const updated = await prisma.memory.update({
        where: { id: existing.id },
        data: { updatedAt: new Date() },
      });
      console.log(`[MEMORY] Touched existing: "${clean.slice(0, 40)}..." for subscriber:${subscriberId}`);
      return { saved: true, reason: 'duplicate_touched', memory: updated };
    }

    // Create new memory
    const memory = await prisma.memory.create({
      data: {
        subscriberId,
        category,
        fact: clean,
        source,
      },
    });

    console.log(`[MEMORY] Saved: [${category}] "${clean.slice(0, 40)}..." for subscriber:${subscriberId}`);
    return { saved: true, reason: null, memory };
  } catch (err) {
    console.error(`[MEMORY] Save failed: ${err.message}`);
    return { saved: false, reason: 'db_error', memory: null };
  }
}

/**
 * Get all memories for a subscriber.
 *
 * @param {string} subscriberId
 * @returns {Promise<Array>}
 */
export async function getMemories(subscriberId) {
  return prisma.memory.findMany({
    where: { subscriberId },
    orderBy: [
      { category: 'asc' },
      { updatedAt: 'desc' },
    ],
  });
}

/**
 * Format memories as plain text for injection into SOUL.md context.
 * Groups by category in priority order, respects token budget.
 *
 * @param {Array} memories - Array of memory records
 * @returns {string}
 */
export function formatMemoriesForContext(memories) {
  if (!memories || memories.length === 0) {
    return '';
  }

  // Group by category
  const grouped = {};
  for (const m of memories) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m.fact);
  }

  const lines = ['🧠 WHAT I REMEMBER ABOUT YOU:'];
  let totalChars = lines[0].length;

  for (const cat of CATEGORY_ORDER) {
    if (!grouped[cat] || grouped[cat].length === 0) continue;

    const label = CATEGORY_LABELS[cat] || cat;
    const header = `\n${label}:`;

    // Check budget before adding header
    if (totalChars + header.length > MAX_CONTEXT_CHARS) break;

    lines.push(header);
    totalChars += header.length;

    for (const fact of grouped[cat]) {
      const line = `- ${fact}`;
      if (totalChars + line.length + 1 > MAX_CONTEXT_CHARS) break;
      lines.push(line);
      totalChars += line.length + 1; // +1 for newline
    }
  }

  return lines.join('\n');
}

/**
 * Delete expired recent_context entries (older than 14 days).
 *
 * @returns {Promise<number>} Number of deleted records
 */
export async function cleanExpiredRecentContext() {
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const result = await prisma.memory.deleteMany({
    where: {
      category: 'recent_context',
      updatedAt: { lt: cutoff },
    },
  });

  if (result.count > 0) {
    console.log(`[MEMORY] Cleaned ${result.count} expired recent_context entries`);
  }

  return result.count;
}

/**
 * Seed initial memories from subscriber profile data.
 * Called after agent creation to pre-populate memory so
 * the system isn't empty on day one.
 *
 * @param {string} subscriberId
 * @param {object|null} profileData - Subscriber's profileData JSON
 * @returns {Promise<number>} Number of memories seeded
 */
export async function seedMemoriesFromProfile(subscriberId, profileData) {
  if (!profileData) return 0;

  let seeded = 0;

  // Seed role
  if (profileData.role) {
    const result = await saveFact(subscriberId, {
      category: 'career',
      fact: `Role: ${profileData.role}`,
      source: 'onboarding',
    });
    if (result.saved) seeded++;
  }

  // Seed priorities
  if (profileData.priorities) {
    const priorities = Array.isArray(profileData.priorities)
      ? profileData.priorities
      : [profileData.priorities];

    for (const priority of priorities) {
      const result = await saveFact(subscriberId, {
        category: 'active_tasks',
        fact: `Priority: ${priority}`,
        source: 'onboarding',
      });
      if (result.saved) seeded++;
    }
  }

  // Seed desired feeling
  if (profileData.desiredFeeling) {
    const result = await saveFact(subscriberId, {
      category: 'preferences',
      fact: `Wants weeks to feel: ${profileData.desiredFeeling}`,
      source: 'onboarding',
    });
    if (result.saved) seeded++;
  }

  if (seeded > 0) {
    console.log(`[MEMORY] Seeded ${seeded} memories from profile for subscriber:${subscriberId}`);
  }

  return seeded;
}

export { VALID_CATEGORIES, CATEGORY_ORDER, MAX_FACT_LENGTH, MIN_FACT_LENGTH, MAX_CONTEXT_CHARS };
