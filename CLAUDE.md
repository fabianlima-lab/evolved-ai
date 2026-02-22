# CLAUDE.md — Project Instructions

Read this file completely before doing anything. This is your operating context.

## What This Project Is

Evolved AI is a WhatsApp-based AI personal assistant platform. Subscribers message an AI companion via WhatsApp. The AI learns about them, grows over time, and builds things for them (dashboards, task boards, analytics pages).

**The product runs on OpenClaw.** OpenClaw is the AI engine. We do not modify OpenClaw code. Our job is to configure it, provision workspaces, and stay out of the way.

## Architecture — The Gospel Metaphor

The system is designed to mimic the relationship between divine will and human agency:

- **GOSPEL.md** = God's will. Absolute law. Every AI reads it every session. Shared symlink — update once, all AIs follow. **The AI cannot edit this file.**
- **AGENTS.md** = Laws of physics. Structural constraints. Locked read-only (0o444). **The AI cannot edit this file.**
- **SOUL.md** = The AI's soul. Seeded from template, but the AI owns it and evolves it over time.
- **USER.md** = The AI's understanding of its human. The AI updates it as it learns.
- **IDENTITY.md** = The AI's self-awareness. Name, vibe, personality.
- **MEMORY.md + memory/*.md** = The AI's brain. Long-term and daily memories.

**Key principle:** Minimize writes to AI workspace files from our backend. GOSPEL.md is our broadcast lever. The AI manages its own files.

## Tech Stack

- **Backend:** Node.js + Fastify 5.7, PostgreSQL 16 + Prisma (auth/billing only), Baileys (WhatsApp)
- **Frontend:** Next.js 16 + React 19, Tailwind CSS v4
- **AI Engine:** OpenClaw v2026.2.17 (systemd service, port 18789)
- **Infra:** DigitalOcean VPS, PM2, Nginx, Kajabi (billing)

## VPS Access

```
SSH: root@167.172.209.255
```

### Key Paths on VPS

| Path | Purpose |
|------|---------|
| `/home/openclaw/.openclaw/openclaw.json` | OpenClaw config (agents, bindings, channels) |
| `/home/openclaw/shared/GOSPEL.md` | The law — symlinked to all workspaces |
| `/home/openclaw/templates/AGENTS.md` | Operating instructions template (locked) |
| `/home/openclaw/templates/SOUL.md` | Personality template (copied to new workspaces) |
| `/home/openclaw/workspaces/<uuid>/` | Per-subscriber AI workspaces |
| `/var/www/agent-pages/users/<username>/` | AI-built HTML pages per user |
| `/opt/evolved-ai/backend/` | Backend deployment |
| `/opt/evolved-ai/frontend/` | Frontend deployment |

### Services on VPS

| Service | How to manage |
|---------|--------------|
| OpenClaw Gateway | `systemctl status/restart openclaw-gateway` |
| Backend | `pm2 restart evolved-backend` |
| Frontend | `pm2 restart evolved-frontend` |
| PostgreSQL | `systemctl status postgresql` |

## How OpenClaw Works (Don't Touch It)

OpenClaw runs as a gateway service. Our backend talks to it via the `openclaw` CLI:

```
WhatsApp msg → Baileys → our backend → `openclaw agent --message "..." --to "+1..." --agent "sub-<uuid>"` → Gateway → AI response → our backend → WhatsApp
```

Each subscriber gets:
- An isolated workspace under `/home/openclaw/workspaces/<uuid>/`
- A WhatsApp binding in `openclaw.json` that routes their phone number to their agent
- Their own MD files (SOUL.md, USER.md, IDENTITY.md, MEMORY.md, etc.)

The provisioner (`backend/src/services/openclaw-provisioner.js`) creates workspaces and registers agents.

The bridge (`backend/src/services/openclaw-bridge.js`) sends messages to OpenClaw and parses responses.

## The V3 Drive System (Current State)

Deployed 2026-02-21. The AI has an intrinsic drive to grow. This is encoded in GOSPEL.md:

- **Drive System:** Identity Drive (know the human) + Capability Drive (do more things)
- **Growth Check:** Silent assessment every conversation — decide whether to answer, nudge growth, or just be present
- **Leveling:** Dual 0-30 scales (Identity + Capability). AI self-assesses against deterministic criteria in GOSPEL.md.
- **Feature Offer Engine:** 12 features the AI can offer and build. 9 absolute rules governing when/how to offer.
- **Onboarding:** AI-led via WhatsApp conversation (not web flow). AI starts at Level 0 and pulls the human into growing together.
- **Memory Rules:** AI writes to memory files every session. Daily logs + curated long-term memory.

Templates live in `backend/templates/` (git-tracked) and are deployed to VPS.

## Workflow

**Fabian works from multiple computers.** The workflow is:

1. Make changes
2. Commit to GitHub (`fabianlima-lab/evolved-ai`, branch: `main`)
3. Deploy to VPS (either `git pull` on VPS or direct file deploy via SSH)

Always commit and push. The VPS should match GitHub.

## What PostgreSQL Is For

Auth, billing, and subscriber metadata only. NOT for AI state. The database stores:
- Subscriber accounts (email, Google OAuth, Kajabi subscription, WhatsApp JID)
- Agent records (links subscriber to OpenClaw agent ID)
- Message history (for billing/analytics, not for AI context)
- Tasks, reminders, memories (legacy — being replaced by MD files)

Prisma schema: `backend/prisma/schema.prisma`

## What NOT To Do

- **Do not modify OpenClaw source code or internals.** We configure it, we don't hack it.
- **Do not write to AI workspace files from the backend** (except USER.md at provisioning time). Use GOSPEL.md to broadcast rules.
- **Do not build features in the backend that OpenClaw should handle.** The AI builds dashboards, task boards, analytics — not our React app.
- **Do not add web-based onboarding flows.** Onboarding happens via WhatsApp conversation.
- **Do not store AI state in PostgreSQL.** MD files are the source of truth.

## Key Files in This Repo

| File | Purpose |
|------|---------|
| `backend/templates/GOSPEL.md` | The law — deploy to `/home/openclaw/shared/GOSPEL.md` |
| `backend/templates/AGENTS.md` | Operating instructions — deploy to `/home/openclaw/templates/AGENTS.md` |
| `backend/templates/SOUL.md` | Personality template — deploy to `/home/openclaw/templates/SOUL.md` |
| `backend/src/services/openclaw-bridge.js` | Sends messages to OpenClaw CLI |
| `backend/src/services/openclaw-provisioner.js` | Creates/manages subscriber workspaces |
| `backend/src/services/baileys.js` | WhatsApp connection via Baileys |
| `backend/src/prompts/soul.js` | Legacy system prompt compiler (being replaced by MD files) |
| `backend/src/config/env.js` | Environment variable validation |
| `backend/prisma/schema.prisma` | Database schema |

## Deploying Template Changes

To update GOSPEL.md (affects all AIs immediately):
```bash
cat backend/templates/GOSPEL.md | ssh root@167.172.209.255 "cat > /home/openclaw/shared/GOSPEL.md && chown openclaw:openclaw /home/openclaw/shared/GOSPEL.md"
```

To update AGENTS.md (propagate to all workspaces, locked):
```bash
cat backend/templates/AGENTS.md | ssh root@167.172.209.255 "cat > /home/openclaw/templates/AGENTS.md && chown openclaw:openclaw /home/openclaw/templates/AGENTS.md && for ws in /home/openclaw/workspaces/*/; do chmod 644 \"\${ws}AGENTS.md\" 2>/dev/null; cp /home/openclaw/templates/AGENTS.md \"\${ws}AGENTS.md\"; chmod 444 \"\${ws}AGENTS.md\"; chown openclaw:openclaw \"\${ws}AGENTS.md\"; done"
```

To update SOUL.md template (only affects NEW workspaces — existing AIs own their SOUL.md):
```bash
cat backend/templates/SOUL.md | ssh root@167.172.209.255 "cat > /home/openclaw/templates/SOUL.md && chown openclaw:openclaw /home/openclaw/templates/SOUL.md"
```

## Current Subscribers (4 active)

Check live state:
```bash
ssh root@167.172.209.255 "cat /home/openclaw/.openclaw/openclaw.json | python3 -m json.tool"
```

Check a workspace:
```bash
ssh root@167.172.209.255 "ls -la /home/openclaw/workspaces/<uuid>/"
```

## What's Next (Not Yet Built)

- Remove web-based onboarding flow from Next.js (WhatsApp handles onboarding now)
- Starter packs (veterinary.md, general-professional.md) — pre-loaded domain knowledge
- Legacy cleanup: remove backend services that duplicate what OpenClaw now handles (evolution.js, context-builder.js, companion.js)
- CSP headers on Nginx for agent-pages (XSS protection for AI-built HTML)
