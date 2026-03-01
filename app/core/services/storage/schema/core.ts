import { db } from '../database';

export function initializeCoreSchema(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      due_date INTEGER,
      category_id TEXT,
      completed_at INTEGER
      -- location TEXT
      -- repeat_pattern TEXT
      -- streak INTEGER
      -- analytics JSON
    );
  `);

  // Migration: add due_date column to existing tasks tables
  try {
    db.execSync(`ALTER TABLE tasks ADD COLUMN due_date INTEGER`);
  } catch (_) {
    // Column already exists, ignore
  }

  // Migration: add category_id column
  try {
    db.execSync(`ALTER TABLE tasks ADD COLUMN category_id TEXT`);
  } catch (_) {
    // Column already exists, ignore
  }

  // Migration: add completed_at column (for Sprint 4 stats)
  try {
    db.execSync(`ALTER TABLE tasks ADD COLUMN completed_at INTEGER`);
  } catch (_) {
    // Column already exists, ignore
  }

  // ── Indexes ──────────────────────────────────────────────────────────────
  // These indexes cover the two columns most frequently used by stats queries
  // that still hit the tasks table (e.g. categoryStorage.getCategoryStats).
  //
  //   idx_tasks_completed_at  — range queries on the completion timestamp
  //                             (e.g. "completions this week/month/year").
  //   idx_tasks_category_id   — equality filter for per-category task counts.
  //
  // Both use IF NOT EXISTS so this block is safe to run on every launch.
  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_tasks_completed_at
      ON tasks (completed_at);

    CREATE INDEX IF NOT EXISTS idx_tasks_category_id
      ON tasks (category_id);
  `);

  console.log('✅ Core tasks table created');
}
