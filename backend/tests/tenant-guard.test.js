import { describe, it, expect } from 'vitest';
import {
  assertTenantAccess,
  assertAgentOwnership,
  assertReminderOwnership,
  assertMemoryOwnership,
  TenantViolationError,
  logTenantViolation,
} from '../src/utils/tenant-guard.js';

describe('Tenant Guard (REQ-006)', () => {
  // ── assertTenantAccess ──
  describe('assertTenantAccess()', () => {
    it('passes when subscriber IDs match', () => {
      expect(() => {
        assertTenantAccess('sub-1', 'sub-1', 'test-resource');
      }).not.toThrow();
    });

    it('throws TenantViolationError when IDs mismatch', () => {
      expect(() => {
        assertTenantAccess('sub-1', 'sub-2', 'agent:abc');
      }).toThrow(TenantViolationError);
    });

    it('includes context in error message on mismatch', () => {
      try {
        assertTenantAccess('sub-1', 'sub-2', 'agent:abc');
      } catch (err) {
        expect(err.message).toContain('agent:abc');
        expect(err.message).toContain('Tenant isolation violation');
      }
    });

    it('throws when expectedSubscriberId is null', () => {
      expect(() => {
        assertTenantAccess(null, 'sub-2', 'resource');
      }).toThrow(TenantViolationError);
    });

    it('throws when actualOwnerId is null', () => {
      expect(() => {
        assertTenantAccess('sub-1', null, 'resource');
      }).toThrow(TenantViolationError);
    });

    it('throws when both IDs are undefined', () => {
      expect(() => {
        assertTenantAccess(undefined, undefined, 'resource');
      }).toThrow(TenantViolationError);
    });

    it('throws when expectedSubscriberId is empty string', () => {
      expect(() => {
        assertTenantAccess('', 'sub-2', 'resource');
      }).toThrow(TenantViolationError);
    });

    it('uses default context when not provided', () => {
      try {
        assertTenantAccess('sub-1', 'sub-2');
      } catch (err) {
        expect(err.message).toContain('resource'); // default context
      }
    });
  });

  // ── assertAgentOwnership ──
  describe('assertAgentOwnership()', () => {
    it('passes for matching agent', () => {
      const agent = { id: 'agent-1', subscriberId: 'sub-1' };
      expect(() => {
        assertAgentOwnership(agent, 'sub-1');
      }).not.toThrow();
    });

    it('throws for agent owned by different subscriber', () => {
      const agent = { id: 'agent-1', subscriberId: 'sub-2' };
      expect(() => {
        assertAgentOwnership(agent, 'sub-1');
      }).toThrow(TenantViolationError);
    });

    it('throws when agent is null', () => {
      expect(() => {
        assertAgentOwnership(null, 'sub-1');
      }).toThrow(TenantViolationError);
      expect(() => {
        assertAgentOwnership(null, 'sub-1');
      }).toThrow('Agent not found');
    });
  });

  // ── assertReminderOwnership ──
  describe('assertReminderOwnership()', () => {
    it('passes for matching reminder', () => {
      const reminder = { id: 'rem-1', subscriberId: 'sub-1' };
      expect(() => {
        assertReminderOwnership(reminder, 'sub-1');
      }).not.toThrow();
    });

    it('throws for reminder owned by different subscriber', () => {
      const reminder = { id: 'rem-1', subscriberId: 'sub-2' };
      expect(() => {
        assertReminderOwnership(reminder, 'sub-1');
      }).toThrow(TenantViolationError);
    });

    it('throws when reminder is null', () => {
      expect(() => {
        assertReminderOwnership(null, 'sub-1');
      }).toThrow('Reminder not found');
    });
  });

  // ── assertMemoryOwnership ──
  describe('assertMemoryOwnership()', () => {
    it('passes for matching memory', () => {
      const memory = { id: 'mem-1', subscriberId: 'sub-1' };
      expect(() => {
        assertMemoryOwnership(memory, 'sub-1');
      }).not.toThrow();
    });

    it('throws for memory owned by different subscriber', () => {
      const memory = { id: 'mem-1', subscriberId: 'sub-2' };
      expect(() => {
        assertMemoryOwnership(memory, 'sub-1');
      }).toThrow(TenantViolationError);
    });

    it('throws when memory is null', () => {
      expect(() => {
        assertMemoryOwnership(null, 'sub-1');
      }).toThrow('Memory not found');
    });
  });

  // ── TenantViolationError ──
  describe('TenantViolationError', () => {
    it('is an instance of Error', () => {
      const err = new TenantViolationError('test');
      expect(err).toBeInstanceOf(Error);
    });

    it('has name "TenantViolationError"', () => {
      const err = new TenantViolationError('test');
      expect(err.name).toBe('TenantViolationError');
    });

    it('has statusCode 403', () => {
      const err = new TenantViolationError('test');
      expect(err.statusCode).toBe(403);
    });

    it('stores the message', () => {
      const err = new TenantViolationError('custom message');
      expect(err.message).toBe('custom message');
    });
  });

  // ── logTenantViolation ──
  describe('logTenantViolation()', () => {
    it('does not throw', () => {
      expect(() => {
        logTenantViolation('sub-1', 'sub-2', 'read_email');
      }).not.toThrow();
    });
  });
});
