import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma, getAuthToken } from './helpers.js';

describe('Subscriber Routes', () => {
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
    mockPrisma.subscriber.update.mockReset();
  });

  describe('POST /api/subscribers/goals', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/subscribers/goals',
        payload: { goals: 'productivity' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('saves goals as string', async () => {
      mockPrisma.subscriber.update.mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/api/subscribers/goals',
        headers: { authorization: 'Bearer ' + token },
        payload: { goals: 'productivity' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
    });

    it('saves goals as array', async () => {
      mockPrisma.subscriber.update.mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/api/subscribers/goals',
        headers: { authorization: 'Bearer ' + token },
        payload: { goals: ['productivity', 'content'] },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.goals).toContain('productivity');
    });

    it('rejects missing goals with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/subscribers/goals',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
