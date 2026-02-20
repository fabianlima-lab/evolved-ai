#!/usr/bin/env node

/**
 * One-time migration: Provision isolated OpenClaw workspaces
 * for all existing subscribers with active agents.
 *
 * What it does:
 *   1. Queries all active agents + their subscribers from the database
 *   2. Creates an isolated OpenClaw workspace for each subscriber
 *   3. Registers each agent in openclaw.json with WhatsApp bindings
 *   4. Updates the agent's DB record with the new openclawAgentId
 *
 * Run from the backend directory:
 *   node scripts/migrate-to-multi-agent.js
 *
 * Safe to re-run — skips subscribers who already have an openclawAgentId.
 */

import { PrismaClient } from '@prisma/client';
import { provisionWorkspace } from '../src/services/openclaw-provisioner.js';
import { compileSoulMd } from '../src/prompts/soul.js';

const prisma = new PrismaClient();

async function migrate() {
  console.log('\n🚀 Migration: Per-Subscriber OpenClaw Workspaces\n');

  // Get all active agents with their subscribers
  const agents = await prisma.agent.findMany({
    where: { isActive: true },
    include: {
      subscriber: true,
    },
  });

  console.log(`Found ${agents.length} active agent(s)\n`);

  let provisioned = 0;
  let skipped = 0;
  let failed = 0;

  for (const agent of agents) {
    const sub = agent.subscriber;
    const label = `${sub.name || sub.email} (${sub.id.slice(0, 8)}...)`;

    // Skip if already provisioned
    if (agent.openclawAgentId) {
      console.log(`⏭  ${label} — already provisioned (${agent.openclawAgentId})`);
      skipped++;
      continue;
    }

    try {
      // Compile USER.md from subscriber profile
      let soulMd;
      try {
        soulMd = compileSoulMd({
          assistantName: agent.name,
          profileData: sub.profileData,
          subscriber: sub,
        });
      } catch (err) {
        console.warn(`   ⚠ SOUL.md compilation failed for ${label}: ${err.message}`);
        soulMd = `# User Profile\n\nName: ${sub.name || 'Unknown'}\nRole: Not specified\n`;
      }

      // Convert WhatsApp JID to E.164 phone
      let phone = null;
      if (sub.whatsappJid) {
        const num = sub.whatsappJid.replace('@s.whatsapp.net', '');
        phone = num.startsWith('+') ? num : `+${num}`;
      }

      // Provision the workspace
      const openclawAgentId = await provisionWorkspace(sub.id, {
        assistantName: sub.assistantName || agent.name,
        soulMd,
        whatsappPhone: phone,
      });

      // Update DB with the new agent ID
      await prisma.agent.update({
        where: { id: agent.id },
        data: { openclawAgentId },
      });

      console.log(`✅ ${label} → ${openclawAgentId}${phone ? ` (WhatsApp: ${phone})` : ''}`);
      provisioned++;
    } catch (err) {
      console.error(`❌ ${label} — FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Migration complete:`);
  console.log(`  ✅ Provisioned: ${provisioned}`);
  console.log(`  ⏭  Skipped:     ${skipped}`);
  console.log(`  ❌ Failed:      ${failed}`);
  console.log(`  Total:          ${agents.length}\n`);

  if (failed > 0) {
    console.log('⚠  Some migrations failed. Check the errors above and re-run.');
    console.log('   The script is safe to re-run — it skips already-provisioned agents.\n');
  }
}

migrate()
  .catch((err) => {
    console.error('\n💥 Migration script crashed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
