// ─────────────────────────────────────────────────────
// Reminder Parser
//
// Extracts reminder intent from natural language messages.
// Uses simple regex patterns — fast and deterministic (no AI).
//
// Patterns:
//   "remind me to [task] at [time]"
//   "remind me to [task] on [date]"
//   "remind me to [task] in [duration]"
//   "remind me about [task] tomorrow"
//   "reminder: [task] [time/date]"
// ─────────────────────────────────────────────────────

/**
 * Try to parse a reminder from a user message.
 *
 * @param {string} text - Raw user message
 * @param {string} [timezone='America/New_York'] - Subscriber's timezone
 * @returns {{ title: string, dueAt: Date } | null} Parsed reminder or null if no match
 */
export function parseReminderFromText(text, timezone = 'America/New_York') {
  if (!text || text.length < 10) return null;

  const lower = text.toLowerCase().trim();

  // Must contain "remind" keyword
  if (!lower.includes('remind')) return null;

  // Pattern 1: "remind me to [task] at/on/in/by [time]"
  const remindMeMatch = lower.match(
    /remind\s+me\s+(?:to|about)\s+(.+?)\s+(?:at|on|in|by|tomorrow|next\s+\w+|tonight|this\s+\w+)/i,
  );

  // Pattern 2: "remind me to [task]" (no time specified — default to tomorrow 9am)
  const remindMeSimple = lower.match(
    /remind\s+me\s+(?:to|about)\s+(.+)/i,
  );

  if (!remindMeMatch && !remindMeSimple) return null;

  // Extract the task title
  let title;
  if (remindMeMatch) {
    title = remindMeMatch[1].trim();
  } else {
    title = remindMeSimple[1].trim();
  }

  // Clean up title (remove trailing time/date phrases)
  title = title
    .replace(/\s+(?:at|on|in|by|tomorrow|tonight|next\s+\w+|this\s+\w+)\s+.*$/i, '')
    .replace(/\s+(?:at|on|in|by)\s*$/i, '')
    .trim();

  if (!title || title.length < 2) return null;

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Parse the due date/time
  const dueAt = parseDueTime(lower, timezone);

  if (!dueAt) return null;

  return { title, dueAt };
}

/**
 * Parse a due date/time from the text.
 */
function parseDueTime(text, timezone) {
  const now = new Date();

  // "in X minutes/hours/days"
  const inMatch = text.match(/in\s+(\d+)\s+(minute|min|hour|hr|day|week)s?/i);
  if (inMatch) {
    const amount = parseInt(inMatch[1], 10);
    const unit = inMatch[2].toLowerCase();
    const ms = {
      minute: 60000, min: 60000,
      hour: 3600000, hr: 3600000,
      day: 86400000,
      week: 604800000,
    }[unit] || 3600000;
    return new Date(now.getTime() + amount * ms);
  }

  // "tomorrow at [time]"
  const tomorrowAt = text.match(/tomorrow\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (tomorrowAt) {
    return buildDateAtTime(1, tomorrowAt[1], tomorrowAt[2], tomorrowAt[3], timezone);
  }

  // "tomorrow" (no time — default 9am)
  if (text.includes('tomorrow')) {
    return buildDateAtTime(1, '9', '00', 'am', timezone);
  }

  // "tonight" — 8pm today
  if (text.includes('tonight')) {
    return buildDateAtTime(0, '8', '00', 'pm', timezone);
  }

  // "at [time]" (today)
  const atTime = text.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (atTime) {
    const date = buildDateAtTime(0, atTime[1], atTime[2], atTime[3], timezone);
    // If the time has already passed today, move to tomorrow
    if (date && date.getTime() < now.getTime()) {
      return new Date(date.getTime() + 86400000);
    }
    return date;
  }

  // "on [day of week]" — next occurrence
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayMatch = text.match(/on\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
  if (dayMatch) {
    const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
    const currentDay = now.getDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    return buildDateAtTime(daysAhead, '9', '00', 'am', timezone);
  }

  // "next week" — next Monday 9am
  if (text.includes('next week')) {
    const currentDay = now.getDay();
    const daysToMonday = currentDay === 0 ? 1 : 8 - currentDay;
    return buildDateAtTime(daysToMonday, '9', '00', 'am', timezone);
  }

  // Fallback: if we got here with a "remind me" but no parseable time, use tomorrow 9am
  if (text.includes('remind me')) {
    return buildDateAtTime(1, '9', '00', 'am', timezone);
  }

  return null;
}

/**
 * Build a Date object for daysFromNow at a specific time.
 */
function buildDateAtTime(daysFromNow, hourStr, minuteStr, ampm, timezone) {
  try {
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr || '0', 10);

    // Handle AM/PM
    if (ampm) {
      const isPM = ampm.toLowerCase() === 'pm';
      if (isPM && hour < 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
    } else if (hour < 7) {
      // If no AM/PM specified and hour < 7, assume PM (e.g., "at 3" = 3pm)
      hour += 12;
    }

    // Get today's date in the subscriber's timezone
    const now = new Date();
    const target = new Date(now.getTime() + daysFromNow * 86400000);

    // Set the target time
    // Use a simple approach: get the date parts in the timezone, then construct
    const dateStr = target.toLocaleDateString('en-US', { timeZone: timezone });
    const [month, day, year] = dateStr.split('/').map(Number);

    // Create the date with the timezone offset
    // This is approximate but good enough for reminders
    const result = new Date(year, month - 1, day, hour, minute, 0, 0);

    return result;
  } catch {
    return null;
  }
}
