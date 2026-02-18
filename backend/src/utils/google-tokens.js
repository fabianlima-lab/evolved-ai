import { OAuth2Client } from 'google-auth-library';
import env from '../config/env.js';
import prisma from '../lib/prisma.js';

// ─────────────────────────────────────────────────────
// Google Token Refresh Utility
//
// Provides an authenticated OAuth2Client for any subscriber
// who has connected their Google account. Handles automatic
// token refresh when access tokens expire.
// ─────────────────────────────────────────────────────

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 min before expiry

/**
 * Get an authenticated Google OAuth2Client for a subscriber.
 *
 * - If no refresh token → throws 'google_not_connected'
 * - If access token expired → refreshes automatically and saves to DB
 * - Returns a ready-to-use OAuth2Client
 *
 * @param {object} subscriber - Subscriber record from Prisma
 * @returns {Promise<OAuth2Client>}
 * @throws {string} 'google_not_connected' | 'google_not_configured'
 */
export async function getAuthedClient(subscriber) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw 'google_not_configured';
  }

  if (!subscriber.googleRefreshToken) {
    throw 'google_not_connected';
  }

  const client = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );

  client.setCredentials({
    access_token: subscriber.googleAccessToken,
    refresh_token: subscriber.googleRefreshToken,
    expiry_date: subscriber.googleAccessTokenExpiry
      ? new Date(subscriber.googleAccessTokenExpiry).getTime()
      : 0,
  });

  // Check if token needs refresh
  const now = Date.now();
  const expiry = subscriber.googleAccessTokenExpiry
    ? new Date(subscriber.googleAccessTokenExpiry).getTime()
    : 0;

  if (!subscriber.googleAccessToken || expiry < now + TOKEN_REFRESH_BUFFER_MS) {
    console.log(`[GOOGLE] Refreshing token for subscriber:${subscriber.id}`);
    try {
      const { credentials } = await client.refreshAccessToken();

      // Save new tokens to DB
      const updateData = {
        googleAccessToken: credentials.access_token,
      };
      if (credentials.expiry_date) {
        updateData.googleAccessTokenExpiry = new Date(credentials.expiry_date);
      }
      if (credentials.refresh_token) {
        updateData.googleRefreshToken = credentials.refresh_token;
      }

      await prisma.subscriber.update({
        where: { id: subscriber.id },
        data: updateData,
      });

      client.setCredentials(credentials);
      console.log(`[GOOGLE] Token refreshed for subscriber:${subscriber.id}`);
    } catch (err) {
      console.error(`[GOOGLE] Token refresh failed for subscriber:${subscriber.id}: ${err.message}`);
      throw 'google_not_connected';
    }
  }

  return client;
}

/**
 * Check if a subscriber has the required Google scopes.
 *
 * @param {object} subscriber - Subscriber record
 * @param {string[]} requiredScopes - Array of scope URLs to check
 * @returns {boolean}
 */
export function hasGoogleScopes(subscriber, requiredScopes) {
  if (!subscriber.googleScopes) return false;
  const granted = subscriber.googleScopes.split(' ');
  return requiredScopes.every((scope) => granted.includes(scope));
}

/**
 * Check if a subscriber has Google connected (has refresh token).
 *
 * @param {object} subscriber
 * @returns {boolean}
 */
export function isGoogleConnected(subscriber) {
  return !!(subscriber.googleRefreshToken && subscriber.googleAccessToken);
}
