import { routeIncomingMessage } from '../services/message-router.js';
import { sendWhatsAppMessage } from '../services/whatsapp.js';
import { pendingConnections } from './channels.js';
import prisma from '../lib/prisma.js';

// Regex to match a 6-digit connection code
const CONNECTION_CODE_RE = /^\d{6}$/;

/**
 * Fastify plugin — registers webhook routes.
 * The Twilio POST /whatsapp route is gone; incoming messages now arrive
 * via the Baileys socket listener which calls handleIncomingWhatsApp().
 */
async function webhookRoutes(app) {
  // (placeholder — Kajabi webhooks are in their own file)
}

/**
 * Called by the Baileys message listener for every incoming WhatsApp message.
 * Decides whether it's a connection code or a normal chat message.
 */
export function handleIncomingWhatsApp(whatsappJid, text, senderName) {
  if (CONNECTION_CODE_RE.test(text)) {
    handleConnectionCode(whatsappJid, text).catch((err) => {
      console.error('[ERROR] connection code handling:', err.message);
    });
    return;
  }

  routeIncomingMessage({
    channel: 'whatsapp',
    channelId: whatsappJid,
    text,
    senderName,
  }).catch((err) => {
    console.error('[ERROR] whatsapp message routing:', err.message);
  });
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
