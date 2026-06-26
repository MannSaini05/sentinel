import nodemailer from 'nodemailer';

let transporter = null;

/**
 * Initialize the email transporter from environment variables.
 */
function initTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('[Email] SMTP credentials not configured. Emails will be logged to console.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: parseInt(port, 10) || 587,
    secure: parseInt(port, 10) === 465,
    auth: { user, pass },
  });
}

/**
 * Returns the color associated with each alert type.
 */
function getAlertColor(alertType) {
  switch (alertType) {
    case 'warning': return '#f59e0b';
    case 'exceeded': return '#ef4444';
    case 'critical': return '#dc2626';
    default: return '#8b5cf6';
  }
}

/**
 * Builds a branded HTML email for an alert notification.
 */
function buildEmailHTML(childName, alertType, message, usageMinutes, limitMinutes) {
  const color = getAlertColor(alertType);
  const typeLabel = alertType.charAt(0).toUpperCase() + alertType.slice(1);
  const percentage = limitMinutes > 0 ? Math.round((usageMinutes / limitMinutes) * 100) : 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: ${color}; padding: 24px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                🛡️ Sentinel Alert
              </h1>
              <p style="margin: 4px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                Screen Time ${typeLabel} — ${childName}
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="color: #e2e8f0; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                ${message}
              </p>
              <!-- Stats -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <tr>
                  <td align="center" style="padding: 12px;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0; text-transform: uppercase;">Usage Today</p>
                    <p style="color: #f8fafc; font-size: 28px; font-weight: 700; margin: 4px 0 0;">${usageMinutes} min</p>
                  </td>
                  <td align="center" style="padding: 12px;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0; text-transform: uppercase;">Daily Limit</p>
                    <p style="color: #f8fafc; font-size: 28px; font-weight: 700; margin: 4px 0 0;">${limitMinutes} min</p>
                  </td>
                  <td align="center" style="padding: 12px;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0; text-transform: uppercase;">Used</p>
                    <p style="color: ${color}; font-size: 28px; font-weight: 700; margin: 4px 0 0;">${percentage}%</p>
                  </td>
                </tr>
              </table>
              <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 0;">
                You're receiving this because you have alert notifications enabled in Sentinel.
                Log in to your Sentinel dashboard to manage settings.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 16px 32px; border-top: 1px solid #334155;">
              <p style="color: #475569; font-size: 12px; margin: 0; text-align: center;">
                &copy; ${new Date().getFullYear()} Sentinel — Digital Well-Being Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends an alert email notification.
 * Gracefully degrades to console logging if SMTP is not configured.
 *
 * @param {string} to - Recipient email address
 * @param {string} childName - Name of the child
 * @param {string} alertType - 'warning' | 'exceeded' | 'critical'
 * @param {string} message - Alert message body
 * @param {number} usageMinutes - Current usage in minutes
 * @param {number} limitMinutes - Configured limit in minutes
 */
export async function sendAlertEmail(to, childName, alertType, message, usageMinutes, limitMinutes) {
  if (!transporter) {
    transporter = initTransporter();
  }

  if (!transporter) {
    console.log(`[Email] Would send to: ${to} — ${message}`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  try {
    const typeLabel = alertType.charAt(0).toUpperCase() + alertType.slice(1);
    const fromAddress = process.env.SMTP_FROM || 'alerts@sentinel.app';

    const info = await transporter.sendMail({
      from: `"Sentinel Alerts" <${fromAddress}>`,
      to,
      subject: `🛡️ Sentinel ${typeLabel}: ${childName}'s screen time alert`,
      html: buildEmailHTML(childName, alertType, message, usageMinutes, limitMinutes),
    });

    console.log(`[Email] Alert sent to ${to}: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * Builds a branded HTML welcome email for new user registration.
 */
function buildWelcomeHTML(name, role) {
  const isParent = role === 'parent';
  const headline = isParent
    ? 'Welcome to Sentinel, ' + name + '!'
    : 'Hey ' + name + ', welcome to Sentinel!';
  const body = isParent
    ? `You're all set to start monitoring your family's digital well-being. Here's what you can do:
        <ul style="color: #cbd5e1; line-height: 2; padding-left: 20px;">
          <li>📊 <strong>Track screen time</strong> for each of your children in real-time</li>
          <li>🔔 <strong>Set alerts</strong> when screen time limits are exceeded</li>
          <li>📈 <strong>View analytics</strong> — weekly trends, app usage, and category breakdowns</li>
          <li>👧 <strong>Link child accounts</strong> using their unique link code</li>
        </ul>
        <p style="color: #e2e8f0; font-size: 15px;">To get started, ask your child to register and share their link code with you.</p>`
    : `Your parent has invited you to join Sentinel for healthy screen time habits. Here's what to know:
        <ul style="color: #cbd5e1; line-height: 2; padding-left: 20px;">
          <li>📱 Your device usage will be monitored to help build healthy habits</li>
          <li>⏰ Your parent can set daily screen time limits</li>
          <li>🔗 Share your <strong>link code</strong> with your parent to connect your accounts</li>
        </ul>
        <p style="color: #e2e8f0; font-size: 15px;">Log in to your Sentinel dashboard to generate your link code.</p>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 12px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #06b6d4, #8b5cf6); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                🛡️ Sentinel
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                Digital Well-Being Platform
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="color: #f8fafc; font-size: 22px; margin: 0 0 16px;">${headline}</h2>
              <div style="color: #e2e8f0; font-size: 15px; line-height: 1.6;">
                ${body}
              </div>
              <div style="text-align: center; margin-top: 28px;">
                <a href="#" style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #8b5cf6); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                  Open Sentinel Dashboard
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 16px 32px; border-top: 1px solid #334155;">
              <p style="color: #475569; font-size: 12px; margin: 0; text-align: center;">
                &copy; ${new Date().getFullYear()} Sentinel — Digital Well-Being Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a welcome email to a newly registered user.
 * Gracefully degrades to console logging if SMTP is not configured.
 *
 * @param {string} to - Recipient email address
 * @param {string} name - User's display name
 * @param {string} role - 'parent' | 'child'
 */
export async function sendWelcomeEmail(to, name, role) {
  if (!transporter) {
    transporter = initTransporter();
  }

  if (!transporter) {
    console.log(`[Email] Would send welcome email to: ${to} (${role})`);
    return { sent: false, reason: 'SMTP not configured' };
  }

  try {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@sentinel.app';

    const info = await transporter.sendMail({
      from: `"Sentinel" <${fromAddress}>`,
      to,
      subject: `🛡️ Welcome to Sentinel, ${name}!`,
      html: buildWelcomeHTML(name, role),
    });

    console.log(`[Email] Welcome email sent to ${to}: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email] Failed to send welcome email to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

export default sendAlertEmail;
