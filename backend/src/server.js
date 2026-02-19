import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import env from './config/env.js';

import authRoutes from './routes/auth.js';
import agentRoutes from './routes/agents.js';
import dashboardRoutes from './routes/dashboard.js';
import webhookRoutes from './routes/webhooks.js';
import kajabiWebhookRoutes from './routes/kajabi-webhooks.js';
import channelRoutes from './routes/channels.js';
import subscriberRoutes from './routes/subscribers.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import whatsappAdminRoutes from './routes/whatsapp-admin.js';

async function build() {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Plugins
  await app.register(cors, {
    origin: env.NODE_ENV === 'production'
      ? [env.APP_URL, env.APP_URL.replace('://', '://www.')]
      : true,
    credentials: true,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '7d' },
  });

  await app.register(rateLimit, {
    global: false,
    max: env.NODE_ENV === 'test' ? 1000 : 1000,
    allowList: env.NODE_ENV === 'test' ? () => true : undefined,
  });

  // Auth decorator
  app.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Routes
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(agentRoutes, { prefix: '/api/agents' });
  app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  app.register(webhookRoutes, { prefix: '/api/webhooks' });
  app.register(kajabiWebhookRoutes, { prefix: '/api/webhooks/kajabi' });
  app.register(channelRoutes, { prefix: '/api/channels' });
  app.register(subscriberRoutes, { prefix: '/api/subscribers' });
  app.register(chatRoutes, { prefix: '/api/chat' });
  app.register(adminRoutes, { prefix: '/api/admin' });
  app.register(whatsappAdminRoutes, { prefix: '/api/whatsapp' });

  return app;
}

async function start() {
  const app = await build();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`[STARTUP] Server running on port ${env.PORT}`);
    console.log(`[STARTUP] Environment: ${env.NODE_ENV}`);

    // Start Baileys WhatsApp connection (not in test mode)
    const { initBaileys } = await import('./services/baileys.js');
    await initBaileys();

    // Start background schedulers
    const { startReminderScheduler } = await import('./services/reminder-scheduler.js');
    startReminderScheduler();

    const { startBriefingScheduler } = await import('./services/daily-briefings.js');
    startBriefingScheduler();

    const { startMemoryCleanupScheduler } = await import('./services/memory-scheduler.js');
    startMemoryCleanupScheduler();
  } catch (err) {
    console.error('[STARTUP] Failed to start server:', err.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { build };
