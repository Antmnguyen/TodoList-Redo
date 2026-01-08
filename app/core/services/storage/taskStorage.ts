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

// TODO: Import database connection
// import { db } from './database';

// TODO: Import Task type
// import { Task } from '../../models/task';

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
export async function getAllTasks(): Promise</* Task[] */ any[]> {
  /**
   * Implementation will:
   * - Run SELECT * FROM tasks
   * - Map completed INTEGER → boolean
   * - Return an array of Task objects
   */

  throw new Error('Not implemented');
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
export async function saveTask(/* task: Task */): Promise<void> {
  /**
   * Implementation will:
   * - Use INSERT OR REPLACE
   * - Convert boolean → INTEGER
   * - Write immediately to SQLite
   */

  throw new Error('Not implemented');
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
export async function deleteTask(/* taskId: string */): Promise<void> {
  /**
   * Implementation will:
   * - Run DELETE FROM tasks WHERE id = ?
   */

  throw new Error('Not implemented');
}

/**
 * IMPORTANT DESIGN NOTES
 * ----------------------
 * - All functions are async, even though SQLite is local
 * - No batching (Sprint 2)
 * - No retries (Sprint 2)
 * - No analytics (Sprint 2)
 *
 * Future features (history, sync, analytics) will hook in here
 * WITHOUT changing UI or hooks.
 */
