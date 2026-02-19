# Luna — Installed ClawHub Skills & Integrations

Last updated: 2026-02-19
VPS: 167.172.209.255
Workspace: /root/clawd/agents/luna
Skills dir: /root/clawd/agents/luna/skills

---

## Installed Skills

| # | Skill | Slug | Version | Status | API Key Required |
|---|-------|------|---------|--------|-----------------|
| 1 | ClawHub CLI | clawdhub | 1.0.0 | Active | None |
| 2 | Tavily Web Search | tavily-search | 1.0.0 | Needs API Key | TAVILY_API_KEY |
| 3 | Self-Improving Agent | self-improving-agent | 1.0.5 | Active | None |
| 4 | Proactive Agent | proactive-agent | 3.1.0 | Active | None |
| 5 | Slack | slack | 1.0.0 | Needs Config | Slack Bot Token |
| 6 | Fathom (Meetings) | fathom-api | 1.0.5 | Needs API Key | Maton API Key |
| 7 | Xero (Accounting) | xero | 1.0.4 | Needs API Key | Maton API Key |
| 8 | Calendly | calendly | 1.0.0 | Needs Setup | Calendly API |

---

## Skill Details

### 1. ClawHub CLI (clawdhub)
- **Purpose:** Meta-skill to search, install, update, and publish other skills from ClawHub marketplace
- **Commands:** `clawdhub search`, `clawdhub install`, `clawdhub update`, `clawdhub list`
- **Status:** Fully operational
- **Config:** None needed

### 2. Tavily Web Search (tavily-search)
- **Purpose:** AI-optimized real-time web search. Returns clean, relevant results for AI agents
- **What it enables:** Luna can search the web live (restaurants, news, stock info, anything)
- **Status:** Needs TAVILY_API_KEY
- **Setup:** Get free API key at https://tavily.com, add to OpenClaw env vars
- **Priority:** HIGH — biggest capability gap for Luna

### 3. Self-Improving Agent (self-improving-agent)
- **Purpose:** Captures learnings, errors, and corrections for continuous improvement
- **What it enables:** When a user says "no, that's wrong" or something fails, Luna learns and improves
- **Status:** Active (no external dependencies)
- **How it works:** Logs learnings to markdown files, promotes important ones to memory
- **Priority:** HIGH — makes Luna smarter over time

### 4. Proactive Agent (proactive-agent)
- **Purpose:** Transforms Luna from task-follower to proactive partner
- **What it enables:** WAL Protocol, Working Buffer, Autonomous Crons, anticipating needs
- **Status:** Active (no external dependencies)
- **How it works:** Adds patterns for morning briefings, deadline reminders, follow-ups
- **Priority:** HIGH — core to the "chief of staff" value proposition

### 5. Slack (slack)
- **Purpose:** Control Slack from Luna — send messages, react, pin items, manage channels
- **What it enables:** Luna can interact with user's Slack workspace
- **Status:** Needs Slack Bot Token configured in OpenClaw
- **Setup:** Create Slack Bot, get OAuth token, add to OpenClaw channels config
- **Priority:** MEDIUM — depends on subscriber demand

### 6. Fathom (fathom-api)
- **Purpose:** Access meeting recordings, transcripts, and summaries via Fathom API
- **What it enables:** Luna can fetch meeting notes, search recordings, summarize meetings
- **Status:** Needs Maton API key (managed OAuth)
- **Setup:** Sign up at https://maton.ai, get API key, configure OAuth
- **Priority:** MEDIUM — great for busy professionals

### 7. Xero (xero)
- **Purpose:** Accounting integration — invoices, contacts, payments, financial reports
- **What it enables:** Luna can check invoices, track payments, run financial reports
- **Status:** Needs Maton API key (managed OAuth)
- **Setup:** Sign up at https://maton.ai, get API key, connect Xero account
- **Priority:** MEDIUM — for subscribers who run businesses

### 8. Calendly (calendly)
- **Purpose:** Scheduling integration — list events, check availability, manage meetings
- **What it enables:** Luna can check Calendly availability, share booking links
- **Status:** Needs Calendly API setup (MCP server v2.0.0 pending)
- **Setup:** Get Calendly API key, install calendly-mcp-server
- **Priority:** MEDIUM — useful for appointment-based businesses (vets, coaches)

---

## Architecture

```
WhatsApp msg → Baileys → message-router.js → openclaw-bridge.js
  → OpenClaw Gateway (port 18789) → Claude Sonnet 4.6
  → Response with [ACTION:...] tags → action-executor.js → WhatsApp reply
```

Skills are loaded from `/root/clawd/agents/luna/skills/` as SKILL.md context.
OpenClaw reads these on each Gateway call and injects them into the agent context.

---

## Managing Skills

```bash
# SSH into VPS
ssh root@167.172.209.255

# Navigate to Luna workspace
cd /root/clawd/agents/luna

# List installed skills
clawdhub list

# Search for new skills
clawdhub search "keyword"

# Install a skill
clawdhub install skill-slug

# Update all skills
clawdhub update --all

# Update specific skill
clawdhub update skill-slug
```

After installing/removing skills, restart the Gateway:
```bash
kill $(ps aux | grep openclaw-gateway | grep -v grep | awk '{print $2}')
sleep 2
nohup openclaw gateway run --force > /var/log/openclaw-gateway.log 2>&1 &
```

---

## Next Steps

1. Get Tavily API key (free tier: 1000 searches/month) — https://tavily.com
2. Set up Slack Bot for subscriber workspaces
3. Configure Maton API for Fathom + Xero OAuth
4. Set up Calendly API integration
5. Consider adding: Notion, Trello, Weather, Summarize, API Gateway
