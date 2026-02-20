import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma, getAuthToken } from './helpers.js';

describe('Companion Routes', () => {
  let app;
  let token;

  beforeAll(async () => {
    app = await buildTestApp();
    token = getAuthToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    Object.values(mockPrisma).forEach(model => {
      if (typeof model === 'object' && model !== null) {
        Object.values(model).forEach(fn => {
          if (typeof fn?.mockReset === 'function') fn.mockReset();
        });
      }
    });
  });

  describe('GET /api/companion', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/companion' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 when no agent exists', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        createdAt: new Date(),
        agent: null,
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/companion',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns full companion profile', async () => {
      const now = new Date();
      const agent = {
        id: 'agent-1',
        name: 'Blaze',
        personality: 'Friendly and proactive',
        level: 2,
        traitWarmth: 40,
        traitKnowsYou: 30,
        traitReliability: 50,
        traitGrowth: 25,
      };

      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        agent,
        messages: [{ id: 'm1', createdAt: now }, { id: 'm2', createdAt: now }],
        memories: [{ id: 'mem1' }],
        reminders: [{ id: 'r1', status: 'completed' }],
        expenses: [],
      });

      mockPrisma.agentSkill.count.mockResolvedValue(3);
      mockPrisma.agentIntegration.count.mockResolvedValue(1);
      mockPrisma.agentEvent.findMany.mockResolvedValue([
        { id: 'evt-1', eventType: 'milestone', title: 'Agent created', createdAt: now },
      ]);
      mockPrisma.agentSkill.findMany.mockResolvedValue([
        { id: 'sk-1', slug: 'chat-voice', name: 'Chat & Voice', status: 'active', category: 'communication' },
      ]);
      mockPrisma.agentIntegration.findMany.mockResolvedValue([
        { id: 'int-1', slug: 'whatsapp', name: 'WhatsApp', status: 'connected' },
      ]);
      mockPrisma.dailyIntention.findUnique.mockResolvedValue(null);
      mockPrisma.message.count.mockResolvedValue(42);

      const res = await app.inject({
        method: 'GET',
        url: '/api/companion',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('Blaze');
      expect(body.traits).toBeDefined();
      expect(body.traits.warmth).toBeGreaterThanOrEqual(0);
      expect(body.level).toBeGreaterThanOrEqual(1);
      expect(body.skills).toHaveLength(1);
      expect(body.integrations).toHaveLength(1);
      expect(body.stats.totalMessages).toBe(42);
    });
  });

  describe('POST /api/companion/refresh-traits', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/companion/refresh-traits' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 when no agent', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/companion/refresh-traits',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(404);
    });

    it('recalculates and returns traits', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({ id: 'agent-1', subscriberId: 'test-subscriber-id' });
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        agent: { id: 'agent-1' },
        messages: [],
        memories: [],
        reminders: [],
        expenses: [],
      });
      mockPrisma.agentSkill.count.mockResolvedValue(2);
      mockPrisma.agentIntegration.count.mockResolvedValue(1);
      mockPrisma.agent.update.mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/api/companion/refresh-traits',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.traits).toBeDefined();
      expect(body.level).toBeGreaterThanOrEqual(1);
    });
  });
});
