import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma, getAuthToken } from './helpers.js';

describe('Intentions Routes', () => {
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
    mockPrisma.dailyIntention.findUnique.mockReset();
    mockPrisma.dailyIntention.upsert.mockReset();
  });

  describe('GET /api/intention/today', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/intention/today' });
      expect(res.statusCode).toBe(401);
    });

    it('returns null when no intention set', async () => {
      mockPrisma.dailyIntention.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/api/intention/today',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.intention).toBeNull();
    });

    it('returns today\'s intention', async () => {
      mockPrisma.dailyIntention.findUnique.mockResolvedValue({
        id: 'di-1',
        feeling: 'Focused and productive',
        source: 'morning_briefing',
        optionsOffered: ['Calm', 'Focused', 'Energized'],
        wasCustom: false,
        setAt: new Date(),
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/intention/today',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.intention.feeling).toBe('Focused and productive');
      expect(body.intention.source).toBe('morning_briefing');
    });
  });

  describe('POST /api/intention', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/intention',
        payload: { feeling: 'Productive' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('requires feeling field', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/intention',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('sets daily intention', async () => {
      mockPrisma.dailyIntention.upsert.mockResolvedValue({
        id: 'di-1',
        feeling: 'Ready to tackle challenges',
        source: 'manual',
        wasCustom: true,
        setAt: new Date(),
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/intention',
        headers: { authorization: 'Bearer ' + token },
        payload: { feeling: 'Ready to tackle challenges', wasCustom: true },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.feeling).toBe('Ready to tackle challenges');
    });
  });
});
