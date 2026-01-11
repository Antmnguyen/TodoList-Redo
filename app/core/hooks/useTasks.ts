// app/core/hooks/useTasks.ts
import { useState, useEffect } from 'react';
import { Task } from '../types/tasks';
import { getAllTasks, saveTask, deleteTask } from '../services/storage/taskStorage';

/**
 * useTasks Hook
 * ----------------
 * Core task management for Sprint 2.
 * Responsibilities:
 *  - Manage task state in memory
 *  - Persist tasks to SQLite via taskStorage.ts
 *  - Keep UI decoupled from database
 *
 * Future-proofing:
 *  - Can add analytics, streaks, geofencing, etc.
 *  - All changes happen in storage layer without touching this hook
 */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Load tasks from DB on mount
  useEffect(() => {
    loadTasks();
  }, []);

  /** Load all tasks from persistent storage */
  async function loadTasks() {
    setLoading(true);
    const loadedTasks = await getAllTasks();
    setTasks(loadedTasks);
    setLoading(false);
  }

  /** Add a new task */
  async function addTask(title: string) {
    const newTask: Task = {
      id: Date.now().toString(), // simple unique ID for Sprint 2
      title,
      completed: false,
      createdAt: new Date(),
    };

    // Optimistic UI update
    setTasks(prev => [newTask, ...prev]);

    // Persist to database
    await saveTask(newTask);
  }

  /** Toggle task completion */
  async function toggleTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask: Task = { ...task, completed: !task.completed };

    // Optimistic UI update
    setTasks(prev => prev.map(t => (t.id === taskId ? updatedTask : t)));

    // Persist to database
    await saveTask(updatedTask);
  }

  /** Remove a task */
  async function removeTask(taskId: string) {
    // Optimistic UI update
    setTasks(prev => prev.filter(t => t.id !== taskId));

    // Remove from database
    await deleteTask(taskId);
  }

  return {
    tasks,
    loading,
    addTask,
    toggleTask,
    removeTask,
  };
}
