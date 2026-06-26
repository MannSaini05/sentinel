import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';
import { broadcastToParentsOf } from '../sse/stream.js';
import { checkThresholds } from './alertEngine.js';

let simulatorInterval = null;

/**
 * App categories with their apps and time-of-day weights.
 * Weights: [morning(7-12), afternoon(12-17), evening(17-22)]
 */
const APP_DATA = {
  'Social Media': {
    apps: ['TikTok', 'Instagram', 'Snapchat'],
    weights: [0.05, 0.25, 0.35],
    durationRange: [5, 30],
  },
  'Gaming': {
    apps: ['Roblox', 'Minecraft', 'Fortnite'],
    weights: [0.05, 0.15, 0.35],
    durationRange: [10, 45],
  },
  'Education': {
    apps: ['Khan Academy', 'Duolingo', 'Google Classroom'],
    weights: [0.40, 0.15, 0.05],
    durationRange: [10, 35],
  },
  'Entertainment': {
    apps: ['YouTube', 'Netflix', 'Disney+'],
    weights: [0.10, 0.20, 0.30],
    durationRange: [10, 40],
  },
  'Productivity': {
    apps: ['Google Docs', 'Notion'],
    weights: [0.25, 0.15, 0.05],
    durationRange: [5, 25],
  },
  'Communication': {
    apps: ['WhatsApp', 'iMessage'],
    weights: [0.25, 0.10, 0.05],
    durationRange: [5, 15],
  },
};

const CATEGORIES = Object.keys(APP_DATA);

/**
 * Returns 0 (morning), 1 (afternoon), or 2 (evening) based on the current hour.
 */
function getTimeSlot() {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 12) return 0;  // Morning
  if (hour >= 12 && hour < 17) return 1; // Afternoon
  return 2;                                // Evening
}

/**
 * Picks a random category weighted by the current time of day.
 */
function pickWeightedCategory() {
  const slot = getTimeSlot();
  const weights = CATEGORIES.map(cat => APP_DATA[cat].weights[slot]);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let random = Math.random() * totalWeight;
  for (let i = 0; i < CATEGORIES.length; i++) {
    random -= weights[i];
    if (random <= 0) return CATEGORIES[i];
  }

  return CATEGORIES[CATEGORIES.length - 1];
}

/**
 * Picks a random app from the given category.
 */
function pickRandomApp(category) {
  const apps = APP_DATA[category].apps;
  return apps[Math.floor(Math.random() * apps.length)];
}

/**
 * Generates a random session duration for the given category.
 */
function generateDuration(category) {
  const [min, max] = APP_DATA[category].durationRange;
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

/**
 * Starts the usage simulator.
 * Every 30 seconds, it may create new usage sessions for each child
 * and broadcasts updates via SSE.
 */
export function startSimulator() {
  if (simulatorInterval) {
    console.log('[Simulator] Already running.');
    return;
  }

  console.log('[Simulator] Starting usage simulator (30s interval)...');

  simulatorInterval = setInterval(async () => {
    try {
      const db = getDb();

      // Get all children who have linked parents
      const children = db.prepare(`
        SELECT DISTINCT u.id, u.name
        FROM users u
        JOIN parent_child_links pcl ON u.id = pcl.child_id
        WHERE u.role = 'child'
      `).all();

      if (children.length === 0) return;

      for (const child of children) {
        // 70% chance to create a new session
        if (Math.random() > 0.70) continue;

        // Get a random device for this child
        const devices = db.prepare(
          'SELECT * FROM devices WHERE child_id = ? AND is_active = 1'
        ).all(child.id);

        if (devices.length === 0) continue;

        const device = devices[Math.floor(Math.random() * devices.length)];
        const category = pickWeightedCategory();
        const appName = pickRandomApp(category);
        const duration = generateDuration(category);

        // Create a completed session (start_time in the past, end_time now)
        const now = new Date();
        const startTime = new Date(now.getTime() - duration * 60000);
        const sessionId = uuidv4();

        db.prepare(`
          INSERT INTO usage_sessions (id, child_id, device_id, app_category, app_name, start_time, end_time, duration_minutes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          sessionId,
          child.id,
          device.id,
          category,
          appName,
          startTime.toISOString(),
          now.toISOString(),
          duration
        );

        // Update device last_seen
        db.prepare('UPDATE devices SET last_seen = ? WHERE id = ?').run(now.toISOString(), device.id);

        // Calculate today's total for the broadcast
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const todayTotal = db.prepare(`
          SELECT COALESCE(SUM(duration_minutes), 0) as total
          FROM usage_sessions
          WHERE child_id = ? AND start_time >= ?
        `).get(child.id, todayStart);

        // Broadcast usage update to all parents of this child
        broadcastToParentsOf(child.id, 'usage_update', {
          child_id: child.id,
          child_name: child.name,
          session: {
            id: sessionId,
            app_name: appName,
            app_category: category,
            device_name: device.device_name,
            duration_minutes: duration,
            start_time: startTime.toISOString(),
            end_time: now.toISOString(),
          },
          today_total_minutes: Math.round(todayTotal.total * 100) / 100,
          timestamp: now.toISOString(),
        });
      }

      // After all usage updates, check alert thresholds
      await checkThresholds();
    } catch (err) {
      console.error('[Simulator] Error:', err);
    }
  }, 30000);
}

/**
 * Stops the usage simulator.
 */
export function stopSimulator() {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
    console.log('[Simulator] Stopped.');
  }
}

export default { startSimulator, stopSimulator };
