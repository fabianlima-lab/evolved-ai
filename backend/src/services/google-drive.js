import { google } from 'googleapis';
import { getAuthedClient, isGoogleConnected } from '../utils/google-tokens.js';

// ─────────────────────────────────────────────────────
// Google Drive Service
//
// Search files, create documents/spreadsheets, and list
// recent files. All formatted as plain text for SOUL.md.
// ─────────────────────────────────────────────────────

/**
 * Search files in Google Drive.
 *
 * @param {object} subscriber
 * @param {string} query - Search query (file name, content, etc.)
 * @param {number} [maxResults=5]
 * @returns {Promise<{files: Array, connected: boolean, error?: string}>}
 */
export async function searchFiles(subscriber, query, maxResults = 5) {
  if (!isGoogleConnected(subscriber)) {
    return { files: [], connected: false };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      q: `name contains '${query.replace(/'/g, "\\'")}'`,
      pageSize: maxResults,
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime, owners)',
      orderBy: 'modifiedTime desc',
    });

    const files = (response.data.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      type: mimeToFriendly(f.mimeType),
      link: f.webViewLink,
      modified: f.modifiedTime,
      relativeTime: getRelativeTime(f.modifiedTime),
    }));

    console.log(`[DRIVE] Found ${files.length} files for query "${query}" subscriber:${subscriber.id}`);
    return { files, connected: true };
  } catch (err) {
    console.error(`[DRIVE] Search error: ${err.message}`);
    return { files: [], connected: true, error: err.message };
  }
}

/**
 * List recent files from Google Drive.
 *
 * @param {object} subscriber
 * @param {number} [maxResults=5]
 * @returns {Promise<{files: Array, connected: boolean, error?: string}>}
 */
export async function listRecentFiles(subscriber, maxResults = 5) {
  if (!isGoogleConnected(subscriber)) {
    return { files: [], connected: false };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      pageSize: maxResults,
      fields: 'files(id, name, mimeType, webViewLink, modifiedTime)',
      orderBy: 'viewedByMeTime desc',
      q: "trashed = false",
    });

    const files = (response.data.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      type: mimeToFriendly(f.mimeType),
      link: f.webViewLink,
      modified: f.modifiedTime,
      relativeTime: getRelativeTime(f.modifiedTime),
    }));

    return { files, connected: true };
  } catch (err) {
    console.error(`[DRIVE] List recent error: ${err.message}`);
    return { files: [], connected: true, error: err.message };
  }
}

/**
 * Create a new Google Doc.
 *
 * @param {object} subscriber
 * @param {string} title - Document title
 * @param {string} [content=''] - Initial plain text content
 * @returns {Promise<{success: boolean, docId?: string, link?: string, error?: string}>}
 */
export async function createGoogleDoc(subscriber, title, content = '') {
  if (!isGoogleConnected(subscriber)) {
    return { success: false, error: 'Google not connected' };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const docs = google.docs({ version: 'v1', auth });

    // Create the document
    const createResponse = await docs.documents.create({
      requestBody: { title },
    });

    const docId = createResponse.data.documentId;

    // Add content if provided
    if (content) {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [{
            insertText: {
              location: { index: 1 },
              text: content,
            },
          }],
        },
      });
    }

    const link = `https://docs.google.com/document/d/${docId}/edit`;
    console.log(`[DRIVE] Created doc "${title}" for subscriber:${subscriber.id}`);
    return { success: true, docId, link };
  } catch (err) {
    console.error(`[DRIVE] Create doc error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Create a new Google Sheet.
 *
 * @param {object} subscriber
 * @param {string} title - Spreadsheet title
 * @returns {Promise<{success: boolean, sheetId?: string, link?: string, error?: string}>}
 */
export async function createGoogleSheet(subscriber, title) {
  if (!isGoogleConnected(subscriber)) {
    return { success: false, error: 'Google not connected' };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
      },
    });

    const sheetId = response.data.spreadsheetId;
    const link = response.data.spreadsheetUrl;

    console.log(`[DRIVE] Created sheet "${title}" for subscriber:${subscriber.id}`);
    return { success: true, sheetId, link };
  } catch (err) {
    console.error(`[DRIVE] Create sheet error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Create a Google Meet link (via Calendar event with conferencing).
 *
 * @param {object} subscriber
 * @param {string} title - Meeting title
 * @param {string} startTime - ISO datetime
 * @param {string} [endTime] - ISO datetime (defaults to +30 min)
 * @param {string[]} [attendees] - Array of email addresses
 * @returns {Promise<{success: boolean, meetLink?: string, eventId?: string, error?: string}>}
 */
export async function createMeetLink(subscriber, title, startTime, endTime, attendees = []) {
  if (!isGoogleConnected(subscriber)) {
    return { success: false, error: 'Google not connected' };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const calendar = google.calendar({ version: 'v3', auth });
    const tz = subscriber.profileData?.timezone || 'America/New_York';

    const startDt = new Date(startTime);
    const endDt = endTime
      ? new Date(endTime)
      : new Date(startDt.getTime() + 30 * 60 * 1000); // Default 30 min

    const event = {
      summary: title,
      start: { dateTime: startDt.toISOString(), timeZone: tz },
      end: { dateTime: endDt.toISOString(), timeZone: tz },
      conferenceData: {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    if (attendees.length > 0) {
      event.attendees = attendees.map((email) => ({ email }));
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
    });

    const meetLink = response.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video',
    )?.uri || response.data.hangoutLink || '';

    console.log(`[MEET] Created meeting "${title}" with link ${meetLink} for subscriber:${subscriber.id}`);
    return {
      success: true,
      meetLink,
      eventId: response.data.id,
    };
  } catch (err) {
    console.error(`[MEET] Create meeting error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Format files for context display.
 */
export function formatFilesForContext(files) {
  if (!files || files.length === 0) return '';

  const lines = files.map((f) => {
    return `- ${f.name} (${f.type}) — ${f.relativeTime}`;
  });

  return lines.join('\n');
}

// ── Helpers ──

function mimeToFriendly(mime) {
  const map = {
    'application/vnd.google-apps.document': 'Doc',
    'application/vnd.google-apps.spreadsheet': 'Sheet',
    'application/vnd.google-apps.presentation': 'Slides',
    'application/vnd.google-apps.folder': 'Folder',
    'application/pdf': 'PDF',
    'image/png': 'Image',
    'image/jpeg': 'Image',
    'text/plain': 'Text',
  };
  return map[mime] || 'File';
}

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
