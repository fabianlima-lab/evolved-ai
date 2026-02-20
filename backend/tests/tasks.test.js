import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma, getAuthToken } from './helpers.js';

describe('Tasks Routes', () => {
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
    mockPrisma.task.findMany.mockReset();
  });

  describe('GET /api/tasks', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/tasks' });
      expect(res.statusCode).toBe(401);
    });

    it('returns tasks grouped by column', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 't-1', title: 'Fix bug', column: 'todo', priority: 'high', createdAt: new Date(), movedAt: new Date() },
        { id: 't-2', title: 'Write docs', column: 'backlog', priority: 'low', createdAt: new Date(), movedAt: new Date() },
        { id: 't-3', title: 'Deploy', column: 'done', priority: 'medium', createdAt: new Date(), movedAt: new Date(), completedAt: new Date() },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/tasks',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.todo).toHaveLength(1);
      expect(body.backlog).toHaveLength(1);
      expect(body.done).toHaveLength(1);
      expect(body.in_progress).toHaveLength(0);
      expect(body.review).toHaveLength(0);
    });

    it('returns empty columns when no tasks', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/tasks',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.backlog).toHaveLength(0);
      expect(body.todo).toHaveLength(0);
      expect(body.done).toHaveLength(0);
    });
  });
});
