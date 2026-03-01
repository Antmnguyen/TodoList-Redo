// app/core/domain/taskActions.ts

import { Task, TaskFactory } from '../types/task';
import {
  handlePermanentCompletion,
  createPermanentTask,
  deletePermanentTask,
  reassignPermanentTask,
  pushPermanentTaskForward,
} from '../../features/permanentTask/utils/permanentTaskActions';

// ===== STORAGE =====
import { saveTask, getAllTasks } from '../services/storage/taskStorage';
import { deleteTask as deleteTaskDB } from '../services/storage/taskStorage';
import { logCompletion, logAutoFail, getLastCompletionTimestamp } from '../services/storage/statsStorage';
import { toLocalDateString } from '../utils/statsCalculations';
// getAllTemplates is imported here (not from the permanent feature module) so
// the scheduler can read template data without going through permanentTaskActions,
// which would create a mutual-dependency cycle:
//   taskActions → permanentTaskActions → [scheduling] → taskActions  ✗
// Reading from permanentTaskStorage directly is safe — it's a storage layer,
// not a business-logic layer, and taskActions already sits above it.
import { getAllTemplates } from '../services/storage/permanentTaskStorage';
// Read/write the app_settings table so runMidnightJob can persist the last-run
// date across cold starts without needing AsyncStorage.
import { getAppSetting, setAppSetting } from '../services/storage/appSettingsStorage';
import { archiveCompletedTasks } from '../services/archivalService';

/**
 * UNIVERSAL TASK ACTIONS
 * =======================
 * Central dispatcher for all task operations.
 * Routes actions to appropriate handlers based on task.kind.
 * 
 * Supports:
 * - one_off: Default tasks (handled here)
 * - permanent: Delegated to permanent feature module
 * - preset: Placeholder for future implementation
 */

// ======== CREATE TASK ========

/**
 * CREATE TASK
 * -----------
 * Universal entry point for task creation.
 * Routes to appropriate handler based on kind.
 */
export async function createTask(
  title: string, 
  kind: Task['kind'] = 'one_off',
  additionalData?: Partial<Task>
): Promise<Task> {
  switch (kind) {
    case 'permanent':
      return await createPermanentTask(title, additionalData);
    
    case 'one_off':
    default:
      const task = TaskFactory.create(title);
      const taskWithData = { ...task, ...additionalData };
      await saveTask(taskWithData);
      return taskWithData;
  }
}

// ======== COMPLETE TASK ========

/**
 * COMPLETE TASK
 * -------------
 * Universal entry point for task completion.
 * Routes to appropriate handler based on task.kind.
 */
export async function completeTask(task: Task): Promise<Task> {
  let completed: Task;

  switch (task.kind) {
    case 'permanent':
      completed = await handlePermanentCompletion(task);
      break;

    case 'preset':
      throw new Error('Preset task completion not yet implemented');

    case 'one_off':
    default:
      completed = { ...TaskFactory.complete(task), completedAt: new Date() };
      await saveTask(completed);
  }

  // Condition A: log the completion event
  logCompletion({
    taskId:        task.id,
    templateId:    task.kind === 'permanent' ? (task.metadata as any)?.permanentId ?? null : null,
    categoryId:    task.categoryId ?? null,
    taskKind:      task.kind === 'permanent' ? 'permanent' : 'one_off',
    completedAt:   completed.completedAt?.getTime() ?? Date.now(),
    scheduledDate: task.dueDate ? toLocalDateString(task.dueDate) : null,
  });

  return completed;
}

// ======== DELETE TASK ========

/**
 * DELETE TASK
 * -----------
 * Universal entry point for task deletion.
 * Routes to appropriate handler based on task.kind.
 */
export async function deleteTask(task: Task): Promise<void> {
  switch (task.kind) {
    case 'permanent':
      await deletePermanentTask(task);
      break;
    
    case 'preset':
      // Future: await deletePresetTask(task);
      throw new Error('Preset task deletion not yet implemented');
    
    case 'one_off':
    default:
      await deleteTaskDB(task.id);
      break;
  }
}

// ======== REASSIGN TASK ========

/**
 * REASSIGN TASK
 * -------------
 * Universal entry point for editing task properties (title, dueDate, etc.)
 * Routes to appropriate handler based on task.kind.
 *
 * DATA FLOW:
 *   UI (EditTaskModal) → useTasks.editTask() → THIS FUNCTION → saveTask()
 *
 * SUPPORTED UPDATES:
 *   - title: string       → Updates task name
 *   - dueDate: Date       → Updates due date
 *   - category: string    → Updates category (when schema supports it)
 *   - Any other Task field
 *
 * STORAGE:
 *   saveTask() uses INSERT OR REPLACE, so all fields are written to DB
 *   Location: app/core/services/storage/taskStorage.ts
 */
export async function reassignTask(task: Task, updates: Partial<Task>): Promise<Task> {
  switch (task.kind) {
    case 'permanent':
      return await reassignPermanentTask(task, updates);

    case 'preset':
      // Future: return await reassignPresetTask(task, updates);
      throw new Error('Preset task reassignment not yet implemented');

    case 'one_off':
    default:
      // Merge updates into existing task
      const updated = { ...task, ...updates };

      // Persist to database (INSERT OR REPLACE writes all fields including title, due_date)
      await saveTask(updated);

      return updated;
  }
}

// ======== PUSH TASK FORWARD ========

/**
 * PUSH TASK FORWARD
 * -----------------
 * Universal entry point for pushing task due date forward by N days.
 * Routes to appropriate handler based on task.kind.
 * 
 * @param task - The task to push forward
 * @param days - Number of days to push forward (default: 1)
 */
export async function pushTaskForward(task: Task, days: number = 1): Promise<Task> {
  switch (task.kind) {
    case 'permanent':
      return await pushPermanentTaskForward(task, days);
    
    case 'preset':
      // Future: return await pushPresetTaskForward(task, days);
      throw new Error('Preset task push forward not yet implemented');
    
    case 'one_off':
    default:
      const updated = { ...task };
      
      // If no due date exists, set it to today
      if (!updated.dueDate) {
        updated.dueDate = new Date();
      }
      
      // Push forward by specified days
      const newDate = new Date(updated.dueDate.getTime());
      newDate.setDate(newDate.getDate() + days);
      updated.dueDate = newDate;
      
      await saveTask(updated);
      return updated;
  }
}

// ======== UNCOMPLETE TASK ========

/**
 * UNCOMPLETE TASK
 * ---------------
 * Universal entry point for marking a task as incomplete.
 * Useful for undoing accidental completions.
 */
export async function uncompleteTask(task: Task): Promise<Task> {
  switch (task.kind) {
    case 'permanent':
      // Future: may need special handling for permanent tasks
      // For now, treat like one-off
      const uncompletedPerm = TaskFactory.uncomplete(task);
      await saveTask(uncompletedPerm);
      return uncompletedPerm;
    
    case 'preset':
      // Future: return await uncompletePresetTask(task);
      throw new Error('Preset task uncompletion not yet implemented');
    
    case 'one_off':
    default:
      const uncompleted = {
        ...TaskFactory.uncomplete(task),
        completedAt: undefined, // Clear completion time
      };
      await saveTask(uncompleted);
      return uncompleted;
  }
}

// ======== AUTO-FAIL OVERDUE TASKS ========

/**
 * AUTO-FAIL OVERDUE TASKS
 * -----------------------
 * Runs on app start (before the task list loads) to handle tasks whose
 * dueDate has passed since the last session.
 *
 * For each overdue incomplete task:
 *   1. Logs an 'auto_failed' event to completion_log (attributed to the due day).
 *   2. Pushes the task's dueDate forward by 1 day (Condition B).
 *
 * This keeps the task list accurate and the stats graph honest about missed days.
 */
export async function autoFailOverdueTasks(): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const allTasks = await getAllTasks();
  const overdue  = allTasks.filter(
    t => !t.completed && t.dueDate && t.dueDate < todayStart
  );

  for (const task of overdue) {
    logAutoFail({
      taskId:        task.id,
      templateId:    task.kind === 'permanent' ? (task.metadata as any)?.permanentId ?? null : null,
      categoryId:    task.categoryId ?? null,
      taskKind:      task.kind === 'permanent' ? 'permanent' : 'one_off',
      failedAt:      Date.now(),
      scheduledDate: toLocalDateString(task.dueDate!),
    });
    await pushTaskForward(task, 1);
  }
}

// ======== MIDNIGHT JOB ========

/**
 * The SQLite key used to persist the last midnight-job run date.
 * Value format: 'YYYY-MM-DD' local calendar date string.
 * Written by runMidnightJob after the job completes.
 * Read by runMidnightJob at the start of every cold start to decide
 * whether the job has already run today.
 */
const MIDNIGHT_JOB_DATE_KEY = 'midnight_job_last_run_date';

/**
 * In-session fast guard. Set to true the first time runMidnightJob runs
 * within a JS engine process lifetime.
 *
 * Why keep this alongside the SQLite gate?
 *   The SQLite read is cheap, but useTasks can remount multiple times in a
 *   session (e.g. navigating between tabs). Reading from the DB on every
 *   remount is unnecessary once we know the job has already run this session.
 *   This flag short-circuits those redundant DB reads without changing the
 *   correctness guarantee — the SQLite gate is what actually enforces the
 *   once-per-calendar-day rule across cold starts.
 *
 * Lifecycle:
 *   false  — module just loaded (cold start or JS reload)
 *   true   — job ran at least once this session; all further calls are no-ops
 */
let _midnightJobRanThisSession = false;

/**
 * COMPUTE NEXT DUE DATE
 * ----------------------
 * Pure function (no DB calls, no side effects) that takes an autoRepeat config
 * and a base timestamp and returns when the next instance should be due.
 *
 * Why is this here and not in permanentTaskFactory?
 *   permanentTaskFactory.createNextRecurringInstance has a bug (reads 'interval'
 *   but the UI stores 'frequency') and is tightly coupled to creating a
 *   PermanentTask object. This function only does the date math and nothing else,
 *   keeping the scheduler self-contained and easy to unit-test later.
 *
 * Why support both 'frequency' and 'interval'?
 *   The UI (CreatePermanentTaskScreen) saves { frequency: 'daily' }.
 *   Older templates may have been saved with { interval: 'daily' } (the legacy
 *   field name in the factory). Supporting both ensures no template is silently
 *   skipped due to a field-name mismatch.
 *
 * @param autoRepeat  - The template's autoRepeat config object
 * @param completedAt - Unix ms timestamp of the last real completion
 * @returns Unix ms timestamp for the next instance's due date
 */
function computeNextDueDate(
  autoRepeat: Record<string, any>,
  completedAt: number,
): number {
  // Read either field name — 'frequency' is current, 'interval' is legacy.
  const freq = autoRepeat.frequency ?? autoRepeat.interval;
  const { dayOfWeek, dayOfMonth } = autoRepeat;

  let nextDue = completedAt;

  switch (freq) {
    case 'daily':
      // Simple offset: next instance is due exactly 24 hours after completion.
      nextDue = completedAt + 86_400_000;
      break;

    case 'weekly':
      // Start by jumping forward 7 days from completion, then optionally snap
      // to a specific day of the week (0 = Sunday … 6 = Saturday).
      nextDue = completedAt + 7 * 86_400_000;
      if (dayOfWeek !== undefined) {
        const d = new Date(nextDue);
        // ((target - current) + 7) % 7 gives the forward offset in days,
        // correctly wrapping around when target === current (result = 0).
        const daysToAdd = (dayOfWeek - d.getDay() + 7) % 7;
        nextDue += daysToAdd * 86_400_000;
      }
      break;

    case 'monthly': {
      // setMonth handles year rollover automatically (Dec + 1 → Jan next year).
      const d = new Date(completedAt);
      d.setMonth(d.getMonth() + 1);
      // If a specific day-of-month is requested, pin to it.
      // Note: setDate(31) on a 30-day month spills into the next month — this is
      // acceptable for now; a more robust approach can clamp to last day if needed.
      if (dayOfMonth !== undefined) d.setDate(dayOfMonth);
      nextDue = d.getTime();
      break;
    }

    default:
      // Throw so the per-template try/catch in autoScheduleRecurringTasks
      // logs a warning and moves on rather than silently skipping.
      throw new Error(`Unknown autoRepeat frequency: "${freq}"`);
  }

  return nextDue;
}

/**
 * AUTO-SCHEDULE RECURRING TASKS
 * --------------------------------
 * Reads all permanent task templates, finds those with auto-repeat enabled,
 * and creates a new pending instance for any that don't already have one.
 *
 * Key design decisions:
 *
 * 1. Zero coupling to permanentTaskActions / permanentTaskFactory.
 *    This function reads template data directly from storage and creates
 *    instances via createTask (the normal public API). The permanent task
 *    module's job is completion + stats — not scheduling.
 *
 * 2. Idempotent by design.
 *    Before creating anything, we check whether a pending (incomplete) instance
 *    already exists for the template. If it does, we skip it. This means the
 *    function is safe to call multiple times and will never create duplicates.
 *
 * 3. Uses completion_log as the source for last completion time.
 *    The tasks table will eventually be pruned by the archival system, so
 *    completed rows may disappear from it. completion_log is append-only and
 *    permanent — using it here keeps this correct after archival lands.
 *
 * 4. Never schedules for a template that has never been completed.
 *    The first instance must always be created manually (via UsePermanentTaskScreen).
 *    Auto-scheduling only kicks in after the first real completion. This prevents
 *    speculative instances appearing for templates the user hasn't started yet.
 *
 * 5. One pending instance at a time — no backlog.
 *    If the user hasn't completed the task for 5 days, there's still just 1
 *    pending instance (the existing uncompleted one). Only when they complete it
 *    does the next one get scheduled (on the next midnight job run).
 */
async function autoScheduleRecurringTasks(): Promise<void> {
  // Fetch all templates. getAllTemplates() returns only isTemplate=true rows.
  const templates = await getAllTemplates();

  // Keep only templates that have a valid auto-repeat config.
  // Two checks on 'enabled':
  //   - ar.enabled === true  → explicit opt-in (current format)
  //   - !('enabled' in ar)   → legacy templates that predate the 'enabled' field;
  //                            treat the presence of autoRepeat itself as opt-in.
  const recurring = templates.filter(t => {
    const ar = t.autoRepeat;
    if (!ar) return false;
    const isEnabled = ar.enabled === true || !('enabled' in ar);
    // Also guard that there's an actual frequency to compute a date with.
    const hasFrequency = Boolean(ar.frequency ?? ar.interval);
    return isEnabled && hasFrequency;
  });

  // Nothing to do — exit early to avoid loading all tasks unnecessarily.
  if (recurring.length === 0) return;

  // Load the full task list once and reuse it for all templates.
  // We need this to check whether a pending instance already exists.
  // getAllTasks() returns tasks enriched with kind + metadata (including
  // permanentId) via the JOIN with template_instances in taskStorage.
  const allTasks = await getAllTasks();

  for (const template of recurring) {
    // ── Guard 1: skip if a pending instance already exists ────────────────
    // "Pending" = kind is permanent, not completed, and linked to this template.
    // This is the primary safety mechanism against duplicates.
    const hasPending = allTasks.some(
      t =>
        t.kind === 'permanent' &&
        !t.completed &&
        (t.metadata as any)?.permanentId === template.permanentId,
    );
    if (hasPending) continue;

    // ── Guard 2: skip if never completed ─────────────────────────────────
    // We only auto-schedule after the user has completed at least one instance.
    // getLastCompletionTimestamp queries completion_log (outcome='completed' only).
    const lastCompletedAt = getLastCompletionTimestamp(template.permanentId);
    if (lastCompletedAt === null) continue;

    // ── Create the next instance ──────────────────────────────────────────
    try {
      // Compute the due date as a pure date-math operation.
      const nextDueDate = computeNextDueDate(template.autoRepeat!, lastCompletedAt);

      // Route through the standard createTask path (kind='permanent', templateId
      // provided) so the instance is saved to both template_instances AND tasks,
      // exactly the same as if the user created it manually.
      await createTask(template.templateTitle, 'permanent', {
        templateId:  template.permanentId,
        dueDate:     nextDueDate,
        categoryId:  template.categoryId,
      } as any);

    } catch (error) {
      // Log a warning but keep going — one bad template should not block the
      // others. Completion is not affected; this runs after the fact.
      console.warn(
        `[midnight] Failed to schedule next instance for template "${template.permanentId}":`,
        error,
      );
    }
  }
}

/**
 * MIDNIGHT JOB — UNIFIED APP MAINTENANCE
 * ----------------------------------------
 * Single entry point for all once-per-session maintenance tasks.
 * Called from useTasks on mount, replacing the old autoFailOverdueTasks call.
 *
 * Job order matters:
 *   1. autoFailOverdueTasks first — this pushes overdue tasks forward and logs
 *      auto_failed events. It must run before autoScheduleRecurringTasks so that
 *      the "pending instance exists" check in step 2 sees the correct state
 *      (an overdue instance that was just pushed forward is still pending).
 *
 *   2. autoScheduleRecurringTasks second — now that overdue tasks have been
 *      handled, any template with no pending instance and a real prior completion
 *      gets a new instance created.
 *
 *   3. archiveCompletedTasks (future, Sprint 5 §2.4) will go last — archival
 *      should only touch tasks after all scheduling is done.
 *
 * The _midnightJobRan guard ensures this only runs once per JS engine lifetime
 * (i.e. once per cold start of the app), even if useTasks unmounts and remounts.
 */
export async function runMidnightJob(): Promise<void> {
  // ── Layer 1: in-session guard (fast, no DB) ─────────────────────────────
  // If the job already ran earlier in this app session, skip immediately.
  // This handles useTasks remounting without touching SQLite.
  if (_midnightJobRanThisSession) return;

  // ── Layer 2: cross-session date gate (SQLite) ───────────────────────────
  // Read the last-run date from the app_settings table.
  // toLocalDateString produces a 'YYYY-MM-DD' string in the device's local
  // timezone — the same format used throughout this project for date comparisons.
  const today = toLocalDateString(new Date());
  const lastRunDate = getAppSetting(MIDNIGHT_JOB_DATE_KEY);

  if (lastRunDate === today) {
    // The job already ran today (in a previous cold start of the app).
    // Cache this in the session flag so future remounts skip the DB read.
    _midnightJobRanThisSession = true;
    return;
  }

  // ── Mark as ran before awaiting jobs ───────────────────────────────────
  // Set the session flag immediately so that if runMidnightJob is somehow
  // called concurrently (e.g. two rapid mounts before the first await
  // resolves), the second call exits at layer 1 rather than running the
  // jobs twice. The SQLite write happens after the jobs complete.
  _midnightJobRanThisSession = true;

  // ── Run maintenance jobs in order ──────────────────────────────────────
  // 1. autoFailOverdueTasks must run before autoScheduleRecurringTasks so
  //    that the "pending instance exists" check in the scheduler sees the
  //    correct state (overdue tasks are still pending, just with a new date).
  await autoFailOverdueTasks();
  await autoScheduleRecurringTasks();
  await archiveCompletedTasks();

  // ── Persist the run date ────────────────────────────────────────────────
  // Written after jobs complete so that a crash mid-job causes a retry on
  // the next cold start rather than silently skipping. Both jobs are
  // idempotent, so a retry is always safe.
  setAppSetting(MIDNIGHT_JOB_DATE_KEY, today);
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  DEV-ONLY TESTING FUNCTION — REMOVE BEFORE PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════
//
// runMidnightJobDev bypasses ALL guards (session flag + calendar date gate)
// and runs all three maintenance jobs unconditionally every time it is called.
//
// It is called on a 3-minute interval from useTasks.ts so the full midnight
// job pipeline (autoFail → autoSchedule → archive) can be exercised without
// waiting until midnight.
//
// ── HOW TO SWITCH BACK TO PRODUCTION (midnight-only) ─────────────────────
//  STEP 1  Delete this entire function (everything between the ═══ banners).
//  STEP 2  In app/core/hooks/useTasks.ts, replace the useEffect with:
//
//            useEffect(() => {
//              runMidnightJob().then(loadTasks);
//            }, []);
//
//  STEP 3  In useTasks.ts, remove the runMidnightJobDev import.
//  STEP 4  Done — the production midnight-once-per-day job takes over.
// ═══════════════════════════════════════════════════════════════════════════
export async function runMidnightJobDev(): Promise<void> {
  await autoFailOverdueTasks();
  await autoScheduleRecurringTasks();
  await archiveCompletedTasks();
}
// ═══════════════════════════════════════════════════════════════════════════
// END DEV-ONLY SECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * FUTURE EXTENSION PATTERN
 * ========================
 * When adding new task types (e.g., recurring, subtasks):
 * 
 * 1. Add the kind to TaskKind type in core/types/task.ts
 * 2. Create feature module at features/{feature-name}/
 * 3. Implement handlers in features/{feature-name}/utils/{feature}TaskActions.ts
 * 4. Import handlers and add new case to switch statements above
 * 
 * Example:
 * ```typescript
 * case 'recurring':
 *   return await handleRecurringCompletion(task);
 * ```
 */