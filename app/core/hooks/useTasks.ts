import { useState } from 'react';
import { Task } from '../types/tasks';

/**
 * useTasks Hook
 * 
 * Custom React hook to manage the state of tasks in the app.
 * Handles basic CRUD operations for Sprint 1:
 * - Add task
 * - Toggle completion
 * - Delete task
 * 
 * Designed to be **minimal and decoupled**, so future features can be added without breaking.
 * Examples of future expansions:
 * - Integrate with SQLite / AsyncStorage
 * - Handle recurring tasks
 * - Update streaks or analytics
 * - Link tasks to calendar or location
 */
export function useTasks(initialTasks: Task[] = []) {
  // State to hold all tasks
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  /**
   * addTask
   * Adds a new task to the state.
   * Accepts a Task object (with required fields: id, title, completed, createdAt)
   * Future logic could:
   * - Auto-generate IDs here instead of using TaskFactory
   * - Save to database / AsyncStorage
   */
  function addTask(task: Task) {
    setTasks(prev => [...prev, task]);
  }

  /**
   * toggleTaskCompletion
   * Marks a task as completed/uncompleted.
   * Accepts a task ID, finds the task, and toggles its `completed` property.
   * Returns a **new array** to ensure immutable state updates.
   * Future logic could:
   * - Update streaks, completion history
   * - Trigger analytics or notifications
   */
  function toggleTaskCompletion(taskId: string) {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  }

  /**
   * deleteTask
   * Removes a task from the list.
   * Accepts a task ID.
   * Returns a **new array** to maintain immutability.
   * Future logic could:
   * - Archive deleted tasks for undo
   * - Remove related subtasks or analytics
   */
  function deleteTask(taskId: string) {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  }

  /**
   * updateTask
   * Updates a task with new values.
   * Accepts a task ID and partial updates.
   * Returns a **new array** with the updated task.
   * Future logic could:
   * - Persist changes to database
   * - Trigger notifications or analytics
   */
  function updateTask(taskId: string, updates: Partial<Task>) {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  }

  // Return the tasks state and CRUD functions to components
  return {
    tasks,
    addTask,
    toggleTaskCompletion,
    deleteTask,
    updateTask,
  };
}
