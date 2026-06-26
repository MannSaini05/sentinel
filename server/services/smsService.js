let twilioClient = null;
let twilioFrom = null;
let twilioConfigured = false;

/**
 * Initialize the Twilio client from environment variables.
 */
async function initTwilio() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  twilioFrom = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioFrom) {
    console.log('[SMS] Twilio credentials not configured. SMS messages will be logged to console.');
    twilioConfigured = false;
    return;
  }

  try {
    // Dynamic import to avoid crashing if twilio isn't installed
    const twilio = await import('twilio');
    twilioClient = twilio.default(accountSid, authToken);
    twilioConfigured = true;
    console.log('[SMS] Twilio client initialized successfully.');
  } catch (err) {
    console.log('[SMS] Twilio module not available. SMS messages will be logged to console.');
    twilioConfigured = false;
  }
}

/**
 * Lazily initializes the Twilio client.
 */
async function ensureInitialized() {
  if (twilioClient === null && !twilioConfigured) {
    await initTwilio();
  }
}

/**
 * Sends an alert SMS notification.
 * Gracefully degrades to console logging if Twilio is not configured.
 *
 * @param {string} to - Recipient phone number (E.164 format)
 * @param {string} childName - Name of the child
 * @param {string} alertType - 'warning' | 'exceeded' | 'critical'
 * @param {number} usageMinutes - Current usage in minutes
 * @param {number} limitMinutes - Configured limit in minutes
 */
export async function sendAlertSMS(to, childName, alertType, usageMinutes, limitMinutes) {
  await ensureInitialized();

  const messageBody = `🔔 Sentinel Alert: ${childName} has used ${usageMinutes} min of screen time (${alertType}). Limit: ${limitMinutes} min.`;

  if (!twilioConfigured || !twilioClient) {
    console.log(`[SMS] Would send to: ${to} — ${messageBody}`);
    return { sent: false, reason: 'Twilio not configured' };
  }

  try {
    const message = await twilioClient.messages.create({
      body: messageBody,
      from: twilioFrom,
      to,
    });

    console.log(`[SMS] Alert sent to ${to}: ${message.sid}`);
    return { sent: true, sid: message.sid };
  } catch (err) {
    console.error(`[SMS] Failed to send to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

export default sendAlertSMS;
