import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma, getAuthToken } from './helpers.js';

describe('Evolution Routes', () => {
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

  // ── Timeline ──
  describe('GET /api/evolution/timeline', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/evolution/timeline' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 when no agent exists', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/evolution/timeline',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns timeline events', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({ id: 'agent-1', subscriberId: 'test-subscriber-id' });
      mockPrisma.agentEvent.findMany.mockResolvedValue([
        { id: 'evt-1', eventType: 'milestone', title: 'Agent created', createdAt: new Date() },
        { id: 'evt-2', eventType: 'skill_installed', title: 'Activated: Chat', createdAt: new Date() },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/evolution/timeline?limit=10',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(2);
      expect(body[0].eventType).toBe('milestone');
    });
  });

  // ── Skills ──
  describe('GET /api/evolution/skills', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/evolution/skills' });
      expect(res.statusCode).toBe(401);
    });

    it('returns skills list', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({ id: 'agent-1', subscriberId: 'test-subscriber-id' });
      mockPrisma.agentSkill.findMany.mockResolvedValue([
        { id: 'sk-1', slug: 'chat-voice', name: 'Chat & Voice', status: 'active', category: 'communication' },
        { id: 'sk-2', slug: 'research', name: 'Research', status: 'available', category: 'research' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/evolution/skills',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(2);
      expect(body[0].slug).toBe('chat-voice');
    });
  });

  // ── Skill Activation ──
  describe('POST /api/evolution/skills/:slug/activate', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/evolution/skills/research/activate' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 when skill not found', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({ id: 'agent-1', subscriberId: 'test-subscriber-id' });
      mockPrisma.agentSkill.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/evolution/skills/nonexistent/activate',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(404);
    });

    it('activates skill and records event', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({ id: 'agent-1', subscriberId: 'test-subscriber-id' });
      mockPrisma.agentSkill.findUnique.mockResolvedValue({
        id: 'sk-2', slug: 'research', name: 'Research', status: 'available',
      });
      mockPrisma.agentSkill.update.mockResolvedValue({
        id: 'sk-2', slug: 'research', name: 'Research', status: 'active', activatedAt: new Date(),
      });
      mockPrisma.agentEvent.create.mockResolvedValue({ id: 'evt-1' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/evolution/skills/research/activate',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('active');
      expect(mockPrisma.agentEvent.create).toHaveBeenCalled();
    });
  });
});
