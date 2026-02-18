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

  console.log('✅ Core tasks table created');
}
