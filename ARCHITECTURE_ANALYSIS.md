# Evolved AI — Architecture Analysis

> Phase 1 fork-and-clean from the ClawWarriors codebase.
> This document records every structural change made during the conversion.

---

## 1. Overview

**Evolved AI** is a luxury WhatsApp-based AI personal assistant for high-achieving women, built by Dr. Bethany Weinheimer. It was forked from ClawWarriors (an RPG-themed AI agent platform) and rebranded/restructured as a single-tier, WhatsApp-first product.

| Aspect | ClawWarriors (before) | Evolved AI (after) |
|---|---|---|
| Theme | RPG / gaming | Luxury personal assistant |
| Primary channel | Telegram + WhatsApp | WhatsApp only |
| Pricing | Trial / Pro / Pro Tribe | Trial / Active ($49/mo) |
| Billing | Stripe | Kajabi |
| AI agents | "Warriors" with class system | Simple named assistants |
| Languages | English + Portuguese | English only |
| Brand color | Orange `#e8632b` | Teal `#8BC4C6` |
| Display font | Cinzel | DM Sans |

---

## 2. Tech Stack

- **Backend**: Fastify 5.7 + Node.js (ES Modules only)
- **Frontend**: Next.js 16.1.6 + React 19 + Tailwind v4
- **Database**: PostgreSQL 16 + Prisma 6.19.2
- **AI**: NVIDIA NIMs (3-tier model routing)
- **i18n**: next-intl (English only)
- **Auth**: JWT + Google OAuth
- **Email**: Resend
- **Process manager**: PM2

---

## 3. Database Schema Changes

### Subscriber (was `User`)

| Field | Status | Notes |
|---|---|---|
| `id`, `email`, `passwordHash`, `name` | Kept | — |
| `googleId`, `authProvider` | Kept | — |
| `tier`, `trialEndsAt`, `goals` | Kept | tier values: `trial` / `active` / `cancelled` |
| `passwordResetToken`, `passwordResetExpiry` | Kept | — |
| `stripeCustomerId`, `stripeSubscriptionId` | **Removed** | Stripe eliminated |
| `channel`, `channelId`, `channel2`, `channel2Id` | **Removed** | Replaced by `whatsappJid` |
| `googleRefreshToken` | **Added** | For future Google API access |
| `kajabiContactId`, `kajabiOfferId` | **Added** | Kajabi subscription tracking |
| `whatsappJid` | **Added** | WhatsApp identifier |
| `onboardingComplete` | **Added** | Boolean flag |
| `assistantName` | **Added** | User's preferred assistant name |

### Agent (was `Warrior`)

| Field | Status | Notes |
|---|---|---|
| `id`, `name`, `systemPrompt`, `isActive` | Kept | — |
| `subscriberId` | Renamed | Was `userId` |
| `templateId`, `warriorClass`, `tone`, `customName` | **Removed** | Class system eliminated |
| `soulMd` | **Added** | Agent personality document |
| `openclawAgentId` | **Added** | Link to OpenClaw gateway agent |

### Message

| Field | Status | Notes |
|---|---|---|
| `id`, `content`, `channel` | Kept | — |
| `subscriberId` | Renamed | Was `userId` |
| `agentId` | Renamed | Was `warriorId` |
| `role` | Renamed | Was `direction` (`in`/`out` → `user`/`assistant`) |

### WarriorTemplate — **Deleted entirely**

The 15-template RPG class system was removed. Agents are now created with a name and auto-generated system prompt.

---

## 4. Backend Changes

### Files Deleted
- `routes/billing.js` — Stripe billing routes
- `tests/billing.test.js` — Stripe tests

### Files Renamed
- `routes/warriors.js` → `routes/agents.js`
- `routes/users.js` → `routes/subscribers.js`

### API Route Changes
| Before | After |
|---|---|
| `POST /api/warriors/deploy` | `POST /api/agents/deploy` |
| `GET /api/warriors/mine` | `GET /api/agents/mine` |
| `PATCH /api/warriors/:id` | `PATCH /api/agents/:id` |
| `DELETE /api/warriors/:id` | `DELETE /api/agents/:id` |
| `GET /api/users/me` | `GET /api/subscribers/me` |
| `PATCH /api/users/me` | `PATCH /api/subscribers/me` |
| `DELETE /api/users/me` | `DELETE /api/subscribers/me` |
| `POST /api/billing/*` | **Removed** |

### Architectural Improvements
1. **PrismaClient singleton** (`lib/prisma.js`) — prevents connection pool exhaustion in dev/test
2. **Shared `stripHtml()`** utility — extracted from 6 duplicate definitions into `utils/helpers.js`
3. **Stripe fully removed** — no billing routes, no raw body parser, no Stripe env vars

---

## 5. Frontend Changes

### Files Deleted
- `components/WarriorCard.jsx` — RPG warrior card
- `components/ClassTabs.jsx` — Class selection tabs
- `components/LocaleSwitcher.jsx` — Language switcher
- `components/landing/WarriorShowcase.jsx` — Landing page warrior display
- `app/[locale]/(app)/warriors/page.js` — Warriors page
- `messages/pt-BR.json` — Portuguese translations
- Associated test files

### Files Created
- `app/[locale]/(app)/agents/page.js` — Simple name-your-assistant flow

### Theme Changes (globals.css)
- Accent color: `#e8632b` (orange) → `#8BC4C6` (teal)
- Glow effects updated to teal
- 5 RPG class colors removed (guardian, scholar, bard, artificer, rogue)
- Display font: Cinzel removed, unified to DM Sans
- Selection highlight updated to teal

### Token & Storage
- `cw_token` → `eai_token` (localStorage key)
- `cw_selected_plan` → `eai_selected_plan`

### i18n
- Locales reduced: `['en', 'pt-BR']` → `['en']`
- Cookie-based locale detection removed
- `messages/en.json` completely rewritten for Evolved AI brand

---

## 6. Infrastructure Changes

| File | Change |
|---|---|
| `backend/package.json` | `name`: `clawwarriors-backend` → `evolved-ai-backend` |
| `frontend/package.json` | `name`: `frontend` → `evolved-ai-frontend` |
| `ecosystem.config.cjs` | PM2 names: `cw-api`/`cw-web` → `eai-api`/`eai-web`, paths updated |
| `deploy.sh` | Paths: `/home/deploy/clawwarriors` → `/home/deploy/evolved-ai` |
| `backend/.env.example` | DB name, email sender, Stripe vars removed, Kajabi added |
| `frontend/public/manifest.json` | App name and description updated |

---

## 7. What Was Preserved

- **3-tier AI model routing** — query complexity classification (simple/medium/complex) routes to appropriate NVIDIA NIM models
- **Telegram service** — `services/telegram.js` and message-router Telegram support kept intact for future use
- **Webhook architecture** — fire-and-forget 200 responses for channel webhooks
- **JWT auth middleware** — unchanged authentication flow
- **Google OAuth** — same flow, just updated destination routing
- **Resend email** — same service, just rebranded templates
- **Admin dashboard** — same structure, model names updated
- **Password reset flow** — completely intact

---

## 8. Environment Variables

### Required
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret

### Optional
- `GOOGLE_CLIENT_ID` — enables "Continue with Google"
- `NVIDIA_API_KEY` — AI model access
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` — email sending
- `KAJABI_WEBHOOK_SECRET` — subscription webhook verification
- `TELEGRAM_BOT_TOKEN` — Telegram bot (legacy, kept for flexibility)
- `WHATSAPP_GATEWAY_URL` — OpenClaw WhatsApp gateway
- `ADMIN_EMAILS` — comma-separated admin email list
- `FRONTEND_URL` / `APP_URL` — CORS and email link generation

---

## 9. Verification Checklist

- [ ] `cd backend && npx prisma generate` — schema compiles
- [ ] `cd backend && npm test` — all tests pass
- [ ] `cd frontend && npm run build` — frontend builds without errors
- [ ] Zero grep hits for: `warrior`, `Warrior`, `ClawWarrior`, `claw-warrior`, `cw_token`, `#e8632b`, `Stripe`, `stripe`, `Cinzel`, `pt-BR`
