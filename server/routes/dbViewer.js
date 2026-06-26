import { Router } from 'express';
import { getDb } from '../db/schema.js';

const router = Router();

/**
 * GET /api/db/tables
 * Returns all table names, schemas, row counts, and data.
 */
router.get('/tables', (req, res) => {
  try {
    const db = getDb();

    // Get all table names
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();

    const result = tables.map(({ name }) => {
      // Get column info
      const columns = db.prepare(`PRAGMA table_info('${name}')`).all();

      // Get row count
      const countRow = db.prepare(`SELECT COUNT(*) as count FROM "${name}"`).get();

      // Get all rows (limit 500 for safety)
      const rows = db.prepare(`SELECT * FROM "${name}" LIMIT 500`).all();

      // Get CREATE TABLE statement
      const createStmt = db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?"
      ).get(name);

      return {
        name,
        columns: columns.map(c => ({
          name: c.name,
          type: c.type,
          notNull: !!c.notnull,
          primaryKey: !!c.pk,
          defaultValue: c.dflt_value,
        })),
        rowCount: countRow.count,
        rows,
        createStatement: createStmt?.sql || '',
      };
    });

    res.json({ tables: result, totalTables: result.length });
  } catch (err) {
    console.error('[DB Viewer] Error:', err);
    res.status(500).json({ error: 'Failed to fetch database info' });
  }
});

export default router;
