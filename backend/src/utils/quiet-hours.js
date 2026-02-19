// ─────────────────────────────────────────────────────
// Quiet Hours Utility
//
// Enforces quiet hours (default 10pm-6am) per subscriber timezone.
// Used by all schedulers to prevent messages during quiet hours.
// ─────────────────────────────────────────────────────

const DEFAULT_QUIET_START = 22; // 10 PM
const DEFAULT_QUIET_END = 6;   // 6 AM

/**
 * Check if it's currently quiet hours for a subscriber.
 *
 * @param {string} timezone - IANA timezone (e.g. "America/New_York")
 * @param {object} [options]
 * @param {number} [options.quietStart=22] - Hour quiet hours begin (24h)
 * @param {number} [options.quietEnd=6] - Hour quiet hours end (24h)
 * @returns {boolean} true if currently in quiet hours
 */
export function isQuietHours(timezone, options = {}) {
  const quietStart = options.quietStart ?? DEFAULT_QUIET_START;
  const quietEnd = options.quietEnd ?? DEFAULT_QUIET_END;

  try {
    const now = new Date();
    const currentHour = parseInt(
      now.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }),
      10,
    );

    // Quiet hours span midnight (e.g. 22-6)
    if (quietStart > quietEnd) {
      return currentHour >= quietStart || currentHour < quietEnd;
    }

    // Quiet hours within same day (e.g. 1-5)
    return currentHour >= quietStart && currentHour < quietEnd;
  } catch {
    // Invalid timezone — default to not quiet
    return false;
  }
}

/**
 * Get the current hour in a specific timezone.
 *
 * @param {string} timezone - IANA timezone
 * @returns {number} Current hour (0-23)
 */
export function getCurrentHour(timezone) {
  try {
    const now = new Date();
    return parseInt(
      now.toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }),
      10,
    );
  } catch {
    return new Date().getUTCHours();
  }
}

/**
 * Get the current day of week in a specific timezone.
 *
 * @param {string} timezone - IANA timezone
 * @returns {number} 0=Sunday, 1=Monday, ..., 6=Saturday
 */
export function getCurrentDayOfWeek(timezone) {
  try {
    const now = new Date();
    const dayStr = now.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short' });
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return dayMap[dayStr] ?? now.getDay();
  } catch {
    return new Date().getDay();
  }
}

export { DEFAULT_QUIET_START, DEFAULT_QUIET_END };
