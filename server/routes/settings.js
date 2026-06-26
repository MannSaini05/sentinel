import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/settings/limits/:childId
 * Get screen time limits for a child.
 */
router.get('/limits/:childId', authenticate, (req, res) => {
  try {
    const { childId } = req.params;
    const db = getDb();

    // Verify access
    if (req.user.role === 'child' && req.user.id !== childId) {
      return res.status(403).json({ error: 'Children can only view their own limits' });
    }

    if (req.user.role === 'parent') {
      const link = db.prepare(
        'SELECT id FROM parent_child_links WHERE parent_id = ? AND child_id = ?'
      ).get(req.user.id, childId);
      if (!link) {
        return res.status(403).json({ error: 'You are not linked to this child' });
      }
    }

    const limits = db.prepare(`
      SELECT stl.*, u.name as set_by_name
      FROM screen_time_limits stl
      LEFT JOIN users u ON stl.set_by_parent_id = u.id
      WHERE stl.child_id = ?
      ORDER BY stl.category NULLS FIRST
    `).all(childId);

    res.json({ childId, limits });
  } catch (err) {
    console.error('[Settings] Get limits error:', err);
    res.status(500).json({ error: 'Failed to fetch screen time limits' });
  }
});

/**
 * POST /api/settings/limits
 * Create or update a screen time limit for a child.
 */
router.post('/limits', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can set screen time limits' });
    }

    const { childId, dailyLimitMinutes, perAppLimitMinutes, category } = req.body;

    if (!childId || !dailyLimitMinutes) {
      return res.status(400).json({ error: 'childId and dailyLimitMinutes are required' });
    }

    const db = getDb();

    // Verify parent-child link
    const link = db.prepare(
      'SELECT id FROM parent_child_links WHERE parent_id = ? AND child_id = ?'
    ).get(req.user.id, childId);

    if (!link) {
      return res.status(403).json({ error: 'You are not linked to this child' });
    }

    // Check for existing limit with same category
    const existing = db.prepare(`
      SELECT id FROM screen_time_limits
      WHERE child_id = ? AND (category = ? OR (category IS NULL AND ? IS NULL))
    `).get(childId, category || null, category || null);

    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE screen_time_limits SET
          daily_limit_minutes = ?,
          per_app_limit_minutes = ?,
          set_by_parent_id = ?
        WHERE id = ?
      `).run(dailyLimitMinutes, perAppLimitMinutes || null, req.user.id, existing.id);

      const updated = db.prepare('SELECT * FROM screen_time_limits WHERE id = ?').get(existing.id);
      return res.json({ limit: updated, updated: true });
    }

    // Create new
    const id = uuidv4();
    db.prepare(`
      INSERT INTO screen_time_limits (id, child_id, daily_limit_minutes, per_app_limit_minutes, category, set_by_parent_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, childId, dailyLimitMinutes, perAppLimitMinutes || null, category || null, req.user.id);

    const newLimit = db.prepare('SELECT * FROM screen_time_limits WHERE id = ?').get(id);

    res.status(201).json({ limit: newLimit, updated: false });
  } catch (err) {
    console.error('[Settings] Create limit error:', err);
    res.status(500).json({ error: 'Failed to create screen time limit' });
  }
});

/**
 * PUT /api/settings/limits/:id
 * Update a specific screen time limit.
 */
router.put('/limits/:id', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can update screen time limits' });
    }

    const { id } = req.params;
    const db = getDb();

    const existing = db.prepare(
      'SELECT * FROM screen_time_limits WHERE id = ? AND set_by_parent_id = ?'
    ).get(id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: 'Screen time limit not found' });
    }

    const { dailyLimitMinutes, perAppLimitMinutes, category } = req.body;

    db.prepare(`
      UPDATE screen_time_limits SET
        daily_limit_minutes = COALESCE(?, daily_limit_minutes),
        per_app_limit_minutes = COALESCE(?, per_app_limit_minutes),
        category = COALESCE(?, category)
      WHERE id = ?
    `).run(
      dailyLimitMinutes ?? null,
      perAppLimitMinutes ?? null,
      category ?? null,
      id
    );

    const updated = db.prepare('SELECT * FROM screen_time_limits WHERE id = ?').get(id);

    res.json({ limit: updated });
  } catch (err) {
    console.error('[Settings] Update limit error:', err);
    res.status(500).json({ error: 'Failed to update screen time limit' });
  }
});

/**
 * DELETE /api/settings/limits/:id
 * Delete a specific screen time limit.
 */
router.delete('/limits/:id', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can delete screen time limits' });
    }

    const { id } = req.params;
    const db = getDb();

    const result = db.prepare(
      'DELETE FROM screen_time_limits WHERE id = ? AND set_by_parent_id = ?'
    ).run(id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Screen time limit not found' });
    }

    res.json({ message: 'Screen time limit deleted' });
  } catch (err) {
    console.error('[Settings] Delete limit error:', err);
    res.status(500).json({ error: 'Failed to delete screen time limit' });
  }
});

/**
 * GET /api/settings/children
 * Parent only: list all linked children with their devices and limits.
 */
router.get('/children', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can list children' });
    }

    const db = getDb();

    const children = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.avatar_color, u.created_at
      FROM parent_child_links pcl
      JOIN users u ON pcl.child_id = u.id
      WHERE pcl.parent_id = ?
      ORDER BY u.name
    `).all(req.user.id);

    const result = children.map(child => {
      const devices = db.prepare(
        'SELECT * FROM devices WHERE child_id = ? ORDER BY device_name'
      ).all(child.id);

      const limits = db.prepare(
        'SELECT * FROM screen_time_limits WHERE child_id = ?'
      ).all(child.id);

      return {
        ...child,
        devices,
        limits,
      };
    });

    res.json({ children: result });
  } catch (err) {
    console.error('[Settings] Children list error:', err);
    res.status(500).json({ error: 'Failed to fetch children' });
  }
});

export default router;
