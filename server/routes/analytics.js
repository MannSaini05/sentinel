import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * Verify the user can access this child's analytics.
 */
function verifyChildAccess(req, res, next) {
  const { childId } = req.params;
  const db = getDb();

  if (req.user.role === 'child') {
    if (req.user.id !== childId) {
      return res.status(403).json({ error: 'Children can only view their own analytics' });
    }
    return next();
  }

  const link = db.prepare(
    'SELECT id FROM parent_child_links WHERE parent_id = ? AND child_id = ?'
  ).get(req.user.id, childId);

  if (!link) {
    return res.status(403).json({ error: 'You are not linked to this child' });
  }

  next();
}

/**
 * Helper: get the start-of-day ISO string for a date.
 */
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Helper: get the end-of-day ISO string for a date.
 */
function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * GET /api/analytics/daily/:childId
 * Today's stats: total_minutes, session_count, top_app, top_category,
 * and comparison to yesterday.
 */
router.get('/daily/:childId', authenticate, verifyChildAccess, (req, res) => {
  try {
    const { childId } = req.params;
    const db = getDb();

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    const yesterdayStart = startOfDay(yesterday);
    const yesterdayEnd = endOfDay(yesterday);

    // Today's stats
    const todayStats = db.prepare(`
      SELECT
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COUNT(*) as session_count
      FROM usage_sessions
      WHERE child_id = ? AND start_time >= ? AND start_time <= ?
    `).get(childId, todayStart, todayEnd);

    // Yesterday's stats for comparison
    const yesterdayStats = db.prepare(`
      SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
      FROM usage_sessions
      WHERE child_id = ? AND start_time >= ? AND start_time <= ?
    `).get(childId, yesterdayStart, yesterdayEnd);

    // Top app today
    const topApp = db.prepare(`
      SELECT app_name, SUM(duration_minutes) as total
      FROM usage_sessions
      WHERE child_id = ? AND start_time >= ? AND start_time <= ?
      GROUP BY app_name
      ORDER BY total DESC
      LIMIT 1
    `).get(childId, todayStart, todayEnd);

    // Top category today
    const topCategory = db.prepare(`
      SELECT app_category, SUM(duration_minutes) as total
      FROM usage_sessions
      WHERE child_id = ? AND start_time >= ? AND start_time <= ?
      GROUP BY app_category
      ORDER BY total DESC
      LIMIT 1
    `).get(childId, todayStart, todayEnd);

    const todayTotal = Math.round((todayStats.total_minutes || 0) * 100) / 100;
    const yesterdayTotal = Math.round((yesterdayStats.total_minutes || 0) * 100) / 100;
    const difference = Math.round((todayTotal - yesterdayTotal) * 100) / 100;
    const percentChange = yesterdayTotal > 0
      ? Math.round((difference / yesterdayTotal) * 10000) / 100
      : todayTotal > 0 ? 100 : 0;

    res.json({
      childId,
      date: today.toISOString().split('T')[0],
      total_minutes: todayTotal,
      session_count: todayStats.session_count,
      top_app: topApp ? { name: topApp.app_name, minutes: Math.round(topApp.total * 100) / 100 } : null,
      top_category: topCategory ? { name: topCategory.app_category, minutes: Math.round(topCategory.total * 100) / 100 } : null,
      comparison: {
        yesterday_minutes: yesterdayTotal,
        difference,
        percent_change: percentChange,
        direction: difference > 5 ? 'up' : difference < -5 ? 'down' : 'stable',
      },
    });
  } catch (err) {
    console.error('[Analytics] Daily error:', err);
    res.status(500).json({ error: 'Failed to fetch daily analytics' });
  }
});

/**
 * GET /api/analytics/weekly/:childId
 * Last 7 days: daily totals, avg, trend, busiest day, category breakdown.
 */
router.get('/weekly/:childId', authenticate, verifyChildAccess, (req, res) => {
  try {
    const { childId } = req.params;
    const db = getDb();

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Daily totals for last 7 days
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
    `).all(childId, startDate.toISOString());

    // Fill in missing days
    const dailyArray = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = dailyTotals.find(dt => dt.date === dateStr);
      dailyArray.push({
        date: dateStr,
        day_name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        total_minutes: existing ? Math.round(existing.total_minutes * 100) / 100 : 0,
        session_count: existing ? existing.session_count : 0,
      });
    }

    // Calculate stats
    const totalMinutes = dailyArray.reduce((sum, d) => sum + d.total_minutes, 0);
    const avgDaily = Math.round((totalMinutes / 7) * 100) / 100;
    const busiestDay = dailyArray.reduce((max, d) => d.total_minutes > max.total_minutes ? d : max, dailyArray[0]);

    // Trend: compare first half vs second half of the week
    const firstHalf = dailyArray.slice(0, 3).reduce((s, d) => s + d.total_minutes, 0) / 3;
    const secondHalf = dailyArray.slice(4).reduce((s, d) => s + d.total_minutes, 0) / 3;
    const trendDiff = secondHalf - firstHalf;
    const trend = trendDiff > 10 ? 'up' : trendDiff < -10 ? 'down' : 'stable';

    // Category breakdown
    const categories = db.prepare(`
      SELECT
        app_category,
        SUM(duration_minutes) as total_minutes,
        COUNT(*) as session_count
      FROM usage_sessions
      WHERE child_id = ?
        AND start_time >= ?
      GROUP BY app_category
      ORDER BY total_minutes DESC
    `).all(childId, startDate.toISOString());

    const categoryBreakdown = categories.map(c => ({
      category: c.app_category,
      total_minutes: Math.round(c.total_minutes * 100) / 100,
      session_count: c.session_count,
      percentage: totalMinutes > 0 ? Math.round((c.total_minutes / totalMinutes) * 10000) / 100 : 0,
    }));

    res.json({
      childId,
      period: { start: startDate.toISOString().split('T')[0], end: endDate.toISOString().split('T')[0] },
      daily_totals: dailyArray,
      avg_daily: avgDaily,
      total_minutes: Math.round(totalMinutes * 100) / 100,
      trend,
      busiest_day: {
        date: busiestDay.date,
        day_name: busiestDay.day_name,
        total_minutes: busiestDay.total_minutes,
      },
      category_breakdown: categoryBreakdown,
    });
  } catch (err) {
    console.error('[Analytics] Weekly error:', err);
    res.status(500).json({ error: 'Failed to fetch weekly analytics' });
  }
});

/**
 * GET /api/analytics/categories/:childId?days=7
 * Usage minutes broken down by category for the specified period.
 */
router.get('/categories/:childId', authenticate, verifyChildAccess, (req, res) => {
  try {
    const { childId } = req.params;
    const days = parseInt(req.query.days, 10) || 7;
    const db = getDb();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const categories = db.prepare(`
      SELECT
        app_category,
        SUM(duration_minutes) as total_minutes,
        COUNT(*) as session_count,
        GROUP_CONCAT(DISTINCT app_name) as apps
      FROM usage_sessions
      WHERE child_id = ?
        AND start_time >= ?
      GROUP BY app_category
      ORDER BY total_minutes DESC
    `).all(childId, startDate.toISOString());

    const totalMinutes = categories.reduce((sum, c) => sum + c.total_minutes, 0);

    const breakdown = categories.map(c => ({
      category: c.app_category,
      total_minutes: Math.round(c.total_minutes * 100) / 100,
      session_count: c.session_count,
      percentage: totalMinutes > 0 ? Math.round((c.total_minutes / totalMinutes) * 10000) / 100 : 0,
      apps: c.apps ? c.apps.split(',') : [],
    }));

    res.json({
      childId,
      days,
      total_minutes: Math.round(totalMinutes * 100) / 100,
      categories: breakdown,
    });
  } catch (err) {
    console.error('[Analytics] Categories error:', err);
    res.status(500).json({ error: 'Failed to fetch category analytics' });
  }
});

/**
 * GET /api/analytics/comparison
 * Parent only: compare all linked children's usage for today and 7-day averages.
 */
router.get('/comparison', authenticate, (req, res) => {
  try {
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can view comparison analytics' });
    }

    const db = getDb();

    // Get all linked children
    const children = db.prepare(`
      SELECT u.id, u.name, u.avatar_color
      FROM parent_child_links pcl
      JOIN users u ON pcl.child_id = u.id
      WHERE pcl.parent_id = ?
    `).all(req.user.id);

    if (children.length === 0) {
      return res.json({ children: [], message: 'No linked children found' });
    }

    const today = new Date();
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const comparison = children.map(child => {
      // Today's usage
      const todayUsage = db.prepare(`
        SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes, COUNT(*) as session_count
        FROM usage_sessions
        WHERE child_id = ? AND start_time >= ? AND start_time <= ?
      `).get(child.id, todayStart, todayEnd);

      // 7-day total
      const weekUsage = db.prepare(`
        SELECT COALESCE(SUM(duration_minutes), 0) as total_minutes
        FROM usage_sessions
        WHERE child_id = ? AND start_time >= ?
      `).get(child.id, weekAgo.toISOString());

      // Screen time limit
      const limit = db.prepare(`
        SELECT daily_limit_minutes FROM screen_time_limits WHERE child_id = ? LIMIT 1
      `).get(child.id);

      // Top category today
      const topCategory = db.prepare(`
        SELECT app_category, SUM(duration_minutes) as total
        FROM usage_sessions
        WHERE child_id = ? AND start_time >= ? AND start_time <= ?
        GROUP BY app_category ORDER BY total DESC LIMIT 1
      `).get(child.id, todayStart, todayEnd);

      const todayMinutes = Math.round((todayUsage.total_minutes || 0) * 100) / 100;
      const weekAvg = Math.round(((weekUsage.total_minutes || 0) / 7) * 100) / 100;
      const dailyLimit = limit ? limit.daily_limit_minutes : null;

      return {
        id: child.id,
        name: child.name,
        avatar_color: child.avatar_color,
        today: {
          total_minutes: todayMinutes,
          session_count: todayUsage.session_count,
          limit_minutes: dailyLimit,
          limit_percentage: dailyLimit ? Math.round((todayMinutes / dailyLimit) * 10000) / 100 : null,
          top_category: topCategory ? topCategory.app_category : null,
        },
        weekly: {
          avg_daily: weekAvg,
          total_minutes: Math.round((weekUsage.total_minutes || 0) * 100) / 100,
        },
      };
    });

    res.json({ children: comparison });
  } catch (err) {
    console.error('[Analytics] Comparison error:', err);
    res.status(500).json({ error: 'Failed to fetch comparison analytics' });
  }
});

export default router;
