import { useEffect, useState } from 'react';
import { Task } from '../types/tasks';

/**
 * useTasks Hook
 *
 * RESPONSIBILITY:
 * - Manage in-memory task state (SOURCE OF TRUTH)
 * - Trigger persistence as a SIDE EFFECT (Sprint 2)
 *
 * This hook:
 * ✅ Knows tasks are persisted
 * ❌ Does NOT know how (SQLite, AsyncStorage, etc.)
 *
 * Persistence is intentionally abstracted away.
 */
export function useTasks(initialTasks: Task[] = []) {
  /**
   * In-memory task state.
   *
   * GOLDEN RULE:
   * This state is the source of truth.
   * Disk storage exists only for durability across restarts.
   */
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  /**
   * =========================
   * Sprint 2 – Storage Wiring
   * =========================
   *
   * This effect will:
   * - Load tasks from persistent storage on app startup
   * - Populate in-memory state
   *
   * IMPORTANT:
   * - Runs once
   * - Failure is non-fatal
   * - UI must still work with an empty list
   *
   * NOTE:
   * Actual storage implementation (SQLite) will live in:
   * app/core/services/storage/taskStorage.ts
   */
  useEffect(() => {
    // async function loadTasksFromStorage() {
    //   try {
    //     const storedTasks = await taskStorage.getAllTasks();
    //     setTasks(storedTasks);
    //   } catch (error) {
    //     console.error('Failed to load tasks from storage', error);
    //     setTasks([]); // App still runs
    //   }
    // }
    //
    // loadTasksFromStorage();
  }, []);

  /**
   * addTask
   *
   * FLOW (Sprint 2):
   * 1. Update in-memory state immediately
   * 2. Persist asynchronously (side effect)
   *
   * UI must NEVER block on disk writes.
   */
  function addTask(task: Task) {
    setTasks(prev => [...prev, task]);

    // Sprint 2 (side effect only):
    // taskStorage.saveTask(task).catch(console.error);
  }

  /**
   * toggleTaskCompletion
   *
   * FLOW:
   * - Optimistic UI update
   * - Persistence happens after state update
   *
   * Storage failures do NOT rollback UI.
   */
  function toggleTaskCompletion(taskId: string) {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );

    // Sprint 2:
    // const updatedTask = ...
    // taskStorage.saveTask(updatedTask).catch(console.error);
  }

  /**
   * deleteTask
   *
   * Deletion is optimistic.
   * Persistence happens asynchronously.
   */
  function deleteTask(taskId: string) {
    setTasks(prev => prev.filter(task => task.id !== taskId));

    // Sprint 2:
    // taskStorage.deleteTask(taskId).catch(console.error);
  }

  /**
   * updateTask
   *
   * General-purpose update helper.
   * Useful for future features (editing title, metadata, etc.).
   *
   * Persistence will be handled the same way:
   * UI first, disk second.
   */
  function updateTask(taskId: string, updates: Partial<Task>) {
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, ...updates } : task
      )
    );

    // Sprint 2:
    // const updatedTask = ...
    // taskStorage.saveTask(updatedTask).catch(console.error);
  }

  /**
   * Public API
   *
   * UI consumes this object.
   * UI does NOT know persistence exists.
   */
  return {
    tasks,
    addTask,
    toggleTaskCompletion,
    deleteTask,
    updateTask,
  };
}

/**
 * DESIGN GUARANTEES (Sprint 2)
 * ---------------------------
 * - Behavior identical to Sprint 1
 * - No UI blocking
 * - No rollback on persistence failure
 * - App survives restarts once storage is wired
 *
 * Future features (history, analytics, sync) will hook in
 * WITHOUT changing UI components.
 */
