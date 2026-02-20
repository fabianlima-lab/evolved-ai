import adminGuard from '../middleware/adminGuard.js';
import prisma from '../lib/prisma.js';
import { pushSkillToAll, pushIntegrationToAll } from '../services/evolution.js';
import { getDetailedHealth } from '../services/health-monitor.js';
import { isOpenClawConfigured } from '../services/openclaw-bridge.js';

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
        by: ['name'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 15,
      });

      const agents = popular.map(p => ({
        name: p.name || 'Unnamed',
        deploy_count: p._count.id,
      }));

      return reply.send({ agents });
    } catch (error) {
      console.error('[ADMIN] popular-agents error:', error.message);
      return reply.code(500).send({ error: 'Failed to load popular agents' });
    }
  });

  // ── POST /api/admin/push-skill — deploy skill to ALL agents ──
  app.post('/push-skill', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    const { slug, name, description, icon, category } = request.body || {};

    if (!slug || !name) {
      return reply.code(400).send({ error: 'slug and name are required' });
    }

    try {
      const count = await pushSkillToAll({ slug, name, description, icon, category });
      return reply.send({ pushed_to: count, slug, name });
    } catch (error) {
      console.error('[ADMIN] push-skill error:', error.message);
      return reply.code(500).send({ error: 'Failed to push skill' });
    }
  });

  // ── POST /api/admin/push-integration — deploy integration to ALL agents ──
  app.post('/push-integration', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    const { slug, name, description, icon, benefits, setupPrompt } = request.body || {};

    if (!slug || !name) {
      return reply.code(400).send({ error: 'slug and name are required' });
    }

    try {
      const count = await pushIntegrationToAll({ slug, name, description, icon, benefits, setupPrompt });
      return reply.send({ pushed_to: count, slug, name });
    } catch (error) {
      console.error('[ADMIN] push-integration error:', error.message);
      return reply.code(500).send({ error: 'Failed to push integration' });
    }
  });

  // ── GET /api/admin/evolution-overview — global evolution stats ──
  app.get('/evolution-overview', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    try {
      const [totalSkills, activeSkills, totalIntegrations, connectedIntegrations, totalEvents] = await Promise.all([
        prisma.agentSkill.count(),
        prisma.agentSkill.count({ where: { status: 'active' } }),
        prisma.agentIntegration.count(),
        prisma.agentIntegration.count({ where: { status: 'connected' } }),
        prisma.agentEvent.count(),
      ]);

      return reply.send({
        total_skills: totalSkills,
        active_skills: activeSkills,
        total_integrations: totalIntegrations,
        connected_integrations: connectedIntegrations,
        total_events: totalEvents,
      });
    } catch (error) {
      console.error('[ADMIN] evolution-overview error:', error.message);
      return reply.code(500).send({ error: 'Failed to load evolution overview' });
    }
  });

  // ── GET /api/admin/control-tower — single-fetch cockpit for business owner ──
  app.get('/control-tower', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // ── All parallel queries ──
      const [
        totalSubscribers,
        active7d,
        active24h,
        whatsappConnected,
        agentsDeployed,
        tierGroups,
        trialConvertingSoon,
        messagesToday,
        messages7d,
        messages30d,
        skillsActive,
        integrationsConnected,
        googleConnected,
        intentionsToday,
        recentSignupsRaw,
        lastMessageRaw,
        atRiskTrials,
        atRiskPastDue,
        signups7dRaw,
        messages7dRaw,
      ] = await Promise.all([
        // Pulse
        prisma.subscriber.count(),
        prisma.subscriber.count({ where: { messages: { some: { createdAt: { gte: sevenDaysAgo } } } } }),
        prisma.subscriber.count({ where: { messages: { some: { createdAt: { gte: oneDayAgo } } } } }),
        prisma.subscriber.count({ where: { whatsappJid: { not: null } } }),
        prisma.agent.count({ where: { isActive: true } }),
        // Funnel
        prisma.subscriber.groupBy({ by: ['tier'], _count: { id: true } }),
        prisma.subscriber.count({ where: { tier: 'trial', trialEndsAt: { lte: fortyEightHoursFromNow, gte: now } } }),
        // Engagement
        prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.message.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.message.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.agentSkill.count({ where: { status: 'active' } }),
        prisma.agentIntegration.count({ where: { status: 'connected' } }),
        prisma.subscriber.count({ where: { googleAccessToken: { not: null } } }),
        prisma.dailyIntention.count({ where: { date: todayStart } }),
        // Recent signups
        prisma.subscriber.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { email: true, tier: true, createdAt: true, whatsappJid: true },
        }),
        // Last message
        prisma.message.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        // At risk
        prisma.subscriber.findMany({
          where: { tier: 'trial', trialEndsAt: { lte: fortyEightHoursFromNow, gte: now } },
          select: { email: true, tier: true, trialEndsAt: true },
          take: 10,
        }),
        prisma.subscriber.findMany({
          where: { tier: 'past_due' },
          select: { email: true, tier: true },
          take: 10,
        }),
        // Growth sparklines
        prisma.subscriber.findMany({
          where: { createdAt: { gte: sevenDaysAgo } },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.message.findMany({
          where: { createdAt: { gte: sevenDaysAgo } },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      // ── Top engaged (raw SQL — top 5 by message count in 7d) ──
      let topEngaged = [];
      try {
        topEngaged = await prisma.$queryRaw`
          SELECT
            s.email,
            COUNT(m.id)::int AS message_count_7d,
            a.name AS agent_name,
            a.level AS agent_level
          FROM messages m
          JOIN subscribers s ON s.id = m.subscriber_id
          LEFT JOIN agents a ON a.subscriber_id = s.id AND a.is_active = true
          WHERE m.created_at >= ${sevenDaysAgo}
          GROUP BY s.id, s.email, a.name, a.level
          ORDER BY COUNT(m.id) DESC
          LIMIT 5
        `;
      } catch (err) {
        console.error('[ADMIN] control-tower top engaged query failed:', err.message);
      }

      // ── AI model + token usage ──
      let tokenStats = { tokens_today: { input: 0, output: 0, total: 0 }, tokens_7d: { input: 0, output: 0, total: 0 }, tokens_30d: { input: 0, output: 0, total: 0 }, models_used: [] };
      try {
        const [tokensToday, tokens7d, tokens30d, modelsUsed] = await Promise.all([
          prisma.$queryRaw`
            SELECT COALESCE(SUM(input_tokens), 0)::int AS input,
                   COALESCE(SUM(output_tokens), 0)::int AS output,
                   COALESCE(SUM(input_tokens), 0)::int + COALESCE(SUM(output_tokens), 0)::int AS total
            FROM messages WHERE created_at >= ${todayStart} AND model IS NOT NULL
          `,
          prisma.$queryRaw`
            SELECT COALESCE(SUM(input_tokens), 0)::int AS input,
                   COALESCE(SUM(output_tokens), 0)::int AS output,
                   COALESCE(SUM(input_tokens), 0)::int + COALESCE(SUM(output_tokens), 0)::int AS total
            FROM messages WHERE created_at >= ${sevenDaysAgo} AND model IS NOT NULL
          `,
          prisma.$queryRaw`
            SELECT COALESCE(SUM(input_tokens), 0)::int AS input,
                   COALESCE(SUM(output_tokens), 0)::int AS output,
                   COALESCE(SUM(input_tokens), 0)::int + COALESCE(SUM(output_tokens), 0)::int AS total
            FROM messages WHERE created_at >= ${thirtyDaysAgo} AND model IS NOT NULL
          `,
          prisma.$queryRaw`
            SELECT model, COUNT(*)::int AS count
            FROM messages
            WHERE model IS NOT NULL AND created_at >= ${thirtyDaysAgo}
            GROUP BY model ORDER BY count DESC
          `,
        ]);
        tokenStats = {
          tokens_today: tokensToday[0] || { input: 0, output: 0, total: 0 },
          tokens_7d: tokens7d[0] || { input: 0, output: 0, total: 0 },
          tokens_30d: tokens30d[0] || { input: 0, output: 0, total: 0 },
          models_used: modelsUsed.map(m => ({ model: m.model, count: m.count })),
        };
      } catch (err) {
        console.error('[ADMIN] control-tower token stats query failed:', err.message);
      }

      // ── System health ──
      let health;
      try { health = getDetailedHealth(); } catch { health = null; }

      let openclawStatus = 'unknown';
      try { openclawStatus = (await isOpenClawConfigured()) ? 'ok' : 'down'; } catch { openclawStatus = 'down'; }

      // ── Build funnel map ──
      const funnelMap = {};
      for (const t of tierGroups) {
        funnelMap[t.tier] = t._count.id;
      }

      // ── Build response ──
      return reply.send({
        pulse: {
          total_subscribers: totalSubscribers,
          active_7d: active7d,
          active_24h: active24h,
          whatsapp_connected: whatsappConnected,
          agents_deployed: agentsDeployed,
          openclaw_status: openclawStatus,
        },
        funnel: {
          trial: funnelMap.trial || 0,
          active: funnelMap.active || 0,
          past_due: funnelMap.past_due || 0,
          cancelled: funnelMap.cancelled || 0,
          trial_converting_soon: trialConvertingSoon,
        },
        engagement: {
          messages_today: messagesToday,
          messages_7d: messages7d,
          messages_30d: messages30d,
          avg_messages_per_active_user_7d: active7d > 0 ? Math.round((messages7d / active7d) * 10) / 10 : 0,
          skills_activated_total: skillsActive,
          integrations_connected_total: integrationsConnected,
          google_connected: googleConnected,
          daily_intentions_today: intentionsToday,
        },
        system: {
          server_uptime_seconds: health?.uptime || Math.floor(process.uptime()),
          memory_mb: health?.memory?.rss_mb || Math.round(process.memoryUsage().rss / 1024 / 1024),
          whatsapp_status: health?.whatsapp?.status === 'open' ? 'connected' : 'disconnected',
          openclaw_status: openclawStatus,
          last_message_at: lastMessageRaw?.createdAt || null,
        },
        growth: {
          signups_7d: groupByDate(signups7dRaw),
          messages_7d: groupByDate(messages7dRaw),
        },
        recent_signups: recentSignupsRaw.map(s => ({
          email: s.email,
          tier: s.tier,
          created_at: s.createdAt,
          whatsapp_connected: !!s.whatsappJid,
        })),
        top_engaged: topEngaged.map(t => ({
          email: t.email,
          message_count_7d: t.message_count_7d,
          agent_name: t.agent_name || null,
          agent_level: t.agent_level || 1,
        })),
        at_risk: [
          ...atRiskTrials.map(s => ({
            email: s.email,
            tier: s.tier,
            reason: 'trial_expiring',
            trial_ends_at: s.trialEndsAt,
          })),
          ...atRiskPastDue.map(s => ({
            email: s.email,
            tier: s.tier,
            reason: 'payment_failed',
            trial_ends_at: null,
          })),
        ],
        ai: tokenStats,
      });
    } catch (error) {
      console.error('[ADMIN] control-tower error:', error.message);
      return reply.code(500).send({ error: 'Failed to load control tower' });
    }
  });
}

export default adminRoutes;
