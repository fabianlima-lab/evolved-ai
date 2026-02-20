import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before import
vi.mock('../src/services/google-calendar.js', () => ({
  getTodaySchedule: vi.fn(),
  formatEventsForContext: vi.fn().mockReturnValue('📅 TODAY\'S SCHEDULE:\n- 10 AM: Team standup'),
}));

vi.mock('../src/services/gmail.js', () => ({
  getEmailSummary: vi.fn(),
  formatEmailsForContext: vi.fn().mockReturnValue('📧 EMAIL: 3 unread'),
}));

vi.mock('../src/services/reminders.js', () => ({
  getPendingReminders: vi.fn(),
  formatRemindersForContext: vi.fn().mockReturnValue('⏳ No upcoming reminders'),
}));

import { getTodaySchedule, formatEventsForContext } from '../src/services/google-calendar.js';
import { getEmailSummary, formatEmailsForContext } from '../src/services/gmail.js';
import { getPendingReminders, formatRemindersForContext } from '../src/services/reminders.js';
import { buildLiveContext } from '../src/services/context-builder.js';

describe('Context Builder', () => {
  const baseSubscriber = {
    id: 'sub-1',
    profileData: { timezone: 'America/New_York' },
    googleAccessToken: null,
    googleRefreshToken: null,
  };

  const googleSubscriber = {
    ...baseSubscriber,
    googleAccessToken: 'access-token',
    googleRefreshToken: 'refresh-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getPendingReminders.mockResolvedValue([]);
    formatRemindersForContext.mockReturnValue('⏳ No upcoming reminders');
  });

  // ── Always includes current time ──
  describe('Current time', () => {
    it('always includes current time section', async () => {
      const context = await buildLiveContext(baseSubscriber);
      expect(context).toContain('RIGHT NOW');
    });

    it('includes subscriber timezone', async () => {
      const context = await buildLiveContext(baseSubscriber);
      expect(context).toContain('America/New_York');
    });

    it('uses default timezone when profileData is missing', async () => {
      const sub = { id: 'sub-1', googleAccessToken: null, googleRefreshToken: null };
      const context = await buildLiveContext(sub);
      expect(context).toContain('America/New_York');
    });
  });

  // ── Calendar (Google not connected) ──
  describe('Calendar (not connected)', () => {
    it('shows "not connected" when no Google tokens', async () => {
      const context = await buildLiveContext(baseSubscriber);
      expect(context).toContain('Calendar: not connected');
      expect(getTodaySchedule).not.toHaveBeenCalled();
    });
  });

  // ── Calendar (Google connected) ──
  describe('Calendar (connected)', () => {
    it('fetches calendar when Google tokens present', async () => {
      getTodaySchedule.mockResolvedValue({ events: [], connected: true, error: null });

      await buildLiveContext(googleSubscriber);

      expect(getTodaySchedule).toHaveBeenCalledWith(googleSubscriber);
    });

    it('shows calendar events when connected', async () => {
      getTodaySchedule.mockResolvedValue({ events: [{ title: 'Test' }], connected: true, error: null });
      formatEventsForContext.mockReturnValue('📅 TODAY: 10 AM standup');

      const context = await buildLiveContext(googleSubscriber);
      expect(context).toContain('10 AM standup');
    });

    it('shows not connected when calendar returns connected=false', async () => {
      getTodaySchedule.mockResolvedValue({ events: [], connected: false, error: null });

      const context = await buildLiveContext(googleSubscriber);
      expect(context).toContain('Calendar: not connected');
    });

    it('handles calendar error gracefully', async () => {
      getTodaySchedule.mockResolvedValue({ events: [], connected: true, error: 'token expired' });

      const context = await buildLiveContext(googleSubscriber);
      expect(context).toContain('Calendar: unable to fetch right now');
    });

    it('catches calendar exceptions', async () => {
      getTodaySchedule.mockRejectedValue(new Error('Network timeout'));

      const context = await buildLiveContext(googleSubscriber);
      expect(context).toContain('Calendar: unable to fetch right now');
    });
  });

  // ── Email (Google not connected) ──
  describe('Email (not connected)', () => {
    it('shows "not connected" when no Google tokens', async () => {
      const context = await buildLiveContext(baseSubscriber);
      expect(context).toContain('Email: not connected');
      expect(getEmailSummary).not.toHaveBeenCalled();
    });
  });

  // ── Email (Google connected) ──
  describe('Email (connected)', () => {
    it('fetches email summary when Google tokens present', async () => {
      getTodaySchedule.mockResolvedValue({ events: [], connected: true, error: null });
      getEmailSummary.mockResolvedValue({ emails: [], unreadCount: 0, connected: true, error: null });

      await buildLiveContext(googleSubscriber);

      expect(getEmailSummary).toHaveBeenCalledWith(googleSubscriber);
    });

    it('shows email summary when connected', async () => {
      getTodaySchedule.mockResolvedValue({ events: [], connected: true, error: null });
      getEmailSummary.mockResolvedValue({ emails: [{}], unreadCount: 5, connected: true, error: null });
      formatEmailsForContext.mockReturnValue('📧 EMAIL: 5 unread');

      const context = await buildLiveContext(googleSubscriber);
      expect(context).toContain('5 unread');
    });

    it('handles email error gracefully', async () => {
      getTodaySchedule.mockResolvedValue({ events: [], connected: true, error: null });
      getEmailSummary.mockResolvedValue({ emails: [], unreadCount: 0, connected: true, error: 'rate limited' });

      const context = await buildLiveContext(googleSubscriber);
      expect(context).toContain('Email: unable to fetch right now');
    });

    it('catches email exceptions', async () => {
      getTodaySchedule.mockResolvedValue({ events: [], connected: true, error: null });
      getEmailSummary.mockRejectedValue(new Error('API error'));

      const context = await buildLiveContext(googleSubscriber);
      expect(context).toContain('Email: unable to fetch right now');
    });
  });

  // ── Reminders (always available) ──
  describe('Reminders', () => {
    it('fetches reminders regardless of Google connection', async () => {
      await buildLiveContext(baseSubscriber);
      expect(getPendingReminders).toHaveBeenCalledWith('sub-1');
    });

    it('includes formatted reminders in context', async () => {
      formatRemindersForContext.mockReturnValue('⏳ UPCOMING REMINDERS:\n- Call dentist (due: today at 3 PM)');

      const context = await buildLiveContext(baseSubscriber);
      expect(context).toContain('Call dentist');
    });

    it('handles reminder exceptions', async () => {
      getPendingReminders.mockRejectedValue(new Error('DB down'));

      const context = await buildLiveContext(baseSubscriber);
      expect(context).toContain('Reminders: unable to load');
    });
  });

  // ── Full context assembly ──
  describe('Full context', () => {
    it('sections are separated by double newlines', async () => {
      const context = await buildLiveContext(baseSubscriber);
      expect(context).toContain('\n\n');
    });

    it('logs context build with subscriber ID and length', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await buildLiveContext(baseSubscriber);

      const logCall = consoleSpy.mock.calls.find((c) => c[0]?.includes('[CONTEXT]'));
      expect(logCall).toBeDefined();
      expect(logCall[0]).toContain('subscriber:sub-1');
      expect(logCall[0]).toContain('len:');

      consoleSpy.mockRestore();
    });
  });
});
