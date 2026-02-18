import { getBaileysStatus } from '../services/baileys.js';

/**
 * Admin endpoints for WhatsApp (Baileys) connection management.
 * Prefix: /api/whatsapp
 */
async function whatsappAdminRoutes(app) {
  // ─────────────────────────────────────────────
  // GET /api/whatsapp/status
  // Returns { status: 'disconnected' | 'connecting' | 'open' }
  // ─────────────────────────────────────────────
  app.get('/status', {
    onRequest: [app.authenticate],
  }, async () => {
    const { status } = getBaileysStatus();
    return { status };
  });

  // ─────────────────────────────────────────────
  // GET /api/whatsapp/qr
  // Returns { qr: '<data-uri>' } when status is 'connecting', null otherwise
  // ─────────────────────────────────────────────
  app.get('/qr', {
    onRequest: [app.authenticate],
  }, async () => {
    const { status, qr } = getBaileysStatus();
    return { status, qr: qr || null };
  });

  // ─────────────────────────────────────────────
  // GET /api/whatsapp/qr-page  (DEV ONLY — no auth)
  // Shows a scannable QR code page in the browser
  // ─────────────────────────────────────────────
  app.get('/qr-page', async (request, reply) => {
    const { status, qr } = getBaileysStatus();
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>WhatsApp QR</title>
<meta http-equiv="refresh" content="5">
<style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui;background:#f5f5f5}
img{width:350px;height:350px;border-radius:12px}h2{margin-bottom:8px}p{color:#666;font-size:14px}</style></head>
<body>
<h2>WhatsApp Connection</h2>
<p>Status: <strong>${status}</strong></p>
${qr ? `<img src="${qr}" alt="QR Code"/><p>Scan with WhatsApp → Settings → Linked Devices → Link a Device</p>` : status === 'open' ? '<p style="color:green;font-size:24px">✅ Connected!</p>' : '<p>Waiting for QR code... (page auto-refreshes)</p>'}
</body></html>`;
    reply.type('text/html').send(html);
  });
}

export default whatsappAdminRoutes;
