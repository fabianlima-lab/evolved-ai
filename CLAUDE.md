# CLAUDE.md — Project Instructions

Read this file completely before doing anything. This is your operating context.

## What This Project Is

Evolved AI is a WhatsApp-first AI personal assistant platform for high-achieving veterinary professionals. Built by Dr. Bethany Weinheimer / The Evolved Vets. Subscribers message an AI companion via WhatsApp. The AI learns about them, grows over time, and builds things for them (dashboards, task boards, analytics pages). The web dashboard is a secondary channel.

**The product runs on OpenClaw.** OpenClaw is the AI engine. We do not modify OpenClaw code. Our job is to configure it, provision workspaces, and stay out of the way.

## Architecture — The Gospel Metaphor

The system mimics the relationship between divine will and human agency:

**Files we control (the AI cannot edit):**
- **AGENTS.md** = The AI's operating system. **Auto-injected by OpenClaw every turn.** Contains the Drive System behavioral engine, growth check, feature offer rules, onboarding flow, memory rules, safety boundaries. Locked read-only (0o444). This is what makes the AI behave correctly — it sees these rules in its context window on every single message.
- **GOSPEL.md** = Reference manual. Shared symlink — update once, all AIs see it. Contains level definitions (0-30), feature catalog, integration flows, platform announcements. The AI reads it on demand (when assessing levels or picking features), NOT auto-injected.

**Files the AI owns (read-write):**
- **SOUL.md** = The AI's soul. Seeded from template, the AI evolves it over time.
- **USER.md** = The AI's understanding of its human. Updated as it learns.
- **IDENTITY.md** = The AI's self-awareness. Name, vibe, personality.
- **MEMORY.md + memory/*.md** = The AI's brain. Long-term and daily memories.

**Key principle:** Minimize writes to AI workspace files from our backend. AGENTS.md (injected) is the behavioral lever. GOSPEL.md (read on demand) is the reference data lever. The AI manages its own files.

**Critical technical detail:** OpenClaw auto-injects AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, MEMORY.md into the context window every turn. GOSPEL.md is NOT auto-injected — the AI must actively read it. That's why all behavioral rules live in AGENTS.md.

## Tech Stack

- **Backend:** Node.js + Fastify 5.7 (ES Modules only, no CommonJS), PostgreSQL 16 + Prisma 6 (auth/billing only), Baileys (WhatsApp)
- **Frontend:** Next.js 16 + React 19, Tailwind CSS v4
- **AI Engine:** OpenClaw v2026.2.17 (systemd service, port 18789) → OpenRouter (Grok 4.1 Fast primary, DeepSeek V3.2 + Llama 4 Maverick fallbacks)
- **Voice:** Whisper (via Groq API)
- **i18n:** next-intl (English only, but all strings go through translations)
- **Auth:** JWT (7-day expiry) + Google OAuth; admin access via ADMIN_EMAILS env var
- **Billing:** Kajabi webhooks ($49/mo)
- **Infra:** DigitalOcean VPS, PM2, Nginx

## Project Structure
```
evolved-ai/
  backend/
    src/
      config/env.js          — Environment variables
      lib/prisma.js           — Prisma singleton
      middleware/              — adminGuard.js, auth
      routes/                 — Fastify route files (admin, auth, agents, chat, channels, webhooks, etc.)
      services/               — Business logic (baileys, openclaw-bridge, evolution, health-monitor, etc.)
      prompts/soul.js         — Agent personality compilation
    prisma/schema.prisma      — Database schema
    prisma/migrations/        — Migration history
    templates/                — GOSPEL.md, AGENTS.md, SOUL.md (deployed to VPS)
  frontend/
    src/
      app/[locale]/(app)/     — Authenticated pages (admin, dashboard, control-tower, settings, etc.)
      app/[locale]/(auth)/    — Auth pages (login, signup, password-reset)
      app/[locale]/page.js    — Landing page
      components/ui/          — Shared UI components (Card, Button, SectionLabel, Input)
      components/landing/     — Marketing page sections
      lib/api.js              — API fetch helper (apiFetch)
      lib/auth.js             — Auth context (AuthProvider)
    messages/en.json          — All translation strings
  scripts/                    — Deployment & setup scripts
  deploy.sh                   — Production deployment script
  ecosystem.config.cjs        — PM2 configuration
```

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
Web Chat → POST /api/chat/send → OpenClaw Gateway CLI → AI → Response JSON
```

Each subscriber gets:
- An isolated workspace under `/home/openclaw/workspaces/<uuid>/`
- A WhatsApp binding in `openclaw.json` that routes their phone number to their agent
- Their own MD files (SOUL.md, USER.md, IDENTITY.md, MEMORY.md, etc.)

The provisioner (`backend/src/services/openclaw-provisioner.js`) creates workspaces and registers agents.

The bridge (`backend/src/services/openclaw-bridge.js`) sends messages to OpenClaw and parses responses.

## The V3 Drive System (Current State)

Deployed 2026-02-21. The AI has an intrinsic drive to grow.

**AGENTS.md (auto-injected every turn) contains:**
- Drive System: Identity Drive (know the human) + Capability Drive (do more things)
- Growth Check: silent assessment every conversation
- Feature Offer Rules: 9 absolute rules the AI follows
- Onboarding flow: AI-led via WhatsApp (Level 0 → naming → learning → building)
- Memory rules: write to memory files every session
- Safety boundaries and formatting rules

**GOSPEL.md (read on demand) contains:**
- Leveling: dual 0-30 scales (Identity + Capability) with deterministic criteria
- Feature catalog: 12 features with triggers and what to build
- Integration connection flows
- Platform capabilities and announcements

Templates live in `backend/templates/` (git-tracked) and are deployed to VPS.

## Key Conventions

### Backend
- All routes use Fastify plugin pattern: `async function routeName(app) { ... }`
- Routes registered in `server.js` with prefix (e.g., `prefix: '/api/admin'`)
- Admin routes use `preHandler: [app.authenticate, adminGuard]`
- Raw SQL via `prisma.$queryRaw` for complex aggregations; Prisma ORM for simple queries
- ES Modules only — `import/export`, never `require()`

### Frontend
- `apiFetch('/path')` prepends `NEXT_PUBLIC_API_URL` and includes Bearer token from `localStorage.eai_token`
- All user-facing strings use next-intl: `const t = useTranslations('Section'); t('keyName')`
- Translation keys in `messages/en.json` grouped by page/section
- CSS: Tailwind v4 with CSS variables (see `globals.css`)
- Brand colors: teal `#2A7C7B` (accent), cream `#F7F4EE` (bg), warm charcoal `#222` (text), mint `#B8D8D0`
- Border radius: 2px (`--radius-card`) — sharp rectangles, luxury feel
- Fonts: Cormorant (display headings), DM Sans (body)
- UI components defined inline in page files (no shared admin component library)
- All pages under `(app)/` are `'use client'` components

## Resetting Agent Sessions

After deploying new AGENTS.md, existing sessions may still use old context. To force all AIs to start fresh:
```bash
ssh root@167.172.209.255 "for f in /home/openclaw/.openclaw/agents/*/sessions/sessions.json; do echo '{}' > \"\$f\"; chown openclaw:openclaw \"\$f\"; done && systemctl restart openclaw-gateway"
```

## Workflow

**Fabian works from multiple computers.** The workflow is:

1. Make changes
2. Commit to GitHub (`fabianlima-lab/evolved-ai`, branch: `main`)
3. Deploy to VPS (either `git pull` on VPS or direct file deploy via SSH)

Always commit and push. The VPS should match GitHub.

## Key Commands
```bash
# Backend
cd backend && npm install
cd backend && npx prisma generate
cd backend && npx prisma migrate deploy
cd backend && npm run dev          # Dev server on :3001
cd backend && npm test             # Vitest

# Frontend
cd frontend && npm install
cd frontend && npm run dev         # Dev server on :3000
cd frontend && npm run build       # Production build

# Deploy to production (on VPS)
./deploy.sh   # git pull → install → migrate → build → pm2 restart

# Database
cd backend && npx prisma studio    # Visual DB browser
```

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

## Admin Access
- Admin pages: `/admin` (dashboard with per-user analytics), `/control-tower` (real-time cockpit)
- Access controlled by `ADMIN_EMAILS` env var (comma-separated email allowlist)
- Admin guard: JWT auth + email whitelist check → 403 if not admin

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
