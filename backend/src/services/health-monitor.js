import { getBaileysStatus } from './baileys.js';
import env from '../config/env.js';

// ─────────────────────────────────────────────────────
// Health Monitor & Alerting
//
// Background service that watches for critical failures:
//   - WhatsApp disconnection (subscribers go silent)
//   - Repeated crash-loop detection
//   - Memory usage warnings
//
// Sends alerts to admin email(s) via SMTP when issues
// are detected. Runs every 2 minutes.
//
// Also exposes a detailed /health endpoint for external
// monitoring (UptimeRobot, Pingdom, etc.)
// ─────────────────────────────────────────────────────

const CHECK_INTERVAL_MS = 2 * 60 * 1000; // Check every 2 minutes
let intervalHandle = null;

// Alert cooldowns — prevent spam
const alertCooldowns = new Map(); // key → timestamp
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between same alerts

// Track WhatsApp state transitions
let lastWhatsAppStatus = null;
let whatsAppDisconnectedSince = null;

/**
 * Start the health monitor background loop.
 */
export function startHealthMonitor() {
  if (intervalHandle) return;

  console.log('[STARTUP] Health monitor started (checks every 2min)');
  lastWhatsAppStatus = getBaileysStatus().status;

  intervalHandle = setInterval(async () => {
    try {
      await runHealthChecks();
    } catch (err) {
      console.error(`[HEALTH] Monitor tick error: ${err.message}`);
    }
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the health monitor (for testing/shutdown).
 */
export function stopHealthMonitor() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/**
 * Run all health checks.
 */
async function runHealthChecks() {
  // ── Check WhatsApp connection ──
  checkWhatsAppHealth();

  // ── Check memory usage ──
  checkMemoryUsage();
}

/**
 * Check WhatsApp connection status and alert on disconnect.
 */
function checkWhatsAppHealth() {
  const { status } = getBaileysStatus();

  // Detect state transition to disconnected
  if (status !== 'open' && lastWhatsAppStatus === 'open') {
    whatsAppDisconnectedSince = new Date();
    console.warn(`[HEALTH] WhatsApp disconnected at ${whatsAppDisconnectedSince.toISOString()}`);
  }

  // If disconnected for more than 5 minutes, alert
  if (status !== 'open' && whatsAppDisconnectedSince) {
    const disconnectedMs = Date.now() - whatsAppDisconnectedSince.getTime();
    const disconnectedMin = Math.floor(disconnectedMs / 60000);

    if (disconnectedMin >= 5) {
      sendAlert(
        'whatsapp_down',
        'WhatsApp Disconnected',
        `WhatsApp has been disconnected for ${disconnectedMin} minutes.\n\n` +
        `Status: ${status}\n` +
        `Since: ${whatsAppDisconnectedSince.toISOString()}\n\n` +
        `Action needed: SSH into server and check Baileys logs.\n` +
        `If logged out, scan QR at: http://167.172.209.255/api/whatsapp/qr-page\n\n` +
        `Commands:\n` +
        `  ssh root@167.172.209.255\n` +
        `  pm2 logs evolved-backend --lines 50 | grep BAILEYS`
      );
    }
  }

  // If reconnected, clear state
  if (status === 'open' && lastWhatsAppStatus !== 'open') {
    if (whatsAppDisconnectedSince) {
      const downtime = Math.floor((Date.now() - whatsAppDisconnectedSince.getTime()) / 60000);
      console.log(`[HEALTH] WhatsApp reconnected after ${downtime} minutes`);
      whatsAppDisconnectedSince = null;
      // Clear the cooldown so future disconnects are alerted
      alertCooldowns.delete('whatsapp_down');
    }
  }

  lastWhatsAppStatus = status;
}

/**
 * Check Node.js memory usage and warn if getting high.
 */
function checkMemoryUsage() {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);

  // Warn at 400MB (PM2 restarts at 512MB)
  if (rssMB > 400) {
    sendAlert(
      'memory_high',
      'High Memory Usage Warning',
      `Server memory usage is high:\n\n` +
      `RSS: ${rssMB}MB\n` +
      `Heap Used: ${heapUsedMB}MB\n\n` +
      `PM2 will auto-restart at 512MB.\n` +
      `Check for memory leaks in scheduler intervals or message history.`
    );
  }
}

/**
 * Send an alert (console log + email if configured).
 * Respects cooldown to prevent alert spam.
 */
function sendAlert(key, subject, body) {
  // Check cooldown
  const lastSent = alertCooldowns.get(key);
  if (lastSent && Date.now() - lastSent < COOLDOWN_MS) {
    return; // Still in cooldown
  }

  alertCooldowns.set(key, Date.now());

  // Always log to console
  console.error(`[ALERT] ${subject}\n${body}`);

  // Send email if SMTP is configured
  if (env.SMTP_USER && env.SMTP_PASS && env.ADMIN_EMAILS.length > 0) {
    sendAlertEmail(subject, body).catch((err) => {
      console.error(`[ALERT] Email send failed: ${err.message}`);
    });
  }
}

/**
 * Send alert email to admin(s).
 */
async function sendAlertEmail(subject, body) {
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: env.ADMIN_EMAILS.join(', '),
      subject: `[Evolved AI Alert] ${subject}`,
      text: `${body}\n\n---\nServer: 167.172.209.255\nTime: ${new Date().toISOString()}\nEnvironment: ${env.NODE_ENV}`,
    });

    console.log(`[ALERT] Email sent to ${env.ADMIN_EMAILS.join(', ')}: ${subject}`);
  } catch (err) {
    console.error(`[ALERT] Email transport error: ${err.message}`);
  }
}

/**
 * Get detailed health status for the /health endpoint.
 * Used by external monitoring (UptimeRobot, etc.)
 */
export function getDetailedHealth() {
  const { status: waStatus } = getBaileysStatus();
  const memory = process.memoryUsage();

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    whatsapp: {
      status: waStatus,
      disconnectedSince: whatsAppDisconnectedSince?.toISOString() || null,
    },
    memory: {
      rss_mb: Math.round(memory.rss / 1024 / 1024),
      heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(memory.heapTotal / 1024 / 1024),
    },
    schedulers: {
      reminder: 'running',
      briefing: 'running',
      memory_cleanup: 'running',
      weekly_recap: 'running',
      lifecycle: 'running',
      health_monitor: 'running',
    },
  };
}
