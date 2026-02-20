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
    mockPrisma.task.findFirst.mockReset();
    mockPrisma.task.create.mockReset();
    mockPrisma.task.update.mockReset();
    mockPrisma.task.delete.mockReset();
    mockPrisma.agent.findFirst.mockReset();
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

  describe('POST /api/tasks', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'POST', url: '/api/tasks', payload: { title: 'Test' } });
      expect(res.statusCode).toBe(401);
    });

    it('rejects missing title', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });

    it('creates a task with defaults', async () => {
      const now = new Date();
      mockPrisma.agent.findFirst.mockResolvedValue({ id: 'agent-1' });
      mockPrisma.task.create.mockResolvedValue({
        id: 'new-task-1',
        title: 'Do something',
        description: null,
        column: 'backlog',
        priority: 'medium',
        createdAt: now,
        movedAt: now,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: { authorization: 'Bearer ' + token },
        payload: { title: 'Do something' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.title).toBe('Do something');
      expect(body.column).toBe('backlog');
      expect(body.priority).toBe('medium');
    });

    it('creates a task with custom column and priority', async () => {
      const now = new Date();
      mockPrisma.agent.findFirst.mockResolvedValue({ id: 'agent-1' });
      mockPrisma.task.create.mockResolvedValue({
        id: 'new-task-2',
        title: 'Urgent fix',
        description: 'Fix the login bug',
        column: 'todo',
        priority: 'high',
        createdAt: now,
        movedAt: now,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: { authorization: 'Bearer ' + token },
        payload: { title: 'Urgent fix', description: 'Fix the login bug', column: 'todo', priority: 'high' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.title).toBe('Urgent fix');
      expect(body.column).toBe('todo');
      expect(body.priority).toBe('high');
    });

    it('returns 400 when no agent deployed', async () => {
      mockPrisma.agent.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: { authorization: 'Bearer ' + token },
        payload: { title: 'Some task' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'PATCH', url: '/api/tasks/some-id', payload: { column: 'done' } });
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 for non-existent task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tasks/missing-id',
        headers: { authorization: 'Bearer ' + token },
        payload: { column: 'todo' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('moves a task to a new column', async () => {
      const now = new Date();
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 't-1', title: 'Fix bug', column: 'todo', priority: 'high',
      });
      mockPrisma.task.update.mockResolvedValue({
        id: 't-1', title: 'Fix bug', column: 'in_progress', priority: 'high',
        createdAt: now, movedAt: now, completedAt: null, description: null,
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tasks/t-1',
        headers: { authorization: 'Bearer ' + token },
        payload: { column: 'in_progress' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.column).toBe('in_progress');
    });

    it('sets completedAt when moved to done', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 't-2', title: 'Write docs', column: 'review', priority: 'low',
      });
      mockPrisma.task.update.mockImplementation(({ data }) => {
        expect(data.completedAt).toBeTruthy();
        return Promise.resolve({
          id: 't-2', title: 'Write docs', column: 'done', priority: 'low',
          createdAt: new Date(), movedAt: new Date(), completedAt: data.completedAt, description: null,
        });
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tasks/t-2',
        headers: { authorization: 'Bearer ' + token },
        payload: { column: 'done' },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).completedAt).toBeTruthy();
    });

    it('rejects invalid column', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 't-1', title: 'Fix bug', column: 'todo', priority: 'high',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tasks/t-1',
        headers: { authorization: 'Bearer ' + token },
        payload: { column: 'invalid_column' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects empty body', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({
        id: 't-1', title: 'Fix bug', column: 'todo', priority: 'high',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tasks/t-1',
        headers: { authorization: 'Bearer ' + token },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('requires authentication', async () => {
      const res = await app.inject({ method: 'DELETE', url: '/api/tasks/some-id' });
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 for non-existent task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/tasks/missing-id',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(404);
    });

    it('deletes a task', async () => {
      mockPrisma.task.findFirst.mockResolvedValue({ id: 't-1', title: 'Old task' });
      mockPrisma.task.delete.mockResolvedValue({});

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/tasks/t-1',
        headers: { authorization: 'Bearer ' + token },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });
  });
});
