import { isTrialExpired, getFeaturesByTier } from '../utils/helpers.js';
import prisma from '../lib/prisma.js';

/**
 * Compute the next monthly billing date from the original purchase date.
 * Advances month-by-month from kajabiPurchaseDate until we find a date > now.
 */
function computeNextBillingDate(subscriber) {
  if (subscriber.tier !== 'active' || !subscriber.kajabiPurchaseDate) return null;

  const purchase = new Date(subscriber.kajabiPurchaseDate);
  const now = new Date();
  const next = new Date(purchase);

  // Advance month by month until we're in the future
  while (next <= now) {
    next.setMonth(next.getMonth() + 1);
  }

  return next.toISOString();
}

async function dashboardRoutes(app) {
  // GET /api/dashboard/stats
  app.get('/stats', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 60, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;

    try {
      const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } });
      const activeAgents = await prisma.agent.count({
        where: { subscriberId, isActive: true },
      });

      const agent = await prisma.agent.findFirst({
        where: { subscriberId, isActive: true },
        select: { id: true, name: true, level: true, traitWarmth: true, traitKnowsYou: true, traitReliability: true, traitGrowth: true },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [messagesToday, messagesThisMonth, totalMessages] = await Promise.all([
        prisma.message.count({
          where: { subscriberId, createdAt: { gte: today } },
        }),
        prisma.message.count({
          where: { subscriberId, createdAt: { gte: startOfMonth } },
        }),
        prisma.message.count({
          where: { subscriberId },
        }),
      ]);

      const trialExpired = isTrialExpired(subscriber);
      const daysRemaining = subscriber.trialEndsAt
        ? Math.max(0, Math.ceil(
            (new Date(subscriber.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          ))
        : null;

      const features = getFeaturesByTier(subscriber.tier);

      const whatsappConnected = !!subscriber.whatsappJid;
      const assistantName = agent?.name || null;
      const profileData = subscriber.profileData || null;

      // Build integrations status (WhatsApp only)
      const integrations = {
        whatsapp: { connected: whatsappConnected, label: 'WhatsApp' },
      };

      // Calculate tuned score (max 100)
      let tunedScore = 0;
      if (whatsappConnected) tunedScore += 25;
      if (assistantName) tunedScore += 20;
      if (profileData?.drains) tunedScore += 15;
      if (subscriber.name) tunedScore += 15;
      if (subscriber.onboardingStep === 'complete') tunedScore += 15;
      if (totalMessages > 10) tunedScore += 10;

      // Companion preview for dashboard
      let companionPreview = null;
      if (agent?.id) {
        const [activeSkills, connectedIntegrations] = await Promise.all([
          prisma.agentSkill.count({ where: { agentId: agent.id, status: 'active' } }),
          prisma.agentIntegration.count({ where: { agentId: agent.id, status: 'connected' } }),
        ]);

        companionPreview = {
          level: agent.level,
          traits: {
            warmth: agent.traitWarmth,
            knowsYou: agent.traitKnowsYou,
            reliability: agent.traitReliability,
            growth: agent.traitGrowth,
          },
          active_skills: activeSkills,
          connected_integrations: connectedIntegrations,
        };
      }

      return reply.send({
        email: subscriber.email,
        goals: subscriber.goals,
        auth_provider: subscriber.authProvider,
        tier: subscriber.tier,
        trial_ends_at: subscriber.trialEndsAt,
        trial_expired: trialExpired,
        trial_days_remaining: daysRemaining,
        active_agents: activeAgents,
        max_agents: features.max_active_agents,
        messages_today: messagesToday,
        messages_this_month: messagesThisMonth,
        total_messages: totalMessages,
        whatsapp_connected: whatsappConnected,
        onboarding_step: subscriber.onboardingStep || 'pending',
        features,
        assistant_name: assistantName,
        subscriber_name: subscriber.name || null,
        profile_data: profileData,
        created_at: subscriber.createdAt,
        integrations,
        tuned_score: tunedScore,
        companion: companionPreview,
        // Billing details
        subscription_started_at: subscriber.kajabiPurchaseDate || null,
        subscription_cancelled_at: subscriber.kajabiCancelDate || null,
        next_billing_date: computeNextBillingDate(subscriber),
        member_since: subscriber.createdAt,
      });
    } catch (error) {
      console.error('[ERROR] dashboard stats failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // GET /api/dashboard/messages
  app.get('/messages', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 60, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);
    const offset = parseInt(request.query.offset || '0', 10);

    try {
      const messages = await prisma.message.findMany({
        where: { subscriberId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return reply.send(messages);
    } catch (error) {
      console.error('[ERROR] dashboard messages failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

export default dashboardRoutes;
