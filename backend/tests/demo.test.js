import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildTestApp } from './helpers.js';

describe('Demo Routes', () => {
  let app;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/demo/chat', () => {
    it('returns stub response when AI not configured', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/demo/chat',
        payload: { message: 'Hello!' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.response).toBeDefined();
      expect(body.agent).toBeDefined();
    });

    it('rejects missing message with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/demo/chat',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects overly long message with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/demo/chat',
        payload: { message: 'x'.repeat(5000) },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
