import { db } from '../database';

/**
 * Create the database schema for permanent tasks
 * Includes:
 *  - templates table
 *  - template_instances junction table
 *  - template_stats table (all requested stats)
 */
export function createPermanentTasksSchema(): void {
  // Templates table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS templates (
      permanentId TEXT PRIMARY KEY,
      templateTitle TEXT NOT NULL,
      isTemplate INTEGER NOT NULL DEFAULT 1,   -- 1 = true
      instanceCount INTEGER NOT NULL DEFAULT 0,
      autoRepeat TEXT,                          -- JSON string for repeat settings
      location TEXT,                            -- optional location
      createdAt INTEGER NOT NULL                -- timestamp in ms
    );
  `);

  // Junction table linking instances to templates
  db.execSync(`
    CREATE TABLE IF NOT EXISTS template_instances (
      instanceId TEXT NOT NULL,
      templateId TEXT NOT NULL,
      createdAt INTEGER NOT NULL,               -- timestamp in ms
      dueDate INTEGER,                          -- optional due date in ms
      PRIMARY KEY (instanceId, templateId),
      FOREIGN KEY (instanceId) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (templateId) REFERENCES templates(permanentId) ON DELETE CASCADE
    );
  `);

  // Stats table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS template_stats (
      templateId TEXT PRIMARY KEY,
      completionCount INTEGER NOT NULL DEFAULT 0,
      completionRate REAL NOT NULL DEFAULT 0,
      currentStreak INTEGER NOT NULL DEFAULT 0,
      maxStreak INTEGER NOT NULL DEFAULT 0,
      completionMon REAL NOT NULL DEFAULT 0,
      completionTue REAL NOT NULL DEFAULT 0,
      completionWed REAL NOT NULL DEFAULT 0,
      completionThu REAL NOT NULL DEFAULT 0,
      completionFri REAL NOT NULL DEFAULT 0,
      completionSat REAL NOT NULL DEFAULT 0,
      completionSun REAL NOT NULL DEFAULT 0,
      lastUpdatedAt INTEGER NOT NULL
    );
  `);

  // Migration: add dueDate column to existing template_instances tables
  try {
    db.execSync(`ALTER TABLE template_instances ADD COLUMN dueDate INTEGER`);
  } catch (_) {
    // Column already exists, ignore
  }

  console.log('✅ Permanent tasks schema created (templates, instances, stats)');
}
