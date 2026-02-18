import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp, getAuthToken } from './helpers.js';

describe('WhatsApp Admin Routes', () => {
  let app;
  let token;

  beforeAll(async () => {
    app = await buildTestApp();
    token = getAuthToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/whatsapp/status', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/whatsapp/status',
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns connection status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/whatsapp/status',
        headers: { authorization: 'Bearer ' + token },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('disconnected');
    });
  });

  describe('GET /api/whatsapp/qr', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/whatsapp/qr',
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns qr as null when disconnected', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/whatsapp/qr',
        headers: { authorization: 'Bearer ' + token },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.qr).toBeNull();
      expect(body.status).toBe('disconnected');
    });
  });
});
