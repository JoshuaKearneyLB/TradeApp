import { Resend } from 'resend';

let resend: Resend | null = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('RESEND_API_KEY not set — email notifications disabled');
}

const FROM = process.env.RESEND_FROM || 'noreply@tradeapp.co.uk';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (error) {
    console.error('Email send error:', error);
    // Never throw — email failure must not crash the request
  }
}

// Throttle: only send one message email per user+job per 15 minutes
const messageEmailThrottle = new Map<string, number>();

export function sendNewMessageEmail(
  receiverId: string,
  jobId: string,
  receiverEmail: string,
  receiverName: string,
  senderName: string,
  jobTitle: string,
  preview: string,
): void {
  const key = `${receiverId}:${jobId}`;
  const now = Date.now();
  const last = messageEmailThrottle.get(key) ?? 0;
  if (now - last < 15 * 60 * 1000) return;
  messageEmailThrottle.set(key, now);

  const jobUrl = `${FRONTEND_URL}/jobs/${jobId}`;
  const eSender = escHtml(senderName);
  const eReceiver = escHtml(receiverName);
  const eTitle = escHtml(jobTitle);
  const ePreview = escHtml(preview);
  sendEmail(
    receiverEmail,
    `New message from ${eSender} — TradeApp`,
    emailLayout(`
      <h2 style="margin:0 0 16px;">New message</h2>
      <p>Hi ${eReceiver},</p>
      <p><strong>${eSender}</strong> sent you a message about <strong>${eTitle}</strong>:</p>
      <blockquote style="border-left:3px solid #0d9488;margin:16px 0;padding:12px 16px;background:#f0f9f8;color:#333;border-radius:4px;">
        "${ePreview}${preview.length >= 120 ? '…' : ''}"
      </blockquote>
      <a href="${jobUrl}" style="${btnStyle}">View conversation</a>
    `),
  );
}

export function sendJobAcceptedEmail(
  customerEmail: string,
  customerName: string,
  proName: string,
  jobTitle: string,
  jobId: string,
): void {
  const jobUrl = `${FRONTEND_URL}/jobs/${jobId}`;
  const eCust = escHtml(customerName);
  const ePro = escHtml(proName);
  const eTitle = escHtml(jobTitle);
  sendEmail(
    customerEmail,
    `Your job has been accepted — TradeApp`,
    emailLayout(`
      <h2 style="margin:0 0 16px;">Job accepted</h2>
      <p>Hi ${eCust},</p>
      <p>Great news! <strong>${ePro}</strong> has accepted your job <strong>${eTitle}</strong>.</p>
      <p>You can now message them directly to coordinate the work.</p>
      <a href="${jobUrl}" style="${btnStyle}">View job</a>
    `),
  );
}

export function sendJobCompletedEmail(
  customerEmail: string,
  customerName: string,
  jobTitle: string,
  jobId: string,
): void {
  const jobUrl = `${FRONTEND_URL}/jobs/${jobId}`;
  const eCust = escHtml(customerName);
  const eTitle = escHtml(jobTitle);
  sendEmail(
    customerEmail,
    `Job marked complete — please pay — TradeApp`,
    emailLayout(`
      <h2 style="margin:0 0 16px;">Job complete</h2>
      <p>Hi ${eCust},</p>
      <p>Your job <strong>${eTitle}</strong> has been marked as complete by the tradesperson.</p>
      <p>Please review the work and process payment when you are satisfied.</p>
      <a href="${jobUrl}" style="${btnStyle}">Pay now</a>
    `),
  );
}

export function sendPaymentReceivedEmail(
  proEmail: string,
  proName: string,
  jobTitle: string,
  amount: number,
  jobId: string,
): void {
  const jobUrl = `${FRONTEND_URL}/jobs/${jobId}`;
  const ePro = escHtml(proName);
  const eTitle = escHtml(jobTitle);
  sendEmail(
    proEmail,
    `Payment received — TradeApp`,
    emailLayout(`
      <h2 style="margin:0 0 16px;">Payment received</h2>
      <p>Hi ${ePro},</p>
      <p>You have received a payment of <strong>£${amount.toFixed(2)}</strong> for <strong>${eTitle}</strong>.</p>
      <p>Funds will be transferred to your connected bank account shortly.</p>
      <a href="${jobUrl}" style="${btnStyle}">View job</a>
    `),
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

const btnStyle = [
  'display:inline-block',
  'margin-top:20px',
  'padding:12px 24px',
  'background:#1a3a6b',
  'color:#fff',
  'text-decoration:none',
  'border-radius:8px',
  'font-weight:600',
  'font-family:sans-serif',
].join(';');

function emailLayout(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f5ff;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(15,35,70,0.1);">
        <tr>
          <td style="background:#1a3a6b;padding:24px 32px;">
            <span style="color:#fff;font-size:1.3rem;font-weight:800;letter-spacing:-0.03em;">TradeApp<span style="display:inline-block;width:8px;height:8px;background:#0d9488;border-radius:50%;margin-left:6px;margin-bottom:2px;"></span></span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#0f1e35;font-size:15px;line-height:1.6;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;background:#f0f5ff;color:#7090ae;font-size:12px;border-top:1px solid #cdd8f0;">
            TradeApp — Connecting customers with trusted UK tradespeople.<br>
            You received this email because you have an account on TradeApp.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
