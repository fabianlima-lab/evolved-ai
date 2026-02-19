import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import env from '../config/env.js';
import { sendPasswordResetEmail } from '../services/email.js';
import { stripHtml } from '../utils/helpers.js';
import prisma from '../lib/prisma.js';

// Initialize Google OAuth client (null if not configured)
const googleClient = env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID)
  : null;

// OAuth2 client for authorization code flow (needs client secret)
const googleOAuth2 = (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
  ? new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI)
  : null;

// Scopes required for Evolved AI Google API integration
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/drive.file',           // Create/access files created by the app
  'https://www.googleapis.com/auth/documents',             // Google Docs read/write
  'https://www.googleapis.com/auth/spreadsheets',          // Google Sheets read/write
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function authRoutes(app) {
  // POST /api/auth/signup
  app.post('/signup', {
    config: {
      rateLimit: { max: 3, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { email, password, firstName, lastName } = request.body || {};

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    if (!EMAIL_RE.test(email)) {
      return reply.code(400).send({ error: 'Invalid email format' });
    }

    if (password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    // Build full name from first/last if provided
    const fullName = [firstName, lastName].filter(Boolean).map(s => stripHtml(s).trim()).join(' ') || null;

    try {
      const existing = await prisma.subscriber.findUnique({ where: { email } });
      if (existing) {
        // If this is a Kajabi-provisioned subscriber with no password yet,
        // allow them to "claim" the account by setting their password
        if (existing.kajabiContactId && !existing.passwordHash) {
          const passwordHash = await bcrypt.hash(password, 10);
          const subscriber = await prisma.subscriber.update({
            where: { id: existing.id },
            data: {
              passwordHash,
              authProvider: 'email',
              ...(fullName && { name: fullName }),
            },
          });
          const token = app.jwt.sign({ userId: subscriber.id, email: subscriber.email });
          console.log(`[AUTH] signup-claimed-kajabi: ${subscriber.id}`);
          return reply.code(200).send({
            subscriber_id: subscriber.id,
            token,
            claimed_kajabi: true,
          });
        }
        return reply.code(409).send({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const subscriber = await prisma.subscriber.create({
        data: {
          email,
          passwordHash,
          ...(fullName && { name: fullName }),
          tier: 'trial',
          trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
      });

      const token = app.jwt.sign({ userId: subscriber.id, email: subscriber.email });
      console.log(`[AUTH] signup: ${subscriber.id}`);

      return reply.code(201).send({
        subscriber_id: subscriber.id,
        token,
      });
    } catch (error) {
      console.error('[ERROR] signup failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/auth/login
  app.post('/login', {
    config: {
      rateLimit: { max: 5, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { email, password } = request.body || {};

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    try {
      const subscriber = await prisma.subscriber.findUnique({ where: { email } });
      if (!subscriber) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      if (!subscriber.passwordHash) {
        return reply.code(401).send({ error: 'This account uses Google sign-in. Please use "Continue with Google" to sign in.' });
      }

      const valid = await bcrypt.compare(password, subscriber.passwordHash);
      if (!valid) {
        return reply.code(401).send({ error: 'Invalid email or password' });
      }

      const token = app.jwt.sign({ userId: subscriber.id, email: subscriber.email });
      console.log(`[AUTH] login: ${subscriber.id}`);

      return reply.send({
        subscriber_id: subscriber.id,
        token,
      });
    } catch (error) {
      console.error('[ERROR] login failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/auth/google
  app.post('/google', {
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { credential } = request.body || {};

    if (!credential) {
      return reply.code(400).send({ error: 'Google credential is required' });
    }

    if (!googleClient) {
      return reply.code(503).send({ error: 'Google authentication is not configured' });
    }

    try {
      // 1. Verify the Google ID token
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const { sub: googleId, email, email_verified: emailVerified } = payload;

      if (!email || !emailVerified) {
        return reply.code(400).send({ error: 'Google account email must be verified' });
      }

      // 2. Look up subscriber by googleId first, then by email
      let subscriber = await prisma.subscriber.findUnique({ where: { googleId } });
      let isNewSubscriber = false;

      if (!subscriber) {
        // No subscriber with this googleId — check if email exists (account linking)
        subscriber = await prisma.subscriber.findUnique({ where: { email } });

        if (subscriber) {
          // Existing email+password subscriber — link Google account
          subscriber = await prisma.subscriber.update({
            where: { id: subscriber.id },
            data: {
              googleId,
              authProvider: subscriber.authProvider === 'email' ? 'both' : subscriber.authProvider,
            },
          });
          console.log(`[AUTH] google-link: ${subscriber.id} (existing email subscriber)`);
        } else {
          // Brand new subscriber — create account via Google
          subscriber = await prisma.subscriber.create({
            data: {
              email,
              googleId,
              authProvider: 'google',
              tier: 'trial',
              trialEndsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            },
          });
          isNewSubscriber = true;
          console.log(`[AUTH] google-signup: ${subscriber.id}`);
        }
      } else {
        console.log(`[AUTH] google-login: ${subscriber.id}`);
      }

      // 3. Sign JWT (same as email auth)
      const token = app.jwt.sign({ userId: subscriber.id, email: subscriber.email });

      return reply.code(isNewSubscriber ? 201 : 200).send({
        subscriber_id: subscriber.id,
        token,
        is_new_subscriber: isNewSubscriber,
      });
    } catch (error) {
      console.error('[ERROR] google auth failed:', error.message);
      if (error.message?.includes('Token used too late') || error.message?.includes('Invalid token')) {
        return reply.code(401).send({ error: 'Google authentication failed. Please try again.' });
      }
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // ─────────────────────────────────────────────
  // GET /api/auth/google/url
  // Returns the Google OAuth consent URL with expanded scopes.
  // The frontend redirects the user to this URL during onboarding.
  // ─────────────────────────────────────────────
  app.get('/google/url', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    if (!googleOAuth2) {
      return reply.code(503).send({ error: 'Google OAuth is not fully configured (missing client secret or redirect URI)' });
    }

    const subscriberId = request.user.userId;

    // Generate consent URL with required scopes
    const url = googleOAuth2.generateAuthUrl({
      access_type: 'offline',       // Get refresh token
      prompt: 'consent',             // Force consent to always get refresh token
      scope: GOOGLE_SCOPES,
      state: subscriberId,           // Pass subscriber ID through OAuth flow
      include_granted_scopes: true,
    });

    return reply.send({ url });
  });

  // ─────────────────────────────────────────────
  // POST /api/auth/google/callback
  // Exchanges an authorization code for access + refresh tokens.
  // Called by the frontend after Google redirects back.
  // Stores tokens and granted scopes on the subscriber.
  // ─────────────────────────────────────────────
  app.post('/google/callback', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 10, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { code } = request.body || {};
    const subscriberId = request.user.userId;

    if (!code) {
      return reply.code(400).send({ error: 'Authorization code is required' });
    }

    if (!googleOAuth2) {
      return reply.code(503).send({ error: 'Google OAuth is not fully configured' });
    }

    try {
      // Exchange authorization code for tokens
      const { tokens } = await googleOAuth2.getToken(code);

      if (!tokens.access_token) {
        return reply.code(400).send({ error: 'Failed to obtain access token from Google' });
      }

      // Verify the ID token to get user info
      googleOAuth2.setCredentials(tokens);
      const tokenInfo = await googleOAuth2.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const googlePayload = tokenInfo.getPayload();
      const { sub: googleId, email } = googlePayload;

      // Build update data
      const updateData = {
        googleId,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token || undefined, // Only update if provided
        googleScopes: tokens.scope || GOOGLE_SCOPES.join(' '),
        authProvider: 'google',
      };

      if (tokens.expiry_date) {
        updateData.googleAccessTokenExpiry = new Date(tokens.expiry_date);
      }

      // Update subscriber with tokens
      const subscriber = await prisma.subscriber.update({
        where: { id: subscriberId },
        data: updateData,
      });

      console.log(`[AUTH] google-oauth-scopes: ${subscriber.id} (scopes: ${updateData.googleScopes})`);

      return reply.send({
        success: true,
        scopes: updateData.googleScopes,
        email,
      });
    } catch (error) {
      console.error('[ERROR] google callback failed:', error.message);
      if (error.message?.includes('invalid_grant')) {
        return reply.code(400).send({ error: 'Authorization code expired or already used. Please try again.' });
      }
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/auth/forgot-password
  app.post('/forgot-password', {
    config: {
      rateLimit: { max: 3, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { email } = request.body || {};

    if (!email || !EMAIL_RE.test(email)) {
      return reply.code(400).send({ error: 'Valid email is required' });
    }

    // Always return 200 to prevent email enumeration
    const successMsg = { message: 'If that email exists, we sent a reset link.' };

    try {
      const subscriber = await prisma.subscriber.findUnique({ where: { email: email.toLowerCase() } });

      // No subscriber found, or Google-only subscriber (no password to reset)
      if (!subscriber || (subscriber.authProvider === 'google' && !subscriber.passwordHash)) {
        return reply.send(successMsg);
      }

      // Generate 48-byte hex token, hash with SHA-256 before storing
      const rawToken = crypto.randomBytes(48).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      await prisma.subscriber.update({
        where: { id: subscriber.id },
        data: {
          passwordResetToken: hashedToken,
          passwordResetExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 min
        },
      });

      // Send email (fire-and-forget style — don't fail the request if email fails)
      const sent = await sendPasswordResetEmail(subscriber.email, rawToken);
      if (!sent) {
        console.error(`[AUTH] reset email failed for: ${subscriber.email}`);
      } else {
        console.log(`[AUTH] reset email sent to: ${subscriber.email}`);
      }

      return reply.send(successMsg);
    } catch (err) {
      console.error('[ERROR] forgot-password failed:', err.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/auth/reset-password
  app.post('/reset-password', {
    config: {
      rateLimit: { max: 5, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { token, password } = request.body || {};

    if (!token || !password) {
      return reply.code(400).send({ error: 'Token and new password are required' });
    }

    if (password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    try {
      // Hash the incoming token to match the stored hash
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const subscriber = await prisma.subscriber.findFirst({
        where: {
          passwordResetToken: hashedToken,
          passwordResetExpiry: { gt: new Date() },
        },
      });

      if (!subscriber) {
        return reply.code(400).send({ error: 'Invalid or expired reset link. Please request a new one.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await prisma.subscriber.update({
        where: { id: subscriber.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiry: null,
          // If Google-only subscriber sets a password, upgrade to "both"
          authProvider: subscriber.authProvider === 'google' ? 'both' : subscriber.authProvider,
        },
      });

      console.log(`[AUTH] password reset: ${subscriber.id}`);
      return reply.send({ message: 'Password reset successfully.' });
    } catch (err) {
      console.error('[ERROR] reset-password failed:', err.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/auth/change-password (authenticated)
  app.post('/change-password', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 5, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body || {};

    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    try {
      const subscriber = await prisma.subscriber.findUnique({ where: { id: request.user.userId } });
      if (!subscriber) {
        return reply.code(404).send({ error: 'Subscriber not found' });
      }

      if (!subscriber.passwordHash) {
        return reply.code(400).send({ error: 'This account uses Google sign-in and has no password to change. Use "Forgot Password" to set one.' });
      }

      const valid = await bcrypt.compare(currentPassword, subscriber.passwordHash);
      if (!valid) {
        return reply.code(401).send({ error: 'Current password is incorrect' });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.subscriber.update({
        where: { id: subscriber.id },
        data: { passwordHash },
      });

      console.log(`[AUTH] password changed: ${subscriber.id}`);
      return reply.send({ message: 'Password updated successfully.' });
    } catch (err) {
      console.error('[ERROR] change-password failed:', err.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // ─────────────────────────────────────────────
  // POST /api/auth/google/disconnect
  // Removes Google API tokens (Calendar/Gmail access).
  // Does NOT remove the Google login link (googleId stays).
  // ─────────────────────────────────────────────
  app.post('/google/disconnect', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 5, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;

    try {
      await prisma.subscriber.update({
        where: { id: subscriberId },
        data: {
          googleAccessToken: null,
          googleRefreshToken: null,
          googleAccessTokenExpiry: null,
          googleScopes: null,
        },
      });

      console.log(`[AUTH] google-disconnect: ${subscriberId}`);
      return reply.send({ success: true });
    } catch (err) {
      console.error('[ERROR] google disconnect failed:', err.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

export default authRoutes;
