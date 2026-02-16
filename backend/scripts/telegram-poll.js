/**
 * Telegram Long-Polling Script (Development Only)
 *
 * Polls Telegram's getUpdates API and forwards messages to the local
 * webhook endpoint, simulating what Telegram would do in production.
 *
 * Usage: node scripts/telegram-poll.js
 * Requires: server running on PORT (default 3001)
 */

import 'dotenv/config';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SERVER_URL = `http://127.0.0.1:${process.env.PORT || 3001}`;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

if (!BOT_TOKEN || BOT_TOKEN === 'xxx') {
  console.error('[POLL] Missing TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}

let offset = 0;

async function poll() {
  console.log(`[POLL] Starting Telegram polling for Evolved AI bot`);
  console.log(`[POLL] Forwarding to ${SERVER_URL}/api/webhooks/telegram`);
  console.log(`[POLL] Press Ctrl+C to stop\n`);

  // First, clear any pending updates
  try {
    const clearRes = await fetch(`${TELEGRAM_API}/getUpdates?offset=-1`);
    const clearData = await clearRes.json();
    if (clearData.ok && clearData.result.length > 0) {
      offset = clearData.result[clearData.result.length - 1].update_id + 1;
      console.log(`[POLL] Cleared ${clearData.result.length} old updates, starting from offset ${offset}\n`);
    }
  } catch (e) {
    console.error('[POLL] Failed to clear updates:', e.message);
  }

  while (true) {
    try {
      const res = await fetch(
        `${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=30`,
        { signal: AbortSignal.timeout(35000) }
      );

      const data = await res.json();

      if (!data.ok) {
        console.error('[POLL] Telegram error:', data.description);
        await sleep(5000);
        continue;
      }

      for (const update of data.result) {
        offset = update.update_id + 1;

        // Log the incoming update
        if (update.message?.text) {
          console.log(`[POLL] ← Message from ${update.message.from?.first_name || 'Unknown'} (chat:${update.message.chat.id}): "${update.message.text}"`);
        }

        // Forward to local webhook
        try {
          const fwdRes = await fetch(`${SERVER_URL}/api/webhooks/telegram`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(update),
          });
          console.log(`[POLL] → Forwarded to server (${fwdRes.status})`);
        } catch (fwdErr) {
          console.error(`[POLL] → Forward failed: ${fwdErr.message}`);
          console.error(`[POLL]   Is the server running on port ${process.env.PORT || 3001}?`);
        }
      }
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        // Normal timeout on long poll — just continue
        continue;
      }
      console.error('[POLL] Error:', error.message);
      await sleep(5000);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

poll().catch((e) => {
  console.error('[POLL] Fatal:', e);
  process.exit(1);
});
