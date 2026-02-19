import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPrisma } from './helpers.js';
import { executeAction, executeAllActions } from '../src/services/action-executor.js';

// Mock all external service modules that action-executor imports
vi.mock('../src/services/google-calendar.js', () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  findFreeSlots: vi.fn(),
}));

vi.mock('../src/services/gmail.js', () => ({
  sendEmail: vi.fn(),
  createDraft: vi.fn(),
  markAsRead: vi.fn(),
  archiveEmails: vi.fn(),
  searchEmails: vi.fn(),
  getEmailBody: vi.fn(),
}));

vi.mock('../src/services/reminders.js', () => ({
  createReminder: vi.fn().mockResolvedValue({ id: 'rem-1' }),
  dismissReminder: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/google-drive.js', () => ({
  searchFiles: vi.fn(),
  listRecentFiles: vi.fn(),
  createGoogleDoc: vi.fn(),
  createGoogleSheet: vi.fn(),
  createMeetLink: vi.fn(),
}));

vi.mock('../src/services/skills.js', () => ({
  webSearch: vi.fn().mockResolvedValue('Search results'),
  getWeather: vi.fn().mockResolvedValue('72°F Sunny'),
  getNews: vi.fn().mockResolvedValue('Top news'),
  calculate: vi.fn().mockResolvedValue('42'),
}));

vi.mock('../src/services/expenses.js', () => ({
  logExpense: vi.fn().mockResolvedValue({ success: true }),
  getMonthlyExpenses: vi.fn().mockResolvedValue({ total: 0, byCategory: {}, count: 0 }),
  getCategoryTotal: vi.fn().mockResolvedValue({ total: 0, count: 0 }),
}));

describe('Action Executor', () => {
  beforeEach(() => {
    mockPrisma.memory.findFirst.mockReset();
    mockPrisma.memory.findMany.mockReset();
    mockPrisma.memory.create.mockReset();
  });

  // ── Tenant Guard: Subscriber Validation ──
  describe('Tenant Guard (subscriber validation)', () => {
    it('blocks actions when subscriber is null', async () => {
      const result = await executeAction('web_search', { query: 'test' }, null);
      expect(result.success).toBe(false);
    });

    it('blocks actions when subscriber is undefined', async () => {
      const result = await executeAction('web_search', { query: 'test' }, undefined);
      expect(result.success).toBe(false);
    });

    it('blocks actions when subscriber has no id', async () => {
      const result = await executeAction('web_search', { query: 'test' }, { email: 'test@test.com' });
      expect(result.success).toBe(false);
    });

    it('allows actions when subscriber has valid id', async () => {
      mockPrisma.memory.findMany.mockResolvedValue([]);
      const result = await executeAction('memory_dump', {}, { id: 'sub-1' });
      expect(result.success).toBe(true);
    });
  });

  // ── Unknown Action Handling ──
  describe('Unknown actions', () => {
    it('returns failure for unknown action types', async () => {
      const result = await executeAction('totally_fake_action', {}, { id: 'sub-1' });
      expect(result.success).toBe(false);
    });
  });

  // ── Memory Dump (QMD — REQ-015) ──
  describe('memory_dump (REQ-015)', () => {
    it('returns message when no memories exist', async () => {
      mockPrisma.memory.findMany.mockResolvedValue([]);

      const result = await executeAction('memory_dump', {}, { id: 'sub-1' });

      expect(result.success).toBe(true);
      expect(result.result).toContain("don't have any memories");
    });

    it('returns formatted dump with single category', async () => {
      mockPrisma.memory.findMany.mockResolvedValue([
        { id: 'm1', category: 'relationships', fact: 'Mom Linda birthday March 15' },
        { id: 'm2', category: 'relationships', fact: 'Dog named Max' },
      ]);

      const result = await executeAction('memory_dump', {}, { id: 'sub-1' });

      expect(result.success).toBe(true);
      expect(result.result).toContain('People');
      expect(result.result).toContain('Mom Linda birthday March 15');
      expect(result.result).toContain('Dog named Max');
    });

    it('returns formatted dump with multiple categories', async () => {
      mockPrisma.memory.findMany.mockResolvedValue([
        { id: 'm1', category: 'relationships', fact: 'Mom Linda' },
        { id: 'm2', category: 'preferences', fact: 'Morning person' },
        { id: 'm3', category: 'career', fact: 'Veterinarian at City Clinic' },
      ]);

      const result = await executeAction('memory_dump', {}, { id: 'sub-1' });

      expect(result.success).toBe(true);
      expect(result.result).toContain('People');
      expect(result.result).toContain('Preferences');
      expect(result.result).toContain('Career');
      expect(result.result).toContain('Mom Linda');
      expect(result.result).toContain('Morning person');
      expect(result.result).toContain('Veterinarian at City Clinic');
    });

    it('includes fact count in output', async () => {
      mockPrisma.memory.findMany.mockResolvedValue([
        { id: 'm1', category: 'relationships', fact: 'Mom Linda' },
        { id: 'm2', category: 'preferences', fact: 'Morning person' },
        { id: 'm3', category: 'career', fact: 'Vet' },
      ]);

      const result = await executeAction('memory_dump', {}, { id: 'sub-1' });

      expect(result.result).toContain('3 facts');
    });

    it('includes correction prompt', async () => {
      mockPrisma.memory.findMany.mockResolvedValue([
        { id: 'm1', category: 'preferences', fact: 'Likes tea' },
      ]);

      const result = await executeAction('memory_dump', {}, { id: 'sub-1' });

      expect(result.result).toContain('wrong');
    });

    it('handles single memory with singular grammar', async () => {
      mockPrisma.memory.findMany.mockResolvedValue([
        { id: 'm1', category: 'relationships', fact: 'Mom Linda' },
      ]);

      const result = await executeAction('memory_dump', {}, { id: 'sub-1' });

      expect(result.result).toContain('1 fact');
      expect(result.result).not.toContain('1 facts');
    });
  });

  // ── Memory Save (silent) ──
  describe('memory_save', () => {
    it('saves a valid fact silently', async () => {
      mockPrisma.memory.findFirst.mockResolvedValue(null);
      mockPrisma.memory.create.mockResolvedValue({ id: 'mem-1' });

      const result = await executeAction(
        'memory_save',
        { category: 'relationships', fact: 'Mom Linda birthday March 15' },
        { id: 'sub-1' },
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe(''); // Silent — no user-visible result
    });

    it('returns failure but empty result for missing params', async () => {
      const result = await executeAction(
        'memory_save',
        { category: 'relationships' }, // missing fact
        { id: 'sub-1' },
      );

      expect(result.success).toBe(false);
      expect(result.result).toBe('');
    });
  });

  // ── executeAllActions ──
  describe('executeAllActions()', () => {
    it('executes multiple actions and returns combined results', async () => {
      mockPrisma.memory.findMany.mockResolvedValue([]);
      mockPrisma.memory.findFirst.mockResolvedValue(null);
      mockPrisma.memory.create.mockResolvedValue({ id: 'mem-1' });

      const actions = [
        { action: 'memory_dump', params: {} },
        { action: 'memory_save', params: { category: 'preferences', fact: 'Likes coffee' } },
      ];

      const { results, allSucceeded } = await executeAllActions(actions, { id: 'sub-1' });

      expect(results).toHaveLength(2);
      expect(allSucceeded).toBe(true);
    });

    it('reports partial failure correctly', async () => {
      mockPrisma.memory.findMany.mockResolvedValue([]);

      const actions = [
        { action: 'memory_dump', params: {} },
        { action: 'totally_fake_action', params: {} },
      ];

      const { results, allSucceeded } = await executeAllActions(actions, { id: 'sub-1' });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(allSucceeded).toBe(false);
    });

    it('blocks all actions when subscriber is invalid', async () => {
      const actions = [
        { action: 'memory_dump', params: {} },
      ];

      const { results, allSucceeded } = await executeAllActions(actions, null);

      expect(results).toHaveLength(1);
      expect(allSucceeded).toBe(false);
    });
  });
});
