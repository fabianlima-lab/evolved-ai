import prisma from '../lib/prisma.js';
import { recordEvent } from '../services/evolution.js';

const VALID_COLUMNS = ['backlog', 'todo', 'in_progress', 'review', 'done'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];

async function tasksRoutes(app) {
  // GET /api/tasks — all tasks grouped by column
  app.get('/', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 60, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;

    try {
      const tasks = await prisma.task.findMany({
        where: { subscriberId },
        orderBy: [
          { column: 'asc' },
          { movedAt: 'desc' },
        ],
      });

      // Group by column
      const columns = {
        backlog: [],
        todo: [],
        in_progress: [],
        review: [],
        done: [],
      };

      for (const task of tasks) {
        const col = columns[task.column] || columns.backlog;
        col.push({
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          createdAt: task.createdAt,
          movedAt: task.movedAt,
          completedAt: task.completedAt,
        });
      }

      return reply.send(columns);
    } catch (error) {
      console.error('[ERROR] tasks fetch failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/tasks — create a new task
  app.post('/', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const { title, description, column, priority } = request.body || {};

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return reply.code(400).send({ error: 'Title is required.' });
    }

    const col = column && VALID_COLUMNS.includes(column) ? column : 'backlog';
    const prio = priority && VALID_PRIORITIES.includes(priority) ? priority : 'medium';

    try {
      const agent = await prisma.agent.findFirst({
        where: { subscriberId, isActive: true },
        select: { id: true },
      });

      if (!agent) {
        return reply.code(400).send({ error: 'No active agent found. Deploy your assistant first.' });
      }

      const task = await prisma.task.create({
        data: {
          subscriberId,
          agentId: agent.id,
          title: title.trim().slice(0, 300),
          description: description ? String(description).trim().slice(0, 1000) : null,
          column: col,
          priority: prio,
        },
      });

      return reply.code(201).send({
        id: task.id,
        title: task.title,
        description: task.description,
        column: task.column,
        priority: task.priority,
        createdAt: task.createdAt,
        movedAt: task.movedAt,
      });
    } catch (error) {
      console.error('[ERROR] task create failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // PATCH /api/tasks/:id — update a task (move column, change priority, edit title/description)
  app.patch('/:id', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 60, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const { id } = request.params;
    const { title, description, column, priority } = request.body || {};

    try {
      const existing = await prisma.task.findFirst({
        where: { id, subscriberId },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'Task not found.' });
      }

      const data = {};

      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length === 0) {
          return reply.code(400).send({ error: 'Title cannot be empty.' });
        }
        data.title = title.trim().slice(0, 300);
      }

      if (description !== undefined) {
        data.description = description ? String(description).trim().slice(0, 1000) : null;
      }

      if (column !== undefined) {
        if (!VALID_COLUMNS.includes(column)) {
          return reply.code(400).send({ error: `Invalid column. Must be one of: ${VALID_COLUMNS.join(', ')}` });
        }
        data.column = column;
        data.movedAt = new Date();

        if (column === 'done' && existing.column !== 'done') {
          data.completedAt = new Date();
        }
        if (column !== 'done' && existing.column === 'done') {
          data.completedAt = null;
        }
      }

      if (priority !== undefined) {
        if (!VALID_PRIORITIES.includes(priority)) {
          return reply.code(400).send({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
        }
        data.priority = priority;
      }

      if (Object.keys(data).length === 0) {
        return reply.code(400).send({ error: 'No valid fields to update.' });
      }

      const updated = await prisma.task.update({
        where: { id },
        data,
      });

      return reply.send({
        id: updated.id,
        title: updated.title,
        description: updated.description,
        column: updated.column,
        priority: updated.priority,
        createdAt: updated.createdAt,
        movedAt: updated.movedAt,
        completedAt: updated.completedAt,
      });
    } catch (error) {
      console.error('[ERROR] task update failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // DELETE /api/tasks/:id — delete a task
  app.delete('/:id', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const { id } = request.params;

    try {
      const existing = await prisma.task.findFirst({
        where: { id, subscriberId },
      });

      if (!existing) {
        return reply.code(404).send({ error: 'Task not found.' });
      }

      await prisma.task.delete({ where: { id } });

      return reply.send({ success: true });
    } catch (error) {
      console.error('[ERROR] task delete failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

export default tasksRoutes;
