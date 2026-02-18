import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { toDataURL } from 'qrcode';
import env from '../config/env.js';

// ── Singleton state ──
let sock = null;
let currentQR = null;       // data-URI of latest QR code
let connectionStatus = 'disconnected'; // disconnected | connecting | open

/**
 * Initialise the Baileys WhatsApp Web socket.
 * Call once at server startup (skip in test mode).
 */
export async function initBaileys() {
  if (sock) return; // already running

  const { state, saveCreds } = await useMultiFileAuthState(env.WHATSAPP_AUTH_DIR);

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, undefined),
    },
    printQRInTerminal: true, // handy for first-time setup in dev
  });

  // ── Connection updates ──
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = await toDataURL(qr);
      connectionStatus = 'connecting';
      console.log('[BAILEYS] QR code generated — scan with WhatsApp');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      connectionStatus = 'disconnected';
      currentQR = null;

      if (shouldReconnect) {
        console.log(`[BAILEYS] Disconnected (code ${statusCode}), reconnecting…`);
        sock = null;
        await initBaileys();
      } else {
        console.log('[BAILEYS] Logged out — admin must re-scan QR');
        sock = null;
      }
    }

    if (connection === 'open') {
      connectionStatus = 'open';
      currentQR = null;
      console.log('[BAILEYS] Connected to WhatsApp');
    }
  });

  // ── Persist auth state on credential update ──
  sock.ev.on('creds.update', saveCreds);

  // ── Incoming messages ──
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return; // ignore history sync etc.

    for (const msg of messages) {
      if (msg.key.fromMe) continue; // skip own messages

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';

      if (!text) continue;

      const jid = msg.key.remoteJid; // e.g. "1234567890@s.whatsapp.net"
      const pushName = msg.pushName || 'Unknown';

      // Lazy-import to avoid circular deps at module-load time
      const { handleIncomingWhatsApp } = await import('../routes/webhooks.js');
      handleIncomingWhatsApp(jid, text.trim(), pushName);
    }
  });
}

/**
 * Send a WhatsApp message via the Baileys socket.
 *
 * @param {string} jid - Recipient JID (e.g. "1234567890@s.whatsapp.net")
 * @param {string} text - Message body
 * @returns {object|null} Baileys send result or null on error
 */
export async function sendWhatsAppMessage(jid, text) {
  if (!sock || connectionStatus !== 'open') {
    console.error('[ERROR] WhatsApp send: socket not connected');
    return null;
  }

  try {
    // Ensure @s.whatsapp.net suffix
    const normalised = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
    const result = await sock.sendMessage(normalised, { text });
    console.log(`[MSG_OUT] whatsapp:${jid} - len:${text.length}`);
    return result;
  } catch (error) {
    console.error(`[ERROR] WhatsApp send: ${error.message}`);
    return null;
  }
}

/**
 * Return current Baileys connection status + QR data-URI (if connecting).
 */
export function getBaileysStatus() {
  return {
    status: connectionStatus,
    qr: currentQR,
  };
}
