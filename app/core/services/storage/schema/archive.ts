// app/core/services/storage/schema/archive.ts
// =============================================================================
// TASK ARCHIVE SCHEMA
// =============================================================================
//
// Creates the task_archive table and its performance index.
//
// PURPOSE:
//   The midnight job (runMidnightJob in taskActions.ts) sweeps completed tasks
//   from the live `tasks` table into this archive table each day. This keeps
//   the main task list lean and fast while preserving a full history that the
//   user can browse via Browse → History.
//
// WHAT IS STORED:
//   A compact snapshot of each completed task — enough to display a history
//   entry. Full task objects are not preserved. Category names are denormalised
//   (copied as a text string at archival time) so history rows remain readable
//   even if the category is later renamed or deleted.
//
// WHAT IS NOT STORED:
//   dueDate, createdAt, location, autoRepeat, the `completed` flag (always
//   true in the archive), and kind (encoded as was_recurring boolean).
//
// IDEMPOTENCY:
//   CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS — safe to call
//   on every app launch without modifying existing data.
//
// Registered as step 6 in schema/index.ts (after app_settings, no
// dependencies on any other table — safe to run last).
// =============================================================================

import { db } from '../database';

/**
 * Creates the task_archive table and its completed_at index.
 * Safe to call on every app launch — IF NOT EXISTS guards are idempotent.
 */
export function initializeArchiveSchema(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS task_archive (
      -- Original task id — preserved for deduplication. INSERT OR IGNORE in
      -- archiveStorage.writeArchivedTasks relies on this PRIMARY KEY to silently
      -- skip rows that were already archived (e.g. if the midnight job is retried
      -- after a crash before the date-gate was written to app_settings).
      id            TEXT    PRIMARY KEY,

      -- Task title at the time of archival. Stored as TEXT (not a foreign key)
      -- so the history row survives task or template deletion without going orphan.
      title         TEXT    NOT NULL,

      -- Category id at archival time. NULL if the task had no category.
      -- Retained as a separate column from category_name for potential future
      -- filtering. Not a foreign key — the category may be deleted later.
      category_id   TEXT,

      -- Category name at archival time. Denormalised — copied from the categories
      -- table so history entries remain readable if the category is later renamed,
      -- recoloured, or deleted. NULL for uncategorised tasks.
      category_name TEXT,

      -- Unix ms timestamp of when the task was marked complete.
      -- Primary sort key — the history screen orders and groups by this.
      completed_at  INTEGER NOT NULL,

      -- Unix ms timestamp of when the archival job ran.
      -- Useful for debugging ("archived X days ago") and future display.
      archived_at   INTEGER NOT NULL,

      -- 1 if this was a permanent (recurring) task instance, 0 if one-off.
      -- SQLite has no BOOLEAN type — stored as INTEGER, read as boolean in TS.
      was_recurring INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Index for the history screen's date-range queries.
  // The history list always filters by completed_at (today / this week / etc.),
  // so this index covers the primary query pattern and avoids full table scans
  // as the archive grows over time.
  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_archive_completed_at
      ON task_archive (completed_at DESC);
  `);

  console.log('✅ Archive schema initialized');
}
