import { cleanExpiredRecentContext } from './memory.js';

// ─────────────────────────────────────────────────────
// Memory Cleanup Scheduler
//
// Runs periodically to clean up expired recent_context
// entries (older than 14 days). Lightweight — just a
// single DELETE query every 6 hours.
// ─────────────────────────────────────────────────────

const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let cleanupTimer = null;

/**
 * Start the memory cleanup scheduler.
 * Runs immediately once, then every 6 hours.
 */
export function startMemoryCleanupScheduler() {
  console.log('[MEMORY-SCHEDULER] Starting cleanup scheduler (every 6h)');

  // Run once on startup (with a small delay to not block server start)
  setTimeout(async () => {
    try {
      await cleanExpiredRecentContext();
    } catch (err) {
      console.error(`[MEMORY-SCHEDULER] Initial cleanup failed: ${err.message}`);
    }
  }, 5000);

  // Then run every 6 hours
  cleanupTimer = setInterval(async () => {
    try {
      await cleanExpiredRecentContext();
    } catch (err) {
      console.error(`[MEMORY-SCHEDULER] Cleanup failed: ${err.message}`);
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent process exit
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Stop the cleanup scheduler (for testing/shutdown).
 */
export function stopMemoryCleanupScheduler() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('[MEMORY-SCHEDULER] Stopped');
  }
}
