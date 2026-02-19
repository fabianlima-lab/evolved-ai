import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPrisma } from './helpers.js';

// We need to add reminder mock to mockPrisma
if (!mockPrisma.reminder) {
  mockPrisma.reminder = {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  };
}

import {
  createReminder,
  getPendingReminders,
  getDueReminders,
  markReminderSent,
  dismissReminder,
  formatRemindersForContext,
} from '../src/services/reminders.js';

describe('Reminder Service', () => {
  beforeEach(() => {
    mockPrisma.reminder.create.mockReset();
    mockPrisma.reminder.findMany.mockReset();
    mockPrisma.reminder.update.mockReset();
    mockPrisma.reminder.updateMany.mockReset();
  });

  // ── createReminder ──
  describe('createReminder()', () => {
    it('creates a reminder with required fields', async () => {
      const dueAt = new Date('2026-03-01T10:00:00Z');
      mockPrisma.reminder.create.mockResolvedValue({
        id: 'rem-1',
        subscriberId: 'sub-1',
        title: 'Call dentist',
        dueAt,
        channel: 'whatsapp',
        status: 'pending',
      });

      const result = await createReminder('sub-1', { title: 'Call dentist', dueAt });

      expect(mockPrisma.reminder.create).toHaveBeenCalledWith({
        data: {
          subscriberId: 'sub-1',
          agentId: null,
          title: 'Call dentist',
          dueAt,
          channel: 'whatsapp',
          status: 'pending',
        },
      });
      expect(result.id).toBe('rem-1');
      expect(result.status).toBe('pending');
    });

    it('uses whatsapp as default channel', async () => {
      const dueAt = new Date('2026-03-01T10:00:00Z');
      mockPrisma.reminder.create.mockResolvedValue({ id: 'rem-1' });

      await createReminder('sub-1', { title: 'Test', dueAt });

      expect(mockPrisma.reminder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ channel: 'whatsapp' }),
        }),
      );
    });

    it('accepts optional agentId', async () => {
      const dueAt = new Date('2026-03-01T10:00:00Z');
      mockPrisma.reminder.create.mockResolvedValue({ id: 'rem-1' });

      await createReminder('sub-1', { title: 'Test', dueAt, agentId: 'agent-1' });

      expect(mockPrisma.reminder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ agentId: 'agent-1' }),
        }),
      );
    });
  });

  // ── getPendingReminders ──
  describe('getPendingReminders()', () => {
    it('fetches pending reminders for a subscriber', async () => {
      mockPrisma.reminder.findMany.mockResolvedValue([
        { id: 'rem-1', title: 'Call dentist', status: 'pending' },
      ]);

      const result = await getPendingReminders('sub-1');

      expect(mockPrisma.reminder.findMany).toHaveBeenCalledWith({
        where: { subscriberId: 'sub-1', status: 'pending' },
        orderBy: { dueAt: 'asc' },
        take: 10,
      });
      expect(result).toHaveLength(1);
    });

    it('respects custom limit', async () => {
      mockPrisma.reminder.findMany.mockResolvedValue([]);

      await getPendingReminders('sub-1', 5);

      expect(mockPrisma.reminder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  // ── getDueReminders ──
  describe('getDueReminders()', () => {
    it('fetches due reminders with subscriber included', async () => {
      mockPrisma.reminder.findMany.mockResolvedValue([]);

      await getDueReminders();

      expect(mockPrisma.reminder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'pending',
            dueAt: expect.objectContaining({ lte: expect.any(Date) }),
          }),
          include: { subscriber: true },
          take: 50,
        }),
      );
    });
  });

  // ── markReminderSent ──
  describe('markReminderSent()', () => {
    it('updates status to sent', async () => {
      mockPrisma.reminder.update.mockResolvedValue({ id: 'rem-1', status: 'sent' });

      await markReminderSent('rem-1');

      expect(mockPrisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'rem-1' },
        data: { status: 'sent' },
      });
    });
  });

  // ── dismissReminder ──
  describe('dismissReminder()', () => {
    it('updates status to dismissed for matching subscriber', async () => {
      mockPrisma.reminder.updateMany.mockResolvedValue({ count: 1 });

      await dismissReminder('rem-1', 'sub-1');

      expect(mockPrisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { id: 'rem-1', subscriberId: 'sub-1', status: 'pending' },
        data: { status: 'dismissed' },
      });
    });

    it('only dismisses pending reminders', async () => {
      mockPrisma.reminder.updateMany.mockResolvedValue({ count: 0 });

      await dismissReminder('rem-already-sent', 'sub-1');

      expect(mockPrisma.reminder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });
  });

  // ── formatRemindersForContext ──
  describe('formatRemindersForContext()', () => {
    it('returns "no upcoming" for empty array', () => {
      expect(formatRemindersForContext([])).toContain('No upcoming reminders');
    });

    it('returns "no upcoming" for null', () => {
      expect(formatRemindersForContext(null)).toContain('No upcoming reminders');
    });

    it('formats reminders with titles', () => {
      const reminders = [
        { title: 'Call dentist', dueAt: new Date('2026-03-01T15:00:00Z') },
        { title: 'Pick up groceries', dueAt: new Date('2026-03-02T10:00:00Z') },
      ];

      const result = formatRemindersForContext(reminders, 'America/New_York');

      expect(result).toContain('UPCOMING REMINDERS');
      expect(result).toContain('Call dentist');
      expect(result).toContain('Pick up groceries');
    });

    it('includes due date information', () => {
      const reminders = [
        { title: 'Test reminder', dueAt: new Date('2026-03-01T15:00:00Z') },
      ];

      const result = formatRemindersForContext(reminders, 'America/New_York');
      expect(result).toContain('due:');
    });

    it('formats each reminder as a bullet point', () => {
      const reminders = [
        { title: 'First', dueAt: new Date('2026-03-01T15:00:00Z') },
        { title: 'Second', dueAt: new Date('2026-03-02T15:00:00Z') },
      ];

      const result = formatRemindersForContext(reminders);
      const lines = result.split('\n').filter((l) => l.startsWith('-'));
      expect(lines).toHaveLength(2);
    });
  });
});
