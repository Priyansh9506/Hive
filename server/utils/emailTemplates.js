// Inline styles only: email clients strip <style> blocks unpredictably.
const escapeHtml = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Invite email (PRD §10.3): names the space, gives one clear action, and
 * repeats the code as a fallback for when the link gets mangled.
 */
const inviteEmail = ({ spaceName, inviterName, joinCode, joinUrl, message }) => {
  const space = escapeHtml(spaceName);
  const inviter = escapeHtml(inviterName);
  const code = escapeHtml(joinCode);
  const url = escapeHtml(joinUrl);
  const note = message ? escapeHtml(message) : '';

  const subject = `${inviterName} invited you to join "${spaceName}" on Kolo`;

  const text = [
    `You have been invited to join: ${spaceName}`,
    '',
    `${inviterName} invited you to collaborate on Kolo.`,
    note ? `\nTheir message: "${message}"\n` : '',
    `Join the study space: ${joinUrl}`,
    '',
    `Invite Code: ${joinCode}`,
    '',
    'Kolo — shared notes, discussion and resources for study groups.',
  ].join('\n');

  const html = `
<div style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

    <div style="padding:20px 28px;background:#4f46e5;">
      <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">Kolo</span>
    </div>

    <div style="padding:28px;">
      <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">You have been invited to join</p>
      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#111827;font-weight:700;">${space}</h1>

      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
        <strong>${inviter}</strong> invited you to collaborate on shared notes, discussion and resources.
      </p>

      ${note
      ? `<div style="margin:0 0 20px;padding:12px 14px;background:#f9fafb;border-left:3px solid #4f46e5;border-radius:4px;">
             <p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563;font-style:italic;">&ldquo;${note}&rdquo;</p>
           </div>`
      : ''}

      <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
        Join Study Space &rarr;
      </a>

      <div style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e5e7eb;">
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Or enter this invite code in Kolo:</p>
        <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.12em;color:#111827;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;">${code}</p>
      </div>
    </div>

    <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
        If you were not expecting this invitation you can safely ignore this email.
      </p>
    </div>

  </div>
</div>`.trim();

  return { subject, text, html };
};

module.exports = { inviteEmail, escapeHtml };
