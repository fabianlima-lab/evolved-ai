import { describe, it, expect } from 'vitest';
import { compileSoulMd, getSoulTemplate, SOUL_MD_TEMPLATE } from '../src/prompts/soul.js';

describe('USER.md Generator (soul.js)', () => {
  // ── Template ──
  describe('USER_MD_TEMPLATE', () => {
    it('contains user profile section', () => {
      expect(SOUL_MD_TEMPLATE).toContain('# User Profile');
    });

    it('contains key template variables', () => {
      expect(SOUL_MD_TEMPLATE).toContain('{{USER_NAME}}');
      expect(SOUL_MD_TEMPLATE).toContain('{{USER_ROLE}}');
      expect(SOUL_MD_TEMPLATE).toContain('{{USER_DRAINS}}');
      expect(SOUL_MD_TEMPLATE).toContain('{{USER_PRIORITIES}}');
      expect(SOUL_MD_TEMPLATE).toContain('{{USER_TIMEZONE}}');
      expect(SOUL_MD_TEMPLATE).toContain('{{LIVE_CONTEXT}}');
      expect(SOUL_MD_TEMPLATE).toContain('{{USER_DESIRED_FEELING}}');
      expect(SOUL_MD_TEMPLATE).toContain('{{USER_PREFERENCES}}');
      expect(SOUL_MD_TEMPLATE).toContain('{{BRIEFING_TIME}}');
      expect(SOUL_MD_TEMPLATE).toContain('{{WRAP_TIME}}');
    });

    it('contains live context section', () => {
      expect(SOUL_MD_TEMPLATE).toContain('# Live Context');
    });

    it('contains honesty guard about unconnected services', () => {
      expect(SOUL_MD_TEMPLATE).toContain('not connected');
    });

    it('contains instruction to only reference data actually present', () => {
      expect(SOUL_MD_TEMPLATE).toContain('Only reference personal data that is ACTUALLY shown above');
    });
  });

  // ── getSoulTemplate ──
  describe('getSoulTemplate()', () => {
    it('returns the SOUL_MD_TEMPLATE', () => {
      const result = getSoulTemplate();
      expect(result).toBe(SOUL_MD_TEMPLATE);
    });
  });

  // ── compileSoulMd ──
  describe('compileSoulMd()', () => {
    it('replaces user name from profileData', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        profileData: { name: 'Sarah' },
      });
      expect(result).toContain('Sarah');
      expect(result).not.toContain('{{USER_NAME}}');
    });

    it('falls back to subscriber name when profileData has no name', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        subscriber: { name: 'Jane' },
      });
      expect(result).toContain('Jane');
    });

    it('defaults to "there" when no name provided', () => {
      const result = compileSoulMd({ assistantName: 'TestBot' });
      expect(result).toContain('there');
    });

    it('replaces user role from profileData', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        profileData: { role: 'Veterinarian' },
      });
      expect(result).toContain('Veterinarian');
      expect(result).not.toContain('{{USER_ROLE}}');
    });

    it('defaults role to "Not specified yet"', () => {
      const result = compileSoulMd({ assistantName: 'TestBot' });
      expect(result).toContain('Role: Not specified yet');
    });

    it('replaces drains from profileData array', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        profileData: { drains: ['schedule_chaos', 'admin_overload'] },
      });
      expect(result).toContain('Schedule chaos');
      expect(result).toContain('Admin overload');
      expect(result).not.toContain('{{USER_DRAINS}}');
    });

    it('defaults drains to "Not shared yet"', () => {
      const result = compileSoulMd({ assistantName: 'TestBot' });
      expect(result).toContain('Biggest drains: Not shared yet');
    });

    it('handles unknown drain IDs gracefully', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        profileData: { drains: ['unknown_drain'] },
      });
      expect(result).toContain('unknown_drain');
    });

    it('replaces priorities from profileData array', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        profileData: { priorities: ['Work-life balance', 'Client management'] },
      });
      expect(result).toContain('Work-life balance, Client management');
    });

    it('replaces priorities from profileData string', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        profileData: { priorities: 'Scale the business' },
      });
      expect(result).toContain('Scale the business');
    });

    it('replaces timezone from profileData', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        profileData: { timezone: 'America/Chicago' },
      });
      expect(result).toContain('America/Chicago');
      expect(result).not.toContain('{{USER_TIMEZONE}}');
    });

    it('replaces desired feeling from profileData', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        profileData: { desiredFeeling: 'Calm and in control' },
      });
      expect(result).toContain('Calm and in control');
    });

    it('replaces briefing and wrap times', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        profileData: { briefingTime: '6:30 AM', wrapTime: '9:00 PM' },
      });
      expect(result).toContain('6:30 AM');
      expect(result).toContain('9:00 PM');
    });

    it('injects live context', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        liveContext: 'RIGHT NOW: Tuesday, February 18, 2026\nCalendar: 2 events today',
      });
      expect(result).toContain('RIGHT NOW: Tuesday, February 18, 2026');
      expect(result).toContain('2 events today');
      expect(result).not.toContain('{{LIVE_CONTEXT}}');
    });

    it('shows fallback when no live context', () => {
      const result = compileSoulMd({ assistantName: 'TestBot' });
      expect(result).toContain('No live data available');
    });

    it('has no remaining template placeholders when fully compiled', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        profileData: {
          name: 'Dr. Emily Chen',
          role: 'Veterinary Surgeon',
          drains: ['schedule_chaos', 'mental_load'],
          priorities: ['Surgery scheduling', 'Team management'],
          desiredFeeling: 'Calm and productive',
          preferences: 'Prefers brief messages',
          timezone: 'America/Los_Angeles',
          briefingTime: '6:00 AM',
          wrapTime: '7:00 PM',
        },
        liveContext: 'RIGHT NOW: Monday, February 17, 2026',
      });
      expect(result).not.toContain('{{');
    });

    it('builds complete profile with all fields', () => {
      const result = compileSoulMd({
        assistantName: 'TestBot',
        profileData: {
          name: 'Dr. Emily Chen',
          role: 'Veterinary Surgeon',
          drains: ['schedule_chaos', 'admin_overload'],
          priorities: ['Surgery scheduling', 'Team management'],
          desiredFeeling: 'Calm and productive',
          preferences: 'Prefers brief messages',
          timezone: 'America/Los_Angeles',
          briefingTime: '6:00 AM',
          wrapTime: '7:00 PM',
        },
        liveContext: 'RIGHT NOW: Monday, February 17, 2026',
      });
      expect(result).toContain('Dr. Emily Chen');
      expect(result).toContain('Veterinary Surgeon');
      expect(result).toContain('Schedule chaos');
      expect(result).toContain('Admin overload');
      expect(result).toContain('Surgery scheduling, Team management');
      expect(result).toContain('Calm and productive');
      expect(result).toContain('Prefers brief messages');
      expect(result).toContain('America/Los_Angeles');
      expect(result).toContain('6:00 AM');
      expect(result).toContain('7:00 PM');
    });

    it('uses default values for missing profile fields', () => {
      const result = compileSoulMd({ assistantName: 'TestBot' });
      expect(result).toContain('Not specified yet'); // role, priorities
      expect(result).toContain('Not shared yet'); // drains, desired feeling
      expect(result).toContain('None yet'); // preferences
      expect(result).toContain('America/New_York'); // default timezone
      expect(result).toContain('7:00 AM'); // default briefing
      expect(result).toContain('8:00 PM'); // default wrap
    });
  });
});
