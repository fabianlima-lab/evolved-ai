import 'dotenv/config';

// Required env vars — fail fast if missing
const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[STARTUP] Missing required env var: ${key}`);
    process.exit(1);
  }
}

const env = {
  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // Auth
  JWT_SECRET: process.env.JWT_SECRET,

  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,

  // Google OAuth
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,

  // AI Models (3-tier routing via NVIDIA NIMs)
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
  MODEL_ROUTING_ENABLED: process.env.MODEL_ROUTING_ENABLED !== 'false', // default: true
  LOG_ROUTING_DECISIONS: process.env.LOG_ROUTING_DECISIONS !== 'false', // default: true

  // Email (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,

  // Kajabi webhook integration
  KAJABI_WEBHOOK_SECRET: process.env.KAJABI_WEBHOOK_SECRET,

  // Admin
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),

  // App
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
};

export default env;
