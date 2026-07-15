const nodemailer = require("nodemailer");

// ── Mailer (SMTP via env — provider-agnostic) ────────────────────────────────────
//
// Config lives entirely in env so the provider is swappable without code changes:
// Gmail App Password in dev, any SMTP relay (SendGrid/Mailgun/SES/…) in prod.
//
//   SMTP_HOST    e.g. smtp.gmail.com
//   SMTP_PORT    587 (STARTTLS, default) or 465 (implicit TLS)
//   SMTP_SECURE  "true" only for port 465
//   SMTP_USER    mailbox / API user
//   SMTP_PASS    app password / API key — NEVER the account's real password
//   MAIL_FROM    display From: header (defaults to SMTP_USER)
//
// sendMail() NEVER throws: it returns { sent, reason? } so auth flows stay in
// control of what a delivery failure means (login OTP → tell the user; password
// reset → generic message either way, no account enumeration). Message bodies are
// never logged — they contain one-time codes.

let transporter = null;

function isMailerConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  if (!isMailerConfigured()) {
    console.warn(`[mailer] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS) — "${subject}" not sent.`);
    return { sent: false, reason: "NOT_CONFIGURED" };
  }
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || `MindNavy LMS <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error("[mailer] send failed:", err.message);
    return { sent: false, reason: "SEND_FAILED" };
  }
}

// ── OTP email (login + password reset share one template) ───────────────────────

const OTP_SUBJECT = {
  ADMIN_LOGIN:    "Your MindNavy login code",
  PASSWORD_RESET: "Your MindNavy password reset code",
};

const OTP_INTRO = {
  ADMIN_LOGIN:    "Use this code to finish signing in to the MindNavy admin panel:",
  PASSWORD_RESET: "Use this code to reset your MindNavy admin password:",
};

function sendOtpEmail(to, code, purpose) {
  const subject = OTP_SUBJECT[purpose] ?? "Your MindNavy verification code";
  const intro   = OTP_INTRO[purpose]   ?? "Your verification code:";

  const text = `${intro}\n\n${code}\n\nThis code expires in 5 minutes. If you didn't request it, you can safely ignore this email.`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
    <h2 style="color:#1e3a5f;margin:0 0 16px;">MindNavy LMS</h2>
    <p style="color:#333;font-size:15px;">${intro}</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1e3a5f;
              background:#f4f6f9;border-radius:8px;padding:16px 24px;text-align:center;">${code}</p>
    <p style="color:#666;font-size:13px;">This code expires in <strong>5 minutes</strong> and can be used once.</p>
    <p style="color:#999;font-size:12px;">If you didn't request this code, you can safely ignore this email.</p>
  </div>`;

  return sendMail({ to, subject, text, html });
}

module.exports = { isMailerConfigured, sendMail, sendOtpEmail };
