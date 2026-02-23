// app/core/domain/taskActions.ts

import { Task, TaskFactory } from '../types/task';
import {
  handlePermanentCompletion,
  createPermanentTask,
  deletePermanentTask,
  reassignPermanentTask,
  pushPermanentTaskForward,
} from '../../features/permanentTask/utils/permanentTaskActions';

// ===== STORAGE =====
import { saveTask, getAllTasks } from '../services/storage/taskStorage';
import { deleteTask as deleteTaskDB } from '../services/storage/taskStorage';
import { logCompletion, logAutoFail } from '../services/storage/statsStorage';
import { toLocalDateString } from '../utils/statsCalculations';

/**
 * UNIVERSAL TASK ACTIONS
 * =======================
 * Central dispatcher for all task operations.
 * Routes actions to appropriate handlers based on task.kind.
 * 
 * Supports:
 * - one_off: Default tasks (handled here)
 * - permanent: Delegated to permanent feature module
 * - preset: Placeholder for future implementation
 */

// ======== CREATE TASK ========

/**
 * CREATE TASK
 * -----------
 * Universal entry point for task creation.
 * Routes to appropriate handler based on kind.
 */
export async function createTask(
  title: string, 
  kind: Task['kind'] = 'one_off',
  additionalData?: Partial<Task>
): Promise<Task> {
  switch (kind) {
    case 'permanent':
      return await createPermanentTask(title, additionalData);
    
    case 'one_off':
    default:
      const task = TaskFactory.create(title);
      const taskWithData = { ...task, ...additionalData };
      await saveTask(taskWithData);
      return taskWithData;
  }
}

// ======== COMPLETE TASK ========

/**
 * COMPLETE TASK
 * -------------
 * Universal entry point for task completion.
 * Routes to appropriate handler based on task.kind.
 */
export async function completeTask(task: Task): Promise<Task> {
  let completed: Task;

  switch (task.kind) {
    case 'permanent':
      completed = await handlePermanentCompletion(task);
      break;

    case 'preset':
      throw new Error('Preset task completion not yet implemented');

    case 'one_off':
    default:
      completed = { ...TaskFactory.complete(task), completedAt: new Date() };
      await saveTask(completed);
  }

  // Condition A: log the completion event
  logCompletion({
    taskId:        task.id,
    templateId:    task.kind === 'permanent' ? (task.metadata as any)?.permanentId ?? null : null,
    categoryId:    task.categoryId ?? null,
    taskKind:      task.kind === 'permanent' ? 'permanent' : 'one_off',
    completedAt:   completed.completedAt?.getTime() ?? Date.now(),
    scheduledDate: task.dueDate ? toLocalDateString(task.dueDate) : null,
  });

  return completed;
}

// ======== DELETE TASK ========

/**
 * DELETE TASK
 * -----------
 * Universal entry point for task deletion.
 * Routes to appropriate handler based on task.kind.
 */
export async function deleteTask(task: Task): Promise<void> {
  switch (task.kind) {
    case 'permanent':
      await deletePermanentTask(task);
      break;
    
    case 'preset':
      // Future: await deletePresetTask(task);
      throw new Error('Preset task deletion not yet implemented');
    
    case 'one_off':
    default:
      await deleteTaskDB(task.id);
      break;
  }
}

// ======== REASSIGN TASK ========

/**
 * REASSIGN TASK
 * -------------
 * Universal entry point for editing task properties (title, dueDate, etc.)
 * Routes to appropriate handler based on task.kind.
 *
 * DATA FLOW:
 *   UI (EditTaskModal) → useTasks.editTask() → THIS FUNCTION → saveTask()
 *
 * SUPPORTED UPDATES:
 *   - title: string       → Updates task name
 *   - dueDate: Date       → Updates due date
 *   - category: string    → Updates category (when schema supports it)
 *   - Any other Task field
 *
 * STORAGE:
 *   saveTask() uses INSERT OR REPLACE, so all fields are written to DB
 *   Location: app/core/services/storage/taskStorage.ts
 */
export async function reassignTask(task: Task, updates: Partial<Task>): Promise<Task> {
  switch (task.kind) {
    case 'permanent':
      return await reassignPermanentTask(task, updates);

    case 'preset':
      // Future: return await reassignPresetTask(task, updates);
      throw new Error('Preset task reassignment not yet implemented');

    case 'one_off':
    default:
      // Merge updates into existing task
      const updated = { ...task, ...updates };

      // Persist to database (INSERT OR REPLACE writes all fields including title, due_date)
      await saveTask(updated);

      return updated;
  }
}

// ======== PUSH TASK FORWARD ========

/**
 * PUSH TASK FORWARD
 * -----------------
 * Universal entry point for pushing task due date forward by N days.
 * Routes to appropriate handler based on task.kind.
 * 
 * @param task - The task to push forward
 * @param days - Number of days to push forward (default: 1)
 */
export async function pushTaskForward(task: Task, days: number = 1): Promise<Task> {
  switch (task.kind) {
    case 'permanent':
      return await pushPermanentTaskForward(task, days);
    
    case 'preset':
      // Future: return await pushPresetTaskForward(task, days);
      throw new Error('Preset task push forward not yet implemented');
    
    case 'one_off':
    default:
      const updated = { ...task };
      
      // If no due date exists, set it to today
      if (!updated.dueDate) {
        updated.dueDate = new Date();
      }
      
      // Push forward by specified days
      const newDate = new Date(updated.dueDate.getTime());
      newDate.setDate(newDate.getDate() + days);
      updated.dueDate = newDate;
      
      await saveTask(updated);
      return updated;
  }
}

// ======== UNCOMPLETE TASK ========

/**
 * UNCOMPLETE TASK
 * ---------------
 * Universal entry point for marking a task as incomplete.
 * Useful for undoing accidental completions.
 */
export async function uncompleteTask(task: Task): Promise<Task> {
  switch (task.kind) {
    case 'permanent':
      // Future: may need special handling for permanent tasks
      // For now, treat like one-off
      const uncompletedPerm = TaskFactory.uncomplete(task);
      await saveTask(uncompletedPerm);
      return uncompletedPerm;
    
    case 'preset':
      // Future: return await uncompletePresetTask(task);
      throw new Error('Preset task uncompletion not yet implemented');
    
    case 'one_off':
    default:
      const uncompleted = {
        ...TaskFactory.uncomplete(task),
        completedAt: undefined, // Clear completion time
      };
      await saveTask(uncompleted);
      return uncompleted;
  }
}

// ======== AUTO-FAIL OVERDUE TASKS ========

/**
 * AUTO-FAIL OVERDUE TASKS
 * -----------------------
 * Runs on app start (before the task list loads) to handle tasks whose
 * dueDate has passed since the last session.
 *
 * For each overdue incomplete task:
 *   1. Logs an 'auto_failed' event to completion_log (attributed to the due day).
 *   2. Pushes the task's dueDate forward by 1 day (Condition B).
 *
 * This keeps the task list accurate and the stats graph honest about missed days.
 */
export async function autoFailOverdueTasks(): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const allTasks = await getAllTasks();
  const overdue  = allTasks.filter(
    t => !t.completed && t.dueDate && t.dueDate < todayStart
  );

  for (const task of overdue) {
    logAutoFail({
      taskId:        task.id,
      templateId:    task.kind === 'permanent' ? (task.metadata as any)?.permanentId ?? null : null,
      categoryId:    task.categoryId ?? null,
      taskKind:      task.kind === 'permanent' ? 'permanent' : 'one_off',
      failedAt:      Date.now(),
      scheduledDate: toLocalDateString(task.dueDate!),
    });
    await pushTaskForward(task, 1);
  }
}

/**
 * FUTURE EXTENSION PATTERN
 * ========================
 * When adding new task types (e.g., recurring, subtasks):
 * 
 * 1. Add the kind to TaskKind type in core/types/task.ts
 * 2. Create feature module at features/{feature-name}/
 * 3. Implement handlers in features/{feature-name}/utils/{feature}TaskActions.ts
 * 4. Import handlers and add new case to switch statements above
 * 
 * Example:
 * ```typescript
 * case 'recurring':
 *   return await handleRecurringCompletion(task);
 * ```
 */