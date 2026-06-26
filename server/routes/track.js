import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { broadcastToParent } from '../sse/stream.js';

const router = Router();

/**
 * POST /api/usage/track/start
 * Child starts using an app — creates an open session.
 */
router.post('/start', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'child') {
      return res.status(403).json({ error: 'Only child accounts can track usage' });
    }

    const { app_name, app_category } = req.body;
    if (!app_name || !app_category) {
      return res.status(400).json({ error: 'app_name and app_category are required' });
    }

    const db = getDb();
    const childId = req.user.id;

    // End any currently open session for this child
    const openSession = db.prepare(
      "SELECT id, start_time, app_name FROM usage_sessions WHERE child_id = ? AND end_time IS NULL"
    ).get(childId);

    if (openSession) {
      const now = new Date().toISOString();
      const startMs = new Date(openSession.start_time).getTime();
      const durationMin = Math.round((Date.now() - startMs) / 60000 * 100) / 100;
      db.prepare(
        "UPDATE usage_sessions SET end_time = ?, duration_minutes = ? WHERE id = ?"
      ).run(now, durationMin, openSession.id);
    }

    // Get a device for this child (or create a "Mobile Browser" one)
    let device = db.prepare(
      "SELECT id FROM devices WHERE child_id = ? AND device_type = 'mobile' LIMIT 1"
    ).get(childId);

    if (!device) {
      const deviceId = uuidv4();
      db.prepare(
        "INSERT INTO devices (id, child_id, device_name, device_type, os, is_active, last_seen) VALUES (?, ?, ?, ?, ?, 1, ?)"
      ).run(deviceId, childId, 'Mobile Phone', 'mobile', 'Android/iOS', new Date().toISOString());
      device = { id: deviceId };
    }

    // Create new session
    const sessionId = uuidv4();
    const startTime = new Date().toISOString();

    db.prepare(`
      INSERT INTO usage_sessions (id, child_id, device_id, app_category, app_name, start_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, childId, device.id, app_category, app_name, startTime);

    // Get child name for SSE broadcast
    const child = db.prepare("SELECT name FROM users WHERE id = ?").get(childId);

    // Find linked parents and broadcast
    const parents = db.prepare(
      "SELECT parent_id FROM parent_child_links WHERE child_id = ? AND parent_id IS NOT NULL"
    ).all(childId);

    parents.forEach(({ parent_id }) => {
      broadcastToParent(parent_id, 'usage_update', {
        type: 'session_start',
        session_id: sessionId,
        child_id: childId,
        child_name: child?.name || 'Child',
        app_name,
        app_category,
        category: app_category,
        start_time: startTime,
        duration_minutes: 0,
      });
    });

    res.json({
      session_id: sessionId,
      app_name,
      app_category,
      start_time: startTime,
      status: 'tracking',
    });
  } catch (err) {
    console.error('[Track] Start error:', err);
    res.status(500).json({ error: 'Failed to start tracking' });
  }
});

/**
 * POST /api/usage/track/stop
 * Child stops using an app — closes the open session.
 */
router.post('/stop', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'child') {
      return res.status(403).json({ error: 'Only child accounts can track usage' });
    }

    const db = getDb();
    const childId = req.user.id;

    const openSession = db.prepare(
      "SELECT * FROM usage_sessions WHERE child_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1"
    ).get(childId);

    if (!openSession) {
      return res.status(404).json({ error: 'No active session found' });
    }

    const now = new Date().toISOString();
    const startMs = new Date(openSession.start_time).getTime();
    const durationMin = Math.round((Date.now() - startMs) / 60000 * 100) / 100;

    db.prepare(
      "UPDATE usage_sessions SET end_time = ?, duration_minutes = ? WHERE id = ?"
    ).run(now, Math.max(durationMin, 0.1), openSession.id);

    // Get child name
    const child = db.prepare("SELECT name FROM users WHERE id = ?").get(childId);

    // Broadcast to parents
    const parents = db.prepare(
      "SELECT parent_id FROM parent_child_links WHERE child_id = ? AND parent_id IS NOT NULL"
    ).all(childId);

    parents.forEach(({ parent_id }) => {
      broadcastToParent(parent_id, 'usage_update', {
        type: 'session_end',
        session_id: openSession.id,
        child_id: childId,
        child_name: child?.name || 'Child',
        app_name: openSession.app_name,
        app_category: openSession.app_category,
        category: openSession.app_category,
        start_time: openSession.start_time,
        end_time: now,
        duration_minutes: Math.max(durationMin, 0.1),
      });
    });

    res.json({
      session_id: openSession.id,
      app_name: openSession.app_name,
      duration_minutes: Math.max(durationMin, 0.1),
      status: 'stopped',
    });
  } catch (err) {
    console.error('[Track] Stop error:', err);
    res.status(500).json({ error: 'Failed to stop tracking' });
  }
});

/**
 * GET /api/usage/track/active
 * Get the child's currently active session (if any).
 */
router.get('/active', authenticate, (req, res) => {
  try {
    const childId = req.user.role === 'child' ? req.user.id : req.query.childId;
    if (!childId) return res.json({ active: null });

    const db = getDb();
    const session = db.prepare(
      "SELECT * FROM usage_sessions WHERE child_id = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1"
    ).get(childId);

    if (!session) return res.json({ active: null });

    const elapsed = Math.round((Date.now() - new Date(session.start_time).getTime()) / 60000 * 100) / 100;

    res.json({
      active: {
        ...session,
        elapsed_minutes: elapsed,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch active session' });
  }
});

/**
 * POST /api/usage/track/heartbeat
 * Auto-tracking heartbeat: called every 60s by the child's browser.
 * Uses Page Visibility API — only fires when the page is visible.
 * Records verified "Screen Time" that the child CANNOT fake.
 */
router.post('/heartbeat', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'child') {
      return res.status(403).json({ error: 'Only child accounts can send heartbeats' });
    }

    const db = getDb();
    const childId = req.user.id;
    const now = new Date();
    const nowISO = now.toISOString();

    // Get or create mobile device
    let device = db.prepare(
      "SELECT id FROM devices WHERE child_id = ? AND device_type = 'mobile' LIMIT 1"
    ).get(childId);

    if (!device) {
      const deviceId = uuidv4();
      db.prepare(
        "INSERT INTO devices (id, child_id, device_name, device_type, os, is_active, last_seen) VALUES (?, ?, ?, ?, ?, 1, ?)"
      ).run(deviceId, childId, 'Mobile Phone', 'mobile', 'Android/iOS', nowISO);
      device = { id: deviceId };
    } else {
      // Update last_seen
      db.prepare("UPDATE devices SET last_seen = ?, is_active = 1 WHERE id = ?").run(nowISO, device.id);
    }

    // Find or create the current verified screen time session for today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    let verifiedSession = db.prepare(`
      SELECT * FROM usage_sessions
      WHERE child_id = ? AND app_name = 'Screen Time (Verified)' AND end_time IS NULL
        AND start_time >= ?
      ORDER BY start_time DESC LIMIT 1
    `).get(childId, todayStart.toISOString());

    if (!verifiedSession) {
      // Create a new verified session
      const sessionId = uuidv4();
      db.prepare(`
        INSERT INTO usage_sessions (id, child_id, device_id, app_category, app_name, start_time, duration_minutes)
        VALUES (?, ?, ?, 'screen_time', 'Screen Time (Verified)', ?, 1)
      `).run(sessionId, childId, device.id, nowISO);
      verifiedSession = { id: sessionId, start_time: nowISO, duration_minutes: 1 };
    } else {
      // Increment duration by 1 minute
      const newDuration = (verifiedSession.duration_minutes || 0) + 1;
      db.prepare(
        "UPDATE usage_sessions SET duration_minutes = ? WHERE id = ?"
      ).run(newDuration, verifiedSession.id);
      verifiedSession.duration_minutes = newDuration;
    }

    // Broadcast to linked parents
    const child = db.prepare("SELECT name FROM users WHERE id = ?").get(childId);
    const parents = db.prepare(
      "SELECT parent_id FROM parent_child_links WHERE child_id = ? AND parent_id IS NOT NULL"
    ).all(childId);

    parents.forEach(({ parent_id }) => {
      broadcastToParent(parent_id, 'heartbeat', {
        child_id: childId,
        child_name: child?.name || 'Child',
        verified_minutes: verifiedSession.duration_minutes,
        last_seen: nowISO,
        is_online: true,
      });
      // Also broadcast online status for dashboard
      broadcastToParent(parent_id, 'child_status', {
        child_id: childId,
        child_name: child?.name || 'Child',
        status: 'online',
        last_seen: nowISO,
      });
    });

    res.json({
      verified_minutes: verifiedSession.duration_minutes,
      status: 'ok',
    });
  } catch (err) {
    console.error('[Track] Heartbeat error:', err);
    res.status(500).json({ error: 'Failed to record heartbeat' });
  }
});

/**
 * GET /api/usage/track/screentime/:childId
 * Returns verified vs self-reported screen time for today.
 * Parents use this to detect if a child is misreporting.
 */
router.get('/screentime/:childId', authenticate, (req, res) => {
  try {
    const { childId } = req.params;
    const db = getDb();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    // Verified screen time (from heartbeats)
    const verified = db.prepare(`
      SELECT COALESCE(SUM(duration_minutes), 0) as total
      FROM usage_sessions
      WHERE child_id = ? AND app_name = 'Screen Time (Verified)' AND start_time >= ?
    `).get(childId, todayISO);

    // Self-reported time (from manual app tracking, excluding verified)
    const selfReported = db.prepare(`
      SELECT COALESCE(SUM(duration_minutes), 0) as total
      FROM usage_sessions
      WHERE child_id = ? AND app_name != 'Screen Time (Verified)' AND start_time >= ?
    `).get(childId, todayISO);

    // Check if child is currently online (heartbeat within last 2 minutes)
    const lastDevice = db.prepare(`
      SELECT last_seen FROM devices WHERE child_id = ? ORDER BY last_seen DESC LIMIT 1
    `).get(childId);

    const isOnline = lastDevice?.last_seen
      ? (Date.now() - new Date(lastDevice.last_seen).getTime()) < 120000
      : false;

    const verifiedMin = Math.round(verified.total);
    const reportedMin = Math.round(selfReported.total);
    const gap = verifiedMin - reportedMin;

    res.json({
      childId,
      verified_minutes: verifiedMin,
      self_reported_minutes: reportedMin,
      unreported_minutes: Math.max(gap, 0),
      is_online: isOnline,
      last_seen: lastDevice?.last_seen || null,
      trust_score: verifiedMin > 0
        ? Math.min(100, Math.round((reportedMin / verifiedMin) * 100))
        : 100,
    });
  } catch (err) {
    console.error('[Track] Screentime error:', err);
    res.status(500).json({ error: 'Failed to fetch screen time' });
  }
});

export default router;

