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
import companionRoutes from './routes/companion.js';
import evolutionRoutes from './routes/evolution.js';
import integrationsRoutes from './routes/integrations.js';
import tasksRoutes from './routes/tasks.js';
import intentionsRoutes from './routes/intentions.js';

async function build() {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    trustProxy: env.NODE_ENV === 'production',
    bodyLimit: 1048576, // 1MB max body
  });

  // ── Security headers (production) ──
  if (env.NODE_ENV === 'production') {
    app.addHook('onSend', async (request, reply) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('X-Frame-Options', 'DENY');
      reply.header('X-XSS-Protection', '1; mode=block');
      reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    });
  }

  // ── Global error handler — don't leak internals in production ──
  app.setErrorHandler(async (error, request, reply) => {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      console.error(`[ERROR] ${request.method} ${request.url}: ${error.message}`);
    }
    if (env.NODE_ENV === 'production' && statusCode >= 500) {
      return reply.code(statusCode).send({ error: 'Internal server error' });
    }
    return reply.code(statusCode).send({ error: error.message || 'Unknown error' });
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
    max: env.NODE_ENV === 'test' ? 1000 : 100,
    timeWindow: '1 minute',
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

  // Health check — basic (for load balancers / UptimeRobot)
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) };
  });

  // Health check — detailed (for admin debugging)
  app.get('/health/detailed', {
    onRequest: [app.authenticate],
  }, async () => {
    const { getDetailedHealth } = await import('./services/health-monitor.js');
    return getDetailedHealth();
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
  app.register(companionRoutes, { prefix: '/api/companion' });
  app.register(evolutionRoutes, { prefix: '/api/evolution' });
  app.register(integrationsRoutes, { prefix: '/api/integrations' });
  app.register(tasksRoutes, { prefix: '/api/tasks' });
  app.register(intentionsRoutes, { prefix: '/api/intention' });

  return app;
}

async function start() {
  const app = await build();

  try {
    await app.listen({ port: env.PORT, host: env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0' });
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

    const { startWeeklyRecapScheduler } = await import('./services/weekly-recap.js');
    startWeeklyRecapScheduler();

    const { startLifecycleScheduler } = await import('./services/lifecycle.js');
    startLifecycleScheduler();

    // Health monitor + alerting (WhatsApp disconnect, memory, crash detection)
    const { startHealthMonitor } = await import('./services/health-monitor.js');
    startHealthMonitor();
  } catch (err) {
    console.error('[STARTUP] Failed to start server:', err.message);
    process.exit(1);
  }

  // ── Graceful shutdown ──
  const shutdown = async (signal) => {
    console.log(`[SHUTDOWN] Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      console.log('[SHUTDOWN] Fastify closed');
    } catch (err) {
      console.error(`[SHUTDOWN] Error: ${err.message}`);
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { build };
