import { PrismaClient } from '@prisma/client';
import { build } from '../src/server.js';

const prisma = new PrismaClient();

let app;
let passed = 0;
let failed = 0;
const results = [];

function assert(label, condition, detail) {
  if (condition) {
    passed++;
    results.push(`  PASS  ${label}`);
  } else {
    failed++;
    results.push(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function request(method, url, opts = {}) {
  const res = await app.inject({
    method,
    url,
    payload: opts.body,
    headers: {
      'content-type': 'application/json',
      ...opts.headers,
    },
  });
  return {
    status: res.statusCode,
    body: JSON.parse(res.body),
  };
}

// ===============================================
// TEST SUITES
// ===============================================

async function testHealthCheck() {
  console.log('\n1. Health Check');
  const res = await request('GET', '/health');
  assert('GET /health returns 200', res.status === 200);
  assert('Response has status: ok', res.body.status === 'ok');
  assert('Response has timestamp', !!res.body.timestamp);
}

async function testDatabaseConnection() {
  console.log('\n2. Database Connection');
  try {
    const result = await prisma.$queryRaw`SELECT 1 as connected`;
    assert('Raw SQL query succeeds', result[0].connected === 1);
  } catch (err) {
    assert('Raw SQL query succeeds', false, err.message);
  }

  try {
    const count = await prisma.subscriber.count();
    assert('Subscriber table is accessible', count >= 0);
  } catch (err) {
    assert('Subscriber table is accessible', false, err.message);
  }

  try {
    const count = await prisma.agent.count();
    assert('Agent table is accessible', count >= 0);
  } catch (err) {
    assert('Agent table is accessible', false, err.message);
  }

  try {
    const count = await prisma.message.count();
    assert('Message table is accessible', count >= 0);
  } catch (err) {
    assert('Message table is accessible', false, err.message);
  }
}

async function testSignup() {
  console.log('\n3. Signup');
  const email = `test-${Date.now()}@phase1.test`;

  // Validation tests first (count toward rate limit: 3/min)
  // 1. Missing fields
  const noFields = await request('POST', '/api/auth/signup', {
    body: {},
  });
  assert('Missing fields returns 400', noFields.status === 400);

  // 2. Bad email format
  const badEmail = await request('POST', '/api/auth/signup', {
    body: { email: 'notanemail', password: 'securepass123' },
  });
  assert('Invalid email returns 400', badEmail.status === 400);

  // 3. Short password (last one before rate limit)
  const shortPw = await request('POST', '/api/auth/signup', {
    body: { email: 'short@phase1.test', password: 'short' },
  });
  assert('Short password returns 400', shortPw.status === 400);

  // Rate limit hit — verify it triggers (request 4 of 3/min)
  const rateLimited = await request('POST', '/api/auth/signup', {
    body: { email, password: 'securepass123' },
  });
  assert('Signup rate limit triggers after 3 requests', rateLimited.status === 429);

  // Wait for rate limit to reset (use a fresh Fastify instance approach:
  // close and rebuild to reset in-memory rate limit counters)
  await app.close();
  app = await build();

  // Now do the actual successful signup
  const res = await request('POST', '/api/auth/signup', {
    body: { email, password: 'securepass123' },
  });
  assert('Signup returns 201', res.status === 201, `got ${res.status}`);
  assert('Signup returns subscriber_id', !!res.body.subscriber_id);
  assert('Signup returns JWT token', !!res.body.token);
  assert('JWT is well-formed (3 parts)', res.body.token?.split('.').length === 3);

  // Verify subscriber in DB
  const subscriber = await prisma.subscriber.findUnique({ where: { email } });
  assert('Subscriber exists in database', !!subscriber);
  assert('Password is hashed (not plaintext)', subscriber.passwordHash !== 'securepass123');
  assert('Default tier is free', subscriber.tier === 'free');

  // Duplicate signup
  const dup = await request('POST', '/api/auth/signup', {
    body: { email, password: 'securepass123' },
  });
  assert('Duplicate email returns 409', dup.status === 409);

  return { email, password: 'securepass123', subscriberId: res.body.subscriber_id };
}

async function testLogin(credentials) {
  console.log('\n4. Login');

  // Successful login
  const res = await request('POST', '/api/auth/login', {
    body: { email: credentials.email, password: credentials.password },
  });
  assert('Login returns 200', res.status === 200, `got ${res.status}`);
  assert('Login returns subscriber_id', res.body.subscriber_id === credentials.subscriberId);
  assert('Login returns JWT token', !!res.body.token);

  // Wrong password
  const wrongPw = await request('POST', '/api/auth/login', {
    body: { email: credentials.email, password: 'wrongpassword' },
  });
  assert('Wrong password returns 401', wrongPw.status === 401);

  // Non-existent subscriber
  const noSubscriber = await request('POST', '/api/auth/login', {
    body: { email: 'nobody@test.com', password: 'whatever123' },
  });
  assert('Non-existent subscriber returns 401', noSubscriber.status === 401);

  // Missing fields
  const noFields = await request('POST', '/api/auth/login', {
    body: {},
  });
  assert('Missing fields returns 400', noFields.status === 400);

  return res.body.token;
}

async function testAuthProtection(token) {
  console.log('\n5. JWT Protection');

  const protectedEndpoints = [
    { method: 'POST', url: '/api/agents/deploy' },
    { method: 'GET',  url: '/api/agents/mine' },
    { method: 'GET',  url: '/api/dashboard/stats' },
    { method: 'GET',  url: '/api/dashboard/messages' },
  ];

  // No token — all should return 401
  for (const ep of protectedEndpoints) {
    const res = await request(ep.method, ep.url, {
      body: ep.method === 'POST' ? { dummy: true } : undefined,
    });
    assert(
      `${ep.method} ${ep.url} rejects without token`,
      res.status === 401,
      `got ${res.status}`
    );
  }

  // Invalid token — all should return 401
  for (const ep of protectedEndpoints) {
    const res = await request(ep.method, ep.url, {
      headers: { authorization: 'Bearer invalid.token.here' },
      body: ep.method === 'POST' ? { dummy: true } : undefined,
    });
    assert(
      `${ep.method} ${ep.url} rejects invalid token`,
      res.status === 401,
      `got ${res.status}`
    );
  }

  // Valid token — should NOT return 401
  for (const ep of protectedEndpoints) {
    const res = await request(ep.method, ep.url, {
      headers: { authorization: `Bearer ${token}` },
      body: ep.method === 'POST' ? { dummy: true } : undefined,
    });
    assert(
      `${ep.method} ${ep.url} accepts valid token`,
      res.status !== 401,
      `got ${res.status}`
    );
  }
}

// ===============================================
// RUNNER
// ===============================================

async function run() {
  console.log('='.repeat(50));
  console.log(' Phase 1 Foundation Tests');
  console.log('='.repeat(50));

  try {
    app = await build();

    await testHealthCheck();
    await testDatabaseConnection();
    const credentials = await testSignup();
    const token = await testLogin(credentials);
    await testAuthProtection(token);

  } catch (err) {
    console.error('\n  FATAL TEST ERROR:', err.message);
    console.error(err.stack);
    failed++;
  } finally {
    // Cleanup test data
    try {
      await prisma.agent.deleteMany({
        where: { subscriber: { email: { contains: '@phase1.test' } } },
      });
      await prisma.subscriber.deleteMany({
        where: { email: { contains: '@phase1.test' } },
      });
    } catch (err) {
      // Ignore cleanup errors
    }

    await prisma.$disconnect();
    if (app) await app.close();
  }

  // Print results
  console.log('\n' + '='.repeat(50));
  console.log(' Results');
  console.log('='.repeat(50));
  for (const r of results) {
    console.log(r);
  }
  console.log('\n' + '-'.repeat(50));
  console.log(`  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('-'.repeat(50));

  if (failed > 0) {
    console.log('\n  SOME TESTS FAILED\n');
    process.exit(1);
  } else {
    console.log('\n  ALL TESTS PASSED\n');
    process.exit(0);
  }
}

run();
