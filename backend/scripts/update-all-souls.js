#!/usr/bin/env node

/**
 * Admin utility: Update SOUL.md template across ALL subscriber workspaces.
 *
 * Use this after editing /home/openclaw/templates/SOUL.md to push the
 * updated brand guidelines / personality to every agent workspace.
 *
 * Run from the backend directory:
 *   node scripts/update-all-souls.js
 */

import { updateAllSouls } from '../src/services/openclaw-provisioner.js';

console.log('\n📝 Updating SOUL.md in all subscriber workspaces...\n');

updateAllSouls()
  .then(() => {
    console.log('\nDone!\n');
  })
  .catch((err) => {
    console.error('\n💥 Failed:', err.message);
    process.exit(1);
  });
