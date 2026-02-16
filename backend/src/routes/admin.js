import adminGuard from '../middleware/adminGuard.js';
import prisma from '../lib/prisma.js';

const VALID_SORT_FIELDS = {
  created_at: 'createdAt',
  email: 'email',
  tier: 'tier',
};

function groupByDate(items) {
  const map = {};
  for (const item of items) {
    const date = new Date(item.createdAt).toISOString().slice(0, 10);
    map[date] = (map[date] || 0) + 1;
  }
  return Object.entries(map)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function adminRoutes(app) {
  const adminPreHandlers = [app.authenticate, adminGuard];
  const rl = { max: 30, timeWindow: '1 minute' };

  // ── GET /api/admin/overview ──
  app.get('/overview', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [totalSubscribers, totalMessages, totalAgents, activeSubscribers] = await Promise.all([
        prisma.subscriber.count(),
        prisma.message.count(),
        prisma.agent.count(),
        prisma.subscriber.count({
          where: { messages: { some: { createdAt: { gte: sevenDaysAgo } } } },
        }),
      ]);

      return reply.send({
        total_subscribers: totalSubscribers,
        total_messages: totalMessages,
        total_agents: totalAgents,
        active_subscribers_7d: activeSubscribers,
      });
    } catch (error) {
      console.error('[ADMIN] overview error:', error.message);
      return reply.code(500).send({ error: 'Failed to load overview' });
    }
  });

  // ── GET /api/admin/signups ──
  app.get('/signups', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    try {
      const days = Math.min(parseInt(request.query.days || '30', 10), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const subscribers = await prisma.subscriber.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({ days, data: groupByDate(subscribers) });
    } catch (error) {
      console.error('[ADMIN] signups error:', error.message);
      return reply.code(500).send({ error: 'Failed to load signups' });
    }
  });

  // ── GET /api/admin/tiers ──
  app.get('/tiers', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    try {
      const tiers = await prisma.subscriber.groupBy({
        by: ['tier'],
        _count: { id: true },
      });

      return reply.send({
        tiers: tiers.map(t => ({ tier: t.tier, count: t._count.id })),
      });
    } catch (error) {
      console.error('[ADMIN] tiers error:', error.message);
      return reply.code(500).send({ error: 'Failed to load tiers' });
    }
  });

  // ── GET /api/admin/subscribers ──
  app.get('/subscribers', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    try {
      const sortParam = request.query.sort || 'created_at';
      const orderParam = request.query.order === 'asc' ? 'asc' : 'desc';
      const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);
      const offset = Math.max(parseInt(request.query.offset || '0', 10), 0);

      const sortField = VALID_SORT_FIELDS[sortParam] || 'createdAt';

      const [total, subscribers] = await Promise.all([
        prisma.subscriber.count(),
        prisma.subscriber.findMany({
          orderBy: { [sortField]: orderParam },
          take: limit,
          skip: offset,
          select: {
            id: true,
            email: true,
            tier: true,
            authProvider: true,
            whatsappJid: true,
            createdAt: true,
            _count: {
              select: {
                agents: true,
                messages: true,
              },
            },
          },
        }),
      ]);

      // Get last active dates for these subscribers
      const subscriberIds = subscribers.map(s => s.id);
      let lastActiveMap = {};

      if (subscriberIds.length > 0) {
        const lastMessages = await prisma.$queryRaw`
          SELECT subscriber_id, MAX(created_at) as last_active
          FROM messages
          WHERE subscriber_id = ANY(${subscriberIds}::uuid[])
          GROUP BY subscriber_id
        `;
        for (const row of lastMessages) {
          lastActiveMap[row.subscriber_id] = row.last_active;
        }
      }

      const formatted = subscribers.map(s => {
        return {
          id: s.id,
          email: s.email,
          tier: s.tier,
          auth_provider: s.authProvider,
          whatsapp_connected: !!s.whatsappJid,
          signup_date: s.createdAt,
          message_count: s._count.messages,
          agent_count: s._count.agents,
          last_active: lastActiveMap[s.id] || null,
        };
      });

      return reply.send({ total, subscribers: formatted });
    } catch (error) {
      console.error('[ADMIN] subscribers error:', error.message);
      return reply.code(500).send({ error: 'Failed to load subscribers' });
    }
  });

  // ── GET /api/admin/messages ──
  app.get('/messages', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    try {
      const days = Math.min(parseInt(request.query.days || '30', 10), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const messages = await prisma.message.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      return reply.send({ days, data: groupByDate(messages) });
    } catch (error) {
      console.error('[ADMIN] messages error:', error.message);
      return reply.code(500).send({ error: 'Failed to load messages' });
    }
  });

  // ── GET /api/admin/popular-agents ──
  app.get('/popular-agents', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    try {
      const popular = await prisma.agent.groupBy({
        by: ['assistantName'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 15,
      });

      const agents = popular.map(p => ({
        name: p.assistantName || 'Unnamed',
        deploy_count: p._count.id,
      }));

      return reply.send({ agents });
    } catch (error) {
      console.error('[ADMIN] popular-agents error:', error.message);
      return reply.code(500).send({ error: 'Failed to load popular agents' });
    }
  });
}

export default adminRoutes;
