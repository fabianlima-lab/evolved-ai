import { describe, it, expect, vi } from 'vitest';

// ── Quiet Hours ──
import {
  isQuietHours,
  getCurrentHour,
  getCurrentDayOfWeek,
  DEFAULT_QUIET_START,
  DEFAULT_QUIET_END,
} from '../src/utils/quiet-hours.js';

// ── Helpers ──
import {
  getFeaturesByTier,
  isTrialExpired,
  stripHtml,
  isValidTier,
  VALID_TIERS,
} from '../src/utils/helpers.js';

// ═══════════════════════════════════════════════
// Quiet Hours
// ═══════════════════════════════════════════════
describe('Quiet Hours', () => {
  describe('defaults', () => {
    it('quiet hours start at 10 PM', () => {
      expect(DEFAULT_QUIET_START).toBe(22);
    });

    it('quiet hours end at 6 AM', () => {
      expect(DEFAULT_QUIET_END).toBe(6);
    });
  });

  describe('isQuietHours()', () => {
    it('returns boolean for valid timezone', () => {
      const result = isQuietHours('America/New_York');
      expect(typeof result).toBe('boolean');
    });

    it('returns false for invalid timezone (fallback)', () => {
      expect(isQuietHours('Invalid/Timezone')).toBe(false);
    });

    it('detects quiet hours with custom range (always quiet)', () => {
      // Set quiet hours to cover all 24 hours: 0 to 24
      const result = isQuietHours('UTC', { quietStart: 0, quietEnd: 24 });
      expect(result).toBe(true);
    });

    it('detects non-quiet hours with impossible range', () => {
      // 23-23 means no quiet hours
      const result = isQuietHours('UTC', { quietStart: 23, quietEnd: 23 });
      expect(result).toBe(false);
    });
  });

  describe('getCurrentHour()', () => {
    it('returns a number between 0 and 23', () => {
      const hour = getCurrentHour('America/New_York');
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
    });

    it('falls back to UTC for invalid timezone', () => {
      const hour = getCurrentHour('Invalid/Timezone');
      expect(typeof hour).toBe('number');
      expect(hour).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCurrentDayOfWeek()', () => {
    it('returns a number between 0 and 6', () => {
      const day = getCurrentDayOfWeek('America/New_York');
      expect(day).toBeGreaterThanOrEqual(0);
      expect(day).toBeLessThanOrEqual(6);
    });

    it('falls back for invalid timezone', () => {
      const day = getCurrentDayOfWeek('Invalid/Timezone');
      expect(typeof day).toBe('number');
    });
  });
});

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════
describe('Helpers', () => {
  describe('VALID_TIERS', () => {
    it('includes expected tiers', () => {
      expect(VALID_TIERS).toContain('trial');
      expect(VALID_TIERS).toContain('active');
      expect(VALID_TIERS).toContain('past_due');
      expect(VALID_TIERS).toContain('cancelled');
    });
  });

  describe('isValidTier()', () => {
    it('returns true for valid tiers', () => {
      expect(isValidTier('trial')).toBe(true);
      expect(isValidTier('active')).toBe(true);
      expect(isValidTier('cancelled')).toBe(true);
    });

    it('returns false for invalid tiers', () => {
      expect(isValidTier('premium')).toBe(false);
      expect(isValidTier('')).toBe(false);
      expect(isValidTier(null)).toBe(false);
    });
  });

  describe('getFeaturesByTier()', () => {
    it('returns features for trial tier', () => {
      const features = getFeaturesByTier('trial');
      expect(features.max_active_agents).toBe(1);
      expect(features.web_search).toBe(true);
    });

    it('returns features for active tier', () => {
      const features = getFeaturesByTier('active');
      expect(features.max_active_agents).toBe(1);
      expect(features.custom_name).toBe(true);
    });

    it('returns restricted features for cancelled tier', () => {
      const features = getFeaturesByTier('cancelled');
      expect(features.max_active_agents).toBe(0);
      expect(features.max_channels).toBe(0);
      expect(features.web_search).toBe(false);
    });

    it('defaults to trial for unknown tier', () => {
      const features = getFeaturesByTier('nonexistent');
      expect(features).toEqual(getFeaturesByTier('trial'));
    });
  });

  describe('isTrialExpired()', () => {
    it('returns true when trial has ended', () => {
      const subscriber = {
        tier: 'trial',
        trialEndsAt: new Date('2020-01-01'),
      };
      expect(isTrialExpired(subscriber)).toBe(true);
    });

    it('returns false when trial is still active', () => {
      const subscriber = {
        tier: 'trial',
        trialEndsAt: new Date('2099-12-31'),
      };
      expect(isTrialExpired(subscriber)).toBe(false);
    });

    it('returns false for non-trial tiers', () => {
      const subscriber = {
        tier: 'active',
        trialEndsAt: new Date('2020-01-01'),
      };
      expect(isTrialExpired(subscriber)).toBe(false);
    });

    it('returns falsy when trialEndsAt is null', () => {
      const subscriber = {
        tier: 'trial',
        trialEndsAt: null,
      };
      expect(isTrialExpired(subscriber)).toBeFalsy();
    });
  });

  describe('stripHtml()', () => {
    it('removes HTML tags', () => {
      expect(stripHtml('<b>bold</b>')).toBe('bold');
    });

    it('removes script tags', () => {
      expect(stripHtml('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello');
    });

    it('handles plain text (no tags)', () => {
      expect(stripHtml('Hello world')).toBe('Hello world');
    });

    it('trims whitespace', () => {
      expect(stripHtml('  <p>text</p>  ')).toBe('text');
    });

    it('handles nested tags', () => {
      expect(stripHtml('<div><span>text</span></div>')).toBe('text');
    });

    it('coerces non-string input', () => {
      expect(stripHtml(123)).toBe('123');
    });
  });
});
