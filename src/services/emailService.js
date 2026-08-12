const nodemailer = require('nodemailer');

let transporter = null;
let attemptedInit = false;

function getTransporter() {
  if (attemptedInit) return transporter;
  attemptedInit = true;

  if (!process.env.SMTP_HOST) {
    console.warn('[emailService] SMTP_HOST not configured — emails will be logged, not sent. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM in .env to enable real delivery.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/**
 * Sends an email if SMTP is configured; otherwise logs it to the console so
 * the integration point is visible without requiring real credentials.
 */
async function send({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[emailService] (not sent — no SMTP configured) To: ${to} | Subject: ${subject}\n${text}`);
    return { delivered: false };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || 'QuanTech Support <no-reply@quantech.example>',
      to,
      subject,
      text,
      html: html || undefined,
    });
    return { delivered: true };
  } catch (err) {
    console.error('[emailService] send failed:', err.message);
    return { delivered: false, error: err.message };
  }
}

module.exports = { send };
