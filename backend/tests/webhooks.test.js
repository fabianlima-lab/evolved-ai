import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp } from './helpers.js';

describe('Webhook Routes', () => {
  let app;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/webhooks/whatsapp', () => {
    it('always returns 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/whatsapp',
        payload: {},
      });
      expect(res.statusCode).toBe(200);
    });

    it('handles incoming message', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/whatsapp',
        payload: {
          From: 'whatsapp:+1234567890',
          Body: 'Hello from WhatsApp',
          ProfileName: 'Test Subscriber',
        },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
