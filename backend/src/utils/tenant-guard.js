// ─────────────────────────────────────────────────────
// Multi-Tenant Isolation Guard (REQ-006)
//
// Ensures every database query and action execution
// is scoped to the correct subscriber. Prevents one
// subscriber's data from leaking to another through
// bugs, injection, or misconfigured queries.
//
// Usage:
//   assertTenantAccess(subscriberId, resourceOwnerId)
//   scopedPrisma(subscriberId) → returns prisma helpers
//     that automatically filter by subscriberId
// ─────────────────────────────────────────────────────

/**
 * Assert that a resource belongs to the expected subscriber.
 * Throws if there's a mismatch — this should NEVER happen
 * in normal operation. If it does, it's a bug or attack.
 *
 * @param {string} expectedSubscriberId - The authenticated subscriber
 * @param {string} actualOwnerId - The resource's subscriberId
 * @param {string} [context] - What resource was accessed (for logging)
 */
export function assertTenantAccess(expectedSubscriberId, actualOwnerId, context = 'resource') {
  if (!expectedSubscriberId || !actualOwnerId) {
    console.error(`[TENANT] Missing IDs in access check — expected:${expectedSubscriberId} actual:${actualOwnerId} context:${context}`);
    throw new TenantViolationError(`Missing subscriber ID in ${context} access check`);
  }

  if (expectedSubscriberId !== actualOwnerId) {
    console.error(`[TENANT] ⚠️ ISOLATION VIOLATION: subscriber:${expectedSubscriberId} tried to access ${context} owned by subscriber:${actualOwnerId}`);
    throw new TenantViolationError(`Tenant isolation violation: cannot access ${context} from another subscriber`);
  }
}

/**
 * Validate that an agent belongs to a subscriber before using it.
 *
 * @param {object} agent - Agent record from Prisma
 * @param {string} subscriberId - Expected subscriber owner
 */
export function assertAgentOwnership(agent, subscriberId) {
  if (!agent) {
    throw new TenantViolationError('Agent not found');
  }
  assertTenantAccess(subscriberId, agent.subscriberId, `agent:${agent.id}`);
}

/**
 * Validate that a reminder belongs to a subscriber.
 *
 * @param {object} reminder - Reminder record from Prisma
 * @param {string} subscriberId - Expected subscriber owner
 */
export function assertReminderOwnership(reminder, subscriberId) {
  if (!reminder) {
    throw new TenantViolationError('Reminder not found');
  }
  assertTenantAccess(subscriberId, reminder.subscriberId, `reminder:${reminder.id}`);
}

/**
 * Validate that a memory belongs to a subscriber.
 *
 * @param {object} memory - Memory record from Prisma
 * @param {string} subscriberId - Expected subscriber owner
 */
export function assertMemoryOwnership(memory, subscriberId) {
  if (!memory) {
    throw new TenantViolationError('Memory not found');
  }
  assertTenantAccess(subscriberId, memory.subscriberId, `memory:${memory.id}`);
}

/**
 * Custom error class for tenant violations.
 * Allows catch handlers to distinguish isolation errors
 * from other application errors.
 */
export class TenantViolationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TenantViolationError';
    this.statusCode = 403;
  }
}

/**
 * Audit log for cross-tenant access attempts.
 * Call this when a violation is detected to create
 * a permanent record for security review.
 *
 * @param {string} subscriberId - Who tried to access
 * @param {string} resourceOwnerId - Who owns the resource
 * @param {string} action - What they tried to do
 */
export function logTenantViolation(subscriberId, resourceOwnerId, action) {
  const entry = {
    timestamp: new Date().toISOString(),
    attacker: subscriberId,
    victim: resourceOwnerId,
    action,
  };

  // Log to stderr so it shows up in PM2 error logs
  console.error(`[TENANT-VIOLATION] ${JSON.stringify(entry)}`);
}
