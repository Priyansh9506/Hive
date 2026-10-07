const nodemailer = require('nodemailer');

// Email is an invitation channel, not part of the collaboration path (PRD §10.3),
// so it degrades quietly: with no SMTP credentials configured the app runs
// normally and invite emails report back as "not configured" instead of failing.
let transporter = null;
let verified = false;

const isConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!isConfigured()) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      // 465 is implicit TLS; 587 upgrades with STARTTLS
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    transporter.verify()
      .then(() => {
        verified = true;
        console.log(`Mailer: connected to ${process.env.SMTP_HOST}`);
      })
      .catch((err) => {
        console.error('Mailer: SMTP verification failed —', err.message);
      });
  }

  return transporter;
};

/**
 * Send an email. Resolves `{ sent: false, reason }` rather than throwing, so
 * callers can report a partial success ("invite created, email not sent").
 */
const sendMail = async ({ to, subject, html, text }) => {
  const tx = getTransporter();

  if (!tx) {
    return { sent: false, reason: 'Email is not configured on this server' };
  }

  try {
    const info = await tx.sendMail({
      from: process.env.SMTP_FROM || `Kolo <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('Mailer: send failed —', err.message);
    return { sent: false, reason: err.message };
  }
};

module.exports = { sendMail, isConfigured, isVerified: () => verified };
