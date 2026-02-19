import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma, getAuthToken } from './helpers.js';

describe('Channel Routes', () => {
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
    mockPrisma.subscriber.findFirst.mockReset();
    mockPrisma.subscriber.update.mockReset();
  });

  // ── Connect Request ──
  describe('POST /api/channels/connect/request', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels/connect/request',
        payload: {},
      });
      expect(res.statusCode).toBe(401);
    });

    it('generates a 6-digit code', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels/connect/request',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.code).toMatch(/^\d{6}$/);
      expect(body.expires_in).toBe(600);
    });
  });

  // ── Connect Verify ──
  describe('POST /api/channels/connect/verify', () => {
    it('returns 400 when code or whatsappJid missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels/connect/verify',
        payload: { code: '123456' }, // missing whatsappJid
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for invalid code', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/channels/connect/verify',
        payload: { code: '999999', whatsappJid: '+1234567890@s.whatsapp.net' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('connects subscriber when code is valid', async () => {
      // First generate a code
      const codeRes = await app.inject({
        method: 'POST',
        url: '/api/channels/connect/request',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });
      const { code } = JSON.parse(codeRes.body);

      // No existing subscriber with this JID
      mockPrisma.subscriber.findFirst.mockResolvedValue(null);
      mockPrisma.subscriber.update.mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/api/channels/connect/verify',
        payload: { code, whatsappJid: '+1234567890@s.whatsapp.net' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('connected');
    });

    it('returns already_connected if JID belongs to same subscriber', async () => {
      // Generate a code
      const codeRes = await app.inject({
        method: 'POST',
        url: '/api/channels/connect/request',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });
      const { code } = JSON.parse(codeRes.body);

      // JID already linked to the same subscriber
      mockPrisma.subscriber.findFirst.mockResolvedValue({ id: 'test-subscriber-id' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/channels/connect/verify',
        payload: { code, whatsappJid: '+1234567890@s.whatsapp.net' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('already_connected');
    });

    it('returns 409 if JID belongs to different subscriber', async () => {
      // Generate a code
      const codeRes = await app.inject({
        method: 'POST',
        url: '/api/channels/connect/request',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });
      const { code } = JSON.parse(codeRes.body);

      // JID belongs to a different subscriber
      mockPrisma.subscriber.findFirst.mockResolvedValue({ id: 'other-subscriber-id' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/channels/connect/verify',
        payload: { code, whatsappJid: '+1234567890@s.whatsapp.net' },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  // ── Channel Status ──
  describe('GET /api/channels/status', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/channels/status' });
      expect(res.statusCode).toBe(401);
    });

    it('returns connected channels', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        whatsappJid: '+1234567890',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/channels/status',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.whatsapp_connected).toBe(true);
      expect(body.whatsapp_jid).toBe('+1234567890');
    });
  });

  // ── Disconnect ──
  describe('DELETE /api/channels/whatsapp', () => {
    it('disconnects a connected channel', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        whatsappJid: '+1234567890',
      });
      mockPrisma.subscriber.update.mockResolvedValue({});

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/channels/whatsapp',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('disconnected');
    });

    it('returns 404 for non-connected channel', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'test-subscriber-id',
        whatsappJid: null,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/channels/whatsapp',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
