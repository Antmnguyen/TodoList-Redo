// app/core/hooks/useTasks.ts
import { useState, useEffect } from 'react';
import { Task } from '../types/task';
import { getAllTasks } from '../services/storage/taskStorage';
import {
  createTask,
  completeTask,
  deleteTask,
  uncompleteTask,
} from '../domain/taskActions';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    const loaded = await getAllTasks();
    setTasks(loaded);
    setLoading(false);
  }

  /** CREATE */
  async function addTask(
    title: string,
    kind: Task['kind'] = 'one_off',
    additionalData?: Partial<Task>
  ) {
    const task = await createTask(title, kind, additionalData);

    // Optimistic insert
    setTasks(prev => [task, ...prev]);
  }

  /** COMPLETE / TOGGLE */
  async function toggleTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updated = task.completed
      ? await uncompleteTask(task)
      : await completeTask(task);

    setTasks(prev =>
      prev.map(t => (t.id === taskId ? updated : t))
    );
  }

  /** DELETE */
  async function removeTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Optimistic removal
    setTasks(prev => prev.filter(t => t.id !== taskId));

    await deleteTask(task);
  }

  return {
    tasks,
    loading,
    addTask,
    toggleTask,
    removeTask,
    reload: loadTasks,
  };
}
