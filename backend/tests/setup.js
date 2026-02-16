// Set required env vars BEFORE any imports to prevent env.js process.exit(1)
process.env.DATABASE_URL = 'postgresql://test@localhost:5432/evolved_ai_test';
process.env.JWT_SECRET = 'test-secret-key-for-vitest';
process.env.NODE_ENV = 'test';
process.env.APP_URL = 'http://localhost:3000';

// Admin
process.env.ADMIN_EMAILS = 'admin@test.com';

// Override credentials so real services are never called
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.NVIDIA_API_KEY = '';
process.env.GOOGLE_CLIENT_ID = '';
process.env.RESEND_API_KEY = '';
process.env.RESEND_FROM_EMAIL = '';
