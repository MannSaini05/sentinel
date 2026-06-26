import { getDb } from '../db/schema.js';
import { sendToUser } from '../sse/stream.js';
import { sendAlertEmail } from './emailService.js';

// Track which children we've already alerted as offline
// Key: childId, Value: timestamp when we last alerted
const offlineAlerted = new Map();
const OFFLINE_THRESHOLD_MS = 180000; // 3 minutes

let monitorInterval = null;

/**
 * Start the online monitor. Checks every 60s for children who went offline.
 */
export function startOnlineMonitor() {
  console.log('[OnlineMonitor] Starting (60s interval)...');
  monitorInterval = setInterval(checkOnlineStatus, 60000);
  // Run once immediately after 5 seconds (let server initialize first)
  setTimeout(checkOnlineStatus, 5000);
}

/**
 * Stop the online monitor.
 */
export function stopOnlineMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

/**
 * Check all children's online status.
 */
function checkOnlineStatus() {
  try {
    const db = getDb();
    const now = Date.now();

    // Get all children who have devices
    const children = db.prepare(`
      SELECT DISTINCT u.id AS child_id, u.name AS child_name,
             d.last_seen, d.is_active,
             pcl.parent_id
      FROM users u
      JOIN devices d ON d.child_id = u.id
      JOIN parent_child_links pcl ON pcl.child_id = u.id
      WHERE u.role = 'child' AND pcl.parent_id IS NOT NULL
      ORDER BY d.last_seen DESC
    `).all();

    // Deduplicate by child_id (take most recent device)
    const seen = new Set();
    const uniqueChildren = children.filter(c => {
      if (seen.has(c.child_id)) return false;
      seen.add(c.child_id);
      return true;
    });

    for (const child of uniqueChildren) {
      if (!child.last_seen || !child.parent_id) continue;

      const lastSeenMs = new Date(child.last_seen).getTime();
      const timeSinceLastSeen = now - lastSeenMs;
      const isOnline = timeSinceLastSeen < OFFLINE_THRESHOLD_MS;

      if (isOnline) {
        // Child is online — clear any offline alert state
        if (offlineAlerted.has(child.child_id)) {
          offlineAlerted.delete(child.child_id);
          // Broadcast that child is back online
          sendToUser(child.parent_id, 'child_status', {
            child_id: child.child_id,
            child_name: child.child_name,
            status: 'online',
            last_seen: child.last_seen,
          });
          console.log(`[OnlineMonitor] ${child.child_name} is back ONLINE`);
        }
      } else {
        // Child is offline
        if (!offlineAlerted.has(child.child_id)) {
          offlineAlerted.set(child.child_id, now);

          // Broadcast offline status to parent
          sendToUser(child.parent_id, 'child_status', {
            child_id: child.child_id,
            child_name: child.child_name,
            status: 'offline',
            last_seen: child.last_seen,
            offline_duration_minutes: Math.round(timeSinceLastSeen / 60000),
          });

          // Send email alert to parent
          const parent = db.prepare('SELECT email, name FROM users WHERE id = ?').get(child.parent_id);
          if (parent?.email) {
            const minutesAgo = Math.round(timeSinceLastSeen / 60000);
            sendAlertEmail(
              parent.email,
              child.child_name,
              'warning',
              `${child.child_name} has gone offline. Last seen ${minutesAgo} minute(s) ago. They may have closed the Sentinel app.`,
              0,
              0
            ).catch(err => console.error('[OnlineMonitor] Email error:', err.message));
          }

          // Also mark device as inactive in DB
          db.prepare('UPDATE devices SET is_active = 0 WHERE child_id = ?').run(child.child_id);

          console.log(`[OnlineMonitor] ${child.child_name} went OFFLINE (last seen ${Math.round(timeSinceLastSeen / 60000)}m ago)`);
        }
      }
    }
  } catch (err) {
    console.error('[OnlineMonitor] Error:', err.message);
  }
}
