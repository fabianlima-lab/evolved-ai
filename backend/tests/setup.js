// Set required env vars BEFORE any imports to prevent env.js process.exit(1)
process.env.DATABASE_URL = 'postgresql://test@localhost:5432/evolved_ai_test';
process.env.JWT_SECRET = 'test-secret-key-for-vitest';
process.env.NODE_ENV = 'test';
process.env.APP_URL = 'http://localhost:3000';

// Admin
process.env.ADMIN_EMAILS = 'admin@test.com';

// Override credentials so real services are never called
process.env.WHATSAPP_AUTH_DIR = '/tmp/baileys_test_auth';
process.env.NVIDIA_API_KEY = '';
process.env.GOOGLE_CLIENT_ID = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
