#!/bin/bash
# ─────────────────────────────────────────────────────
# OpenClaw Agent Isolation Setup
#
# Run once on the VPS as root to create an isolated
# user for the OpenClaw gateway. This prevents the AI
# agent from modifying app code, nginx, PM2, or systemd.
#
# Usage: sudo bash scripts/setup-isolation.sh
# ─────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/evolved-ai"
OPENCLAW_USER="openclaw"
OPENCLAW_HOME="/home/${OPENCLAW_USER}"
WORKSPACE="${OPENCLAW_HOME}/clawd"
AGENT_PAGES="/var/www/agent-pages"
DEPLOY_USER="deploy"

echo "=== OpenClaw Agent Isolation Setup ==="
echo ""

# ── 1. Create openclaw user ──
if id "${OPENCLAW_USER}" &>/dev/null; then
  echo "[OK] User '${OPENCLAW_USER}' already exists"
else
  echo "[+] Creating user '${OPENCLAW_USER}'..."
  useradd --system --create-home --shell /bin/bash "${OPENCLAW_USER}"
  echo "[OK] User '${OPENCLAW_USER}' created"
fi

# ── 2. Set up workspace directory ──
if [ -d "${WORKSPACE}" ]; then
  echo "[OK] Workspace ${WORKSPACE} already exists"
else
  echo "[+] Creating workspace ${WORKSPACE}..."
  mkdir -p "${WORKSPACE}"
fi

# Copy existing workspace if it exists at old location
OLD_WORKSPACE="${OPENCLAW_HOME}/../clawd"
if [ -d "/root/clawd" ] && [ ! -f "${WORKSPACE}/SOUL.md" ]; then
  echo "[+] Migrating workspace from /root/clawd..."
  cp -a /root/clawd/. "${WORKSPACE}/"
  echo "[OK] Workspace migrated"
fi

chown -R "${OPENCLAW_USER}:${OPENCLAW_USER}" "${WORKSPACE}"
chmod 770 "${WORKSPACE}"
echo "[OK] Workspace ownership set to ${OPENCLAW_USER}"

# ── 3. Create agent-pages directory ──
echo "[+] Creating ${AGENT_PAGES}..."
mkdir -p "${AGENT_PAGES}"
chown "${OPENCLAW_USER}:${OPENCLAW_USER}" "${AGENT_PAGES}"
chmod 755 "${AGENT_PAGES}"
echo "[OK] Agent pages directory ready"

# ── 4. Add deploy user to openclaw group ──
# So the backend (running as deploy) can write USER.md to the workspace
if id "${DEPLOY_USER}" &>/dev/null; then
  usermod -a -G "${OPENCLAW_USER}" "${DEPLOY_USER}"
  echo "[OK] User '${DEPLOY_USER}' added to '${OPENCLAW_USER}' group"
else
  echo "[WARN] User '${DEPLOY_USER}' not found — backend may need manual group setup"
fi

# ── 5. Verify app directory is protected ──
if [ -d "${APP_DIR}" ]; then
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}" 2>/dev/null || true
  chmod 750 "${APP_DIR}"
  echo "[OK] ${APP_DIR} protected (owned by ${DEPLOY_USER})"
else
  echo "[INFO] ${APP_DIR} not found — will be protected at deploy time"
fi

# ── 6. Install systemd service ──
SERVICE_SRC="$(dirname "$0")/openclaw.service"
SERVICE_DST="/etc/systemd/system/openclaw-gateway.service"

if [ -f "${SERVICE_SRC}" ]; then
  cp "${SERVICE_SRC}" "${SERVICE_DST}"
  systemctl daemon-reload
  echo "[OK] systemd service installed at ${SERVICE_DST}"
  echo "     Start with: systemctl start openclaw-gateway"
  echo "     Enable with: systemctl enable openclaw-gateway"
else
  echo "[WARN] ${SERVICE_SRC} not found — install manually"
fi

# ── 7. Summary ──
echo ""
echo "=== Isolation Complete ==="
echo ""
echo "  Agent user:      ${OPENCLAW_USER}"
echo "  Workspace:       ${WORKSPACE}  (read/write)"
echo "  Agent pages:     ${AGENT_PAGES}  (read/write)"
echo "  App directory:   ${APP_DIR}  (read-only for agent)"
echo "  System configs:  /etc/nginx/, /etc/systemd/  (blocked)"
echo ""
echo "  Run 'scripts/verify-isolation.sh' to confirm."
echo ""
