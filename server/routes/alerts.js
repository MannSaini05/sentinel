import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/alerts
 * List alerts for the current parent, most recent first.
 * Query: ?unread=true to filter only unread alerts.
 */
router.get('/', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can view alerts' });
    }

    const db = getDb();
    const unreadOnly = req.query.unread === 'true';

    let query = `
      SELECT a.*, u.name as child_name, u.avatar_color as child_avatar_color
      FROM alerts a
      JOIN users u ON a.child_id = u.id
      WHERE a.parent_id = ?
    `;
    const params = [req.user.id];

    if (unreadOnly) {
      query += ' AND a.is_read = 0';
    }

    query += ' ORDER BY a.created_at DESC LIMIT 100';

    const alerts = db.prepare(query).all(...params);

    res.json({ alerts });
  } catch (err) {
    console.error('[Alerts] List error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * GET /api/alerts/count
 * Return count of unread alerts for the current parent.
 */
router.get('/count', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can view alert counts' });
    }

    const db = getDb();
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM alerts WHERE parent_id = ? AND is_read = 0'
    ).get(req.user.id);

    res.json({ unread_count: result.count });
  } catch (err) {
    console.error('[Alerts] Count error:', err);
    res.status(500).json({ error: 'Failed to fetch alert count' });
  }
});

/**
 * GET /api/alerts/rules
 * List alert rules for the current parent.
 */
router.get('/rules', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can view alert rules' });
    }

    const db = getDb();
    const rules = db.prepare(`
      SELECT ar.*, u.name as child_name
      FROM alert_rules ar
      JOIN users u ON ar.child_id = u.id
      WHERE ar.parent_id = ?
      ORDER BY ar.child_id
    `).all(req.user.id);

    res.json({ rules });
  } catch (err) {
    console.error('[Alerts] Rules list error:', err);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
});

/**
 * POST /api/alerts/rules
 * Create a new alert rule.
 */
router.post('/rules', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can create alert rules' });
    }

    const { childId, thresholdMinutes, cooldownMinutes, notifyEmail, notifySms } = req.body;

    if (!childId || !thresholdMinutes) {
      return res.status(400).json({ error: 'childId and thresholdMinutes are required' });
    }

    const db = getDb();

    // Verify parent-child link
    const link = db.prepare(
      'SELECT id FROM parent_child_links WHERE parent_id = ? AND child_id = ?'
    ).get(req.user.id, childId);

    if (!link) {
      return res.status(403).json({ error: 'You are not linked to this child' });
    }

    const id = uuidv4();

    db.prepare(`
      INSERT INTO alert_rules (id, parent_id, child_id, threshold_minutes, cooldown_minutes, is_active, notify_email, notify_sms)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      req.user.id,
      childId,
      thresholdMinutes,
      cooldownMinutes || 30,
      notifyEmail !== false ? 1 : 0,
      notifySms === true ? 1 : 0
    );

    const rule = db.prepare('SELECT * FROM alert_rules WHERE id = ?').get(id);

    res.status(201).json({ rule });
  } catch (err) {
    console.error('[Alerts] Create rule error:', err);
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
});

/**
 * PUT /api/alerts/rules/:id
 * Update an alert rule.
 */
router.put('/rules/:id', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can update alert rules' });
    }

    const { id } = req.params;
    const db = getDb();

    const existing = db.prepare(
      'SELECT * FROM alert_rules WHERE id = ? AND parent_id = ?'
    ).get(id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    const {
      thresholdMinutes,
      cooldownMinutes,
      isActive,
      notifyEmail,
      notifySms,
    } = req.body;

    db.prepare(`
      UPDATE alert_rules SET
        threshold_minutes = COALESCE(?, threshold_minutes),
        cooldown_minutes = COALESCE(?, cooldown_minutes),
        is_active = COALESCE(?, is_active),
        notify_email = COALESCE(?, notify_email),
        notify_sms = COALESCE(?, notify_sms)
      WHERE id = ?
    `).run(
      thresholdMinutes ?? null,
      cooldownMinutes ?? null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      notifyEmail !== undefined ? (notifyEmail ? 1 : 0) : null,
      notifySms !== undefined ? (notifySms ? 1 : 0) : null,
      id
    );

    const updated = db.prepare('SELECT * FROM alert_rules WHERE id = ?').get(id);

    res.json({ rule: updated });
  } catch (err) {
    console.error('[Alerts] Update rule error:', err);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
});

/**
 * PUT /api/alerts/:id/read
 * Mark a specific alert as read.
 */
router.put('/:id/read', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const result = db.prepare(
      'UPDATE alerts SET is_read = 1 WHERE id = ? AND parent_id = ?'
    ).run(id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ message: 'Alert marked as read' });
  } catch (err) {
    console.error('[Alerts] Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

/**
 * PUT /api/alerts/read-all
 * Mark all alerts as read for the current parent.
 */
router.put('/read-all', authenticate, (req, res) => {
  try {
    const db = getDb();

    const result = db.prepare(
      'UPDATE alerts SET is_read = 1 WHERE parent_id = ? AND is_read = 0'
    ).run(req.user.id);

    res.json({ message: 'All alerts marked as read', count: result.changes });
  } catch (err) {
    console.error('[Alerts] Read all error:', err);
    res.status(500).json({ error: 'Failed to mark all alerts as read' });
  }
});

export default router;
