import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma, getAuthToken } from './helpers.js';

describe('Agent Routes', () => {
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
    mockPrisma.agent.findFirst.mockReset();
    mockPrisma.agent.findMany.mockReset();
    mockPrisma.agent.create.mockReset();
    mockPrisma.agent.update.mockReset();
    mockPrisma.agent.updateMany.mockReset();
    mockPrisma.agent.count.mockReset();
    mockPrisma.subscriber.findUnique.mockReset();
    mockPrisma.subscriber.update.mockReset();
    mockPrisma.message.deleteMany.mockReset();
  });

  // ── Deploy ──
  describe('POST /api/agents/deploy', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/deploy',
        payload: { name: 'Test Agent' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('deploys an agent with valid data', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        tier: 'trial',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      mockPrisma.agent.count.mockResolvedValue(0);
      mockPrisma.agent.create.mockResolvedValue({
        id: 'new-agent-id',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/deploy',
        headers: { authorization: 'Bearer ' + token },
        payload: { name: 'My Agent', systemPrompt: 'You are a helpful assistant.' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.agent_id).toBe('new-agent-id');
    });

    it('rejects missing name with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/deploy',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects expired trial with 403', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        tier: 'trial',
        trialEndsAt: new Date(Date.now() - 1000),
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/deploy',
        headers: { authorization: 'Bearer ' + token },
        payload: { name: 'My Agent', systemPrompt: 'test' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Mine ──
  describe('GET /api/agents/mine', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents/mine' });
      expect(res.statusCode).toBe(401);
    });

    it('returns active agents', async () => {
      mockPrisma.agent.findMany.mockResolvedValue([
        { id: 'a1', name: 'My Agent' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/agents/mine',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
    });

    it('returns 404 when no active agents', async () => {
      mockPrisma.agent.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/agents/mine',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── Restart ──
  describe('POST /api/agents/:id/restart', () => {
    it('clears conversation history', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue({ id: 'a1' });
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 5 });

      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/a1/restart',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('restarted');
    });

    it('returns 404 for non-owned agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/nonexistent/restart',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── Delete ──
  describe('DELETE /api/agents/:id', () => {
    it('deactivates an agent', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue({ id: 'a1' });
      mockPrisma.agent.update.mockResolvedValue({ id: 'a1', isActive: false });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/agents/a1',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('deactivated');
    });
  });
});
