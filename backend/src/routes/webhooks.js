import { sendWhatsAppMessage } from '../services/whatsapp.js';
import { pendingConnections } from './channels.js';
import { addWhatsAppBinding } from '../services/openclaw-provisioner.js';
import prisma from '../lib/prisma.js';

// Regex to match a 6-digit connection code
const CONNECTION_CODE_RE = /^\d{6}$/;

/**
 * Fastify plugin — registers webhook routes.
 */
async function webhookRoutes(app) {
  // (placeholder — Kajabi webhooks are in their own file)
}

/**
 * Called by the Baileys message listener for every incoming WhatsApp message.
 *
 * OpenClaw gateway handles ALL chat messages via its own WhatsApp plugin.
 * This backend only handles 6-digit connection codes for account linking.
 * Everything else is ignored — OpenClaw is the AI engine.
 */
export function handleIncomingWhatsApp(whatsappJid, text, senderName) {
  // Only handle connection codes — gateway handles everything else
  if (CONNECTION_CODE_RE.test(text)) {
    handleConnectionCode(whatsappJid, text).catch((err) => {
      console.error('[ERROR] connection code handling:', err.message);
    });
  }
  // All other messages: do nothing. OpenClaw gateway handles them.
}

/**
 * Handle a 6-digit connection code sent by a subscriber via WhatsApp.
 * Verifies the code and links WhatsApp to their account.
 */
async function handleConnectionCode(whatsappJid, code) {
  const pending = pendingConnections.get(code);

  if (!pending) {
    await sendWhatsAppMessage(whatsappJid,
      "Invalid or expired connection code. Please request a new one from your dashboard."
    );
    return;
  }

  if (pending.expiresAt < Date.now()) {
    pendingConnections.delete(code);
    await sendWhatsAppMessage(whatsappJid,
      "This connection code has expired. Please request a new one from your dashboard."
    );
    return;
  }

  try {
    // Check if whatsappJid already linked to another subscriber
    const existing = await prisma.subscriber.findFirst({
      where: { whatsappJid },
    });

    if (existing) {
      if (existing.id !== pending.subscriberId) {
        await sendWhatsAppMessage(whatsappJid,
          "This WhatsApp account is already linked to a different Evolved AI subscriber."
        );
        pendingConnections.delete(code);
        return;
      }
      // Already linked to same subscriber
      await sendWhatsAppMessage(whatsappJid,
        "This WhatsApp is already connected to your account! You're all set."
      );
      pendingConnections.delete(code);
      return;
    }

    // Link WhatsApp to subscriber
    await prisma.subscriber.update({
      where: { id: pending.subscriberId },
      data: { whatsappJid },
    });

    pendingConnections.delete(code);

    console.log(`[CHANNEL] connected via bot: whatsapp:${whatsappJid} → subscriber:${pending.subscriberId}`);

    // Check if they have an active agent
    const [agent, subscriber] = await Promise.all([
      prisma.agent.findFirst({
        where: { subscriberId: pending.subscriberId, isActive: true },
      }),
      prisma.subscriber.findUnique({
        where: { id: pending.subscriberId },
        select: { assistantName: true },
      }),
    ]);

    // If agent has an OpenClaw workspace, add WhatsApp binding so
    // OpenClaw routes this phone's messages to their isolated agent
    if (agent?.openclawAgentId) {
      try {
        const phone = whatsappJid.replace('@s.whatsapp.net', '');
        const e164 = phone.startsWith('+') ? phone : `+${phone}`;
        await addWhatsAppBinding(pending.subscriberId, e164);
        console.log(`[CHANNEL] OpenClaw binding added: ${e164} → ${agent.openclawAgentId}`);
      } catch (err) {
        console.error(`[CHANNEL] OpenClaw binding failed (non-fatal): ${err.message}`);
      }
    }

    if (agent) {
      const name = subscriber?.assistantName || agent.name;
      await sendWhatsAppMessage(whatsappJid,
        `Channel connected! Your assistant ${name} is ready. Send a message to start chatting.`
      );
    } else {
      await sendWhatsAppMessage(whatsappJid,
        "Channel connected! Complete your onboarding at evolved.ai to get started."
      );
    }
  } catch (error) {
    console.error(`[ERROR] connection code handling: ${error.message}`);
    await sendWhatsAppMessage(whatsappJid,
      "Something went wrong connecting your account. Please try again."
    );
  }
}

export default webhookRoutes;
