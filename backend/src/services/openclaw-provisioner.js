/**
 * OpenClaw Workspace Provisioner
 *
 * Manages per-subscriber OpenClaw agent workspaces.
 * Each subscriber gets their own isolated workspace with:
 *   - SOUL.md (brand guidelines, copied from template, read-only)
 *   - AGENTS.md (operating instructions, copied from template, read-only)
 *   - USER.md (compiled from subscriber profile)
 *   - IDENTITY.md (assistant name)
 *   - GOSPEL.md (symlink to shared platform updates)
 *   - MEMORY.md + memory/ (AI-managed, per-user)
 *
 * Uses OpenClaw's native multi-agent routing:
 *   - agents.list[] defines each agent + workspace
 *   - bindings[] routes WhatsApp DMs by phone number
 */

import {
  mkdirSync, writeFileSync, readFileSync, copyFileSync,
  symlinkSync, chmodSync, existsSync, rmSync, readdirSync,
} from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

// ── Paths ──
const WORKSPACES_ROOT = '/home/openclaw/workspaces';
const SHARED_DIR = '/home/openclaw/shared';
const TEMPLATES_DIR = '/home/openclaw/templates';
const OPENCLAW_CONFIG = '/home/openclaw/.openclaw/openclaw.json';
const GOSPEL_PATH = path.join(SHARED_DIR, 'GOSPEL.md');

/**
 * Provision a new OpenClaw workspace for a subscriber.
 *
 * Creates the workspace directory, populates it with template files,
 * and registers the agent in OpenClaw's config with a WhatsApp binding.
 *
 * @param {string} subscriberId - UUID of the subscriber
 * @param {object} opts
 * @param {string} opts.assistantName - Display name for the assistant
 * @param {string} opts.soulMd - Compiled USER.md content (from soul.js compileSoulMd)
 * @param {string} [opts.whatsappPhone] - E.164 phone number (e.g. "+15123680657")
 * @returns {string} The OpenClaw agentId (e.g. "sub-abc123")
 */
export async function provisionWorkspace(subscriberId, { assistantName, soulMd, whatsappPhone }) {
  const agentId = `sub-${subscriberId}`;
  const workspaceDir = path.join(WORKSPACES_ROOT, subscriberId);

  console.log(`[PROVISIONER] Creating workspace for ${agentId} at ${workspaceDir}`);

  // 1. Create workspace directory
  mkdirSync(workspaceDir, { recursive: true });
  mkdirSync(path.join(workspaceDir, 'memory'), { recursive: true });

  // 2. Copy locked template files (SOUL.md + AGENTS.md)
  const soulTemplate = path.join(TEMPLATES_DIR, 'SOUL.md');
  const agentsTemplate = path.join(TEMPLATES_DIR, 'AGENTS.md');

  if (existsSync(soulTemplate)) {
    copyFileSync(soulTemplate, path.join(workspaceDir, 'SOUL.md'));
  }
  if (existsSync(agentsTemplate)) {
    copyFileSync(agentsTemplate, path.join(workspaceDir, 'AGENTS.md'));
  }

  // 3. Write USER.md (compiled subscriber profile)
  writeFileSync(path.join(workspaceDir, 'USER.md'), soulMd || '# User Profile\n\nNo profile data yet.', 'utf-8');

  // 4. Write IDENTITY.md
  writeFileSync(
    path.join(workspaceDir, 'IDENTITY.md'),
    `# Identity\n\n- **Name:**\n- **Vibe:**\n- **Emoji:**\n`,
    'utf-8',
  );

  // 5. Initialize MEMORY.md
  writeFileSync(
    path.join(workspaceDir, 'MEMORY.md'),
    '# Long-term Memory\n\n_No memories yet. These will build over time._\n',
    'utf-8',
  );

  // 6. Symlink GOSPEL.md to shared platform updates
  const gospelLink = path.join(workspaceDir, 'GOSPEL.md');
  if (!existsSync(gospelLink) && existsSync(GOSPEL_PATH)) {
    try {
      symlinkSync(GOSPEL_PATH, gospelLink);
    } catch (err) {
      console.warn(`[PROVISIONER] GOSPEL.md symlink failed: ${err.message}`);
      // Fallback: copy instead of symlink
      copyFileSync(GOSPEL_PATH, gospelLink);
    }
  }

  // 7. Lock AGENTS.md (read-only). SOUL.md stays read-write — the AI evolves it.
  try {
    chmodSync(path.join(workspaceDir, 'AGENTS.md'), 0o444);
  } catch (err) {
    console.warn(`[PROVISIONER] chmod failed: ${err.message}`);
  }

  // 8. Set ownership to openclaw:openclaw
  await setOwnership(workspaceDir);

  // 9. Register agent in OpenClaw config
  await registerAgent(agentId, workspaceDir, whatsappPhone);

  console.log(`[PROVISIONER] ✅ Workspace ready: ${agentId}`);
  return agentId;
}

/**
 * Add a WhatsApp binding for an existing agent.
 * Called when a subscriber connects WhatsApp AFTER their agent was already deployed.
 *
 * @param {string} subscriberId
 * @param {string} whatsappPhone - E.164 format (e.g. "+15123680657")
 */
export async function addWhatsAppBinding(subscriberId, whatsappPhone) {
  const agentId = `sub-${subscriberId}`;
  const config = readConfig();

  if (!config.bindings) config.bindings = [];

  // Remove any existing binding for this phone (avoid duplicates)
  config.bindings = config.bindings.filter((b) => b.match?.peer?.id !== whatsappPhone);

  // Add new binding
  config.bindings.push({
    agentId,
    match: {
      channel: 'whatsapp',
      peer: { kind: 'direct', id: whatsappPhone },
    },
  });

  writeConfig(config);
  console.log(`[PROVISIONER] ✅ WhatsApp binding: ${whatsappPhone} → ${agentId}`);
}

/**
 * Update USER.md in an existing workspace with fresh live context.
 *
 * @param {string} subscriberId
 * @param {string} soulMd - Recompiled USER.md content
 */
export async function updateUserContext(subscriberId, soulMd) {
  const workspaceDir = path.join(WORKSPACES_ROOT, subscriberId);

  if (!existsSync(workspaceDir)) {
    console.warn(`[PROVISIONER] Workspace not found for ${subscriberId}, skipping context update`);
    return;
  }

  writeFileSync(path.join(workspaceDir, 'USER.md'), soulMd, 'utf-8');
  await setOwnership(path.join(workspaceDir, 'USER.md'));
}

/**
 * Remove a subscriber's workspace and OpenClaw config entries.
 *
 * @param {string} subscriberId
 */
export async function deprovisionWorkspace(subscriberId) {
  const agentId = `sub-${subscriberId}`;
  const workspaceDir = path.join(WORKSPACES_ROOT, subscriberId);

  // Remove from OpenClaw config
  const config = readConfig();
  if (config.agents?.list) {
    config.agents.list = config.agents.list.filter((a) => a.id !== agentId);
  }
  if (config.bindings) {
    config.bindings = config.bindings.filter((b) => b.agentId !== agentId);
  }
  writeConfig(config);

  // Remove workspace directory
  if (existsSync(workspaceDir)) {
    rmSync(workspaceDir, { recursive: true, force: true });
  }

  console.log(`[PROVISIONER] ✅ Deprovisioned: ${agentId}`);
}

/**
 * Update SOUL.md template across ALL subscriber workspaces.
 * Run this after editing /home/openclaw/templates/SOUL.md.
 */
export async function updateAllSouls() {
  const soulTemplate = path.join(TEMPLATES_DIR, 'SOUL.md');
  if (!existsSync(soulTemplate)) {
    console.error('[PROVISIONER] Template SOUL.md not found');
    return;
  }

  const dirs = readdirSync(WORKSPACES_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let updated = 0;
  for (const dir of dirs) {
    const target = path.join(WORKSPACES_ROOT, dir, 'SOUL.md');
    try {
      // Unlock, copy, re-lock
      if (existsSync(target)) chmodSync(target, 0o644);
      copyFileSync(soulTemplate, target);
      chmodSync(target, 0o444);
      updated++;
    } catch (err) {
      console.warn(`[PROVISIONER] Failed to update SOUL.md for ${dir}: ${err.message}`);
    }
  }

  await setOwnership(WORKSPACES_ROOT);
  console.log(`[PROVISIONER] ✅ Updated SOUL.md in ${updated} workspaces`);
}

// ── Internal Helpers ──

function readConfig() {
  try {
    return JSON.parse(readFileSync(OPENCLAW_CONFIG, 'utf-8'));
  } catch (err) {
    console.error(`[PROVISIONER] Failed to read OpenClaw config: ${err.message}`);
    return {};
  }
}

function writeConfig(config) {
  try {
    writeFileSync(OPENCLAW_CONFIG, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[PROVISIONER] Failed to write OpenClaw config: ${err.message}`);
  }
}

async function registerAgent(agentId, workspaceDir, whatsappPhone) {
  const config = readConfig();

  // Initialize multi-agent structures if needed
  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];
  if (!config.bindings) config.bindings = [];

  // Check if agent already exists
  const existing = config.agents.list.find((a) => a.id === agentId);
  if (existing) {
    console.log(`[PROVISIONER] Agent ${agentId} already in config, updating workspace`);
    existing.workspace = workspaceDir;
  } else {
    config.agents.list.push({
      id: agentId,
      workspace: workspaceDir,
    });
  }

  // Add WhatsApp binding if phone provided
  if (whatsappPhone) {
    // Remove any existing binding for this phone
    config.bindings = config.bindings.filter((b) => b.match?.peer?.id !== whatsappPhone);

    config.bindings.push({
      agentId,
      match: {
        channel: 'whatsapp',
        peer: { kind: 'direct', id: whatsappPhone },
      },
    });
  }

  writeConfig(config);
}

async function setOwnership(targetPath) {
  try {
    await execFileAsync('chown', ['-R', 'openclaw:openclaw', targetPath]);
  } catch (err) {
    console.warn(`[PROVISIONER] chown failed for ${targetPath}: ${err.message}`);
  }
}
