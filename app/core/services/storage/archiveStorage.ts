// app/core/services/storage/archiveStorage.ts
// =============================================================================
// ARCHIVE STORAGE
// =============================================================================
//
// Read and write layer for the task_archive table.
//
// RESPONSIBILITIES:
//   - writeArchivedTasks()  — batch-insert archived task rows (write side,
//                             called by archivalService.archiveCompletedTasks)
//   - getArchivedTasks()    — read archived rows with optional date filter
//                             (read side, called by HistoryManagementScreen)
//
// COUPLING RULES:
//   - Only archivalService.ts calls writeArchivedTasks().
//   - Only HistoryManagementScreen (via direct import) calls getArchivedTasks().
//   - This file never imports from taskActions, hooks, or React.
//
// API STYLE:
//   Both functions are synchronous, matching the expo-sqlite sync API used
//   throughout the rest of the storage layer.
// =============================================================================

import { db } from './database';

// =============================================================================
// TYPE
// =============================================================================

/**
 * Shape of one row in the task_archive table.
 *
 * Mirrors the schema columns exactly, with SQLite column_name → camelCase
 * mapping applied. See schema/archive.ts for column-level comments.
 */
export interface ArchivedTask {
  /** Original tasks.id — primary key in the archive. */
  id:            string;
  /** Task title at the time of archival. */
  title:         string;
  /** categories.id at archival time. Undefined if task had no category. */
  categoryId?:   string;
  /** Category name at archival time (denormalised snapshot). Undefined if uncategorised. */
  categoryName?: string;
  /** Unix ms timestamp when the task was completed. Primary sort key. */
  completedAt:   number;
  /** Unix ms timestamp when the archival job ran. */
  archivedAt:    number;
  /** true if this was a permanent task instance; false if one-off. */
  wasRecurring:  boolean;
}

// =============================================================================
// WRITE
// =============================================================================

/**
 * Batch-inserts archived task rows into task_archive.
 *
 * Uses INSERT OR IGNORE so that if the archival job is retried after a crash
 * (the midnight job writes its date AFTER archival completes — see midnight-job.md),
 * rows that were already archived on the previous partial run are silently
 * skipped. No duplicates are ever created.
 *
 * Loops row-by-row rather than building a single multi-values INSERT because
 * expo-sqlite's runSync does not support array binding in a single statement.
 * The loop is fast — archival runs at most once per day on a small set of rows.
 *
 * @param tasks - Array of ArchivedTask objects to write. Empty array is a no-op.
 */
export function writeArchivedTasks(tasks: ArchivedTask[]): void {
  if (tasks.length === 0) return;

  for (const t of tasks) {
    db.runSync(
      `INSERT OR IGNORE INTO task_archive
         (id, title, category_id, category_name, completed_at, archived_at, was_recurring)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        t.title,
        t.categoryId   ?? null,  // undefined → NULL in SQLite
        t.categoryName ?? null,
        t.completedAt,
        t.archivedAt,
        t.wasRecurring ? 1 : 0,  // boolean → INTEGER for SQLite
      ],
    );
  }
}

// =============================================================================
// READ
// =============================================================================

/**
 * Reads archived tasks within an optional completed_at date range.
 *
 * The history screen calls this synchronously — no useEffect or loading state
 * needed. Filter tab changes re-call this function with new bounds and re-group
 * the result in the component.
 *
 * ## Query strategy
 *   Without bounds: full table scan ordered by completed_at DESC.
 *   With bounds: WHERE completed_at BETWEEN ? AND ? — hits idx_archive_completed_at.
 *
 * @param fromMs - Optional inclusive lower bound (Unix ms). Omit for all-time.
 * @param toMs   - Optional inclusive upper bound (Unix ms). Omit for all-time.
 * @returns Rows ordered by completed_at DESC (most recent first).
 */
export function getArchivedTasks(fromMs?: number, toMs?: number): ArchivedTask[] {
  let query  = `SELECT * FROM task_archive`;
  const params: number[] = [];

  if (fromMs !== undefined && toMs !== undefined) {
    // Both bounds provided — BETWEEN covers the exact ms range.
    query += ` WHERE completed_at BETWEEN ? AND ?`;
    params.push(fromMs, toMs);
  } else if (fromMs !== undefined) {
    // Only lower bound — used when the caller wants "everything after X".
    query += ` WHERE completed_at >= ?`;
    params.push(fromMs);
  }
  // If neither bound is provided, the full table is returned (all-time tab).

  query += ` ORDER BY completed_at DESC`;

  const rows = db.getAllSync<{
    id:            string;
    title:         string;
    category_id:   string | null;
    category_name: string | null;
    completed_at:  number;
    archived_at:   number;
    was_recurring: number;  // INTEGER in SQLite — convert to boolean on read
  }>(query, params);

  // Map raw SQLite column names to camelCase ArchivedTask interface.
  return rows.map(r => ({
    id:           r.id,
    title:        r.title,
    categoryId:   r.category_id   ?? undefined,  // NULL → undefined
    categoryName: r.category_name ?? undefined,
    completedAt:  r.completed_at,
    archivedAt:   r.archived_at,
    wasRecurring: r.was_recurring === 1,          // INTEGER → boolean
  }));
}
