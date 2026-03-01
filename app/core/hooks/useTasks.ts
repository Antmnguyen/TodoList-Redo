// app/core/hooks/useTasks.ts
import { useState, useEffect } from 'react';
import { Task } from '../types/task';
import { getAllTasks } from '../services/storage/taskStorage';
import {
  createTask,
  completeTask,
  deleteTask,
  uncompleteTask,
  reassignTask,
  // runMidnightJob replaces the old autoFailOverdueTasks direct call.
  // It runs autoFail first, then autoScheduleRecurringTasks, and in future
  // will also run archiveCompletedTasks — all in the correct order.
  // runMidnightJob,  // ← PRODUCTION: uncomment this, remove runMidnightJobDev below
  // ⚠️ DEV TESTING: runMidnightJobDev is active (3-min interval).
  // TO REVERT: see taskActions.ts for full switch-back instructions.
  runMidnightJobDev,
} from '../domain/taskActions';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Run the midnight maintenance job (autoFail + autoSchedule), then load
  // the task list so the UI always starts with an up-to-date, consistent view:
  //   - overdue tasks already pushed forward
  //   - new recurring instances already created if due
  //
  // ═══════════════════════════════════════════════════════════════════════
  // ⚠️  DEV TESTING MODE — 3-MINUTE INTERVAL (remove before production)
  // ═══════════════════════════════════════════════════════════════════════
  // Runs the full midnight job immediately on mount, then every 3 minutes,
  // so the archival pipeline can be tested without waiting until midnight.
  //
  // TO SWITCH BACK TO PRODUCTION:
  //   1. Delete this useEffect and its interval (keep the production one below).
  //   2. Uncomment the production useEffect:
  //        useEffect(() => { runMidnightJob().then(loadTasks); }, []);
  //   3. Fix the import at the top of this file (see comment there).
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    runMidnightJobDev().then(loadTasks);
    const devIntervalId = setInterval(() => {
      runMidnightJobDev().then(loadTasks);
    }, 3 * 60 * 1000); // 3 minutes in ms
    return () => clearInterval(devIntervalId);
  }, []);
  // ═══════════════════════════════════════════════════════════════════════
  // END DEV TESTING MODE — production useEffect below (currently commented out)
  // ═══════════════════════════════════════════════════════════════════════
  // useEffect(() => {
  //   runMidnightJob().then(loadTasks);
  // }, []);

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

  /** EDIT / REASSIGN */
  // -------------------------------------------------------------------------
  // Updates task properties (title, dueDate, etc.) via reassignTask
  // Location of reassignTask: app/core/domain/taskActions.ts
  // For one_off tasks: merges updates and saves to storage
  // For permanent tasks: delegates to reassignPermanentTask
  // -------------------------------------------------------------------------
  async function editTask(taskId: string, updates: Partial<Task>) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updated = await reassignTask(task, updates);

    // Update local state
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? updated : t))
    );

    return updated;
  }

  return {
    tasks,
    loading,
    addTask,
    toggleTask,
    removeTask,
    editTask,
    reload: loadTasks,
  };
}
