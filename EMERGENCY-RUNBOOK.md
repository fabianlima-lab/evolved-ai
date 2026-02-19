# Evolved AI — Emergency Runbook

**Last updated:** February 18, 2026
**Server:** 167.172.209.255 (DigitalOcean)
**SSH:** `ssh root@167.172.209.255`
**App path:** `/opt/evolved-ai/backend/`

---

## 1. Suspected Security Breach

**Symptoms:** Unusual API usage, unauthorized tool calls, suspicious message patterns, data exfiltration attempts

**Immediate actions:**

```bash
# 1. Stop all services immediately
ssh root@167.172.209.255
pm2 stop all
systemctl stop nginx

# 2. Check recent logs for suspicious activity
pm2 logs evolved-backend --lines 500 | grep -E '\[ERROR\]|\[ACTION\]|memory_save|send_email'

# 3. Revoke all Google OAuth tokens in database
psql -U evolved_ai -d evolved_ai -c "UPDATE subscribers SET google_access_token = NULL, google_refresh_token = NULL;"

# 4. Rotate credentials (generate new, update .env, revoke old)
nano /opt/evolved-ai/backend/.env
# Change: ANTHROPIC_API_KEY, GROQ_API_KEY, JWT_SECRET, KAJABI_WEBHOOK_SECRET

# 5. Restart services
pm2 restart all
systemctl start nginx

# 6. Notify affected subscribers via Kajabi email blast
```

**Post-mortem:** Document what happened, how it was detected, and what was done. Review within 24 hours.

---

## 2. Unexpected API Bill Spike

**Symptoms:** LLM provider dashboard shows runaway usage, unexpected charges

**Immediate actions:**

```bash
# 1. Check which subscribers are generating the most traffic
pm2 logs evolved-backend --lines 1000 | grep '\[AI\]' | sort | uniq -c | sort -rn | head -20

# 2. Check for infinite loops or excessive tool calls
pm2 logs evolved-backend --lines 500 | grep '\[ACTION\]' | wc -l

# 3. If critical, stop the backend
pm2 stop all

# 4. Lower rate limits in .env or server.js
# Current: 100 req/min per IP

# 5. Check provider dashboards
# Anthropic: console.anthropic.com
# Groq: console.groq.com

# 6. Restart with lower limits
pm2 restart all
```

---

## 3. Mass WhatsApp Disconnection

**Symptoms:** No messages being received, subscribers reporting Luna is silent

```bash
# 1. Check WhatsApp connection status
curl -s http://127.0.0.1:3001/api/whatsapp/status

# 2. Check logs for disconnect reasons
pm2 logs evolved-backend --lines 200 | grep BAILEYS

# 3. If bot session disconnected, re-authenticate
# Clear old auth and generate new QR
rm -rf /opt/evolved-ai/backend/baileys_auth/*
pm2 restart all

# 4. Open QR page in browser and scan with bot phone
# URL: http://167.172.209.255/api/whatsapp/qr-page
# Scan with phone number: +1 (737) 277-7995

# 5. Verify reconnection
pm2 logs evolved-backend --lines 20 | grep "Connected to WhatsApp"
```

---

## 4. LLM API Outage (All Providers Down)

**Symptoms:** AI responses failing, subscribers getting error messages

```bash
# 1. Check which providers are failing
pm2 logs evolved-backend --lines 100 | grep '\[AI\]'

# 2. Check provider status pages
# Anthropic: status.anthropic.com
# Groq: status.groq.com

# 3. The system auto-falls back: Anthropic -> Groq -> NVIDIA
# If ALL are down, subscribers get friendly error messages automatically

# 4. If extended outage (>30 min), send courtesy message
# Use direct WhatsApp (no LLM needed):
psql -U evolved_ai -d evolved_ai -c "SELECT whatsapp_jid FROM subscribers WHERE tier IN ('trial','active') AND whatsapp_jid IS NOT NULL;"
# Then manually message each via the WhatsApp app on the bot phone
```

---

## 5. Database Issues

**Symptoms:** 500 errors, connection timeouts, data not saving

```bash
# 1. Check PostgreSQL status
ssh root@167.172.209.255
systemctl status postgresql

# 2. Check database connectivity
psql -U evolved_ai -d evolved_ai -c "SELECT count(*) FROM subscribers;"

# 3. Check disk space (database fills up)
df -h

# 4. Restart PostgreSQL if needed
systemctl restart postgresql

# 5. Check PM2 logs for database errors
pm2 logs evolved-backend --lines 100 | grep -i "prisma\|database\|postgres"

# 6. If data corruption, restore from backup
# (Set up automated daily backups as a priority)
```

---

## 6. Server Crash / PM2 Down

**Symptoms:** Health check fails, no responses

```bash
# 1. SSH in and check PM2 status
ssh root@167.172.209.255
pm2 status

# 2. If PM2 is not running
pm2 resurrect  # Restores saved process list

# 3. If app keeps crashing (restart loop)
pm2 logs evolved-backend --err --lines 50  # Check error logs

# 4. Manual restart
cd /opt/evolved-ai/backend
pm2 delete all
pm2 start ecosystem.config.cjs

# 5. Verify health
curl -s http://127.0.0.1:3001/health
```

---

## 7. Quick Reference Commands

```bash
# SSH into server
ssh root@167.172.209.255

# App status
pm2 status
pm2 logs evolved-backend --lines 50

# Health check
curl -s http://127.0.0.1:3001/health

# WhatsApp status
curl -s http://127.0.0.1:3001/api/whatsapp/status

# Database quick check
psql -U evolved_ai -d evolved_ai -c "SELECT id, email, tier, whatsapp_jid IS NOT NULL as wa_connected FROM subscribers;"

# Subscriber count
psql -U evolved_ai -d evolved_ai -c "SELECT tier, count(*) FROM subscribers GROUP BY tier;"

# Recent messages
psql -U evolved_ai -d evolved_ai -c "SELECT s.email, m.role, left(m.content, 50), m.created_at FROM messages m JOIN subscribers s ON m.subscriber_id = s.id ORDER BY m.created_at DESC LIMIT 10;"

# Restart everything
pm2 restart all

# Nginx
systemctl status nginx
systemctl restart nginx
nginx -t  # Test config

# UFW firewall
ufw status

# Disk space
df -h

# Memory usage
free -h
```

---

## Architecture

```
Internet --> :80 (Nginx) --> 127.0.0.1:3001 (Node.js/Fastify)
                                  |
                                  ├── WhatsApp (Baileys socket)
                                  ├── PostgreSQL (local)
                                  ├── Anthropic Claude API
                                  ├── Groq API (fallback)
                                  ├── NVIDIA API (safety net)
                                  └── Google APIs (Calendar, Gmail, Drive)
```

**Ports:**
- 22: SSH
- 80: HTTP (Nginx)
- 3001: App (localhost only, behind Nginx)
- 5432: PostgreSQL (localhost only)

**Key files:**
- `/opt/evolved-ai/backend/.env` — Environment variables
- `/opt/evolved-ai/backend/ecosystem.config.cjs` — PM2 config
- `/opt/evolved-ai/backend/baileys_auth/` — WhatsApp session
- `/etc/nginx/sites-available/evolved-ai` — Nginx config
