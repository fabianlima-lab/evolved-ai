import { Resend } from 'resend';
import env from '../config/env.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const FROM_EMAIL = env.RESEND_FROM_EMAIL || 'Evolved AI <onboarding@resend.dev>';
const REPLY_TO = 'support@evolved.ai';

/**
 * Send a password reset email with a link to reset the password.
 * Optimised for deliverability: plain-text alt, reply-to, minimal HTML.
 * @param {string} to — recipient email
 * @param {string} token — raw (unhashed) reset token
 */
export async function sendPasswordResetEmail(to, token) {
  if (!resend) {
    console.error('[EMAIL] Resend not configured (missing RESEND_API_KEY)');
    return false;
  }

  const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;

  const textContent = [
    'Reset Your Evolved AI Password',
    '',
    'We received a request to reset your password. Visit the link below to set a new one:',
    '',
    resetUrl,
    '',
    'This link expires in 15 minutes. If you didn\'t request this, you can safely ignore this email.',
    '',
    '---',
    'Evolved AI — Your AI Agent, Your Rules',
    'https://evolved.ai',
  ].join('\n');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9f9f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:32px 32px 0;">
          <p style="margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:20px;font-weight:600;color:#1a1a1a;">
            Reset Your Password
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#444444;">
            We received a request to reset your Evolved AI password. Click the button below to set a new one.
          </p>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;" align="center">
          <a href="${resetUrl}" style="display:inline-block;background-color:#8BC4C6;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;font-weight:600;">
            Reset Password
          </a>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.5;color:#888888;">
            This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <hr style="border:none;border-top:1px solid #eeeeee;margin:0;">
        </td></tr>
        <tr><td style="padding:16px 32px 24px;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#aaaaaa;">
            Evolved AI — Your AI Agent, Your Rules
          </p>
          <p style="margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;">
            <a href="https://evolved.ai" style="color:#aaaaaa;text-decoration:none;">evolved.ai</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      reply_to: REPLY_TO,
      subject: 'Reset your Evolved AI password',
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Entity-Ref-ID': `ea-reset-${Date.now()}`,
      },
    });

    if (error) {
      console.error('[EMAIL] send failed:', error);
      return false;
    }

    console.log(`[EMAIL] reset email sent to: ${to} (id: ${data?.id})`);
    return true;
  } catch (err) {
    console.error('[EMAIL] send error:', err.message);
    return false;
  }
}

export function isEmailConfigured() {
  return !!resend;
}
