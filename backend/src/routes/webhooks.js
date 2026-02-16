import { routeIncomingMessage } from '../services/message-router.js';
import { sendWhatsAppMessage } from '../services/whatsapp.js';
import { pendingConnections } from './channels.js';
import prisma from '../lib/prisma.js';

// Regex to match a 6-digit connection code
const CONNECTION_CODE_RE = /^\d{6}$/;

async function webhookRoutes(app) {
  // ─────────────────────────────────────────────
  // POST /api/webhooks/whatsapp
  // WhatsApp messages arrive here
  // Always returns 200 to prevent retries
  // ─────────────────────────────────────────────
  app.post('/whatsapp', async (request, reply) => {
    try {
      const { From, Body, ProfileName } = request.body || {};

      if (From && Body) {
        // Strip "whatsapp:" prefix for storage, keep raw phone
        const whatsappJid = From.replace('whatsapp:', '');
        const text = Body.trim();

        // Handle connection code (6-digit number)
        if (CONNECTION_CODE_RE.test(text)) {
          await handleConnectionCode(whatsappJid, text);
          return reply.code(200).send();
        }

        // Fire-and-forget
        routeIncomingMessage({
          whatsappJid,
          text,
          senderName: ProfileName || 'Unknown',
        }).catch((err) => {
          console.error('[ERROR] whatsapp message routing:', err.message);
        });
      }
    } catch (error) {
      console.error('[ERROR] whatsapp webhook:', error.message);
    }

    // Always return 200
    return reply.code(200).send();
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
    const agent = await prisma.agent.findFirst({
      where: { subscriberId: pending.subscriberId, isActive: true },
    });

    if (agent) {
      const name = agent.assistantName;
      await sendWhatsAppMessage(whatsappJid,
        `Channel connected! Your agent ${name} is ready. Send a message to start chatting.`
      );
    } else {
      await sendWhatsAppMessage(whatsappJid,
        "Channel connected! Now deploy an agent from your dashboard to start chatting."
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
