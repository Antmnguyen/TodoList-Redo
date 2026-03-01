// app/core/utils/taskFilters.ts
// =============================================================================
// TASK FILTERING UTILITIES
// =============================================================================
//
// Reusable frontend filtering functions for task arrays.
// These are pure functions that don't modify the original array.
//
// USAGE:
//   import { filterTasksDueToday } from '../../core/utils/taskFilters';
//   const todayTasks = filterTasksDueToday(tasks);
//
// =============================================================================

import { Task } from '../types/task';

// -----------------------------------------------------------------------------
// filterTasksDueToday
// -----------------------------------------------------------------------------
// Filters tasks to only include those with dueDate matching today.
// Tasks without a dueDate are excluded.
//
// PARAMETERS:
//   tasks - Array of Task objects to filter
//
// RETURNS:
//   New filtered array (does not mutate original)
//
// EXAMPLE:
//   Input:  [{ title: 'A', dueDate: today }, { title: 'B', dueDate: tomorrow }]
//   Output: [{ title: 'A', dueDate: today }]
// -----------------------------------------------------------------------------
export function filterTasksDueToday(tasks: Task[]): Task[] {
  // Get start and end of today
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000); // +24 hours

  return tasks.filter(task => {
    // Exclude tasks without a due date
    if (!task.dueDate) return false;

    // Check if dueDate falls within today
    const dueTime = task.dueDate.getTime();
    return dueTime >= startOfDay.getTime() && dueTime < endOfDay.getTime();
  });
}

// -----------------------------------------------------------------------------
// filterTasksDueTomorrow
// -----------------------------------------------------------------------------
// Filters tasks to only include those with dueDate matching tomorrow.
//
// PARAMETERS:
//   tasks - Array of Task objects to filter
//
// RETURNS:
//   New filtered array (does not mutate original)
// -----------------------------------------------------------------------------
export function filterTasksDueTomorrow(tasks: Task[]): Task[] {
  const now = new Date();
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000);

  return tasks.filter(task => {
    if (!task.dueDate) return false;
    const dueTime = task.dueDate.getTime();
    return dueTime >= startOfTomorrow.getTime() && dueTime < endOfTomorrow.getTime();
  });
}

// -----------------------------------------------------------------------------
// filterTasksOverdue
// -----------------------------------------------------------------------------
// Filters tasks that are past due (dueDate < today) and not completed.
//
// PARAMETERS:
//   tasks - Array of Task objects to filter
//
// RETURNS:
//   New filtered array of overdue tasks (does not mutate original)
// -----------------------------------------------------------------------------
export function filterTasksOverdue(tasks: Task[]): Task[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return tasks.filter(task => {
    if (!task.dueDate) return false;
    if (task.completed) return false; // Completed tasks aren't overdue
    return task.dueDate.getTime() < startOfToday.getTime();
  });
}

// -----------------------------------------------------------------------------
// filterTasksWithNoDueDate
// -----------------------------------------------------------------------------
// Filters tasks that have no due date set.
//
// PARAMETERS:
//   tasks - Array of Task objects to filter
//
// RETURNS:
//   New filtered array (does not mutate original)
// -----------------------------------------------------------------------------
export function filterTasksWithNoDueDate(tasks: Task[]): Task[] {
  return tasks.filter(task => !task.dueDate);
}

// -----------------------------------------------------------------------------
// filterTasksDueThisWeek
// -----------------------------------------------------------------------------
// Filters tasks with dueDate falling within the current week (Mon–Sun).
// Tasks without a dueDate are excluded.
// -----------------------------------------------------------------------------
export function filterTasksDueThisWeek(tasks: Task[]): Task[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, ...
  // Shift so week starts on Monday (Mon=0 ... Sun=6)
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

  return tasks.filter(task => {
    if (!task.dueDate) return false;
    const dueTime = task.dueDate.getTime();
    return dueTime >= startOfWeek.getTime() && dueTime < endOfWeek.getTime();
  });
}

// -----------------------------------------------------------------------------
// filterTasksDueThisMonth
// -----------------------------------------------------------------------------
// Filters tasks with dueDate falling within the current calendar month.
// Tasks without a dueDate are excluded.
// -----------------------------------------------------------------------------
export function filterTasksDueThisMonth(tasks: Task[]): Task[] {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return tasks.filter(task => {
    if (!task.dueDate) return false;
    const dueTime = task.dueDate.getTime();
    return dueTime >= startOfMonth.getTime() && dueTime < endOfMonth.getTime();
  });
}
