import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * Middleware: verify the requesting user has access to the child's data.
 * Parents can view their linked children; children can view their own data.
 */
function verifyChildAccess(req, res, next) {
  const { childId } = req.params;
  const db = getDb();

  if (req.user.role === 'child') {
    if (req.user.id !== childId) {
      return res.status(403).json({ error: 'Children can only view their own usage data' });
    }
    return next();
  }

  // Parent: check they're linked to this child
  const link = db.prepare(
    'SELECT id FROM parent_child_links WHERE parent_id = ? AND child_id = ?'
  ).get(req.user.id, childId);

  if (!link) {
    return res.status(403).json({ error: 'You are not linked to this child' });
  }

  next();
}

/**
 * GET /api/usage/today/:childId
 * Today's sessions grouped by hour, total minutes, and active session if any.
 */
router.get('/today/:childId', authenticate, verifyChildAccess, (req, res) => {
  try {
    const { childId } = req.params;
    const db = getDb();

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    // Get all sessions for today
    const sessions = db.prepare(`
      SELECT us.*, d.device_name, d.device_type
      FROM usage_sessions us
      LEFT JOIN devices d ON us.device_id = d.id
      WHERE us.child_id = ?
        AND us.start_time >= ?
        AND us.start_time < ?
      ORDER BY us.start_time ASC
    `).all(childId, startOfDay, endOfDay);

    // Group by hour
    const hourlyBreakdown = {};
    for (let h = 0; h < 24; h++) {
      hourlyBreakdown[h] = { hour: h, sessions: [], total_minutes: 0 };
    }

    let totalMinutes = 0;
    let activeSession = null;

    for (const session of sessions) {
      const hour = new Date(session.start_time).getHours();
      hourlyBreakdown[hour].sessions.push(session);
      hourlyBreakdown[hour].total_minutes += session.duration_minutes || 0;
      totalMinutes += session.duration_minutes || 0;

      if (!session.end_time) {
        activeSession = session;
      }
    }

    res.json({
      childId,
      date: startOfDay,
      total_minutes: Math.round(totalMinutes * 100) / 100,
      session_count: sessions.length,
      hourly_breakdown: Object.values(hourlyBreakdown).filter(h => h.sessions.length > 0),
      active_session: activeSession,
    });
  } catch (err) {
    console.error('[Usage] Today error:', err);
    res.status(500).json({ error: 'Failed to fetch today\'s usage data' });
  }
});

/**
 * GET /api/usage/history/:childId?days=7
 * Daily totals for the specified range.
 */
router.get('/history/:childId', authenticate, verifyChildAccess, (req, res) => {
  try {
    const { childId } = req.params;
    const days = parseInt(req.query.days, 10) || 7;
    const db = getDb();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startISO = startDate.toISOString();

    const dailyTotals = db.prepare(`
      SELECT
        DATE(start_time) as date,
        SUM(duration_minutes) as total_minutes,
        COUNT(*) as session_count
      FROM usage_sessions
      WHERE child_id = ?
        AND start_time >= ?
      GROUP BY DATE(start_time)
      ORDER BY date ASC
    `).all(childId, startISO);

    // Fill in missing days with 0
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = dailyTotals.find(dt => dt.date === dateStr);
      result.push({
        date: dateStr,
        total_minutes: existing ? Math.round(existing.total_minutes * 100) / 100 : 0,
        session_count: existing ? existing.session_count : 0,
      });
    }

    res.json({
      childId,
      days,
      history: result,
    });
  } catch (err) {
    console.error('[Usage] History error:', err);
    res.status(500).json({ error: 'Failed to fetch usage history' });
  }
});

/**
 * GET /api/usage/live/:childId
 * Current active session (end_time IS NULL).
 */
router.get('/live/:childId', authenticate, verifyChildAccess, (req, res) => {
  try {
    const { childId } = req.params;
    const db = getDb();

    const activeSession = db.prepare(`
      SELECT us.*, d.device_name, d.device_type
      FROM usage_sessions us
      LEFT JOIN devices d ON us.device_id = d.id
      WHERE us.child_id = ?
        AND us.end_time IS NULL
      ORDER BY us.start_time DESC
      LIMIT 1
    `).get(childId);

    if (!activeSession) {
      return res.json({ active: false, session: null });
    }

    // Calculate live duration
    const startTime = new Date(activeSession.start_time);
    const now = new Date();
    const liveMinutes = (now - startTime) / 60000;

    res.json({
      active: true,
      session: {
        ...activeSession,
        live_duration_minutes: Math.round(liveMinutes * 100) / 100,
      },
    });
  } catch (err) {
    console.error('[Usage] Live error:', err);
    res.status(500).json({ error: 'Failed to fetch live session' });
  }
});

/**
 * GET /api/usage/sessions/:childId?date=YYYY-MM-DD
 * All sessions for a specific date.
 */
router.get('/sessions/:childId', authenticate, verifyChildAccess, (req, res) => {
  try {
    const { childId } = req.params;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const db = getDb();

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const sessions = db.prepare(`
      SELECT us.*, d.device_name, d.device_type
      FROM usage_sessions us
      LEFT JOIN devices d ON us.device_id = d.id
      WHERE us.child_id = ?
        AND DATE(us.start_time) = ?
      ORDER BY us.start_time ASC
    `).all(childId, date);

    const totalMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

    res.json({
      childId,
      date,
      total_minutes: Math.round(totalMinutes * 100) / 100,
      session_count: sessions.length,
      sessions,
    });
  } catch (err) {
    console.error('[Usage] Sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

export default router;
