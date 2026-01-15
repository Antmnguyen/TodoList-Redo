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
  // Use getAllSync for SELECT queries
  const rows = db.getAllSync<{
    id: string;
    title: string;
    completed: number;
    created_at: number;
  }>('SELECT * FROM tasks ORDER BY created_at DESC');

  // Map SQL rows to Task objects
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    completed: row.completed === 1, // INTEGER → boolean
    createdAt: new Date(row.created_at),
  }));
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
    `INSERT OR REPLACE INTO tasks (id, title, completed, created_at)
     VALUES (?, ?, ?, ?)`,
    [task.id, task.title, task.completed ? 1 : 0, task.createdAt.getTime()]
  );
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