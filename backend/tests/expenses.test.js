import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPrisma } from './helpers.js';

// Add expense mock to mockPrisma
if (!mockPrisma.expense) {
  mockPrisma.expense = {
    create: vi.fn(),
    findMany: vi.fn(),
  };
}

import {
  logExpense,
  getMonthlyExpenses,
  getCategoryTotal,
  VALID_CATEGORIES,
} from '../src/services/expenses.js';

describe('Expense Service', () => {
  beforeEach(() => {
    mockPrisma.expense.create.mockReset();
    mockPrisma.expense.findMany.mockReset();
  });

  // ── VALID_CATEGORIES ──
  describe('VALID_CATEGORIES', () => {
    it('includes expected categories', () => {
      expect(VALID_CATEGORIES).toContain('dining');
      expect(VALID_CATEGORIES).toContain('groceries');
      expect(VALID_CATEGORIES).toContain('coffee');
      expect(VALID_CATEGORIES).toContain('gas');
      expect(VALID_CATEGORIES).toContain('medical');
      expect(VALID_CATEGORIES).toContain('other');
    });

    it('has 12 categories', () => {
      expect(VALID_CATEGORIES).toHaveLength(12);
    });
  });

  // ── logExpense ──
  describe('logExpense()', () => {
    it('logs a valid expense', async () => {
      mockPrisma.expense.create.mockResolvedValue({
        id: 'exp-1',
        amount: 47.5,
        category: 'dining',
        description: 'Lunch',
      });

      const result = await logExpense('sub-1', {
        amount: '47.50',
        category: 'dining',
        description: 'Lunch',
      });

      expect(result.success).toBe(true);
      expect(result.expense).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('rejects invalid amount (NaN)', async () => {
      const result = await logExpense('sub-1', { amount: 'not-a-number', category: 'dining' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_amount');
      expect(mockPrisma.expense.create).not.toHaveBeenCalled();
    });

    it('rejects zero amount', async () => {
      const result = await logExpense('sub-1', { amount: '0', category: 'dining' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_amount');
    });

    it('rejects negative amount', async () => {
      const result = await logExpense('sub-1', { amount: '-5', category: 'dining' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_amount');
    });

    it('normalizes category to lowercase', async () => {
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-1', amount: 10 });

      await logExpense('sub-1', { amount: '10', category: 'DINING' });

      expect(mockPrisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ category: 'dining' }),
        }),
      );
    });

    it('defaults invalid category to "other"', async () => {
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-1', amount: 10 });

      await logExpense('sub-1', { amount: '10', category: 'fake_category' });

      expect(mockPrisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ category: 'other' }),
        }),
      );
    });

    it('defaults missing category to "other"', async () => {
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-1', amount: 10 });

      await logExpense('sub-1', { amount: '10' });

      expect(mockPrisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ category: 'other' }),
        }),
      );
    });

    it('rounds amount to 2 decimal places', async () => {
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-1' });

      await logExpense('sub-1', { amount: '10.999', category: 'dining' });

      expect(mockPrisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 11 }),
        }),
      );
    });

    it('sanitizes description (strips angle brackets)', async () => {
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-1' });

      await logExpense('sub-1', {
        amount: '10',
        category: 'dining',
        description: '<script>alert("xss")</script>Lunch',
      });

      expect(mockPrisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: expect.not.stringContaining('<script>'),
          }),
        }),
      );
    });

    it('truncates description to 300 chars', async () => {
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-1' });
      const longDesc = 'A'.repeat(500);

      await logExpense('sub-1', { amount: '10', category: 'dining', description: longDesc });

      const passedDesc = mockPrisma.expense.create.mock.calls[0][0].data.description;
      expect(passedDesc.length).toBeLessThanOrEqual(300);
    });

    it('handles null description', async () => {
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-1' });

      await logExpense('sub-1', { amount: '10', category: 'dining' });

      expect(mockPrisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: null }),
        }),
      );
    });

    it('handles database errors', async () => {
      mockPrisma.expense.create.mockRejectedValue(new Error('DB error'));

      const result = await logExpense('sub-1', { amount: '10', category: 'dining' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('db_error');
    });
  });

  // ── getMonthlyExpenses ──
  describe('getMonthlyExpenses()', () => {
    it('returns zero totals when no expenses', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([]);

      const result = await getMonthlyExpenses('sub-1');

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
      expect(result.byCategory).toEqual({});
    });

    it('groups expenses by category', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([
        { amount: 10, category: 'dining', description: 'Lunch', date: new Date() },
        { amount: 15, category: 'dining', description: 'Dinner', date: new Date() },
        { amount: 5, category: 'coffee', description: 'Latte', date: new Date() },
      ]);

      const result = await getMonthlyExpenses('sub-1');

      expect(result.total).toBe(30);
      expect(result.count).toBe(3);
      expect(result.byCategory.dining.total).toBe(25);
      expect(result.byCategory.dining.count).toBe(2);
      expect(result.byCategory.coffee.total).toBe(5);
      expect(result.byCategory.coffee.count).toBe(1);
    });

    it('rounds category totals', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([
        { amount: 10.005, category: 'dining', description: null, date: new Date() },
        { amount: 10.005, category: 'dining', description: null, date: new Date() },
      ]);

      const result = await getMonthlyExpenses('sub-1');

      expect(result.byCategory.dining.total).toBe(20.01);
    });

    it('filters by year and month', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([]);

      await getMonthlyExpenses('sub-1', 2026, 3);

      const call = mockPrisma.expense.findMany.mock.calls[0][0];
      const startDate = call.where.date.gte;
      const endDate = call.where.date.lt;

      expect(startDate.getFullYear()).toBe(2026);
      expect(startDate.getMonth()).toBe(2); // March (0-indexed)
      expect(endDate.getMonth()).toBe(3); // April
    });
  });

  // ── getCategoryTotal ──
  describe('getCategoryTotal()', () => {
    it('returns total for a specific category', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([
        { amount: 10 },
        { amount: 15.50 },
      ]);

      const result = await getCategoryTotal('sub-1', 'dining');

      expect(result.total).toBe(25.5);
      expect(result.count).toBe(2);
    });

    it('returns zero for empty category', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([]);

      const result = await getCategoryTotal('sub-1', 'dining');

      expect(result.total).toBe(0);
      expect(result.count).toBe(0);
    });

    it('normalizes category to lowercase in query', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([]);

      await getCategoryTotal('sub-1', 'DINING');

      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'dining' }),
        }),
      );
    });
  });
});
