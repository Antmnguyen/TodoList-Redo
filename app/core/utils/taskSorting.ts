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
