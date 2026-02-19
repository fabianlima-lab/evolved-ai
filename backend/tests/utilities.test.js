import { describe, it, expect, vi } from 'vitest';

// ── Quiet Hours ──
import {
  isQuietHours,
  getCurrentHour,
  getCurrentDayOfWeek,
  DEFAULT_QUIET_START,
  DEFAULT_QUIET_END,
} from '../src/utils/quiet-hours.js';

// ── Token Budget ──
import {
  estimateTokens,
  truncateConversation,
  checkBudget,
  BUDGET,
} from '../src/utils/token-budget.js';

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
// Token Budget
// ═══════════════════════════════════════════════
describe('Token Budget', () => {
  describe('BUDGET constants', () => {
    it('has expected budget limits', () => {
      expect(BUDGET.totalTarget).toBe(20000);
      expect(BUDGET.totalHardCap).toBe(50000);
      expect(BUDGET.conversationHistory).toBe(8000);
      expect(BUDGET.systemPrompt).toBe(5000);
    });
  });

  describe('estimateTokens()', () => {
    it('returns 0 for null', () => {
      expect(estimateTokens(null)).toBe(0);
    });

    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('estimates ~1 token per 4 characters', () => {
      const text = 'a'.repeat(100);
      expect(estimateTokens(text)).toBe(25);
    });

    it('rounds up', () => {
      expect(estimateTokens('abc')).toBe(1);
    });
  });

  describe('truncateConversation()', () => {
    it('returns empty for null messages', () => {
      const result = truncateConversation(null);
      expect(result.messages).toEqual([]);
      expect(result.truncated).toBe(false);
      expect(result.originalCount).toBe(0);
    });

    it('returns empty for empty array', () => {
      const result = truncateConversation([]);
      expect(result.messages).toEqual([]);
      expect(result.truncated).toBe(false);
    });

    it('keeps short conversations unchanged', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const result = truncateConversation(messages);
      expect(result.messages).toHaveLength(2);
      expect(result.truncated).toBe(false);
    });

    it('truncates very long conversations', () => {
      // Create 50 messages with 2000 chars each = 100K chars
      const messages = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(2000),
      }));

      const result = truncateConversation(messages);
      expect(result.truncated).toBe(true);
      expect(result.finalCount).toBeLessThan(result.originalCount);
    });

    it('keeps most recent messages when truncating', () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}: ${'x'.repeat(2000)}`,
      }));

      const result = truncateConversation(messages);
      // The last message should be preserved
      const lastMsg = result.messages[result.messages.length - 1];
      expect(lastMsg.content).toContain('Message 49');
    });

    it('reduces max messages when system prompt is large', () => {
      const messages = Array.from({ length: 25 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}: ${'x'.repeat(2000)}`,
      }));

      // Large system prompt uses more budget
      const result = truncateConversation(messages, 6000);
      expect(result.finalCount).toBeLessThan(25);
    });
  });

  describe('checkBudget()', () => {
    it('returns within budget for small context', () => {
      const result = checkBudget('Short prompt', [
        { content: 'Hello' },
      ]);

      expect(result.withinBudget).toBe(true);
      expect(result.warning).toBeNull();
    });

    it('warns when exceeding target', () => {
      const bigPrompt = 'x'.repeat(BUDGET.totalTarget * 4 + 1000);

      const result = checkBudget(bigPrompt, []);

      expect(result.warning).toContain('WARNING');
    });

    it('critical warning when exceeding hard cap', () => {
      const hugePrompt = 'x'.repeat(BUDGET.totalHardCap * 4 + 1000);

      const result = checkBudget(hugePrompt, []);

      expect(result.withinBudget).toBe(false);
      expect(result.warning).toContain('CRITICAL');
    });

    it('includes system and history token counts', () => {
      const result = checkBudget('Test prompt', [
        { content: 'Message 1' },
        { content: 'Message 2' },
      ]);

      expect(result.systemTokens).toBeGreaterThan(0);
      expect(result.historyTokens).toBeGreaterThan(0);
      expect(result.totalTokens).toBe(result.systemTokens + result.historyTokens);
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
