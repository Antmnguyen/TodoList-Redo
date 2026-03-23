// app/core/utils/taskFilters.ts
// =============================================================================
// TASK FILTERING UTILITIES
// =============================================================================
//
// Reusable frontend filtering functions for task arrays.
// These are pure functions that don't modify the original array.
//
// REFERENCE DATE PARAMETER
// ------------------------
// filterTasksDueToday, filterTasksDueThisWeek, and filterTasksDueThisMonth
// each accept an optional `referenceDate` parameter.  When omitted they
// default to the current date so all existing call-sites are unaffected.
// Passing a referenceDate shifts the window anchor to that day, enabling
// the "Select Date" tab on TodayScreen to re-anchor all filters.
//
// USAGE:
//   import { filterTasksDueToday } from '../../core/utils/taskFilters';
//   const todayTasks    = filterTasksDueToday(tasks);             // uses today
//   const refDayTasks   = filterTasksDueToday(tasks, refDate);    // uses refDate
//
// =============================================================================

import { Task } from '../types/task';

// -----------------------------------------------------------------------------
// filterTasksDueToday
// -----------------------------------------------------------------------------
// Filters tasks to only include those with dueDate matching the reference day.
// Tasks without a dueDate are excluded.
//
// PARAMETERS:
//   tasks         - Array of Task objects to filter.
//   referenceDate - Anchor day.  Defaults to the current date when omitted.
//
// RETURNS:
//   New filtered array (does not mutate original).
//
// EXAMPLE:
//   Input:  [{ title: 'A', dueDate: today }, { title: 'B', dueDate: tomorrow }]
//   Output: [{ title: 'A', dueDate: today }]
// -----------------------------------------------------------------------------
export function filterTasksDueToday(tasks: Task[], referenceDate?: Date): Task[] {
  // Use the provided reference date or fall back to right now.
  const ref = referenceDate ?? new Date();

  // Compute midnight-to-midnight window for the reference day.
  const startOfDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const endOfDay   = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000); // +24 h

  return tasks.filter(task => {
    if (!task.dueDate) return false;
    const dueTime = task.dueDate.getTime();
    return dueTime >= startOfDay.getTime() && dueTime < endOfDay.getTime();
  });
}

// -----------------------------------------------------------------------------
// filterTasksDueTomorrow
// -----------------------------------------------------------------------------
// Filters tasks to only include those with dueDate matching tomorrow.
// (Not reference-date-aware — always relative to the real current date.)
//
// PARAMETERS:
//   tasks - Array of Task objects to filter.
//
// RETURNS:
//   New filtered array (does not mutate original).
// -----------------------------------------------------------------------------
export function filterTasksDueTomorrow(tasks: Task[]): Task[] {
  const now = new Date();
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const endOfTomorrow   = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000);

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
// (Not reference-date-aware — always relative to the real current date.)
//
// PARAMETERS:
//   tasks - Array of Task objects to filter.
//
// RETURNS:
//   New filtered array of overdue tasks (does not mutate original).
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
//   tasks - Array of Task objects to filter.
//
// RETURNS:
//   New filtered array (does not mutate original).
// -----------------------------------------------------------------------------
export function filterTasksWithNoDueDate(tasks: Task[]): Task[] {
  return tasks.filter(task => !task.dueDate);
}

// -----------------------------------------------------------------------------
// filterTasksDueThisWeek
// -----------------------------------------------------------------------------
// Filters tasks with dueDate falling within the ISO week (Mon–Sun) that
// contains referenceDate.  Tasks without a dueDate are excluded.
//
// PARAMETERS:
//   tasks         - Array of Task objects to filter.
//   referenceDate - Anchor day.  Defaults to the current date when omitted.
// -----------------------------------------------------------------------------
export function filterTasksDueThisWeek(tasks: Task[], referenceDate?: Date): Task[] {
  const ref = referenceDate ?? new Date();

  const dayOfWeek = ref.getDay(); // 0 = Sun, 1 = Mon, …
  // Shift so the week starts on Monday (Mon=0 … Sun=6).
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const startOfWeek = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - daysSinceMonday);
  const endOfWeek   = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

  return tasks.filter(task => {
    if (!task.dueDate) return false;
    const dueTime = task.dueDate.getTime();
    return dueTime >= startOfWeek.getTime() && dueTime < endOfWeek.getTime();
  });
}

// -----------------------------------------------------------------------------
// filterTasksDueThisMonth
// -----------------------------------------------------------------------------
// Filters tasks with dueDate falling within the calendar month that contains
// referenceDate.  Tasks without a dueDate are excluded.
//
// PARAMETERS:
//   tasks         - Array of Task objects to filter.
//   referenceDate - Anchor day.  Defaults to the current date when omitted.
// -----------------------------------------------------------------------------
export function filterTasksDueThisMonth(tasks: Task[], referenceDate?: Date): Task[] {
  const ref = referenceDate ?? new Date();

  const startOfMonth = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const endOfMonth   = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);

  return tasks.filter(task => {
    if (!task.dueDate) return false;
    const dueTime = task.dueDate.getTime();
    return dueTime >= startOfMonth.getTime() && dueTime < endOfMonth.getTime();
  });
}
