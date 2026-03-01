/**
 * @file completions.ts
 * @description Schema initializer for the `completion_log` table.
 *
 * The `completion_log` is an **append-only event log** — one row is written
 * every time any task is marked complete. Rows are never deleted or updated;
 * they are a permanent historical record. This decouples stats from the
 * mutable `tasks` table, so:
 *   - Deleting a task does NOT erase its completion history.
 *   - Toggling a task back to incomplete does NOT remove the log entry.
 *   - Calendar and streak queries have a fast, indexed date column to hit
 *     instead of scanning the full `tasks` table with strftime().
 *
 * This file is responsible for:
 *   1. Creating the `completion_log` table (idempotent via IF NOT EXISTS).
 *   2. Creating all indexes needed by the stats read queries.
 *   3. Running a one-time backfill from existing completed tasks on the
 *      first launch after this schema is introduced.
 *
 * Initialization order (see schema/index.ts):
 *   Step 1 — initializeCoreSchema()          (tasks)
 *   Step 2 — createPermanentTasksSchema()     (templates / instances / stats)
 *   Step 3 — initializeCategoriesSchema()     (categories + seed defaults)
 *   Step 4 — initializeCompletionsSchema()    ← this file
 *
 * @module schema/completions
 */

import { db } from '../database';
import { toLocalDateString } from '../../../utils/statsCalculations';

// ─────────────────────────────────────────────────────────────────────────────
// Public initializer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the `completion_log` table, its indexes, and runs the one-time
 * historical backfill if the table is empty.
 *
 * Safe to call on every app launch — all DDL uses `IF NOT EXISTS` guards
 * and the backfill exits early if rows are already present.
 */
export function initializeCompletionsSchema(): void {
  createCompletionLogTable();
  createCompletionLogIndexes();
  addOutcomeMigration();
  backfillCompletionLog();
  console.log('✅ completion_log table and indexes initialized');
}

// ─────────────────────────────────────────────────────────────────────────────
// Table DDL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates the `completion_log` table if it does not already exist.
 *
 * Column notes:
 *
 *   id             — Synthetic PK in the format `clog_<timestampMs>_<4-char random>`.
 *                    Constructed at write time to avoid an auto-increment column.
 *
 *   task_id        — The `tasks.id` of the task that was completed. Kept for
 *                    informational / debugging purposes. The referenced task row
 *                    may be deleted later — that is intentional and does NOT
 *                    cascade to this log (no FK enforcement).
 *
 *   template_id    — `templates.permanentId` for permanent task instances;
 *                    NULL for one-off tasks. Snapshot at completion time.
 *
 *   category_id    — `categories.id` at time of completion (snapshot). If the
 *                    task's category changes later this value is not updated —
 *                    it preserves the historical category.
 *
 *   task_kind      — Either 'permanent' or 'one_off'. Denormalized for fast
 *                    GROUP BY without a join.
 *
 *   completed_at   — Unix millisecond timestamp of the completion event.
 *                    Kept for sub-day ordering / debugging.
 *
 *   completed_date — 'YYYY-MM-DD' string in device-local time derived from
 *                    `completed_at`. This is the **primary grouping key** for
 *                    all calendar-based queries. Storing as TEXT lets SQLite
 *                    use BETWEEN comparisons and GROUP BY without strftime().
 *
 *   scheduled_date — 'YYYY-MM-DD' of the task's due_date at completion time,
 *                    or NULL if the task had no due_date. This is the
 *                    denominator for % mode: a row contributes to "scheduled"
 *                    only when scheduled_date = completed_date (task done on
 *                    the day it was due). Rows with NULL scheduled_date count
 *                    in the numerator but not the denominator.
 */
function createCompletionLogTable(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS completion_log (
      id             TEXT    PRIMARY KEY,
      task_id        TEXT    NOT NULL,
      template_id    TEXT,
      category_id    TEXT,
      task_kind      TEXT    NOT NULL,
      -- outcome: 'completed' | 'auto_failed'
      outcome        TEXT    NOT NULL DEFAULT 'completed',
      completed_at   INTEGER NOT NULL,
      completed_date TEXT    NOT NULL,
      scheduled_date TEXT
    );
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates all indexes needed by the stats read queries.
 *
 * Index strategy:
 *
 *   idx_clog_date
 *     — Single-column index on completed_date.
 *     — Covers all unfiltered date-range queries (overall stats, TimeRangeCountsCard).
 *     — Also used for the streak date scan.
 *
 *   idx_clog_template
 *     — Composite (template_id, completed_date).
 *     — Covers all PermanentDetailScreen queries, which always filter by
 *       template_id first then narrow by date range.
 *
 *   idx_clog_category
 *     — Composite (category_id, completed_date).
 *     — Covers all CategoryDetailScreen queries.
 *
 *   idx_clog_kind_date
 *     — Composite (task_kind, completed_date).
 *     — Covers TaskTypeBreakdownCard and perm/one-off segment queries when no
 *       template or category filter is applied.
 *
 * All created with IF NOT EXISTS — safe to call repeatedly.
 */
function createCompletionLogIndexes(): void {
  db.execSync(`
    CREATE INDEX IF NOT EXISTS idx_clog_date
      ON completion_log (completed_date);

    CREATE INDEX IF NOT EXISTS idx_clog_template
      ON completion_log (template_id, completed_date);

    CREATE INDEX IF NOT EXISTS idx_clog_category
      ON completion_log (category_id, completed_date);

    CREATE INDEX IF NOT EXISTS idx_clog_kind_date
      ON completion_log (task_kind, completed_date);
  `);
}

// ─────────────────────────────────────────────────────────────────────────────
// Migrations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds the `outcome` column to existing `completion_log` tables that were
 * created before it was part of the DDL.
 *
 * Safe to call on every launch — the catch swallows the "duplicate column"
 * error if the column already exists.
 */
function addOutcomeMigration(): void {
  try {
    db.execSync(
      `ALTER TABLE completion_log ADD COLUMN outcome TEXT NOT NULL DEFAULT 'completed'`
    );
  } catch (_) { /* column already exists — no-op */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// One-time historical backfill
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Populates `completion_log` from existing completed rows in `tasks`.
 *
 * This runs exactly once — on the first app launch after `completion_log` is
 * introduced. On all subsequent launches the table already has rows and the
 * function returns immediately (idempotent guard at the top).
 *
 * Backfill strategy:
 *   - Selects every task row where `completed = 1 AND completed_at IS NOT NULL`.
 *   - Looks up `template_instances` to determine whether the task is a
 *     permanent instance (and to retrieve its templateId).
 *   - Inserts one row per completed task using INSERT OR IGNORE so duplicate
 *     runs cannot create double rows.
 *   - Sets `scheduled_date = NULL` for all backfilled rows because the
 *     original due_date at time of completion is no longer reliably available
 *     (it may have been changed since). These rows contribute to completion
 *     counts but not to the scheduled denominator in % mode — this is
 *     documented and acceptable for historical data.
 *
 * After this backfill runs, `logCompletion()` in statsStorage.ts takes over
 * for all new completions going forward.
 */
function backfillCompletionLog(): void {
  // ── Idempotent guard ───────────────────────────────────────────────────────
  // If the table already has any rows, the backfill has already run.
  // This covers both "first launch after upgrade" and "app restarted" cases.
  const { n } = db.getAllSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM completion_log`
  )[0];

  if (n > 0) return;

  // ── Fetch all historically completed tasks ─────────────────────────────────
  // Only tasks with a recorded completion timestamp can be backfilled.
  // Tasks completed before the completed_at column was added have NULL here
  // and are excluded — their history is unrecoverable.
  const completedTasks = db.getAllSync<{
    id: string;
    category_id: string | null;
    completed_at: number;
  }>(
    `SELECT id, category_id, completed_at
     FROM tasks
     WHERE completed = 1 AND completed_at IS NOT NULL`
  );

  if (completedTasks.length === 0) return;

  // ── Insert one log row per completed task ──────────────────────────────────
  for (const task of completedTasks) {
    // Convert the Unix ms timestamp to a local 'YYYY-MM-DD' date string.
    // This is the same conversion used by logCompletion() going forward,
    // ensuring calendar queries return consistent results across old and new rows.
    const completedDate = toLocalDateString(new Date(task.completed_at));

    // Determine whether this task is a permanent instance by checking the
    // junction table. Most tasks will return no rows (one-off tasks).
    const instances = db.getAllSync<{ templateId: string }>(
      `SELECT templateId FROM template_instances WHERE instanceId = ?`,
      [task.id]
    );
    const isPermanent = instances.length > 0;

    // Build a unique PK for this log row. The timestamp component guarantees
    // temporal ordering; the random suffix handles the (rare) case of multiple
    // completions in the same millisecond.
    const logId = `clog_${task.completed_at}_${Math.random().toString(36).slice(2, 6)}`;

    db.runSync(
      `INSERT OR IGNORE INTO completion_log
         (id, task_id, template_id, category_id, task_kind, outcome,
          completed_at, completed_date, scheduled_date)
       VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, NULL)`,
      [
        logId,
        task.id,
        isPermanent ? instances[0].templateId : null,
        task.category_id ?? null,
        isPermanent ? 'permanent' : 'one_off',
        task.completed_at,
        completedDate,
      ]
    );
  }

  console.log(`✅ Backfilled ${completedTasks.length} rows into completion_log`);
}
