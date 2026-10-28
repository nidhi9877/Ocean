import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// ─── Resend Client ──────────────────────────────────────────────────────────────
// Uses the Resend API for transactional emails. Requires RESEND_API_KEY in .env.
// Free tier: 100 emails/day, 3000/month — more than enough for a marketplace MVP.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// ─── SMTP Transport (preferred when configured) ─────────────────────────────────
// When SMTP_HOST is set, mail is sent through the domain mailbox
// (e.g. update@marinestockhub.com) instead of Resend.
const smtpTransport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 465,
      secure: (Number(process.env.SMTP_PORT) || 465) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

// Returns { data, error } like resend.emails.send so callers don't care which transport is used
async function sendMail(mailOptions) {
  if (!smtpTransport) {
    if (!resend) return { data: null, error: { message: 'No email transport configured (set SMTP_* or RESEND_API_KEY)' } };
    return resend.emails.send(mailOptions);
  }
  try {
    const info = await smtpTransport.sendMail(mailOptions);
    return { data: { id: info.messageId }, error: null };
  } catch (err) {
    return { data: null, error: { message: err.message } };
  }
}

// System sender — must match the SMTP mailbox, or a verified domain in Resend (onboarding@resend.dev for testing)
const SYSTEM_FROM = process.env.SYSTEM_EMAIL_FROM || 'MarineStockHub Marketplace <onboarding@resend.dev>';

// Base URL for CTA links (e.g., accept inquiry buttons in emails)
const BASE_URL = process.env.BASE_URL || 'https://marinestockhub.com';


// ─── Professional HTML Email Template ────────────────────────────────────────────
// Generates a multi-million-dollar-grade B2B inquiry email with inline CSS.
// Compatible with Gmail, Outlook, Apple Mail, and all major email clients.
function buildInquiryEmailHTML({
  vendorName,
  buyerName,
  buyerEmail,
  productName,
  brand,
  partNumber,
  targetPrice,
  deliveryPort,
  deliveryRequirements,
  inquiryId,
}) {
  const acceptUrl = `${BASE_URL}/api/deal/accept?dealId=${inquiryId}`;
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Inquiry from MarineStockHub</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">

        <!-- Main card -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#1e293b;border-radius:16px;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,0.4);">
          
          <!-- Header banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9 0%,#6366f1 50%,#8b5cf6 100%);padding:40px 40px 32px 40px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="font-size:36px;margin-bottom:8px;">⚓</div>
                    <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">MARINESTOCKHUB</h1>
                    <p style="margin:6px 0 0 0;font-size:13px;color:rgba(255,255,255,0.8);text-transform:uppercase;letter-spacing:2px;">Maritime Spare Parts Marketplace</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Inquiry alert badge -->
          <tr>
            <td style="padding:28px 40px 0 40px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);border-radius:100px;padding:8px 20px;">
                    <span style="color:#22c55e;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">🔔 New Purchase Inquiry</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:24px 40px 0 40px;">
              <p style="margin:0;font-size:18px;color:#e2e8f0;line-height:1.6;">
                Dear <strong style="color:#ffffff;">${vendorName}</strong>,
              </p>
              <p style="margin:12px 0 0 0;font-size:15px;color:#94a3b8;line-height:1.7;">
                A verified buyer on MarineStockHub has expressed interest in one of your listed products. Please review the inquiry details below and respond at your earliest convenience.
              </p>
            </td>
          </tr>

          <!-- Product details card -->
          <tr>
            <td style="padding:24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.15);border-radius:12px;overflow:hidden;">
                
                <!-- Card header -->
                <tr>
                  <td colspan="2" style="background:rgba(14,165,233,0.1);border-bottom:1px solid rgba(148,163,184,0.1);padding:14px 20px;">
                    <span style="font-size:13px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:1.5px;">📦 Product Details</span>
                  </td>
                </tr>

                <!-- Product Name -->
                <tr>
                  <td style="padding:14px 20px 6px 20px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;width:140px;vertical-align:top;">Product</td>
                  <td style="padding:14px 20px 6px 20px;font-size:15px;color:#f1f5f9;font-weight:700;">${productName}</td>
                </tr>

                <!-- Brand -->
                <tr>
                  <td style="padding:6px 20px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Brand</td>
                  <td style="padding:6px 20px;font-size:15px;color:#e2e8f0;">${brand || 'N/A'}</td>
                </tr>

                <!-- Part Number -->
                <tr>
                  <td style="padding:6px 20px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Part Number</td>
                  <td style="padding:6px 20px;font-size:15px;color:#e2e8f0;font-family:'Courier New',monospace;">${partNumber || 'N/A'}</td>
                </tr>

                <!-- Target Price Removed -->
                <tr>
                  <td style="padding:6px 20px 14px 20px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;vertical-align:top;">Delivery Port</td>
                  <td style="padding:6px 20px 14px 20px;font-size:15px;color:#e2e8f0;">📍 ${deliveryPort || 'To be discussed'}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Delivery Requirements card -->
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.15);border-radius:12px;overflow:hidden;">
                <tr>
                  <td colspan="2" style="background:rgba(234,179,8,0.1);border-bottom:1px solid rgba(148,163,184,0.1);padding:14px 20px;">
                    <span style="font-size:13px;font-weight:700;color:#facc15;text-transform:uppercase;letter-spacing:1.5px;">🚚 Delivery Requirements</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px 6px 20px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;width:140px;">Quantity</td>
                  <td style="padding:14px 20px 6px 20px;font-size:15px;color:#f1f5f9;font-weight:700;">${deliveryRequirements?.quantity || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding:6px 20px 6px 20px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">ETA</td>
                  <td style="padding:6px 20px 6px 20px;font-size:15px;color:#e2e8f0;">${deliveryRequirements?.eta || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding:6px 20px 6px 20px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">ETD</td>
                  <td style="padding:6px 20px 6px 20px;font-size:15px;color:#e2e8f0;">${deliveryRequirements?.etd || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding:6px 20px 14px 20px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Vessel Name</td>
                  <td style="padding:6px 20px 14px 20px;font-size:15px;color:#e2e8f0;">🚢 ${deliveryRequirements?.vessel_name || 'N/A'}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Buyer info card -->
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.15);border-radius:12px;overflow:hidden;">
                <tr>
                  <td colspan="2" style="background:rgba(99,102,241,0.1);border-bottom:1px solid rgba(148,163,184,0.1);padding:14px 20px;">
                    <span style="font-size:13px;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:1.5px;">👤 Buyer Information</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px 6px 20px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;width:140px;">Buyer</td>
                  <td style="padding:14px 20px 6px 20px;font-size:15px;color:#f1f5f9;font-weight:600;">${buyerName}</td>
                </tr>
                <tr>
                  <td style="padding:6px 20px 14px 20px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Email</td>
                  <td style="padding:6px 20px 14px 20px;font-size:15px;color:#38bdf8;">
                    <a href="mailto:${buyerEmail}" style="color:#38bdf8;text-decoration:none;">${buyerEmail}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:8px 40px 32px 40px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:12px;background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);box-shadow:0 6px 20px rgba(22,163,74,0.5);">
                    <a href="${acceptUrl}" target="_blank" style="display:inline-block;padding:18px 48px;font-size:18px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.5px;text-transform:uppercase;">
                      ✅ Accept & Secure Deal
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0 0;font-size:14px;color:#ef4444;font-weight:700;">
                ⚠️ This is a broadcast inquiry. The first seller to accept secures the contract.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:linear-gradient(to right,transparent,rgba(148,163,184,0.2),transparent);"></div>
            </td>
          </tr>

          <!-- Surge warning notice -->
          <tr>
            <td style="padding:24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:16px 20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:14px;color:#ef4444;font-weight:700;text-transform:uppercase;">
                      ⚡ RUTHLESS EXECUTION MODEL
                    </p>
                    <p style="margin:8px 0 0 0;font-size:13px;color:#fca5a5;line-height:1.6;">
                      MarineStockHub operates on a First-to-Accept basis to maximize speed. <strong>No counter-offers. No negotiations.</strong> If you can fulfill the order, click Accept immediately before another seller takes the deal.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:rgba(15,23,42,0.5);padding:24px 40px;text-align:center;border-top:1px solid rgba(148,163,184,0.08);">
              <p style="margin:0 0 4px 0;font-size:12px;color:#475569;">
                This email was sent by <strong style="color:#64748b;">MarineStockHub Maritime Marketplace</strong>
              </p>
              <p style="margin:0 0 4px 0;font-size:12px;color:#475569;">
                You can reply directly to this email to contact the buyer.
              </p>
              <p style="margin:12px 0 0 0;font-size:11px;color:#334155;">
                © ${currentYear} MarineStockHub. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- End main card -->

      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}


// ─── Send Inquiry Email ──────────────────────────────────────────────────────────
// Called when a buyer submits an inquiry. Sends a professional HTML email to the
// vendor with full product details, and sets Reply-To to the buyer's email so
// direct replies go to the buyer.
export async function sendInquiryEmail({
  vendorName,
  vendorEmail,
  buyerName,
  buyerEmail,
  productName,
  brand,
  partNumber,
  targetPrice,
  deliveryPort,
  inquiryId,
  cc,
  bcc,
}) {
  const html = buildInquiryEmailHTML({
    vendorName,
    buyerName,
    buyerEmail,
    productName,
    brand,
    partNumber,
    targetPrice,
    deliveryPort,
    inquiryId,
  });

  const mailOptions = {
    from: SYSTEM_FROM,
    to: vendorEmail,
    replyTo: buyerEmail,  // CRITICAL: vendor replies go directly to the buyer
    subject: `🚢 New Inquiry: ${productName} — MarineStockHub Marketplace`,
    html,
  };

  if (cc) mailOptions.cc = cc;
  if (bcc) mailOptions.bcc = bcc;

  const { data, error } = await sendMail(mailOptions);

  if (error) {
    console.error('❌ Resend email error:', error);
    throw new Error(`Email delivery failed: ${error.message}`);
  }

  console.log(`✅ Inquiry email sent to ${vendorEmail} (Message ID: ${data?.id})`);
  return data;
}


// ─── Legacy Notification (kept for backward compatibility) ───────────────────────
// Lightweight notification used by other parts of the system (e.g., status changes).
export async function sendProviderNotification(providerEmail, buyerName, productName, cc, bcc) {
  try {
    const mailOptions = {
      from: SYSTEM_FROM,
      to: providerEmail,
      subject: `New Inquiry Received: ${productName}`,
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;color:#e2e8f0;background:#1e293b;border-radius:12px;">
          <h2 style="color:#38bdf8;">New Inquiry Received!</h2>
          <p>Hello,</p>
          <p>You have received a new inquiry from <strong>${buyerName}</strong> regarding your product:</p>
          <div style="background:#0f172a;padding:15px;border-left:4px solid #38bdf8;margin:15px 0;border-radius:6px;">
            <strong style="color:#f1f5f9;">${productName}</strong>
          </div>
          <p>Please log in to your Provider Dashboard to view the details and respond to the buyer.</p>
          <br/>
          <p>Best regards,<br/><strong>MarineStockHub Team</strong></p>
        </div>
      `,
    };

    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;

    const { data, error } = await sendMail(mailOptions);

    if (error) {
      console.error('Notification email error:', error);
      return;
    }
    console.log('Notification email sent to provider:', providerEmail, '| ID:', data?.id);
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}


// ─── Password Reset Email ────────────────────────────────────────────────────────
// Sends a one-time reset link. FRONTEND_URL lets dev point at the Vite server
// (e.g. http://localhost:5173); in production the API serves the client, so
// BASE_URL is used as the fallback.
const FRONTEND_URL = process.env.FRONTEND_URL || BASE_URL;

export async function sendPasswordResetEmail({ to, username, token, expiresInMinutes }) {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const currentYear = new Date().getFullYear();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your MarineStockHub password</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%);padding:32px 40px;text-align:center;">
              <div style="font-size:32px;margin-bottom:6px;">⚓</div>
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">MARINESTOCKHUB</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 8px 40px;color:#1e293b;">
              <h2 style="margin:0 0 16px 0;font-size:20px;">Reset your password</h2>
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;">Hello <strong>${username}</strong>,</p>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;">We received a request to reset the password for your MarineStockHub account. Click the button below to choose a new password. This link expires in <strong>${expiresInMinutes} minutes</strong> and can only be used once.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
                <tr>
                  <td style="background:#2563eb;border-radius:10px;">
                    <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;line-height:1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 24px 0;font-size:13px;word-break:break-all;"><a href="${resetUrl}" style="color:#2563eb;">${resetUrl}</a></p>
              <p style="margin:0 0 24px 0;font-size:13px;color:#64748b;line-height:1.6;">If you didn't request a password reset, you can safely ignore this email — your password will not change.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
              © ${currentYear} MarineStockHub · This is an automated message, please do not reply.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { data, error } = await sendMail({
    from: SYSTEM_FROM,
    to,
    subject: 'Reset your MarineStockHub password',
    html,
    text: `Hello ${username},\n\nReset your MarineStockHub password using this link (expires in ${expiresInMinutes} minutes):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
  });

  if (error) {
    console.error('❌ Password reset email error:', error);
    throw new Error(`Email delivery failed: ${error.message}`);
  }

  console.log(`✅ Password reset email sent to ${to} (Message ID: ${data?.id})`);
  return data;
}


// ─── Account Status Emails ───────────────────────────────────────────────────────
// Sent to buyers / sellers when they register (pending) and when management
// approves or rejects their account.
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const ACCOUNT_STATUS_COPY = {
  pending: {
    subject: 'We received your MarineStockHub registration',
    heading: 'Registration received',
    body: 'Thank you for registering. Our management team reviews every new account to keep the marketplace trusted and verified. You will receive another email as soon as your account has been reviewed — usually within 1 business day.',
    cta: null,
  },
  approved: {
    subject: 'Your MarineStockHub account has been approved',
    heading: 'Your account is approved 🎉',
    body: 'Good news — your account has been verified and approved by our management team. You can now sign in and start using MarineStockHub.',
    cta: 'Sign In',
  },
  rejected: {
    subject: 'Update on your MarineStockHub registration',
    heading: 'Registration not approved',
    body: 'After review, we were unable to approve your account at this time. If you believe this is a mistake or would like to provide more information, simply reply to this email or contact our support team.',
    cta: null,
  },
};

function buildSimpleEmailHTML({ heading, paragraphs, ctaLabel, ctaUrl }) {
  const currentYear = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%);padding:32px 40px;text-align:center;">
          <div style="font-size:32px;margin-bottom:6px;">⚓</div>
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">MARINESTOCKHUB</h1>
        </td></tr>
        <tr><td style="padding:36px 40px 24px 40px;color:#1e293b;">
          <h2 style="margin:0 0 16px 0;font-size:20px;">${heading}</h2>
          ${paragraphs.map(p => `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;">${p}</p>`).join('')}
          ${ctaLabel ? `
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px auto 8px auto;">
            <tr><td style="background:#2563eb;border-radius:10px;">
              <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${ctaLabel}</a>
            </td></tr>
          </table>` : ''}
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#94a3b8;">
          © ${currentYear} MarineStockHub · Maritime Spare Parts Marketplace
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendAccountStatusEmail({ to, username, role, status }) {
  const copy = ACCOUNT_STATUS_COPY[status];
  if (!to || !copy) return;

  const roleLabel = role === 'buyer' ? 'buyer' : 'seller';
  const html = buildSimpleEmailHTML({
    heading: copy.heading,
    paragraphs: [
      `Hello <strong>${escapeHtml(username)}</strong>,`,
      copy.body,
      `Account type: <strong>${roleLabel}</strong> · Username: <strong>${escapeHtml(username)}</strong>`,
    ],
    ctaLabel: copy.cta,
    ctaUrl: `${FRONTEND_URL}/login`,
  });

  const { data, error } = await sendMail({ from: SYSTEM_FROM, to, subject: copy.subject, html });
  if (error) throw new Error(`Email delivery failed: ${error.message}`);
  console.log(`✅ Account ${status} email sent to ${to} (Message ID: ${data?.id})`);
  return data;
}

// Optional alert to the management inbox (MANAGEMENT_NOTIFY_EMAIL) for every new registration
export async function sendNewRegistrationAlert({ to, username, role, email }) {
  const roleLabel = role === 'buyer' ? 'Buyer' : 'Seller';
  const html = buildSimpleEmailHTML({
    heading: `New ${roleLabel.toLowerCase()} awaiting approval`,
    paragraphs: [
      `A new <strong>${roleLabel}</strong> account has registered and is waiting for review.`,
      `Username: <strong>${escapeHtml(username)}</strong><br/>Email: <strong>${escapeHtml(email || 'N/A')}</strong>`,
    ],
    ctaLabel: 'Open Approval Queue',
    ctaUrl: `${FRONTEND_URL}/management/dashboard`,
  });

  const { error } = await sendMail({ from: SYSTEM_FROM, to, subject: `New ${roleLabel} registration: ${username}`, html });
  if (error) throw new Error(`Email delivery failed: ${error.message}`);
}


// ─── Registration OTP Email ──────────────────────────────────────────────────────
export async function sendRegistrationOtpEmail({ to, username, code, expiresInMinutes }) {
  const digits = code.split('').map(d =>
    `<td style="width:44px;height:52px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;text-align:center;font-size:26px;font-weight:800;color:#0f172a;font-family:Consolas,'Courier New',monospace;">${d}</td><td style="width:6px;"></td>`
  ).join('');

  const html = buildSimpleEmailHTML({
    heading: 'Verify your email address',
    paragraphs: [
      `Hello${username ? ` <strong>${escapeHtml(username)}</strong>` : ''},`,
      'Use the verification code below to complete your MarineStockHub registration:',
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px auto 4px auto;"><tr>${digits}</tr></table>`,
      `This code expires in <strong>${expiresInMinutes} minutes</strong>. Never share it with anyone — MarineStockHub staff will never ask for it.`,
      '<span style="color:#64748b;font-size:13px;">If you didn\'t try to register, you can safely ignore this email.</span>',
    ],
  });

  const { data, error } = await sendMail({
    from: SYSTEM_FROM,
    to,
    subject: `${code} is your MarineStockHub verification code`,
    html,
    text: `Your MarineStockHub verification code is ${code}. It expires in ${expiresInMinutes} minutes.`,
  });
  if (error) throw new Error(`Email delivery failed: ${error.message}`);
  console.log(`✅ Registration OTP sent to ${to} (Message ID: ${data?.id})`);
  return data;
}
