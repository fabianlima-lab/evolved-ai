import prisma from '../lib/prisma.js';

// ─────────────────────────────────────────────────────
// Evolution Service
//
// Tracks the growth journey of each AI agent:
//   - Skills installed / activated
//   - Integrations connected
//   - Timeline events (milestones, pages built, etc.)
//   - Trait calculation from usage data
//   - Level computation
//   - Admin global push (deploy skill to ALL agents)
// ─────────────────────────────────────────────────────

// ─── Events ───

/**
 * Record an evolution event on the agent's timeline.
 *
 * @param {string} agentId
 * @param {string} subscriberId
 * @param {object} data
 * @param {string} data.eventType - milestone|learning|connection|skill_installed|integration_connected|page_built|admin_push
 * @param {string} data.title
 * @param {string} [data.description]
 * @param {object} [data.metadata]
 * @returns {Promise<object>}
 */
export async function recordEvent(agentId, subscriberId, { eventType, title, description, metadata }) {
  const event = await prisma.agentEvent.create({
    data: {
      agentId,
      subscriberId,
      eventType,
      title,
      description: description || null,
      metadata: metadata || undefined,
    },
  });

  console.log(`[EVOLUTION] Event recorded: [${eventType}] "${title}" for agent:${agentId}`);
  return event;
}

/**
 * Get the evolution timeline for an agent.
 *
 * @param {string} agentId
 * @param {object} [options]
 * @param {number} [options.limit=50]
 * @param {number} [options.offset=0]
 * @returns {Promise<Array>}
 */
export async function getEvolutionTimeline(agentId, { limit = 50, offset = 0 } = {}) {
  return prisma.agentEvent.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

// ─── Skills ───

/**
 * Install a skill for an agent (status starts as 'available').
 *
 * @param {string} agentId
 * @param {string} subscriberId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function installSkill(agentId, subscriberId, { slug, name, description, icon, category, requiredIntegration, source = 'admin' }) {
  const skill = await prisma.agentSkill.upsert({
    where: { agentId_slug: { agentId, slug } },
    update: { name, description, icon, category, requiredIntegration, source },
    create: {
      agentId,
      subscriberId,
      slug,
      name,
      description: description || null,
      icon: icon || null,
      category: category || 'productivity',
      requiredIntegration: requiredIntegration || null,
      source,
      installedBy: source,
      status: 'available',
    },
  });

  console.log(`[EVOLUTION] Skill installed: "${name}" (${slug}) for agent:${agentId}`);
  return skill;
}

/**
 * Activate a skill (change status to 'active').
 *
 * @param {string} agentId
 * @param {string} subscriberId
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export async function activateSkill(agentId, subscriberId, slug) {
  const skill = await prisma.agentSkill.findUnique({
    where: { agentId_slug: { agentId, slug } },
  });

  if (!skill) return null;

  const updated = await prisma.agentSkill.update({
    where: { id: skill.id },
    data: { status: 'active', activatedAt: new Date() },
  });

  // Record timeline event
  await recordEvent(agentId, subscriberId, {
    eventType: 'skill_installed',
    title: `Activated skill: ${skill.name}`,
    metadata: { slug },
  });

  console.log(`[EVOLUTION] Skill activated: "${skill.name}" (${slug}) for agent:${agentId}`);
  return updated;
}

/**
 * Get all skills for an agent.
 *
 * @param {string} agentId
 * @returns {Promise<Array>}
 */
export async function getSkills(agentId) {
  return prisma.agentSkill.findMany({
    where: { agentId },
    orderBy: { createdAt: 'asc' },
  });
}

// ─── Integrations ───

/**
 * Install an integration for an agent (status starts as 'available').
 *
 * @param {string} agentId
 * @param {string} subscriberId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function installIntegration(agentId, subscriberId, { slug, name, description, icon, benefits, setupPrompt }) {
  const integration = await prisma.agentIntegration.upsert({
    where: { agentId_slug: { agentId, slug } },
    update: { name, description, icon, benefits, setupPrompt },
    create: {
      agentId,
      subscriberId,
      slug,
      name,
      description: description || null,
      icon: icon || null,
      benefits: benefits || undefined,
      setupPrompt: setupPrompt || null,
      status: 'available',
    },
  });

  console.log(`[EVOLUTION] Integration installed: "${name}" (${slug}) for agent:${agentId}`);
  return integration;
}

/**
 * Mark an integration as connected.
 *
 * @param {string} agentId
 * @param {string} subscriberId
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export async function connectIntegration(agentId, subscriberId, slug) {
  const integration = await prisma.agentIntegration.findUnique({
    where: { agentId_slug: { agentId, slug } },
  });

  if (!integration) return null;

  const updated = await prisma.agentIntegration.update({
    where: { id: integration.id },
    data: { status: 'connected', connectedAt: new Date() },
  });

  await recordEvent(agentId, subscriberId, {
    eventType: 'integration_connected',
    title: `Connected: ${integration.name}`,
    metadata: { slug },
  });

  console.log(`[EVOLUTION] Integration connected: "${integration.name}" (${slug}) for agent:${agentId}`);
  return updated;
}

/**
 * Get all integrations for an agent.
 *
 * @param {string} agentId
 * @returns {Promise<Array>}
 */
export async function getIntegrations(agentId) {
  return prisma.agentIntegration.findMany({
    where: { agentId },
    orderBy: { createdAt: 'asc' },
  });
}

// ─── Traits & Level ───

/**
 * Calculate trait scores from usage data.
 * Returns object with warmth, knowsYou, reliability, growth (0-100 each).
 *
 * @param {string} subscriberId
 * @returns {Promise<{ warmth: number, knowsYou: number, reliability: number, growth: number }>}
 */
export async function calculateTraits(subscriberId) {
  const sub = await prisma.subscriber.findUnique({
    where: { id: subscriberId },
    include: {
      agent: true,
      messages: { select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 500 },
      memories: { select: { id: true } },
      reminders: { select: { id: true, status: true } },
      expenses: { select: { id: true } },
    },
  });

  if (!sub || !sub.agent) {
    return { warmth: 0, knowsYou: 0, reliability: 0, growth: 0 };
  }

  const totalMessages = sub.messages.length;
  const totalMemories = sub.memories.length;
  const completedReminders = sub.reminders.filter(r => r.status === 'completed').length;
  const totalReminders = sub.reminders.length;

  // Days since creation
  const daysSinceCreation = Math.max(1, (Date.now() - new Date(sub.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  // Warmth: based on message volume and frequency
  const messagesPerDay = totalMessages / daysSinceCreation;
  const warmth = Math.min(100, Math.round(messagesPerDay * 15 + Math.min(totalMessages / 5, 30)));

  // KnowsYou: based on memories stored
  const knowsYou = Math.min(100, Math.round(totalMemories * 8));

  // Reliability: based on reminder completion rate
  const reliability = totalReminders > 0
    ? Math.min(100, Math.round((completedReminders / totalReminders) * 80 + Math.min(totalReminders * 2, 20)))
    : 10; // Base score if no reminders yet

  // Growth: based on skills, integrations, and overall engagement
  const skills = await prisma.agentSkill.count({ where: { agentId: sub.agent.id, status: 'active' } });
  const integrations = await prisma.agentIntegration.count({ where: { agentId: sub.agent.id, status: 'connected' } });
  const growth = Math.min(100, Math.round(
    skills * 10 + integrations * 15 + Math.min(daysSinceCreation, 30) + Math.min(totalMessages / 10, 20),
  ));

  return { warmth, knowsYou, reliability, growth };
}

/**
 * Calculate agent level from trait scores.
 * Level 1: starting, Level 2: familiar, Level 3: trusted, Level 4+: evolved
 *
 * @param {{ warmth: number, knowsYou: number, reliability: number, growth: number }} traits
 * @returns {number}
 */
export function calculateLevel(traits) {
  const avg = (traits.warmth + traits.knowsYou + traits.reliability + traits.growth) / 4;

  if (avg >= 75) return 4;
  if (avg >= 50) return 3;
  if (avg >= 25) return 2;
  return 1;
}

// ─── Admin Global Push ───

// Default skills seeded on agent creation
export const DEFAULT_SKILLS = [
  { slug: 'morning-briefings', name: 'Morning Briefings', description: 'Daily morning check-in with weather, schedule, and intentions', icon: 'sunrise', category: 'communication' },
  { slug: 'chat-voice', name: 'Chat & Voice', description: 'Natural conversation via WhatsApp text and voice messages', icon: 'message-circle', category: 'communication' },
  { slug: 'research', name: 'Research', description: 'Web search, news lookups, and information gathering', icon: 'search', category: 'research' },
  { slug: 'task-management', name: 'Task Management', description: 'Track tasks across backlog, todo, in-progress, and done', icon: 'check-square', category: 'productivity' },
  { slug: 'notes-memory', name: 'Notes & Memory', description: 'Remember facts, preferences, and important details about you', icon: 'brain', category: 'productivity' },
  { slug: 'reminders', name: 'Reminders', description: 'Set and manage time-based reminders via WhatsApp', icon: 'bell', category: 'productivity' },
];

// Default integrations seeded on agent creation
export const DEFAULT_INTEGRATIONS = [
  { slug: 'whatsapp', name: 'WhatsApp', description: 'Primary communication channel', icon: 'message-circle', benefits: ['Text messaging', 'Voice messages', 'Reminders'] },
];

/**
 * Seed default skills and integrations for a newly created agent.
 *
 * @param {string} agentId
 * @param {string} subscriberId
 * @param {{ whatsappConnected?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function seedDefaults(agentId, subscriberId, { whatsappConnected = false } = {}) {
  // Seed skills
  for (const skill of DEFAULT_SKILLS) {
    await installSkill(agentId, subscriberId, { ...skill, source: 'admin' });
  }

  // Activate chat & voice and notes by default
  await activateSkill(agentId, subscriberId, 'chat-voice');
  await activateSkill(agentId, subscriberId, 'notes-memory');

  // Seed integrations
  for (const integration of DEFAULT_INTEGRATIONS) {
    await installIntegration(agentId, subscriberId, integration);
  }

  // If WhatsApp already connected, mark it
  if (whatsappConnected) {
    await connectIntegration(agentId, subscriberId, 'whatsapp');
  }

  // Record milestone
  await recordEvent(agentId, subscriberId, {
    eventType: 'milestone',
    title: 'Agent created',
    description: 'Your AI assistant has been set up and is ready to grow with you.',
  });

  console.log(`[EVOLUTION] Seeded defaults for agent:${agentId}`);
}

/**
 * Push a new skill to ALL active agents (admin global deploy).
 *
 * @param {object} skillData - { slug, name, description, icon, category }
 * @returns {Promise<number>} Number of agents updated
 */
export async function pushSkillToAll(skillData) {
  const agents = await prisma.agent.findMany({
    where: { isActive: true },
    select: { id: true, subscriberId: true },
  });

  let count = 0;
  for (const agent of agents) {
    await installSkill(agent.id, agent.subscriberId, { ...skillData, source: 'admin' });

    await recordEvent(agent.id, agent.subscriberId, {
      eventType: 'admin_push',
      title: `New skill available: ${skillData.name}`,
      metadata: { slug: skillData.slug },
    });

    count++;
  }

  console.log(`[EVOLUTION] Pushed skill "${skillData.name}" to ${count} agents`);
  return count;
}

/**
 * Push a new integration to ALL active agents (admin global deploy).
 *
 * @param {object} integrationData - { slug, name, description, icon, benefits, setupPrompt }
 * @returns {Promise<number>} Number of agents updated
 */
export async function pushIntegrationToAll(integrationData) {
  const agents = await prisma.agent.findMany({
    where: { isActive: true },
    select: { id: true, subscriberId: true },
  });

  let count = 0;
  for (const agent of agents) {
    await installIntegration(agent.id, agent.subscriberId, integrationData);

    await recordEvent(agent.id, agent.subscriberId, {
      eventType: 'admin_push',
      title: `New integration available: ${integrationData.name}`,
      metadata: { slug: integrationData.slug },
    });

    count++;
  }

  console.log(`[EVOLUTION] Pushed integration "${integrationData.name}" to ${count} agents`);
  return count;
}
