import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma, getAuthToken } from './helpers.js';

describe('Admin Routes', () => {
  let app;
  let adminToken;
  let subscriberToken;

  beforeAll(async () => {
    app = await buildTestApp();
    adminToken = getAuthToken(app, 'admin-id', 'admin@test.com');
    subscriberToken = getAuthToken(app, 'subscriber-id', 'regular@test.com');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset all mocks
    for (const model of Object.values(mockPrisma)) {
      if (typeof model === 'object' && model !== null) {
        for (const fn of Object.values(model)) {
          if (typeof fn?.mockReset === 'function') fn.mockReset();
        }
      }
      if (typeof model?.mockReset === 'function') model.mockReset();
    }
  });

  // ── Access Control ──
  describe('Access Control', () => {
    it('returns 401 without auth token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/admin/overview' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 for non-admin subscriber', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/overview',
        headers: { authorization: 'Bearer ' + subscriberToken },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 200 for admin subscriber', async () => {
      mockPrisma.subscriber.count.mockResolvedValue(10);
      mockPrisma.message.count.mockResolvedValue(50);
      mockPrisma.agent.count.mockResolvedValue(15);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/overview',
        headers: { authorization: 'Bearer ' + adminToken },
      });
      expect(res.statusCode).toBe(200);
    });

    it('blocks non-admin on all endpoints', async () => {
      const endpoints = [
        '/api/admin/overview',
        '/api/admin/signups',
        '/api/admin/tiers',
        '/api/admin/subscribers',
        '/api/admin/messages',
        '/api/admin/popular-agents',
      ];
      for (const url of endpoints) {
        const res = await app.inject({
          method: 'GET',
          url,
          headers: { authorization: 'Bearer ' + subscriberToken },
        });
        expect(res.statusCode).toBe(403);
      }
    });
  });

  // ── GET /api/admin/overview ──
  describe('GET /api/admin/overview', () => {
    it('returns correct aggregate counts', async () => {
      mockPrisma.subscriber.count
        .mockResolvedValueOnce(42)  // totalSubscribers
        .mockResolvedValueOnce(10); // activeSubscribers
      mockPrisma.message.count.mockResolvedValue(500);
      mockPrisma.agent.count.mockResolvedValue(60);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/overview',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.total_subscribers).toBe(42);
      expect(body.total_messages).toBe(500);
      expect(body.total_agents).toBe(60);
      expect(body.active_subscribers_7d).toBe(10);
    });
  });

  // ── GET /api/admin/signups ──
  describe('GET /api/admin/signups', () => {
    it('returns daily signup data', async () => {
      mockPrisma.subscriber.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-10T10:00:00Z') },
        { createdAt: new Date('2026-02-10T15:00:00Z') },
        { createdAt: new Date('2026-02-11T09:00:00Z') },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/signups?days=30',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.days).toBe(30);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].date).toBe('2026-02-10');
      expect(body.data[0].count).toBe(2);
      expect(body.data[1].count).toBe(1);
    });

    it('caps days at 90', async () => {
      mockPrisma.subscriber.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/signups?days=999',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      const body = JSON.parse(res.body);
      expect(body.days).toBe(90);
    });
  });

  // ── GET /api/admin/tiers ──
  describe('GET /api/admin/tiers', () => {
    it('returns tier breakdown', async () => {
      mockPrisma.subscriber.groupBy.mockResolvedValue([
        { tier: 'trial', _count: { id: 80 } },
        { tier: 'active', _count: { id: 25 } },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/tiers',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.tiers).toHaveLength(2);
      expect(body.tiers[0]).toEqual({ tier: 'trial', count: 80 });
    });
  });

  // ── GET /api/admin/subscribers ──
  describe('GET /api/admin/subscribers', () => {
    it('returns paginated subscriber list', async () => {
      mockPrisma.subscriber.count.mockResolvedValue(2);
      mockPrisma.subscriber.findMany.mockResolvedValue([
        {
          id: 's1',
          email: 'alice@test.com',
          tier: 'active',
          authProvider: 'email',
          whatsappJid: '+1234567890',
          createdAt: '2026-01-01T00:00:00Z',
          _count: { agents: 1, messages: 50 },
        },
        {
          id: 's2',
          email: 'bob@test.com',
          tier: 'trial',
          authProvider: 'google',
          whatsappJid: null,
          createdAt: '2026-02-01T00:00:00Z',
          _count: { agents: 0, messages: 0 },
        },
      ]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { subscriber_id: 's1', last_active: '2026-02-13T12:00:00Z' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/subscribers?limit=10&offset=0',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.total).toBe(2);
      expect(body.subscribers).toHaveLength(2);
      expect(body.subscribers[0].email).toBe('alice@test.com');
      expect(body.subscribers[0].message_count).toBe(50);
      expect(body.subscribers[0].last_active).toBe('2026-02-13T12:00:00Z');
      expect(body.subscribers[1].last_active).toBeNull();
    });

    it('caps limit at 100', async () => {
      mockPrisma.subscriber.count.mockResolvedValue(0);
      mockPrisma.subscriber.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await app.inject({
        method: 'GET',
        url: '/api/admin/subscribers?limit=999',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      expect(mockPrisma.subscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('uses whitelist for sort field', async () => {
      mockPrisma.subscriber.count.mockResolvedValue(0);
      mockPrisma.subscriber.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await app.inject({
        method: 'GET',
        url: '/api/admin/subscribers?sort=email&order=asc',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      expect(mockPrisma.subscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { email: 'asc' } }),
      );
    });

    it('falls back to createdAt for invalid sort field', async () => {
      mockPrisma.subscriber.count.mockResolvedValue(0);
      mockPrisma.subscriber.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await app.inject({
        method: 'GET',
        url: '/api/admin/subscribers?sort=DROP_TABLE',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      expect(mockPrisma.subscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  // ── GET /api/admin/messages ──
  describe('GET /api/admin/messages', () => {
    it('returns daily message volume', async () => {
      mockPrisma.message.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-12T10:00:00Z') },
        { createdAt: new Date('2026-02-12T14:00:00Z') },
        { createdAt: new Date('2026-02-12T18:00:00Z') },
        { createdAt: new Date('2026-02-13T09:00:00Z') },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/messages?days=7',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.days).toBe(7);
      expect(body.data[0].date).toBe('2026-02-12');
      expect(body.data[0].count).toBe(3);
      expect(body.data[1].count).toBe(1);
    });
  });

  // ── GET /api/admin/popular-agents ──
  describe('GET /api/admin/popular-agents', () => {
    it('returns ranked agents', async () => {
      mockPrisma.agent.groupBy.mockResolvedValue([
        { name: 'Sales Bot', _count: { id: 15 } },
        { name: 'Support Bot', _count: { id: 10 } },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/popular-agents',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.agents).toHaveLength(2);
      expect(body.agents[0].name).toBe('Sales Bot');
      expect(body.agents[0].deploy_count).toBe(15);
    });
  });

  // ── GET /api/admin/control-tower ──
  describe('GET /api/admin/control-tower', () => {
    function mockControlTowerDefaults() {
      // Pulse
      mockPrisma.subscriber.count.mockResolvedValue(0);
      mockPrisma.agent.count.mockResolvedValue(0);
      // Funnel
      mockPrisma.subscriber.groupBy.mockResolvedValue([]);
      // Engagement
      mockPrisma.message.count.mockResolvedValue(0);
      mockPrisma.agentSkill.count.mockResolvedValue(0);
      mockPrisma.agentIntegration.count.mockResolvedValue(0);
      mockPrisma.dailyIntention.count.mockResolvedValue(0);
      // Recent signups, at risk
      mockPrisma.subscriber.findMany.mockResolvedValue([]);
      // Last message
      mockPrisma.message.findFirst.mockResolvedValue(null);
      // Growth sparklines
      mockPrisma.message.findMany.mockResolvedValue([]);
      // Top engaged + token stats (5 raw queries: top engaged, tokens today, 7d, 30d, models used)
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])  // top engaged
        .mockResolvedValueOnce([{ input: 0, output: 0, total: 0 }])  // tokens today
        .mockResolvedValueOnce([{ input: 0, output: 0, total: 0 }])  // tokens 7d
        .mockResolvedValueOnce([{ input: 0, output: 0, total: 0 }])  // tokens 30d
        .mockResolvedValueOnce([]);  // models used
    }

    it('returns 401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/admin/control-tower' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 for non-admin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/control-tower',
        headers: { authorization: 'Bearer ' + subscriberToken },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns all top-level sections', async () => {
      mockControlTowerDefaults();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/control-tower',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveProperty('pulse');
      expect(body).toHaveProperty('funnel');
      expect(body).toHaveProperty('engagement');
      expect(body).toHaveProperty('system');
      expect(body).toHaveProperty('growth');
      expect(body).toHaveProperty('recent_signups');
      expect(body).toHaveProperty('top_engaged');
      expect(body).toHaveProperty('at_risk');
      expect(body).toHaveProperty('ai');
    });

    it('returns correct pulse values', async () => {
      // subscriber.count is called multiple times with different args
      mockPrisma.subscriber.count
        .mockResolvedValueOnce(42)   // total
        .mockResolvedValueOnce(18)   // active 7d
        .mockResolvedValueOnce(7)    // active 24h
        .mockResolvedValueOnce(31)   // whatsapp connected
        .mockResolvedValueOnce(15)   // google connected
        .mockResolvedValueOnce(0);   // trial converting soon (second call)
      mockPrisma.agent.count.mockResolvedValue(38);
      mockPrisma.subscriber.groupBy.mockResolvedValue([]);
      mockPrisma.message.count.mockResolvedValue(0);
      mockPrisma.agentSkill.count.mockResolvedValue(0);
      mockPrisma.agentIntegration.count.mockResolvedValue(0);
      mockPrisma.dailyIntention.count.mockResolvedValue(0);
      mockPrisma.subscriber.findMany.mockResolvedValue([]);
      mockPrisma.message.findFirst.mockResolvedValue(null);
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])  // top engaged
        .mockResolvedValueOnce([{ input: 0, output: 0, total: 0 }])
        .mockResolvedValueOnce([{ input: 0, output: 0, total: 0 }])
        .mockResolvedValueOnce([{ input: 0, output: 0, total: 0 }])
        .mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/control-tower',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.pulse.total_subscribers).toBe(42);
      expect(body.pulse.active_7d).toBe(18);
      expect(body.pulse.active_24h).toBe(7);
      expect(body.pulse.whatsapp_connected).toBe(31);
      expect(body.pulse.agents_deployed).toBe(38);
      expect(body.pulse.openclaw_status).toBeDefined();
    });

    it('returns funnel tier breakdown', async () => {
      mockControlTowerDefaults();
      mockPrisma.subscriber.groupBy.mockResolvedValue([
        { tier: 'trial', _count: { id: 12 } },
        { tier: 'active', _count: { id: 22 } },
        { tier: 'past_due', _count: { id: 3 } },
        { tier: 'cancelled', _count: { id: 5 } },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/control-tower',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      const body = JSON.parse(res.body);
      expect(body.funnel.trial).toBe(12);
      expect(body.funnel.active).toBe(22);
      expect(body.funnel.past_due).toBe(3);
      expect(body.funnel.cancelled).toBe(5);
      expect(body.funnel.trial_converting_soon).toBeDefined();
    });

    it('returns system health data', async () => {
      mockControlTowerDefaults();

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/control-tower',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      const body = JSON.parse(res.body);
      expect(body.system.server_uptime_seconds).toBeGreaterThanOrEqual(0);
      expect(body.system.memory_mb).toBeGreaterThan(0);
      expect(body.system).toHaveProperty('whatsapp_status');
      expect(body.system).toHaveProperty('openclaw_status');
    });

    it('returns at-risk subscribers', async () => {
      mockControlTowerDefaults();
      // Override findMany calls — the route makes multiple findMany calls
      // Mock findMany to return at-risk data for the at-risk queries
      mockPrisma.subscriber.findMany
        .mockResolvedValueOnce([]) // recent signups
        .mockResolvedValueOnce([   // at risk trials
          { email: 'jen@test.com', tier: 'trial', trialEndsAt: new Date('2026-02-20') },
        ])
        .mockResolvedValueOnce([   // at risk past due
          { email: 'mark@test.com', tier: 'past_due' },
        ])
        .mockResolvedValueOnce([]) // signups 7d
        ;

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/control-tower',
        headers: { authorization: 'Bearer ' + adminToken },
      });

      const body = JSON.parse(res.body);
      expect(body.at_risk).toHaveLength(2);
      expect(body.at_risk[0].reason).toBe('trial_expiring');
      expect(body.at_risk[1].reason).toBe('payment_failed');
    });
  });

});
