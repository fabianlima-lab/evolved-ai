import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { toDataURL } from 'qrcode';
import env from '../config/env.js';
import { transcribeAudio, isVoiceConfigured } from './voice.js';

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
        console.error('[BAILEYS] CRITICAL: Logged out — admin must re-scan QR');
        console.error('[ALERT] WhatsApp session invalidated. All subscribers are offline.');
        console.error('[ALERT] Action: Visit http://167.172.209.255/api/whatsapp/qr-page and scan with bot phone');
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

      const jid = msg.key.remoteJid; // e.g. "1234567890@s.whatsapp.net"
      const pushName = msg.pushName || 'Unknown';

      // ── Text messages ──
      let text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        '';

      // ── Voice notes / audio messages ──
      if (!text && (msg.message?.audioMessage || msg.message?.pttMessage)) {
        const audioMsg = msg.message.audioMessage || msg.message.pttMessage;
        if (isVoiceConfigured()) {
          try {
            console.log(`[VOICE] Downloading voice note from ${jid}`);
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            const mimeType = audioMsg.mimetype || 'audio/ogg';
            const { text: transcribed, error, durationMs } = await transcribeAudio(buffer, mimeType);

            if (transcribed) {
              console.log(`[VOICE] Transcribed in ${durationMs}ms: "${transcribed.slice(0, 60)}..."`);
              text = transcribed;
            } else {
              console.warn(`[VOICE] Transcription failed: ${error}`);
              const { handleIncomingWhatsApp } = await import('../routes/webhooks.js');
              // Lazy import to avoid circular deps
              const { sendWhatsAppMessage: sendMsg } = await import('./baileys.js');
              await sendMsg(jid, "🎤 I got your voice note but couldn't quite catch it. Could you type it out or try again?");
              continue;
            }
          } catch (err) {
            console.error(`[VOICE] Error processing voice note: ${err.message}`);
            continue;
          }
        } else {
          // Voice not configured — let user know
          const { sendWhatsAppMessage: sendMsg } = await import('./baileys.js');
          await sendMsg(jid, "🎤 Voice notes are coming soon! For now, could you type your message?");
          continue;
        }
      }

      if (!text) continue;

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
