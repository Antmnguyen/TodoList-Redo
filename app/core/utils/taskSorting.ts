// app/core/utils/taskSorting.ts
// =============================================================================
// TASK SORTING UTILITIES
// =============================================================================
//
// Reusable frontend sorting functions for task arrays.
// These are pure functions that don't modify the original array.
//
// USAGE:
//   import { sortTasksByCompletion } from '../../core/utils/taskSorting';
//   const sortedTasks = sortTasksByCompletion(tasks);
//
// =============================================================================

import { Task } from '../types/task';

// -----------------------------------------------------------------------------
// sortTasksByCompletion
// -----------------------------------------------------------------------------
// Sorts tasks so uncompleted tasks appear first, completed tasks appear last.
// Within each group, maintains the original order (stable sort).
//
// PARAMETERS:
//   tasks - Array of Task objects to sort
//
// RETURNS:
//   New sorted array (does not mutate original)
//
// EXAMPLE:
//   Input:  [{ title: 'A', completed: true }, { title: 'B', completed: false }]
//   Output: [{ title: 'B', completed: false }, { title: 'A', completed: true }]
// -----------------------------------------------------------------------------
export function sortTasksByCompletion(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Uncompleted (false = 0) comes before completed (true = 1)
    return Number(a.completed) - Number(b.completed);
  });
}

// -----------------------------------------------------------------------------
// sortTasksByCompletionAndDate
// -----------------------------------------------------------------------------
// Sorts tasks by completion status first, then by due date within each group.
// Uncompleted tasks with earlier due dates appear first.
// Tasks without due dates appear after tasks with due dates.
//
// PARAMETERS:
//   tasks - Array of Task objects to sort
//
// RETURNS:
//   New sorted array (does not mutate original)
//
// SORT ORDER:
//   1. Uncompleted tasks (sorted by dueDate ascending, nulls last)
//   2. Completed tasks (sorted by dueDate ascending, nulls last)
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// sortTasksByCompletionAndCategory
// -----------------------------------------------------------------------------
// Primary sort: incomplete tasks first, completed tasks last.
// Secondary sort: within each completion group, tasks are ordered by categoryId
// so same-category items are adjacent. Tasks with no category sort last within
// their group (null/undefined categoryId treated as '\uffff' — a high codepoint
// that naturally sorts after any real UUID).
//
// Used by: AllTasksScreen, TodayScreen, UsePermanentTaskScreen
// -----------------------------------------------------------------------------
export function sortTasksByCompletionAndCategory(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Primary: incomplete before complete
    if (a.completed !== b.completed) {
      return Number(a.completed) - Number(b.completed);
    }
    // Secondary: group same-category tasks together; no-category goes last
    const aCat = a.categoryId ?? '\uffff';
    const bCat = b.categoryId ?? '\uffff';
    if (aCat < bCat) return -1;
    if (aCat > bCat) return  1;
    return 0;
  });
}

export function sortTasksByCompletionAndDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // First: sort by completion status (uncompleted first)
    if (a.completed !== b.completed) {
      return Number(a.completed) - Number(b.completed);
    }

    // Second: sort by due date (earlier dates first, nulls last)
    const aDate = a.dueDate?.getTime() ?? Infinity;
    const bDate = b.dueDate?.getTime() ?? Infinity;
    return aDate - bDate;
  });
}
