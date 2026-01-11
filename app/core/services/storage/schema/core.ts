import { db } from '../database';

export function initializeCoreSchema(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
      -- location TEXT
      -- repeat_pattern TEXT
      -- streak INTEGER
      -- analytics JSON
    );
  `);

  console.log('✅ Core tasks table created');
}
