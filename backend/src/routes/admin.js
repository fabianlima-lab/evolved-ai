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

const POSITIVE_WORDS = ['great', 'thanks', 'thank', 'love', 'happy', 'amazing', 'helpful', 'perfect', 'awesome', 'wonderful', 'appreciate', 'excellent', 'good', 'nice', 'fantastic'];
const NEGATIVE_WORDS = ['frustrated', 'broken', 'wrong', 'bad', 'terrible', 'disappointed', 'confused', 'annoying', 'useless', 'hate', 'awful', 'horrible', 'stuck', 'fail', 'error'];

function analyzeTone(messages) {
  let positive = 0;
  let negative = 0;
  const combined = messages.join(' ').toLowerCase();
  for (const word of POSITIVE_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = combined.match(regex);
    if (matches) positive += matches.length;
  }
  for (const word of NEGATIVE_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    const matches = combined.match(regex);
    if (matches) negative += matches.length;
  }
  if (positive === 0 && negative === 0) return 'neutral';
  if (positive > negative * 1.5) return 'positive';
  if (negative > positive * 1.5) return 'negative';
  return 'neutral';
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

  // ── GET /api/admin/subscribers/enhanced — enriched per-user analytics ──
  app.get('/subscribers/enhanced', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    try {
      const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);
      const offset = Math.max(parseInt(request.query.offset || '0', 10), 0);
      const sortParam = request.query.sort || 'created_at';
      const orderParam = request.query.order === 'asc' ? 'ASC' : 'DESC';
      const sortCol = { created_at: 's.created_at', email: 's.email', tier: 's.tier' }[sortParam] || 's.created_at';

      const total = await prisma.subscriber.count();

      const rows = await prisma.$queryRaw`
        WITH subscriber_base AS (
          SELECT s.id, s.email, s.tier, s.auth_provider, s.whatsapp_jid,
                 s.created_at, s.assistant_name
          FROM subscribers s
          ORDER BY
            CASE WHEN ${sortCol} = 's.created_at' AND ${orderParam} = 'DESC' THEN s.created_at END DESC,
            CASE WHEN ${sortCol} = 's.created_at' AND ${orderParam} = 'ASC' THEN s.created_at END ASC,
            s.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        ),
        msg_stats AS (
          SELECT
            m.subscriber_id,
            COUNT(*) FILTER (WHERE m.role = 'user')::int AS user_msg_count,
            COUNT(*) FILTER (WHERE m.role = 'assistant')::int AS assistant_msg_count,
            COUNT(*)::int AS total_msg_count,
            MAX(m.created_at) AS last_message_at,
            MIN(m.created_at) AS first_message_at,
            COALESCE(SUM(m.input_tokens), 0)::bigint AS total_input_tokens,
            COALESCE(SUM(m.output_tokens), 0)::bigint AS total_output_tokens,
            COALESCE(SUM(COALESCE(m.input_tokens, 0) + COALESCE(m.output_tokens, 0))
              FILTER (WHERE m.created_at >= NOW() - INTERVAL '1 day'), 0)::bigint AS tokens_today,
            COALESCE(SUM(COALESCE(m.input_tokens, 0) + COALESCE(m.output_tokens, 0))
              FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days'), 0)::bigint AS tokens_7d,
            COALESCE(SUM(COALESCE(m.input_tokens, 0) + COALESCE(m.output_tokens, 0))
              FILTER (WHERE m.created_at >= NOW() - INTERVAL '30 days'), 0)::bigint AS tokens_30d,
            COUNT(*) FILTER (WHERE m.channel = 'whatsapp')::int AS whatsapp_msgs,
            COUNT(*) FILTER (WHERE m.channel = 'web')::int AS web_msgs
          FROM messages m
          WHERE m.subscriber_id IN (SELECT id FROM subscriber_base)
          GROUP BY m.subscriber_id
        ),
        agent_info AS (
          SELECT a.subscriber_id, a.name AS agent_name, a.level AS agent_level
          FROM agents a
          WHERE a.subscriber_id IN (SELECT id FROM subscriber_base) AND a.is_active = true
        ),
        last_msg_role AS (
          SELECT DISTINCT ON (m.subscriber_id)
            m.subscriber_id, m.role AS last_role
          FROM messages m
          WHERE m.subscriber_id IN (SELECT id FROM subscriber_base)
          ORDER BY m.subscriber_id, m.created_at DESC
        )
        SELECT sb.*, ms.user_msg_count, ms.assistant_msg_count, ms.total_msg_count,
               ms.last_message_at, ms.first_message_at,
               ms.total_input_tokens, ms.total_output_tokens,
               ms.tokens_today, ms.tokens_7d, ms.tokens_30d,
               ms.whatsapp_msgs, ms.web_msgs,
               ai.agent_name, ai.agent_level,
               lr.last_role
        FROM subscriber_base sb
        LEFT JOIN msg_stats ms ON ms.subscriber_id = sb.id
        LEFT JOIN agent_info ai ON ai.subscriber_id = sb.id
        LEFT JOIN last_msg_role lr ON lr.subscriber_id = sb.id
      `;

      const subscribers = rows.map(row => {
        const daysSinceFirst = row.first_message_at
          ? Math.max(1, Math.ceil((Date.now() - new Date(row.first_message_at).getTime()) / 86400000))
          : 1;
        const totalTokens = Number(row.total_input_tokens || 0) + Number(row.total_output_tokens || 0);

        return {
          id: row.id,
          email: row.email,
          tier: row.tier,
          auth_provider: row.auth_provider,
          whatsapp_connected: !!row.whatsapp_jid,
          signup_date: row.created_at,
          assistant_name: row.assistant_name,
          total_msg_count: row.total_msg_count || 0,
          user_msg_count: row.user_msg_count || 0,
          assistant_msg_count: row.assistant_msg_count || 0,
          last_message_at: row.last_message_at || null,
          ai_healthy: row.last_role === 'assistant',
          token_spend: totalTokens,
          tokens_today: Number(row.tokens_today || 0),
          tokens_7d: Number(row.tokens_7d || 0),
          tokens_30d: Number(row.tokens_30d || 0),
          avg_tokens_per_day: Math.round(totalTokens / daysSinceFirst),
          response_rate: (row.user_msg_count || 0) > 0
            ? Math.round(((row.assistant_msg_count || 0) / row.user_msg_count) * 100)
            : 0,
          messages_by_channel: { whatsapp: row.whatsapp_msgs || 0, web: row.web_msgs || 0 },
          agent_name: row.agent_name || null,
          agent_level: row.agent_level || 1,
        };
      });

      // Global aggregates for summary cards
      const globalStats = await prisma.$queryRaw`
        SELECT
          (COALESCE(SUM(input_tokens), 0) + COALESCE(SUM(output_tokens), 0))::bigint AS total_token_spend
        FROM messages WHERE model IS NOT NULL
      `;

      const totalTokenSpend = Number(globalStats[0]?.total_token_spend || 0);
      const healthyCount = subscribers.filter(s => s.ai_healthy).length;

      return reply.send({
        total,
        summary: {
          total_token_spend: totalTokenSpend,
          avg_tokens_per_day: total > 0 ? Math.round(totalTokenSpend / Math.max(total, 1) / 30) : 0,
          active_ai_rate: subscribers.length > 0 ? Math.round((healthyCount / subscribers.length) * 100) : 0,
        },
        subscribers,
      });
    } catch (error) {
      console.error('[ADMIN] subscribers/enhanced error:', error.message);
      return reply.code(500).send({ error: 'Failed to load enhanced subscribers' });
    }
  });

  // ── GET /api/admin/subscribers/:id/detail — deep drill-down for one subscriber ──
  app.get('/subscribers/:id/detail', {
    preHandler: adminPreHandlers,
    config: { rateLimit: rl },
  }, async (request, reply) => {
    try {
      const { id } = request.params;

      const subscriber = await prisma.subscriber.findUnique({
        where: { id },
        include: {
          agent: {
            select: {
              name: true, level: true, isActive: true,
              traitWarmth: true, traitKnowsYou: true, traitReliability: true, traitGrowth: true,
            },
          },
        },
      });

      if (!subscriber) {
        return reply.code(404).send({ error: 'Subscriber not found' });
      }

      // Token breakdown
      const tokenBreakdown = await prisma.$queryRaw`
        SELECT
          COALESCE(SUM(input_tokens), 0)::bigint AS total_input,
          COALESCE(SUM(output_tokens), 0)::bigint AS total_output,
          COALESCE(SUM(input_tokens) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0)::bigint AS input_7d,
          COALESCE(SUM(output_tokens) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0)::bigint AS output_7d,
          COALESCE(SUM(input_tokens) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0)::bigint AS input_30d,
          COALESCE(SUM(output_tokens) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0)::bigint AS output_30d
        FROM messages
        WHERE subscriber_id = ${id}::uuid AND model IS NOT NULL
      `;

      // Message volume 7d
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
      const msgVolumeRaw = await prisma.message.findMany({
        where: { subscriberId: id, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      // Recent messages (last 5)
      const recentMessages = await prisma.message.findMany({
        where: { subscriberId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { role: true, channel: true, content: true, createdAt: true, model: true, inputTokens: true, outputTokens: true },
      });

      // Conversation tone (last 20 user messages)
      const recentUserMessages = await prisma.message.findMany({
        where: { subscriberId: id, role: 'user' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { content: true },
      });

      const tone = analyzeTone(recentUserMessages.map(m => m.content));

      // Response rate
      const msgCounts = await prisma.$queryRaw`
        SELECT
          COUNT(*) FILTER (WHERE role = 'user')::int AS user_count,
          COUNT(*) FILTER (WHERE role = 'assistant')::int AS assistant_count
        FROM messages
        WHERE subscriber_id = ${id}::uuid
      `;

      const userCount = msgCounts[0]?.user_count || 0;
      const assistantCount = msgCounts[0]?.assistant_count || 0;
      const responseRate = userCount > 0 ? Math.round((assistantCount / userCount) * 100) : 0;

      // AI health
      const lastMsg = await prisma.message.findFirst({
        where: { subscriberId: id },
        orderBy: { createdAt: 'desc' },
        select: { role: true },
      });
      const aiHealthy = lastMsg?.role === 'assistant';

      const tb = tokenBreakdown[0] || {};

      return reply.send({
        subscriber: {
          id: subscriber.id,
          email: subscriber.email,
          name: subscriber.name,
          tier: subscriber.tier,
          whatsapp_connected: !!subscriber.whatsappJid,
          signup_date: subscriber.createdAt,
          trial_ends_at: subscriber.trialEndsAt,
          onboarding_step: subscriber.onboardingStep,
          assistant_name: subscriber.assistantName,
        },
        agent: subscriber.agent ? {
          name: subscriber.agent.name,
          level: subscriber.agent.level,
          is_active: subscriber.agent.isActive,
          traits: {
            warmth: subscriber.agent.traitWarmth,
            knows_you: subscriber.agent.traitKnowsYou,
            reliability: subscriber.agent.traitReliability,
            growth: subscriber.agent.traitGrowth,
          },
        } : null,
        tokens: {
          total_input: Number(tb.total_input || 0),
          total_output: Number(tb.total_output || 0),
          input_7d: Number(tb.input_7d || 0),
          output_7d: Number(tb.output_7d || 0),
          input_30d: Number(tb.input_30d || 0),
          output_30d: Number(tb.output_30d || 0),
        },
        message_volume_7d: groupByDate(msgVolumeRaw),
        recent_messages: recentMessages.reverse().map(m => ({
          role: m.role,
          channel: m.channel,
          content: m.content.substring(0, 200),
          created_at: m.createdAt,
          model: m.model,
          tokens: (m.inputTokens || 0) + (m.outputTokens || 0),
        })),
        conversation_tone: tone,
        response_rate: responseRate,
        ai_healthy: aiHealthy,
      });
    } catch (error) {
      console.error('[ADMIN] subscriber detail error:', error.message);
      return reply.code(500).send({ error: 'Failed to load subscriber detail' });
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
