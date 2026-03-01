// app/core/services/storage/taskStorage.ts

/**
 * TASK STORAGE LAYER
 * ------------------
 * This file is the ONLY place that:
 *  - Knows the "tasks" table exists
 *  - Executes SQL queries for tasks
 *  - Maps database rows ↔ Task objects
 *
 * Everything else (hooks, UI) must treat this as an async API.
 *
 * Golden Rule:
 * UI and hooks NEVER import SQLite directly.
 */

import { db } from './database';
import { Task } from '../../types/task';
import { getAllInstanceMetaSync } from './permanentTaskStorage';


/**
 * Fetch all tasks from persistent storage.
 *
 * Responsibility:
 * - Read rows from the database
 * - Convert raw SQL rows into Task objects
 *
 * Does NOT:
 * - Cache results
 * - Sort or filter for UI
 * - Apply business rules
 */
export async function getAllTasks(): Promise<Task[]> {
  // One sync query for all permanent instance metadata — no N+1.
  // Mirrors getInstanceById() in permanentTaskStorage but batched.
  const instanceMeta = getAllInstanceMetaSync();

  // LEFT JOIN categories so we can denormalise category_color onto each task
  // in one query instead of N individual lookups at render time.
  // category_color will be NULL for tasks with no category or when the
  // referenced category has no colour set.
  const rows = db.getAllSync<{
    id:             string;
    title:          string;
    completed:      number;
    created_at:     number;
    due_date:       number | null;
    category_id:    string | null;
    completed_at:   number | null;
    category_color: string | null; // aliased from categories.color via LEFT JOIN
  }>(`
    SELECT t.*, c.color AS category_color
    FROM   tasks t
    LEFT JOIN categories c ON c.id = t.category_id
    ORDER BY t.created_at DESC
  `);

  return rows.map(row => {
    // Look up whether this task is a permanent-task instance.
    // instanceMeta is keyed by task id; presence means the task was spawned
    // from a permanent template, so we set kind = 'permanent'.
    const perm = instanceMeta.get(row.id);
    return {
      id:            row.id,
      title:         row.title,
      completed:     row.completed === 1,
      createdAt:     new Date(row.created_at),
      dueDate:       row.due_date     ? new Date(row.due_date)     : undefined,
      categoryId:    row.category_id  ?? undefined,
      // categoryColor is used by TaskItem to paint the left colour strip.
      // undefined means "no category" → strip falls back to theme.categoryStripNone.
      categoryColor: row.category_color ?? undefined,
      completedAt:   row.completed_at ? new Date(row.completed_at) : undefined,
      // Reconstruct kind + metadata from the batched template_instances lookup
      kind:     perm ? 'permanent' : undefined,
      metadata: perm ? {
        permanentId:   perm.templateId,
        templateTitle: perm.templateTitle,
        isTemplate:    false,
        autoRepeat:    perm.autoRepeat,
      } : undefined,
    };
  });
}

/**
 * Persist a single task.
 *
 * Responsibility:
 * - Insert or replace a task row
 * - Ensure task durability on disk
 *
 * Does NOT:
 * - Validate task fields
 * - Update UI state
 * - Track history or analytics
 *
 * Called as a SIDE EFFECT after in-memory state updates.
 */
export async function saveTask(task: Task): Promise<void> {
  // Use runSync for INSERT/UPDATE/DELETE
  db.runSync(
    `INSERT OR REPLACE INTO tasks (id, title, completed, created_at, due_date, category_id, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      task.id,
      task.title,
      task.completed ? 1 : 0,
      task.createdAt.getTime(),
      task.dueDate ? task.dueDate.getTime() : null,
      task.categoryId || null,
      task.completedAt ? task.completedAt.getTime() : null,
    ]
  );
}

/**
 * Update the due date of an existing task.
 * Pass null to clear the due date.
 */
export async function updateTaskDueDate(taskId: string, dueDate: Date | null): Promise<void> {
  db.runSync(
    `UPDATE tasks SET due_date = ? WHERE id = ?`,
    [dueDate ? dueDate.getTime() : null, taskId]
  );
}

/**
 * Read the due date of a single task.
 * Returns null if the task has no due date or doesn't exist.
 */
export async function getTaskDueDate(taskId: string): Promise<Date | null> {
  const rows = db.getAllSync<{ due_date: number | null }>(
    `SELECT due_date FROM tasks WHERE id = ?`,
    [taskId]
  );
  if (rows.length === 0 || rows[0].due_date === null) {
    return null;
  }
  return new Date(rows[0].due_date);
}

/**
 * Delete a task by ID.
 *
 * Responsibility:
 * - Remove task row from database
 *
 * Does NOT:
 * - Confirm with user
 * - Update UI state
 * - Handle undo
 */
export async function deleteTask(taskId: string): Promise<void> {
  db.runSync('DELETE FROM tasks WHERE id = ?', [taskId]);
}

/**
 * IMPORTANT DESIGN NOTES
 * ----------------------
 * - Functions are async for future-proofing (network sync, migrations)
 * - expo-sqlite v16 uses Sync API internally (no callbacks needed)
 * - No batching (Sprint 2)
 * - No retries (Sprint 2)
 * - No analytics (Sprint 2)
 *
 * Future features (history, sync, analytics) will hook in here
 * WITHOUT changing UI or hooks.
 */