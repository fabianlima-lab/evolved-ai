import crypto from 'node:crypto';
import env from '../config/env.js';
import prisma from '../lib/prisma.js';

// Okta OIDC sign-in (authorization code flow, confidential client).
// Lets a partner org (e.g. VEG) add the app as an Okta tile: the tile's
// "initiate login URI" points at GET /api/auth/okta/login, we redirect to
// Okta, and the callback signs the same JWT the other auth routes issue.

const STATE_TTL_MS = 10 * 60 * 1000;

function oktaConfigured() {
  return Boolean(env.OKTA_ISSUER && env.OKTA_CLIENT_ID && env.OKTA_CLIENT_SECRET && env.OKTA_REDIRECT_URI);
}

// Stateless CSRF state: HMAC-signed nonce + timestamp, so no session store is needed.
function signState() {
  const payload = Buffer.from(
    JSON.stringify({ n: crypto.randomBytes(16).toString('hex'), t: Date.now() })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyState(state) {
  if (typeof state !== 'string') return false;
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { t } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Date.now() - t < STATE_TTL_MS;
  } catch {
    return false;
  }
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed ID token');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
}

function redirectToApp(reply, params) {
  // Token travels in the URL fragment so it never hits server logs or Referer headers.
  const qs = new URLSearchParams(params).toString();
  return reply.redirect(`${env.APP_URL}/sso#${qs}`);
}

async function oktaAuthRoutes(app) {
  // GET /api/auth/okta/login — entry point for the Okta tile (initiate login URI)
  // and for the "Sign in with your organization" link on the login page.
  app.get('/login', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    if (!oktaConfigured()) {
      return reply.code(503).send({ error: 'Okta sign-in is not configured' });
    }

    const authorizeUrl = new URL(`${env.OKTA_ISSUER}/v1/authorize`);
    authorizeUrl.search = new URLSearchParams({
      client_id: env.OKTA_CLIENT_ID,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: env.OKTA_REDIRECT_URI,
      state: signState(),
    }).toString();

    return reply.redirect(authorizeUrl.toString());
  });

  // GET /api/auth/okta/callback — Okta redirects here with ?code&state
  app.get('/callback', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    if (!oktaConfigured()) {
      return reply.code(503).send({ error: 'Okta sign-in is not configured' });
    }

    const { code, state, error: oktaError } = request.query || {};

    if (oktaError) {
      console.error(`[AUTH] okta callback error: ${oktaError}`);
      return redirectToApp(reply, { error: 'okta_denied' });
    }

    if (!code || !verifyState(state)) {
      return redirectToApp(reply, { error: 'okta_invalid' });
    }

    try {
      // Exchange the code for tokens (client_secret_basic)
      const basic = Buffer.from(`${env.OKTA_CLIENT_ID}:${env.OKTA_CLIENT_SECRET}`).toString('base64');
      const tokenRes = await fetch(`${env.OKTA_ISSUER}/v1/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: env.OKTA_REDIRECT_URI,
        }),
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        console.error(`[AUTH] okta token exchange failed (${tokenRes.status}): ${body}`);
        return redirectToApp(reply, { error: 'okta_failed' });
      }

      const { id_token: idToken } = await tokenRes.json();
      if (!idToken) {
        return redirectToApp(reply, { error: 'okta_failed' });
      }

      // The ID token comes straight from Okta's token endpoint over TLS, so
      // claim checks (issuer, audience, expiry) are sufficient here.
      const claims = decodeJwtPayload(idToken);
      if (
        claims.iss !== env.OKTA_ISSUER ||
        claims.aud !== env.OKTA_CLIENT_ID ||
        !claims.exp || claims.exp * 1000 < Date.now()
      ) {
        console.error('[AUTH] okta ID token claim validation failed');
        return redirectToApp(reply, { error: 'okta_invalid' });
      }

      const oktaId = claims.sub;
      const email = claims.email?.toLowerCase();
      const name = claims.name || null;

      if (!oktaId || !email) {
        return redirectToApp(reply, { error: 'okta_invalid' });
      }

      // Look up subscriber by oktaId first, then by email (account linking)
      let subscriber = await prisma.subscriber.findUnique({ where: { oktaId } });
      let isNewSubscriber = false;

      if (!subscriber) {
        subscriber = await prisma.subscriber.findUnique({ where: { email } });

        if (subscriber) {
          subscriber = await prisma.subscriber.update({
            where: { id: subscriber.id },
            data: { oktaId },
          });
          console.log(`[AUTH] okta-link: ${subscriber.id} (existing subscriber)`);
        } else {
          // Org-sponsored membership: active immediately, no trial window
          subscriber = await prisma.subscriber.create({
            data: {
              email,
              oktaId,
              ...(name && { name }),
              authProvider: 'okta',
              tier: 'active',
            },
          });
          isNewSubscriber = true;
          console.log(`[AUTH] okta-signup: ${subscriber.id}`);
        }
      } else {
        console.log(`[AUTH] okta-login: ${subscriber.id}`);
      }

      const token = app.jwt.sign({ userId: subscriber.id, email: subscriber.email });

      return redirectToApp(reply, {
        token,
        ...(isNewSubscriber && { new: '1' }),
      });
    } catch (error) {
      console.error('[ERROR] okta auth failed:', error.message);
      return redirectToApp(reply, { error: 'okta_failed' });
    }
  });
}

export default oktaAuthRoutes;
