import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'sentinel.db');

let db = null;

/**
 * Returns the singleton database instance, creating tables if they don't exist.
 */
export function getDb() {
  if (db) return db;

  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables(db);

  return db;
}

/**
 * Creates all application tables if they don't already exist.
 */
function createTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('parent', 'child')),
      phone TEXT,
      avatar_color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      device_type TEXT NOT NULL,
      os TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_seen TEXT,
      FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usage_sessions (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      app_category TEXT NOT NULL,
      app_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes REAL,
      FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS screen_time_limits (
      id TEXT PRIMARY KEY,
      child_id TEXT NOT NULL,
      daily_limit_minutes INTEGER NOT NULL,
      per_app_limit_minutes INTEGER,
      category TEXT,
      set_by_parent_id TEXT NOT NULL,
      FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (set_by_parent_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      child_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('warning', 'exceeded', 'critical')),
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      delivered_email INTEGER NOT NULL DEFAULT 0,
      delivered_sms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      parent_id TEXT NOT NULL,
      child_id TEXT NOT NULL,
      threshold_minutes INTEGER NOT NULL,
      cooldown_minutes INTEGER NOT NULL DEFAULT 30,
      is_active INTEGER NOT NULL DEFAULT 1,
      notify_email INTEGER NOT NULL DEFAULT 1,
      notify_sms INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_usage_sessions_child_id ON usage_sessions(child_id);
    CREATE INDEX IF NOT EXISTS idx_usage_sessions_start_time ON usage_sessions(start_time);
    CREATE INDEX IF NOT EXISTS idx_usage_sessions_child_start ON usage_sessions(child_id, start_time);
    CREATE INDEX IF NOT EXISTS idx_alerts_parent_id ON alerts(parent_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
    CREATE INDEX IF NOT EXISTS idx_devices_child_id ON devices(child_id);
    CREATE INDEX IF NOT EXISTS idx_alert_rules_child_id ON alert_rules(child_id);
  `);

  // ── Migrate parent_child_links table ──────────────────────
  // The original schema had parent_id as NOT NULL, but the link code
  // workflow requires parent_id to be NULL until a parent claims it.
  // SQLite doesn't support ALTER COLUMN, so we recreate the table.
  _migrateParentChildLinks(database);
}

/**
 * Ensures parent_child_links table allows NULL parent_id.
 */
function _migrateParentChildLinks(database) {
  // Check if table exists
  const tableInfo = database.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='parent_child_links'"
  ).get();

  if (!tableInfo) {
    // Table doesn't exist — create with correct schema
    database.exec(`
      CREATE TABLE parent_child_links (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        child_id TEXT NOT NULL,
        link_code TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_parent_child_links_parent ON parent_child_links(parent_id);
      CREATE INDEX IF NOT EXISTS idx_parent_child_links_child ON parent_child_links(child_id);
    `);
    return;
  }

  // Check if parent_id is currently NOT NULL
  if (tableInfo.sql.includes('parent_id TEXT NOT NULL')) {
    console.log('[DB] Migrating parent_child_links: making parent_id nullable...');
    database.exec(`
      CREATE TABLE parent_child_links_new (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        child_id TEXT NOT NULL,
        link_code TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (child_id) REFERENCES users(id) ON DELETE CASCADE
      );

      INSERT INTO parent_child_links_new (id, parent_id, child_id, link_code, created_at)
        SELECT id, parent_id, child_id, link_code, created_at FROM parent_child_links;

      DROP TABLE parent_child_links;
      ALTER TABLE parent_child_links_new RENAME TO parent_child_links;

      CREATE INDEX IF NOT EXISTS idx_parent_child_links_parent ON parent_child_links(parent_id);
      CREATE INDEX IF NOT EXISTS idx_parent_child_links_child ON parent_child_links(child_id);
    `);
    console.log('[DB] Migration complete.');
  }
}

/**
 * Closes the database connection gracefully.
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDb;
