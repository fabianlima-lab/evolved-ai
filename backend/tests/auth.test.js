import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma } from './helpers.js';

describe('Auth Routes', () => {
  let app;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockPrisma.subscriber.findUnique.mockReset();
    mockPrisma.subscriber.create.mockReset();
    mockPrisma.subscriber.update.mockReset();
  });

  // ── Signup ──
  describe('POST /api/auth/signup', () => {
    it('creates a new subscriber and returns token', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue(null);
      mockPrisma.subscriber.create.mockResolvedValue({
        id: 'new-subscriber-id',
        email: 'new@example.com',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: { email: 'new@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.subscriber_id).toBe('new-subscriber-id');
      expect(body.token).toBeDefined();
    });

    it('rejects duplicate email with 409', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({ id: 'existing-id' });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: { email: 'existing@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('already registered');
    });

    it('rejects missing fields with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: { email: 'test@example.com' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid email format with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: { email: 'not-an-email', password: 'password123' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('Invalid email');
    });

    it('rejects short password with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: { email: 'test@example.com', password: 'short' },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('8 characters');
    });
  });

  // ── Login ──
  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      // bcrypt hash of 'password123' with 10 rounds
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('password123', 10);

      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'subscriber-id',
        email: 'test@example.com',
        passwordHash: hash,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.subscriber_id).toBe('subscriber-id');
      expect(body.token).toBeDefined();
    });

    it('rejects wrong password with 401', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('correctpassword', 10);

      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'subscriber-id',
        email: 'test@example.com',
        passwordHash: hash,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'test@example.com', password: 'wrongpassword' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects nonexistent subscriber with 401', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'noone@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('tells Google-only subscribers to use Google sign-in', async () => {
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'google-subscriber',
        email: 'google@example.com',
        passwordHash: null,
        authProvider: 'google',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'google@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toContain('Google');
    });
  });

  // ── Google OAuth ──
  describe('POST /api/auth/google', () => {
    it('rejects missing credential with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/google',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
