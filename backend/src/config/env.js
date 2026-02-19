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

  // WhatsApp (Baileys — local WhatsApp Web connection)
  WHATSAPP_AUTH_DIR: process.env.WHATSAPP_AUTH_DIR || './baileys_auth',
  WHATSAPP_BOT_NUMBER: process.env.WHATSAPP_BOT_NUMBER || '',

  // Google OAuth (ID token verification + authorization code flow)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,

  // AI Models — Primary: Anthropic Claude, Fallback: Groq, Safety net: NVIDIA
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  MODEL_ROUTING_ENABLED: process.env.MODEL_ROUTING_ENABLED !== 'false', // default: true
  LOG_ROUTING_DECISIONS: process.env.LOG_ROUTING_DECISIONS !== 'false', // default: true

  // Email (Gmail SMTP via Nodemailer)
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,

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
