import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';
import { sendToUser, broadcastToParentsOf } from '../sse/stream.js';
import { sendAlertEmail } from './emailService.js';
import { sendAlertSMS } from './smsService.js';

/**
 * Check all alert thresholds and fire notifications as needed.
 * Called by the simulator after each usage update cycle.
 */
export async function checkThresholds() {
  const db = getDb();

  try {
    // Get all active alert rules with related data
    const rules = db.prepare(`
      SELECT
        ar.*,
        u_child.name as child_name,
        u_parent.email as parent_email,
        u_parent.phone as parent_phone
      FROM alert_rules ar
      JOIN users u_child ON ar.child_id = u_child.id
      JOIN users u_parent ON ar.parent_id = u_parent.id
      WHERE ar.is_active = 1
    `).all();

    if (rules.length === 0) return;

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    for (const rule of rules) {
      // Calculate today's total usage for this child
      const usage = db.prepare(`
        SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
        FROM usage_sessions
        WHERE child_id = ? AND start_time >= ? AND start_time < ?
      `).get(rule.child_id, startOfDay, endOfDay);

      const usageMinutes = Math.round(usage.total_minutes);

      // Check if usage exceeds the rule threshold
      if (usageMinutes < rule.threshold_minutes) continue;

      // Check cooldown: don't re-alert within cooldown period
      const cooldownCutoff = new Date(Date.now() - rule.cooldown_minutes * 60000).toISOString();
      const recentAlert = db.prepare(`
        SELECT id FROM alerts
        WHERE parent_id = ? AND child_id = ? AND created_at > ?
        ORDER BY created_at DESC LIMIT 1
      `).get(rule.parent_id, rule.child_id, cooldownCutoff);

      if (recentAlert) continue;

      // Get the child's screen time limit for context
      const limit = db.prepare(`
        SELECT daily_limit_minutes FROM screen_time_limits
        WHERE child_id = ? AND category IS NULL
        LIMIT 1
      `).get(rule.child_id);

      const limitMinutes = limit ? limit.daily_limit_minutes : rule.threshold_minutes;
      const percentage = limitMinutes > 0 ? Math.round((usageMinutes / limitMinutes) * 100) : 0;

      // Determine alert type based on percentage of limit
      let alertType;
      if (percentage >= 150) {
        alertType = 'critical';
      } else if (percentage >= 100) {
        alertType = 'exceeded';
      } else {
        alertType = 'warning';
      }

      // Build alert message
      let message;
      switch (alertType) {
        case 'critical':
          message = `${rule.child_name} has significantly exceeded their screen time limit with ${usageMinutes} minutes today (${percentage}% of the ${limitMinutes}-minute limit). Immediate attention recommended.`;
          break;
        case 'exceeded':
          message = `${rule.child_name} has exceeded their daily screen time limit. Current usage: ${usageMinutes} minutes (limit: ${limitMinutes} minutes).`;
          break;
        default:
          message = `${rule.child_name} is approaching their screen time limit. Current usage: ${usageMinutes} minutes of ${limitMinutes}-minute daily limit (${percentage}%).`;
      }

      // Create alert record
      const alertId = uuidv4();
      const createdAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO alerts (id, parent_id, child_id, type, message, is_read, delivered_email, delivered_sms, created_at)
        VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?)
      `).run(alertId, rule.parent_id, rule.child_id, alertType, message, createdAt);

      // Send SSE notification to parent
      const alertData = {
        id: alertId,
        type: alertType,
        child_id: rule.child_id,
        child_name: rule.child_name,
        message,
        usage_minutes: usageMinutes,
        limit_minutes: limitMinutes,
        percentage,
        created_at: createdAt,
      };

      sendToUser(rule.parent_id, 'alert', alertData);

      console.log(`[AlertEngine] ${alertType.toUpperCase()} alert for ${rule.child_name}: ${usageMinutes}/${limitMinutes} min (${percentage}%)`);

      // Send email notification if configured
      if (rule.notify_email && rule.parent_email) {
        try {
          const emailResult = await sendAlertEmail(
            rule.parent_email,
            rule.child_name,
            alertType,
            message,
            usageMinutes,
            limitMinutes
          );

          if (emailResult.sent) {
            db.prepare('UPDATE alerts SET delivered_email = 1 WHERE id = ?').run(alertId);
          }
        } catch (err) {
          console.error('[AlertEngine] Email delivery failed:', err.message);
        }
      }

      // Send SMS notification if configured
      if (rule.notify_sms && rule.parent_phone) {
        try {
          const smsResult = await sendAlertSMS(
            rule.parent_phone,
            rule.child_name,
            alertType,
            usageMinutes,
            limitMinutes
          );

          if (smsResult.sent) {
            db.prepare('UPDATE alerts SET delivered_sms = 1 WHERE id = ?').run(alertId);
          }
        } catch (err) {
          console.error('[AlertEngine] SMS delivery failed:', err.message);
        }
      }
    }
  } catch (err) {
    console.error('[AlertEngine] Error checking thresholds:', err);
  }
}

export default checkThresholds;
