import { google } from 'googleapis';
import { getAuthedClient, isGoogleConnected } from '../utils/google-tokens.js';

// ─────────────────────────────────────────────────────
// Gmail Service
//
// Full read + write access to subscriber's Gmail.
// Read: unread emails, search, full email body
// Write: send emails, create drafts, mark read/unread
// All formatted as plain text for SOUL.md injection.
// ─────────────────────────────────────────────────────

// ── READ OPERATIONS ──

/**
 * Get unread emails for a subscriber.
 */
export async function getUnreadEmails(subscriber, { maxResults = 5 } = {}) {
  if (!isGoogleConnected(subscriber)) {
    return { emails: [], unreadCount: 0, connected: false };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const gmail = google.gmail({ version: 'v1', auth });

    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: maxResults,
    });

    const unreadCount = listResponse.data.resultSizeEstimate || 0;
    const messageIds = (listResponse.data.messages || []).slice(0, maxResults);

    if (messageIds.length === 0) {
      return { emails: [], unreadCount: 0, connected: true };
    }

    const emails = await Promise.all(
      messageIds.map(async ({ id }) => {
        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });

          const headers = msg.data.payload?.headers || [];
          const getHeader = (name) =>
            headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          return {
            id,
            from: cleanFromHeader(getHeader('From')),
            fromRaw: getHeader('From'),
            subject: getHeader('Subject') || '(No subject)',
            snippet: (msg.data.snippet || '').slice(0, 150),
            date: getHeader('Date'),
            relativeTime: getRelativeTime(getHeader('Date')),
            threadId: msg.data.threadId,
          };
        } catch {
          return null;
        }
      }),
    );

    const validEmails = emails.filter(Boolean);
    console.log(`[GMAIL] Fetched ${validEmails.length}/${unreadCount} unread for subscriber:${subscriber.id}`);

    return { emails: validEmails, unreadCount, connected: true };
  } catch (err) {
    if (err === 'google_not_connected') {
      return { emails: [], unreadCount: 0, connected: false };
    }
    console.error(`[GMAIL] Error for subscriber:${subscriber.id}: ${err.message}`);
    return { emails: [], unreadCount: 0, connected: true, error: err.message };
  }
}

/**
 * Get email summary — convenience wrapper for context builder.
 */
export async function getEmailSummary(subscriber) {
  return getUnreadEmails(subscriber, { maxResults: 5 });
}

/**
 * Search emails by query.
 *
 * @param {object} subscriber
 * @param {string} query - Gmail search query (e.g. "from:john subject:meeting")
 * @param {number} [maxResults=5]
 * @returns {Promise<{emails: Array, connected: boolean, error?: string}>}
 */
export async function searchEmails(subscriber, query, maxResults = 5) {
  if (!isGoogleConnected(subscriber)) {
    return { emails: [], connected: false };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const gmail = google.gmail({ version: 'v1', auth });

    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    const messageIds = (listResponse.data.messages || []).slice(0, maxResults);
    if (messageIds.length === 0) {
      return { emails: [], connected: true };
    }

    const emails = await Promise.all(
      messageIds.map(async ({ id }) => {
        try {
          const msg = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date'],
          });
          const headers = msg.data.payload?.headers || [];
          const getHeader = (name) =>
            headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
          return {
            id,
            from: cleanFromHeader(getHeader('From')),
            subject: getHeader('Subject') || '(No subject)',
            snippet: (msg.data.snippet || '').slice(0, 150),
            date: getHeader('Date'),
            relativeTime: getRelativeTime(getHeader('Date')),
          };
        } catch {
          return null;
        }
      }),
    );

    return { emails: emails.filter(Boolean), connected: true };
  } catch (err) {
    console.error(`[GMAIL] Search error: ${err.message}`);
    return { emails: [], connected: true, error: err.message };
  }
}

/**
 * Get the full body text of an email.
 *
 * @param {object} subscriber
 * @param {string} messageId - Gmail message ID
 * @returns {Promise<{body: string, subject: string, from: string, error?: string}>}
 */
export async function getEmailBody(subscriber, messageId) {
  if (!isGoogleConnected(subscriber)) {
    return { body: '', error: 'Google not connected' };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const gmail = google.gmail({ version: 'v1', auth });

    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = msg.data.payload?.headers || [];
    const getHeader = (name) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const body = extractBody(msg.data.payload);

    return {
      body: body.slice(0, 2000), // Cap at 2000 chars for context window
      subject: getHeader('Subject'),
      from: cleanFromHeader(getHeader('From')),
    };
  } catch (err) {
    console.error(`[GMAIL] Get body error: ${err.message}`);
    return { body: '', error: err.message };
  }
}

// ── WRITE OPERATIONS ──

/**
 * Send an email.
 *
 * @param {object} subscriber
 * @param {object} emailData
 * @param {string} emailData.to - Recipient email
 * @param {string} emailData.subject - Subject line
 * @param {string} emailData.body - Plain text body
 * @param {string} [emailData.replyToMessageId] - Message ID to reply to
 * @param {string} [emailData.threadId] - Thread ID for replies
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendEmail(subscriber, emailData) {
  if (!isGoogleConnected(subscriber)) {
    return { success: false, error: 'Google not connected' };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const gmail = google.gmail({ version: 'v1', auth });

    // Get sender's email
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const fromEmail = profile.data.emailAddress;

    // Build RFC 2822 message
    let rawMessage = '';
    rawMessage += `From: ${fromEmail}\r\n`;
    rawMessage += `To: ${emailData.to}\r\n`;
    rawMessage += `Subject: ${emailData.subject}\r\n`;
    if (emailData.replyToMessageId) {
      rawMessage += `In-Reply-To: ${emailData.replyToMessageId}\r\n`;
      rawMessage += `References: ${emailData.replyToMessageId}\r\n`;
    }
    rawMessage += `Content-Type: text/plain; charset=utf-8\r\n`;
    rawMessage += `\r\n`;
    // Convert literal \n sequences to real newlines (AI outputs escaped newlines in action tags)
    rawMessage += (emailData.body || '').replace(/\\n/g, '\n');

    // Base64url encode
    const encoded = Buffer.from(rawMessage).toString('base64url');

    const sendParams = {
      userId: 'me',
      requestBody: { raw: encoded },
    };
    if (emailData.threadId) {
      sendParams.requestBody.threadId = emailData.threadId;
    }

    const response = await gmail.users.messages.send(sendParams);

    console.log(`[GMAIL] Sent email to ${emailData.to} for subscriber:${subscriber.id}`);
    return { success: true, messageId: response.data.id };
  } catch (err) {
    console.error(`[GMAIL] Send error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Create a draft email.
 *
 * @param {object} subscriber
 * @param {object} emailData - Same shape as sendEmail
 * @returns {Promise<{success: boolean, draftId?: string, error?: string}>}
 */
export async function createDraft(subscriber, emailData) {
  if (!isGoogleConnected(subscriber)) {
    return { success: false, error: 'Google not connected' };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const gmail = google.gmail({ version: 'v1', auth });

    const profile = await gmail.users.getProfile({ userId: 'me' });
    const fromEmail = profile.data.emailAddress;

    let rawMessage = '';
    rawMessage += `From: ${fromEmail}\r\n`;
    rawMessage += `To: ${emailData.to}\r\n`;
    rawMessage += `Subject: ${emailData.subject}\r\n`;
    rawMessage += `Content-Type: text/plain; charset=utf-8\r\n`;
    rawMessage += `\r\n`;
    // Convert literal \n sequences to real newlines (AI outputs escaped newlines in action tags)
    rawMessage += (emailData.body || '').replace(/\\n/g, '\n');

    const encoded = Buffer.from(rawMessage).toString('base64url');

    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: { raw: encoded },
      },
    });

    console.log(`[GMAIL] Created draft for subscriber:${subscriber.id}`);
    return { success: true, draftId: response.data.id };
  } catch (err) {
    console.error(`[GMAIL] Draft error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Mark emails as read.
 *
 * @param {object} subscriber
 * @param {string[]} messageIds - Array of Gmail message IDs
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
export async function markAsRead(subscriber, messageIds) {
  if (!isGoogleConnected(subscriber)) {
    return { success: false, count: 0, error: 'Google not connected' };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const gmail = google.gmail({ version: 'v1', auth });

    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: messageIds,
        removeLabelIds: ['UNREAD'],
      },
    });

    console.log(`[GMAIL] Marked ${messageIds.length} as read for subscriber:${subscriber.id}`);
    return { success: true, count: messageIds.length };
  } catch (err) {
    console.error(`[GMAIL] Mark read error: ${err.message}`);
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Archive emails (remove from inbox).
 *
 * @param {object} subscriber
 * @param {string[]} messageIds
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
export async function archiveEmails(subscriber, messageIds) {
  if (!isGoogleConnected(subscriber)) {
    return { success: false, count: 0, error: 'Google not connected' };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const gmail = google.gmail({ version: 'v1', auth });

    await gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: messageIds,
        removeLabelIds: ['INBOX'],
      },
    });

    console.log(`[GMAIL] Archived ${messageIds.length} emails for subscriber:${subscriber.id}`);
    return { success: true, count: messageIds.length };
  } catch (err) {
    console.error(`[GMAIL] Archive error: ${err.message}`);
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Format emails as plain text for the SOUL.md context.
 */
export function formatEmailsForContext(emails, unreadCount) {
  if (unreadCount === 0) {
    return '📧 Inbox is clear — no unread emails';
  }

  const lines = emails.map((email) => {
    const time = email.relativeTime || '';
    return `- From: ${email.from} — "${email.subject}"${time ? ` (${time})` : ''}`;
  });

  let header = `📧 INBOX: ${unreadCount} unread email${unreadCount !== 1 ? 's' : ''}`;
  if (emails.length > 0) {
    header += `\nTop messages:\n${lines.join('\n')}`;
  }

  return header;
}

// ── Helpers ──

/**
 * Extract plain text body from Gmail message payload.
 */
function extractBody(payload) {
  if (!payload) return '';

  // Direct body (text/plain)
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }

  // Multipart — find text/plain part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf8');
      }
      // Nested multipart
      if (part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }
    // Fallback: try text/html and strip tags
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64url').toString('utf8');
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }

  // Fallback to snippet
  return payload.snippet || '';
}

/**
 * Clean a "From" header to just show the name or email.
 */
function cleanFromHeader(from) {
  if (!from) return 'Unknown';
  const match = from.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  const emailMatch = from.match(/<([^>]+)>/);
  if (emailMatch) return emailMatch[1];
  return from.split('@')[0] || from;
}

/**
 * Get a human-friendly relative time string.
 */
function getRelativeTime(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHr = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return `${Math.floor(diffDay / 7)}w ago`;
  } catch {
    return '';
  }
}
