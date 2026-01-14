// app/core/domain/taskActions.ts

import { Task, TaskFactory } from '../types/tasks';



// ===== STORAGE =====
import { saveTask } from '../services/storage/taskStorage';
import { deleteTask as deleteTaskDB } from '../services/storage/taskStorage';


/**
 * COMPLETE TASK
 * -----------------
 * Single entry point to complete any task.
 * - Currently only handles one-off tasks
 * - Future handlers (recurring, presets, subtasks, analytics, streaks, etc.) 
 *   can be added here without changing the hook/UI
 */
export async function completeTask(task: Task): Promise<Task> {
  // === FUTURE EXTENSION POINTS ===
  // Example pattern for future task types:
  // if (task.recurring?.enabled) return await handleRecurring(task);
  // if (task.subtasks?.length) return await handleSubtasks(task);
  // if (task.presetId) return await handlePreset(task);

  // Default: simple one-off task
  const completed = TaskFactory.complete(task);

  // Persist to database
  await saveTask(completed);

  return completed;
}

/**
 * FUTURE HANDLER TEMPLATE
 * ------------------------
 * async function handleRecurring(task: Task & { recurring: RecurringConfig }): Promise<Task[]> { ... }
 * async function handleSubtasks(task: Task & { subtasks: SubTask[] }): Promise<Task[]> { ... }
 */



// ======== Universal Actions ========

/** Delete task (works for all types) */
export async function deleteTask(task: Task): Promise<void> {
  await deleteTaskDB(task.id);
  console.log(`[Placeholder] Task "${task.title}" deleted`);
}

/** Reassign task details (title, category, date, etc.) */
export async function reassignTask(task: Task, updates: Partial<Task>): Promise<Task> {
  const updatedTask = { ...task, ...updates };
  await saveTask(updatedTask);
  console.log(`[Placeholder] Task "${task.title}" reassigned`);
  return updatedTask;
}

/** Push task forward by one day (or N days) */
export async function pushTaskForward(task: Task, days: number = 1): Promise<Task> {
  const updatedTask = { ...task };
  if (!updatedTask.dueDate) updatedTask.dueDate = new Date();
  const newDate = new Date(updatedTask.dueDate.getTime());
  newDate.setDate(newDate.getDate() + days);
  updatedTask.dueDate = newDate;
  await saveTask(updatedTask);
  console.log(`[Placeholder] Task "${task.title}" pushed forward ${days} day(s)`);
  return updatedTask;
}