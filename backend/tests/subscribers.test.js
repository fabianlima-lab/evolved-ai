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

  // ── Onboarding Step ──
  describe('PATCH /api/subscribers/onboarding-step', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/subscribers/onboarding-step',
        payload: { step: 'complete' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('updates onboarding step', async () => {
      mockPrisma.subscriber.update.mockResolvedValue({});

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/subscribers/onboarding-step',
        headers: { authorization: 'Bearer ' + token },
        payload: { step: 'google_oauth' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.step).toBe('google_oauth');
    });

    it('sets onboardingComplete when step is complete', async () => {
      mockPrisma.subscriber.update.mockResolvedValue({});

      await app.inject({
        method: 'PATCH',
        url: '/api/subscribers/onboarding-step',
        headers: { authorization: 'Bearer ' + token },
        payload: { step: 'complete' },
      });

      expect(mockPrisma.subscriber.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ onboardingComplete: true }),
        }),
      );
    });

    it('rejects invalid step with 400', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/subscribers/onboarding-step',
        headers: { authorization: 'Bearer ' + token },
        payload: { step: 'invalid_step' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects missing step with 400', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/subscribers/onboarding-step',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── Profile ──
  describe('POST /api/subscribers/profile', () => {
    it('requires authentication', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/subscribers/profile',
        payload: { name: 'Test' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('saves profile data', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        profileData: { timezone: 'America/New_York' },
      });
      mockPrisma.subscriber.update.mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/api/subscribers/profile',
        headers: { authorization: 'Bearer ' + token },
        payload: { name: 'Dr. Sarah', role: 'Veterinarian' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.profileData.name).toBe('Dr. Sarah');
      expect(body.profileData.role).toBe('Veterinarian');
      expect(body.profileData.timezone).toBe('America/New_York'); // merged
    });

    it('merges with existing profile data', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        profileData: { role: 'Vet', timezone: 'America/New_York' },
      });
      mockPrisma.subscriber.update.mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/api/subscribers/profile',
        headers: { authorization: 'Bearer ' + token },
        payload: { name: 'Dr. Sarah' },
      });

      const body = JSON.parse(res.body);
      expect(body.profileData.name).toBe('Dr. Sarah');
      expect(body.profileData.role).toBe('Vet'); // preserved from existing
    });

    it('rejects empty payload with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/subscribers/profile',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('saves priorities as array', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({ profileData: {} });
      mockPrisma.subscriber.update.mockResolvedValue({});

      const res = await app.inject({
        method: 'POST',
        url: '/api/subscribers/profile',
        headers: { authorization: 'Bearer ' + token },
        payload: { priorities: ['Surgery scheduling', 'Team management'] },
      });

      const body = JSON.parse(res.body);
      expect(body.profileData.priorities).toHaveLength(2);
    });
  });
});
