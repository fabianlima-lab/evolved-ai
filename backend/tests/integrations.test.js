import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma, getAuthToken } from './helpers.js';

describe('Integrations Routes', () => {
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

  describe('GET /api/integrations', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/integrations' });
      expect(res.statusCode).toBe(401);
    });

    it('returns integrations list', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({ id: 'agent-1', subscriberId: 'test-subscriber-id' });
      mockPrisma.agentIntegration.findMany.mockResolvedValue([
        { id: 'int-1', slug: 'whatsapp', name: 'WhatsApp', status: 'connected' },
        { id: 'int-2', slug: 'google-calendar', name: 'Google Calendar', status: 'available' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/integrations',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(2);
      expect(body[0].slug).toBe('whatsapp');
    });
  });

  describe('POST /api/integrations/:slug/connect', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/integrations/google-calendar/connect' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 when integration not found', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({ id: 'agent-1', subscriberId: 'test-subscriber-id' });
      mockPrisma.agentIntegration.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/integrations/nonexistent/connect',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(404);
    });

    it('connects integration and records event', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({ id: 'agent-1', subscriberId: 'test-subscriber-id' });
      mockPrisma.agentIntegration.findUnique.mockResolvedValue({
        id: 'int-2', slug: 'google-calendar', name: 'Google Calendar', status: 'available',
      });
      mockPrisma.agentIntegration.update.mockResolvedValue({
        id: 'int-2', slug: 'google-calendar', name: 'Google Calendar', status: 'connected', connectedAt: new Date(),
      });
      mockPrisma.agentEvent.create.mockResolvedValue({ id: 'evt-1' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/integrations/google-calendar/connect',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('connected');
    });
  });
});
