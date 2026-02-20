import prisma from '../lib/prisma.js';
import { calculateTraits, calculateLevel, getEvolutionTimeline, getSkills, getIntegrations } from './evolution.js';

// ─────────────────────────────────────────────────────
// Companion Service
//
// Builds the full "companion" view for the dashboard:
//   - Agent identity (name, personality)
//   - Trait scores (warmth, knowsYou, reliability, growth)
//   - Level
//   - Evolution journey (recent events)
//   - Active skills & connected integrations
//   - Daily intention
//
// The companion is the user's personalized AI — this
// service assembles everything the frontend needs to
// render the "Meet [AI Name]" and dashboard pages.
// ─────────────────────────────────────────────────────

/**
 * Get the full companion profile for a subscriber.
 *
 * @param {string} subscriberId
 * @returns {Promise<object|null>}
 */
export async function getCompanion(subscriberId) {
  const sub = await prisma.subscriber.findUnique({
    where: { id: subscriberId },
    include: {
      agent: true,
    },
  });

  if (!sub || !sub.agent) return null;

  const agent = sub.agent;

  // Calculate traits and level
  const traits = await calculateTraits(subscriberId);
  const level = calculateLevel(traits);

  // Get recent journey events
  const journey = await getEvolutionTimeline(agent.id, { limit: 20 });

  // Get skills and integrations
  const skills = await getSkills(agent.id);
  const integrations = await getIntegrations(agent.id);

  // Get today's intention
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const intention = await prisma.dailyIntention.findUnique({
    where: {
      subscriberId_date: {
        subscriberId,
        date: today,
      },
    },
  });

  // Get message stats
  const totalMessages = await prisma.message.count({
    where: { subscriberId },
  });

  const daysSinceCreation = Math.max(1, Math.ceil(
    (Date.now() - new Date(sub.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  ));

  return {
    id: agent.id,
    name: agent.name,
    personality: agent.personality,
    level,
    traits,
    journey: journey.map(e => ({
      id: e.id,
      eventType: e.eventType,
      title: e.title,
      description: e.description,
      metadata: e.metadata,
      createdAt: e.createdAt,
    })),
    skills: skills.map(s => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description,
      icon: s.icon,
      category: s.category,
      status: s.status,
      requiredIntegration: s.requiredIntegration,
      activatedAt: s.activatedAt,
    })),
    integrations: integrations.map(i => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      description: i.description,
      icon: i.icon,
      benefits: i.benefits,
      setupPrompt: i.setupPrompt,
      status: i.status,
      connectedAt: i.connectedAt,
    })),
    intention: intention ? {
      feeling: intention.feeling,
      source: intention.source,
      setAt: intention.setAt,
    } : null,
    stats: {
      totalMessages,
      daysSinceCreation,
      activeSkills: skills.filter(s => s.status === 'active').length,
      connectedIntegrations: integrations.filter(i => i.status === 'connected').length,
    },
  };
}

/**
 * Update trait scores and level for an agent.
 * Recalculates from usage data and persists to the Agent record.
 *
 * @param {string} agentId
 * @param {string} subscriberId
 * @returns {Promise<{ traits: object, level: number }>}
 */
export async function updateTraits(agentId, subscriberId) {
  const traits = await calculateTraits(subscriberId);
  const level = calculateLevel(traits);

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      traitWarmth: traits.warmth,
      traitKnowsYou: traits.knowsYou,
      traitReliability: traits.reliability,
      traitGrowth: traits.growth,
      level,
    },
  });

  console.log(`[COMPANION] Traits updated for agent:${agentId} — level:${level} warmth:${traits.warmth} knowsYou:${traits.knowsYou} reliability:${traits.reliability} growth:${traits.growth}`);
  return { traits, level };
}

/**
 * Set today's daily intention for a subscriber.
 *
 * @param {string} subscriberId
 * @param {object} data
 * @param {string} data.feeling
 * @param {string} [data.source='manual']
 * @param {Array} [data.optionsOffered]
 * @param {boolean} [data.wasCustom=false]
 * @returns {Promise<object>}
 */
export async function setDailyIntention(subscriberId, { feeling, source = 'manual', optionsOffered, wasCustom = false }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const intention = await prisma.dailyIntention.upsert({
    where: {
      subscriberId_date: {
        subscriberId,
        date: today,
      },
    },
    update: {
      feeling,
      source,
      optionsOffered: optionsOffered || undefined,
      wasCustom,
      setAt: new Date(),
    },
    create: {
      subscriberId,
      date: today,
      feeling,
      source,
      optionsOffered: optionsOffered || undefined,
      wasCustom,
    },
  });

  console.log(`[COMPANION] Daily intention set for subscriber:${subscriberId}: "${feeling}"`);
  return intention;
}

/**
 * Get today's daily intention for a subscriber.
 *
 * @param {string} subscriberId
 * @returns {Promise<object|null>}
 */
export async function getTodayIntention(subscriberId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.dailyIntention.findUnique({
    where: {
      subscriberId_date: {
        subscriberId,
        date: today,
      },
    },
  });
}
