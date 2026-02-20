import { vi } from 'vitest';

// Mock PrismaClient before importing anything that uses it
const mockPrisma = {
  subscriber: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
    groupBy: vi.fn(),
  },
  agent: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
    groupBy: vi.fn(),
  },
  message: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  memory: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  reminder: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  expense: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  agentSkill: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  agentIntegration: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  agentPage: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  agentEvent: {
    findMany: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  dailyIntention: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
  task: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $queryRaw: vi.fn(),
};

vi.mock('@prisma/client', () => {
  return {
    PrismaClient: vi.fn(function () { return mockPrisma; }),
  };
});

// Mock Baileys (prevent real WhatsApp socket in tests)
vi.mock('../src/services/baileys.js', () => ({
  initBaileys: vi.fn().mockResolvedValue(undefined),
  sendWhatsAppMessage: vi.fn().mockResolvedValue(true),
  getBaileysStatus: vi.fn().mockReturnValue({ status: 'disconnected', qr: null }),
}));

// Mock whatsapp.js (thin re-export of baileys.js)
vi.mock('../src/services/whatsapp.js', () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/openclaw-bridge.js', () => ({
  callOpenClaw: vi.fn().mockResolvedValue({ content: 'Mock OpenClaw response', error: null, model: 'openclaw', responseTimeMs: 100, tier: 3 }),
  callOpenClawWithContext: vi.fn().mockResolvedValue({ content: 'Mock OpenClaw response', error: null, model: 'openclaw', responseTimeMs: 100, tier: 3 }),
  isOpenClawConfigured: vi.fn().mockResolvedValue(true),
}));

// Mock email service
vi.mock('../src/services/email.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  isEmailConfigured: vi.fn().mockReturnValue(true),
}));

// Mock google-auth-library
vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: vi.fn(function () {
      this.verifyIdToken = vi.fn();
    }),
  };
});

export { mockPrisma };

export async function buildTestApp() {
  const { build } = await import('../src/server.js');
  const app = await build();
  await app.ready();
  return app;
}

export function getAuthToken(app, subscriberId = 'test-subscriber-id', email = 'test@example.com') {
  return app.jwt.sign({ userId: subscriberId, email });
}
