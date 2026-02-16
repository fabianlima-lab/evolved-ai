import { isTrialExpired, getFeaturesByTier } from '../utils/helpers.js';
import env from '../config/env.js';
import prisma from '../lib/prisma.js';

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

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const messagesToday = await prisma.message.count({
        where: { subscriberId, createdAt: { gte: today } },
      });

      const messagesThisMonth = await prisma.message.count({
        where: { subscriberId, createdAt: { gte: startOfMonth } },
      });

      const trialExpired = isTrialExpired(subscriber);
      const daysRemaining = subscriber.trialEndsAt
        ? Math.max(0, Math.ceil(
            (new Date(subscriber.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          ))
        : null;

      const features = getFeaturesByTier(subscriber.tier);

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
        whatsapp_connected: !!subscriber.whatsappJid,
        features,
        upgrade_url: trialExpired ? `${env.APP_URL}/upgrade` : null,
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
