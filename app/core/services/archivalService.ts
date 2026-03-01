// app/core/services/archivalService.ts
// =============================================================================
// ARCHIVAL SERVICE
// =============================================================================
//
// Implements job #3 of the midnight job: sweeping completed tasks out of the
// live `tasks` table and into the compressed `task_archive` table.
//
// CALLED BY:
//   taskActions.runMidnightJob() — after autoFailOverdueTasks (job 1) and
//   autoScheduleRecurringTasks (job 2) have both completed.
//
// WHAT THIS DOES (in order):
//   1. Fetch all completed rows from `tasks`, LEFT JOIN categories for names,
//      LEFT JOIN template_instances to detect recurring instances.
//   2. Build ArchivedTask objects (compressed snapshots).
//   3. Write to task_archive using INSERT OR IGNORE (idempotent on retry).
//   4. Delete the originals from `tasks`.
//   5. Delete completed instance rows from `template_instances`.
//      NOTE: instanceCount on the parent template is NOT decremented — it
//      is a historical count of instances ever created, used as the denominator
//      for completionRate. Decrementing on archival would retroactively change
//      the historical rate, which is wrong.
//
// WHAT THIS DOES NOT TOUCH:
//   - completion_log   — append-only, permanent. Never modified by archival.
//   - template_stats   — not read or written by the active stats system.
//   - templates        — definitions are never archived.
//   - categories       — lookup table, never modified here.
//
// STAT SAFETY:
//   All active stats queries (streaks, counts, graphs) read from completion_log,
//   which this function never touches. Stats are unaffected by archival.
//   See docs/sprint-5/archival_system/plan.md § Stat Safety for full analysis.
//
// IDEMPOTENCY:
//   INSERT OR IGNORE in step 3 skips rows already in task_archive.
//   DELETE on already-deleted rows in tasks / template_instances is a safe no-op.
//   The function can be retried after a crash without any risk of duplication.
// =============================================================================

import { db } from './storage/database';
import { writeArchivedTasks, ArchivedTask } from './storage/archiveStorage';

/**
 * ARCHIVE COMPLETED TASKS
 * -----------------------
 * Moves all completed tasks out of the live `tasks` table into `task_archive`.
 * Called as job #3 by runMidnightJob() in taskActions.ts.
 *
 * The function is async to match the other midnight job functions and to allow
 * the event loop to remain responsive, but all DB calls are synchronous (SQLite
 * sync API). The async wrapper adds no overhead.
 */
export async function archiveCompletedTasks(): Promise<void> {
  // Timestamp used for the archived_at column on every row written this run.
  // All rows archived in a single job run share the same archived_at value,
  // which makes it easy to see which rows were swept in the same batch.
  const archivedAt = Date.now();

  // ── Step 1: Fetch completed tasks with category names and recurring flag ───
  //
  // LEFT JOIN categories so uncategorised tasks (category_id IS NULL) are
  // still included — they get null for category_name.
  //
  // LEFT JOIN template_instances to detect whether each task is a permanent
  // instance. A non-null ti.instanceId means the task was created from a
  // template. We use the instanceId column (not templateId) so the join
  // works even on archived instances where the template might be gone.
  //
  // WHERE conditions:
  //   completed = 1          — only move completed tasks, never pending ones
  //   completed_at IS NOT NULL — defensive guard: a task with no completion
  //                              timestamp cannot be properly archived (the
  //                              history screen sorts by this field)
  const rows = db.getAllSync<{
    id:            string;
    title:         string;
    category_id:   string | null;
    category_name: string | null;
    completed_at:  number;
    is_recurring:  number;  // 1 if template_instances has a row for this task
  }>(
    `SELECT
       t.id,
       t.title,
       t.category_id,
       c.name        AS category_name,
       t.completed_at,
       CASE WHEN ti.instanceId IS NOT NULL THEN 1 ELSE 0 END AS is_recurring
     FROM tasks t
     LEFT JOIN categories        c  ON c.id         = t.category_id
     LEFT JOIN template_instances ti ON ti.instanceId = t.id
     WHERE t.completed = 1
       AND t.completed_at IS NOT NULL`,
    [],
  );

  // Nothing completed since the last archival run — exit early without writing
  // or deleting anything.
  if (rows.length === 0) return;

  // ── Step 2: Build compressed ArchivedTask objects ─────────────────────────
  //
  // Only the fields needed for history display are kept. Everything else
  // (dueDate, createdAt, location, autoRepeat, etc.) is discarded — the
  // archive is intentionally compact.
  const toArchive: ArchivedTask[] = rows.map(r => ({
    id:           r.id,
    title:        r.title,
    categoryId:   r.category_id   ?? undefined,
    categoryName: r.category_name ?? undefined,
    completedAt:  r.completed_at,
    archivedAt,
    wasRecurring: r.is_recurring === 1,
  }));

  // ── Step 3: Write to task_archive (INSERT OR IGNORE — safe on retry) ──────
  //
  // writeArchivedTasks loops through rows individually because expo-sqlite's
  // runSync does not support multi-values INSERT with array binding.
  // INSERT OR IGNORE means rows already written in a previous partial run
  // (e.g. if the app crashed after step 3 but before step 5) are skipped.
  writeArchivedTasks(toArchive);

  // ── Step 4: Delete completed tasks from the live tasks table ──────────────
  //
  // Build a single DELETE ... WHERE id IN (...) rather than one DELETE per
  // row. SQLite parameterised queries don't support array binding directly,
  // so we construct the placeholders string ('?,?,?,...') from the id array.
  const ids          = toArchive.map(t => t.id);
  const placeholders = ids.map(() => '?').join(',');

  db.runSync(
    `DELETE FROM tasks WHERE id IN (${placeholders})`,
    ids,
  );

  // ── Step 5: Delete completed instance rows from template_instances ─────────
  //
  // Only for rows identified as recurring in step 1. One-off tasks have no
  // template_instances row, so no action is needed for them.
  //
  // We use a direct DELETE rather than going through deletePermanentInstance()
  // because that function decrements instanceCount on the parent template —
  // which we deliberately do NOT want here (see module docblock above).
  //
  // Note: template_instances has a FOREIGN KEY (instanceId) REFERENCES tasks(id)
  // ON DELETE CASCADE. If SQLite foreign key enforcement is ON, step 4 already
  // cascaded the delete here. The DELETE below is a safe no-op in that case.
  // If enforcement is OFF (SQLite default), this step explicitly cleans up.
  const recurringIds = toArchive.filter(t => t.wasRecurring).map(t => t.id);
  if (recurringIds.length > 0) {
    const recurringPlaceholders = recurringIds.map(() => '?').join(',');
    db.runSync(
      `DELETE FROM template_instances WHERE instanceId IN (${recurringPlaceholders})`,
      recurringIds,
    );
  }

  console.log(`✅ Archived ${toArchive.length} completed task(s)`);
}
