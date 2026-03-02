// app/core/hooks/useTasks.ts
import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Task } from '../types/task';
import { getAllTasks } from '../services/storage/taskStorage';
import {
  createTask,
  completeTask,
  deleteTask,
  uncompleteTask,
  reassignTask,
  // Production: runs once per calendar day (guarded by SQLite date gate +
  // in-session flag). Order: autoFail → autoSchedule → archive.
  runMidnightJob,
  resetMidnightJobSession,
  // DEV TESTING: uncomment runMidnightJobDev and swap the useEffect below
  // to re-enable the 3-minute interval pipeline for local testing.
  // runMidnightJobDev,
} from '../domain/taskActions';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  // Run the midnight maintenance job (autoFail → autoSchedule → archive),
  // then load the task list so the UI starts with an up-to-date view.
  // The job is guarded to run at most once per calendar day.
  useEffect(() => {
    runMidnightJob().then(loadTasks);
  }, []);

  // Re-check the midnight gate whenever the app returns to the foreground.
  // The JS engine stays alive while the app is backgrounded, so the mount
  // useEffect above won't fire again — but the calendar date may have crossed
  // midnight. Resetting the session flag forces runMidnightJob to re-evaluate
  // the SQLite date gate; if the date changed it runs the jobs and reloads.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (appState.current !== 'active' && nextState === 'active') {
          resetMidnightJobSession();
          runMidnightJob().then(loadTasks);
        }
        appState.current = nextState;
      },
    );
    return () => subscription.remove();
  }, []);

  // ── DEV TESTING MODE (3-minute interval) ─────────────────────────────────
  // Uncomment the block below (and comment out the production useEffect above)
  // to run the full pipeline every 3 minutes for local testing.
  // Also uncomment the runMidnightJobDev import at the top of this file.
  //
  // useEffect(() => {
  //   runMidnightJobDev().then(loadTasks);
  //   const devIntervalId = setInterval(() => {
  //     runMidnightJobDev().then(loadTasks);
  //   }, 3 * 60 * 1000); // 3 minutes in ms
  //   return () => clearInterval(devIntervalId);
  // }, []);
  // ── END DEV TESTING MODE ─────────────────────────────────────────────────

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
