import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma, getAuthToken } from './helpers.js';

describe('Dashboard Routes', () => {
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
    mockPrisma.subscriber.findUnique.mockReset();
    mockPrisma.agent.count.mockReset();
    mockPrisma.message.count.mockReset();
    mockPrisma.message.findMany.mockReset();
  });

  // ── Stats ──
  describe('GET /api/dashboard/stats', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/dashboard/stats' });
      expect(res.statusCode).toBe(401);
    });

    it('returns dashboard stats for trial subscriber', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        email: 'test@example.com',
        tier: 'trial',
        trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        goals: 'productivity',
        authProvider: 'email',
        telegramChatId: '123',
        whatsappJid: null,
      });
      mockPrisma.agent.count.mockResolvedValue(1);
      mockPrisma.message.count.mockResolvedValue(10);

      const res = await app.inject({
        method: 'GET',
        url: '/api/dashboard/stats',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.email).toBe('test@example.com');
      expect(body.tier).toBe('trial');
      expect(body.trial_expired).toBe(false);
      expect(body.active_agents).toBe(1);
      expect(body.features).toBeDefined();
    });
  });

  // ── Messages ──
  describe('GET /api/dashboard/messages', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/dashboard/messages' });
      expect(res.statusCode).toBe(401);
    });

    it('returns messages with pagination', async () => {
      mockPrisma.message.findMany.mockResolvedValue([
        { id: 'msg-1', content: 'Hello', role: 'user' },
        { id: 'msg-2', content: 'Hi!', role: 'assistant' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/dashboard/messages?limit=10&offset=0',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(2);
    });
  });
});
