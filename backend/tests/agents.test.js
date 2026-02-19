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
    mockPrisma.agent.findUnique.mockReset();
    mockPrisma.agent.findFirst.mockReset();
    mockPrisma.agent.findMany.mockReset();
    mockPrisma.agent.create.mockReset();
    mockPrisma.agent.update.mockReset();
    mockPrisma.agent.updateMany.mockReset();
    mockPrisma.agent.count.mockReset();
    mockPrisma.subscriber.findUnique.mockReset();
    mockPrisma.subscriber.update.mockReset();
    mockPrisma.message.deleteMany.mockReset();
    mockPrisma.memory.findFirst.mockReset();
    mockPrisma.memory.findMany.mockReset();
    mockPrisma.memory.create.mockReset();
    mockPrisma.memory.update.mockReset();
    mockPrisma.memory.deleteMany.mockReset();

    // Default: memory operations succeed silently
    mockPrisma.memory.findFirst.mockResolvedValue(null);
    mockPrisma.memory.create.mockResolvedValue({ id: 'mem-1' });
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

    it('creates a new agent when none exists and populates soulMd', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        tier: 'trial',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        profileData: null,
      });
      mockPrisma.agent.findUnique.mockResolvedValue(null);
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

      // Verify soulMd was passed to prisma.agent.create
      const createCall = mockPrisma.agent.create.mock.calls[0][0];
      expect(createCall.data.soulMd).toBeDefined();
      expect(createCall.data.soulMd).toContain('My Agent');
      expect(createCall.data.soulMd).toContain('Personal Assistant');
    });

    it('compiles soulMd with subscriber profile data', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        tier: 'active',
        name: 'Sarah',
        profileData: { role: 'CEO', priorities: ['Strategy'] },
      });
      mockPrisma.agent.findUnique.mockResolvedValue(null);
      mockPrisma.agent.create.mockResolvedValue({ id: 'new-agent-id' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/deploy',
        headers: { authorization: 'Bearer ' + token },
        payload: { name: 'Luna', systemPrompt: 'test prompt' },
      });

      expect(res.statusCode).toBe(201);

      const createCall = mockPrisma.agent.create.mock.calls[0][0];
      expect(createCall.data.soulMd).toContain('Luna');
      expect(createCall.data.soulMd).toContain('Personal Assistant');
      expect(createCall.data.soulMd).toContain('CEO');
      expect(createCall.data.soulMd).toContain('Strategy');
    });

    it('compiles vets variant when specified', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        tier: 'active',
        profileData: null,
      });
      mockPrisma.agent.findUnique.mockResolvedValue(null);
      mockPrisma.agent.create.mockResolvedValue({ id: 'new-agent-id' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/deploy',
        headers: { authorization: 'Bearer ' + token },
        payload: { name: 'Rex', systemPrompt: 'test', variant: 'vets' },
      });

      expect(res.statusCode).toBe(201);

      const createCall = mockPrisma.agent.create.mock.calls[0][0];
      // New SOUL.md is a single template (no variants) — just check agent name
      expect(createCall.data.soulMd).toContain('Rex');
      expect(createCall.data.soulMd).toContain('Personal Assistant');
    });

    it('updates existing agent when one already exists (upsert) with soulMd', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        tier: 'active',
        profileData: null,
      });
      mockPrisma.agent.findUnique.mockResolvedValue({
        id: 'existing-agent-id',
        subscriberId: 'test-subscriber-id',
      });
      mockPrisma.agent.update.mockResolvedValue({
        id: 'existing-agent-id',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/agents/deploy',
        headers: { authorization: 'Bearer ' + token },
        payload: { name: 'Updated Agent', systemPrompt: 'New prompt' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.agent_id).toBe('existing-agent-id');
      expect(body.name).toBe('Updated Agent');

      // Verify soulMd was included in the update
      const updateCall = mockPrisma.agent.update.mock.calls[0][0];
      expect(updateCall.data.soulMd).toBeDefined();
      expect(updateCall.data.soulMd).toContain('Updated Agent');
      expect(updateCall.data.soulMd).toContain('Personal Assistant');
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
