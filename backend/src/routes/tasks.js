import prisma from '../lib/prisma.js';

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
}

export default tasksRoutes;
