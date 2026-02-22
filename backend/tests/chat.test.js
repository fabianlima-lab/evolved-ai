import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildTestApp, mockPrisma, getAuthToken } from './helpers.js';

// Get the mocked openclaw-bridge so we can control its behavior per-test
const ocBridge = await import('../src/services/openclaw-bridge.js');

describe('Chat Routes', () => {
  let app;
  let token;

  const mockSubscriber = {
    id: 'test-subscriber-id',
    email: 'test@example.com',
    tier: 'trial',
    trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    whatsappJid: '1234567890@s.whatsapp.net',
  };

  const mockAgent = {
    id: 'agent-1',
    subscriberId: 'test-subscriber-id',
    isActive: true,
    name: 'TestAgent',
    systemPrompt: 'You are a helpful agent.',
  };

  beforeAll(async () => {
    app = await buildTestApp();
    token = getAuthToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockPrisma.subscriber.findUnique.mockReset();
    mockPrisma.subscriber.findFirst.mockReset();
    mockPrisma.agent.findFirst.mockReset();
    mockPrisma.agent.create.mockReset();
    mockPrisma.message.create.mockReset();
    mockPrisma.message.findMany.mockReset();
    ocBridge.isOpenClawConfigured.mockResolvedValue(true);
    ocBridge.callOpenClaw.mockResolvedValue({
      content: 'Mock OpenClaw response',
      error: null,
      model: 'openclaw',
      responseTimeMs: 100,
      tier: 3,
    });
  });

  // ── POST /api/chat/send ──
  describe('POST /api/chat/send', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        payload: { message: 'Hello' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects empty message', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        headers: { authorization: 'Bearer ' + token },
        payload: { message: '' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects missing message field', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects message exceeding 4000 characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        headers: { authorization: 'Bearer ' + token },
        payload: { message: 'a'.repeat(4001) },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('4000');
    });

    it('returns 404 if subscriber not found', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        headers: { authorization: 'Bearer ' + token },
        payload: { message: 'Hello' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 403 for expired trial', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        ...mockSubscriber,
        trialEndsAt: new Date('2020-01-01'),
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        headers: { authorization: 'Bearer ' + token },
        payload: { message: 'Hello' },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('Trial expired');
    });

    it('auto-creates default agent if none exists', async () => {
      const autoCreatedAgent = {
        id: 'auto-agent-1',
        subscriberId: 'test-subscriber-id',
        isActive: true,
        name: 'Assistant',
        systemPrompt: 'You are a helpful, friendly personal assistant for a busy veterinary professional. Be warm, concise, and proactive.',
      };
      mockPrisma.subscriber.findUnique.mockResolvedValue(mockSubscriber);
      mockPrisma.agent.findFirst.mockResolvedValue(null);
      mockPrisma.agent.create.mockResolvedValue(autoCreatedAgent);
      mockPrisma.message.create.mockResolvedValue({ id: 'msg-1' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        headers: { authorization: 'Bearer ' + token },
        payload: { message: 'Hello' },
      });
      expect(res.statusCode).toBe(200);
      // Verify agent was auto-created
      expect(mockPrisma.agent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriberId: 'test-subscriber-id',
            name: 'Assistant',
            isActive: true,
          }),
        }),
      );
    });

    it('returns 503 if OpenClaw not configured', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue(mockSubscriber);
      mockPrisma.agent.findFirst.mockResolvedValue(mockAgent);
      ocBridge.isOpenClawConfigured.mockResolvedValue(false);

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        headers: { authorization: 'Bearer ' + token },
        payload: { message: 'Hello' },
      });
      expect(res.statusCode).toBe(503);
    });

    it('sends message and returns OpenClaw response', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue(mockSubscriber);
      mockPrisma.agent.findFirst.mockResolvedValue(mockAgent);
      mockPrisma.message.create.mockResolvedValue({ id: 'msg-1' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        headers: { authorization: 'Bearer ' + token },
        payload: { message: 'Hello agent' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.response).toBe('Mock OpenClaw response');
      expect(body.model).toBe('openclaw');
      expect(body.responseTimeMs).toBeDefined();

      // Should save 2 messages (user + AI)
      expect(mockPrisma.message.create).toHaveBeenCalledTimes(2);
    });

    it('strips HTML from message before processing', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue(mockSubscriber);
      mockPrisma.agent.findFirst.mockResolvedValue(mockAgent);
      mockPrisma.message.create.mockResolvedValue({ id: 'msg-1' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        headers: { authorization: 'Bearer ' + token },
        payload: { message: '<script>alert("xss")</script>Hello' },
      });

      expect(res.statusCode).toBe(200);
      // Verify saved message has stripped HTML
      const savedContent = mockPrisma.message.create.mock.calls[0][0].data.content;
      expect(savedContent).toBe('alert("xss")Hello');
      expect(savedContent).not.toContain('<script>');
    });

    it('handles OpenClaw errors gracefully', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue(mockSubscriber);
      mockPrisma.agent.findFirst.mockResolvedValue(mockAgent);
      mockPrisma.message.create.mockResolvedValue({ id: 'msg-1' });
      ocBridge.callOpenClaw.mockResolvedValue({
        content: null,
        error: 'timeout',
        model: 'openclaw',
        responseTimeMs: 15000,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        headers: { authorization: 'Bearer ' + token },
        payload: { message: 'Hello' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.response).toContain('Something went wrong');
      expect(body.model).toBe('openclaw');
    });

    it('routes to isolated web session via session-id', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue(mockSubscriber);
      mockPrisma.agent.findFirst.mockResolvedValue(mockAgent);
      mockPrisma.message.create.mockResolvedValue({ id: 'msg-1' });

      await app.inject({
        method: 'POST',
        url: '/api/chat/send',
        headers: { authorization: 'Bearer ' + token },
        payload: { message: 'Hello' },
      });

      // Verify callOpenClaw uses a web-specific session ID (not phone)
      expect(ocBridge.callOpenClaw).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({
          sessionId: 'web-test-subscriber-id',
        }),
      );
    });
  });

  // ── GET /api/chat/history ──
  describe('GET /api/chat/history', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/chat/history',
      });
      expect(res.statusCode).toBe(401);
    });

    it('auto-creates agent and returns empty messages if none exists', async () => {
      const autoCreatedAgent = {
        id: 'auto-agent-1',
        subscriberId: 'test-subscriber-id',
        isActive: true,
        name: 'Assistant',
      };
      mockPrisma.agent.findFirst.mockResolvedValue(null);
      mockPrisma.agent.create.mockResolvedValue(autoCreatedAgent);
      mockPrisma.message.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/chat/history',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.messages).toEqual([]);
      expect(body.agent).toBeDefined();
      expect(mockPrisma.agent.create).toHaveBeenCalled();
    });

    it('returns messages in chronological order', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(mockAgent);
      // findMany returns DESC order (newest first) — route should reverse to ASC
      mockPrisma.message.findMany.mockResolvedValue([
        { id: 'msg-3', role: 'assistant', content: 'Third', createdAt: '2024-01-03T00:00:00Z' },
        { id: 'msg-2', role: 'user', content: 'Second', createdAt: '2024-01-02T00:00:00Z' },
        { id: 'msg-1', role: 'user', content: 'First', createdAt: '2024-01-01T00:00:00Z' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/chat/history',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.messages).toHaveLength(3);
      // Should be reversed to chronological order (oldest first)
      expect(body.messages[0].id).toBe('msg-1');
      expect(body.messages[2].id).toBe('msg-3');
    });

    it('returns agent info alongside messages', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(mockAgent);
      mockPrisma.message.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/chat/history',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.agent).toBeDefined();
      expect(body.agent.id).toBe('agent-1');
    });

    it('respects limit parameter', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(mockAgent);
      mockPrisma.message.findMany.mockResolvedValue([]);

      await app.inject({
        method: 'GET',
        url: '/api/chat/history?limit=5',
        headers: { authorization: 'Bearer ' + token },
      });

      // Verify the limit was passed to Prisma
      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('caps limit at 100', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(mockAgent);
      mockPrisma.message.findMany.mockResolvedValue([]);

      await app.inject({
        method: 'GET',
        url: '/api/chat/history?limit=999',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });
});
