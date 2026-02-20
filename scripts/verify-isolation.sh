#!/bin/bash
# ─────────────────────────────────────────────────────
# Verify OpenClaw Isolation
#
# Run after setup-isolation.sh to confirm the agent
# cannot write to protected directories.
#
# Usage: sudo bash scripts/verify-isolation.sh
# ─────────────────────────────────────────────────────
set -euo pipefail

OPENCLAW_USER="openclaw"
PASS=0
FAIL=0

check() {
  local desc="$1"
  local expected="$2"  # "pass" or "fail"
  local cmd="$3"

  if eval "${cmd}" &>/dev/null 2>&1; then
    if [ "${expected}" = "pass" ]; then
      echo "  [PASS] ${desc}"
      ((PASS++))
    else
      echo "  [FAIL] ${desc} — expected to be blocked, but succeeded"
      ((FAIL++))
    fi
  else
    if [ "${expected}" = "fail" ]; then
      echo "  [PASS] ${desc}"
      ((PASS++))
    else
      echo "  [FAIL] ${desc} — expected to succeed, but was blocked"
      ((FAIL++))
    fi
  fi
}

echo "=== OpenClaw Isolation Verification ==="
echo ""

# ── Protected directories (should fail) ──
echo "Protected (agent CANNOT write):"
check "Cannot write to /opt/evolved-ai/" "fail" \
  "sudo -u ${OPENCLAW_USER} touch /opt/evolved-ai/.isolation-test"

check "Cannot write to /etc/nginx/" "fail" \
  "sudo -u ${OPENCLAW_USER} touch /etc/nginx/.isolation-test"

check "Cannot write to /etc/systemd/" "fail" \
  "sudo -u ${OPENCLAW_USER} touch /etc/systemd/.isolation-test"

echo ""

# ── Allowed directories (should pass) ──
echo "Allowed (agent CAN write):"
check "Can write to workspace" "pass" \
  "sudo -u ${OPENCLAW_USER} touch /home/${OPENCLAW_USER}/clawd/.isolation-test && rm /home/${OPENCLAW_USER}/clawd/.isolation-test"

check "Can write to agent-pages" "pass" \
  "sudo -u ${OPENCLAW_USER} touch /var/www/agent-pages/.isolation-test && rm /var/www/agent-pages/.isolation-test"

echo ""

# ── Gateway health ──
echo "Gateway:"
if curl -s --max-time 3 http://127.0.0.1:18789/health &>/dev/null; then
  echo "  [PASS] Gateway reachable on port 18789"
  ((PASS++))
else
  echo "  [WARN] Gateway not reachable — may not be running yet"
fi

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="

if [ "${FAIL}" -gt 0 ]; then
  echo ""
  echo "ISOLATION IS NOT COMPLETE — review failures above."
  exit 1
fi
