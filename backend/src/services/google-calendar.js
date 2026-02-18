import { google } from 'googleapis';
import { getAuthedClient, isGoogleConnected } from '../utils/google-tokens.js';

// ─────────────────────────────────────────────────────
// Google Calendar Service
//
// Full read + write access to subscriber's Google Calendar.
// All data formatted as plain text for SOUL.md injection.
// Write operations return confirmation strings for the AI.
// ─────────────────────────────────────────────────────

/**
 * Get upcoming calendar events for a subscriber.
 */
export async function getUpcomingEvents(subscriber, { hours = 24, maxResults = 10 } = {}) {
  if (!isGoogleConnected(subscriber)) {
    return { events: [], connected: false };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const future = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults,
    });

    const events = (response.data.items || []).map((event) => ({
      id: event.id,
      title: event.summary || '(No title)',
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      location: event.location || '',
      description: event.description ? event.description.slice(0, 200) : '',
      allDay: !!event.start?.date && !event.start?.dateTime,
    }));

    console.log(`[CALENDAR] Fetched ${events.length} events for subscriber:${subscriber.id}`);
    return { events, connected: true };
  } catch (err) {
    if (err === 'google_not_connected') {
      return { events: [], connected: false };
    }
    console.error(`[CALENDAR] Error for subscriber:${subscriber.id}: ${err.message}`);
    return { events: [], connected: true, error: err.message };
  }
}

/**
 * Get today's remaining schedule for a subscriber.
 */
export async function getTodaySchedule(subscriber) {
  const tz = subscriber.profileData?.timezone || 'America/New_York';

  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  });
  const currentHour = parseInt(formatter.format(now), 10);
  const hoursRemaining = Math.max(1, 24 - currentHour);

  return getUpcomingEvents(subscriber, { hours: hoursRemaining });
}

/**
 * Create a new calendar event.
 *
 * @param {object} subscriber
 * @param {object} eventData
 * @param {string} eventData.title - Event title
 * @param {string} eventData.startTime - ISO datetime or date string
 * @param {string} eventData.endTime - ISO datetime or date string (optional, defaults to +1hr)
 * @param {string} [eventData.location] - Location
 * @param {string} [eventData.description] - Description
 * @param {boolean} [eventData.allDay] - All-day event
 * @returns {Promise<{success: boolean, event?: object, error?: string}>}
 */
export async function createEvent(subscriber, eventData) {
  if (!isGoogleConnected(subscriber)) {
    return { success: false, error: 'Google not connected' };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const calendar = google.calendar({ version: 'v3', auth });
    const tz = subscriber.profileData?.timezone || 'America/New_York';

    let start, end;
    if (eventData.allDay) {
      // All-day events use date (not dateTime)
      const dateStr = new Date(eventData.startTime).toISOString().split('T')[0];
      start = { date: dateStr };
      end = { date: eventData.endTime ? new Date(eventData.endTime).toISOString().split('T')[0] : dateStr };
    } else {
      const startDt = new Date(eventData.startTime);
      const endDt = eventData.endTime
        ? new Date(eventData.endTime)
        : new Date(startDt.getTime() + 60 * 60 * 1000); // Default 1 hour
      start = { dateTime: startDt.toISOString(), timeZone: tz };
      end = { dateTime: endDt.toISOString(), timeZone: tz };
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: eventData.title,
        location: eventData.location || '',
        description: eventData.description || '',
        start,
        end,
      },
    });

    const event = response.data;
    console.log(`[CALENDAR] Created event "${eventData.title}" for subscriber:${subscriber.id}`);
    return {
      success: true,
      event: {
        id: event.id,
        title: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        link: event.htmlLink,
      },
    };
  } catch (err) {
    console.error(`[CALENDAR] Create event error for subscriber:${subscriber.id}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Update an existing calendar event.
 *
 * @param {object} subscriber
 * @param {string} eventId - Google event ID
 * @param {object} updates - Fields to update (title, startTime, endTime, location, description)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateEvent(subscriber, eventId, updates) {
  if (!isGoogleConnected(subscriber)) {
    return { success: false, error: 'Google not connected' };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const calendar = google.calendar({ version: 'v3', auth });
    const tz = subscriber.profileData?.timezone || 'America/New_York';

    const patch = {};
    if (updates.title) patch.summary = updates.title;
    if (updates.location) patch.location = updates.location;
    if (updates.description) patch.description = updates.description;
    if (updates.startTime) {
      patch.start = { dateTime: new Date(updates.startTime).toISOString(), timeZone: tz };
    }
    if (updates.endTime) {
      patch.end = { dateTime: new Date(updates.endTime).toISOString(), timeZone: tz };
    }

    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: patch,
    });

    console.log(`[CALENDAR] Updated event ${eventId} for subscriber:${subscriber.id}`);
    return { success: true };
  } catch (err) {
    console.error(`[CALENDAR] Update event error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a calendar event.
 *
 * @param {object} subscriber
 * @param {string} eventId - Google event ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteEvent(subscriber, eventId) {
  if (!isGoogleConnected(subscriber)) {
    return { success: false, error: 'Google not connected' };
  }

  try {
    const auth = await getAuthedClient(subscriber);
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    });

    console.log(`[CALENDAR] Deleted event ${eventId} for subscriber:${subscriber.id}`);
    return { success: true };
  } catch (err) {
    console.error(`[CALENDAR] Delete event error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Find free time slots in the next N hours.
 *
 * @param {object} subscriber
 * @param {number} [hours=8] - How many hours ahead to check
 * @returns {Promise<{slots: Array, error?: string}>}
 */
export async function findFreeSlots(subscriber, hours = 8) {
  if (!isGoogleConnected(subscriber)) {
    return { slots: [], error: 'Google not connected' };
  }

  try {
    const { events } = await getUpcomingEvents(subscriber, { hours, maxResults: 20 });
    const tz = subscriber.profileData?.timezone || 'America/New_York';
    const now = new Date();
    const endWindow = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const slots = [];
    let cursor = now;

    // Sort events by start time
    const sorted = events
      .filter((e) => !e.allDay)
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    for (const event of sorted) {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      // Gap before this event?
      if (eventStart > cursor) {
        const gapMinutes = (eventStart - cursor) / (1000 * 60);
        if (gapMinutes >= 30) {
          // Only show slots >= 30 min
          slots.push({
            start: cursor.toISOString(),
            end: eventStart.toISOString(),
            durationMinutes: Math.round(gapMinutes),
          });
        }
      }
      cursor = eventEnd > cursor ? eventEnd : cursor;
    }

    // Gap after last event
    if (cursor < endWindow) {
      const gapMinutes = (endWindow - cursor) / (1000 * 60);
      if (gapMinutes >= 30) {
        slots.push({
          start: cursor.toISOString(),
          end: endWindow.toISOString(),
          durationMinutes: Math.round(gapMinutes),
        });
      }
    }

    return { slots };
  } catch (err) {
    console.error(`[CALENDAR] Free slots error: ${err.message}`);
    return { slots: [], error: err.message };
  }
}

/**
 * Format calendar events as plain text for the SOUL.md context.
 */
export function formatEventsForContext(events, timezone = 'America/New_York') {
  if (!events || events.length === 0) {
    return '📅 No events on the calendar today';
  }

  const lines = events.map((event) => {
    let timeStr;
    if (event.allDay) {
      timeStr = 'All day';
    } else {
      try {
        const start = new Date(event.start);
        timeStr = start.toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      } catch {
        timeStr = event.start;
      }
    }

    let line = `${timeStr} — ${event.title}`;
    if (event.location) {
      line += ` (${event.location})`;
    }
    return line;
  });

  return `📅 TODAY'S SCHEDULE:\n${lines.join('\n')}`;
}
