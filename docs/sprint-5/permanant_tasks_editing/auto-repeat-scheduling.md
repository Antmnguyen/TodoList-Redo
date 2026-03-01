# Auto-Repeat Scheduling for Permanent Tasks

> **Status: COMPLETE** — Implemented 2026-02-26.
> Modified files: `taskActions.ts`, `statsStorage.ts`, `permanentTaskActions.ts`, `useTasks.ts`.
> See "Implementation Notes" section for one deviation from the original plan.

## Context

Permanent task templates support an `autoRepeat` config (`{ enabled, frequency }`) meant to
automatically create the next instance when a task is completed. The current implementation
inside `handlePermanentCompletion` has 3 bugs and is effectively dead code — it throws silently
on every completion and has never worked.

Rather than patching the broken code in `permanentTaskActions`, scheduling is moved to an outer
**midnight service** that is completely independent of the permanent task module.

---

## Architecture

**Principle:** The permanent task module owns completion, stats, and storage. It does NOT own
scheduling. The midnight service reads permanent task data (read-only) and creates new instances
via the normal `createTask` path.

```
App starts
  └── runMidnightJob()   ← gates on: "has midnight passed since last run?"
        ├── autoFailOverdueTasks()          (already exists in taskActions.ts)
        ├── autoScheduleRecurringTasks()    (new — this feature)
        └── archiveCompletedTasks()         (future — Sprint 5 section 2.4)
```

**No circular dependency:** The midnight service lives in `taskActions.ts`. It imports
`getAllTemplates` from `permanentTaskStorage` (read-only) and calls `createTask` which is
already in the same file.

---

## Root Cause — Why the Current Code Is Dead

The auto-repeat block in `handlePermanentCompletion` (around line 200):

```typescript
if (permanentTask.autoRepeat) {
  try {
    const template = await getTemplateById(permanentTask.permanentId);
    if (template) {
      const nextInstance = createNextRecurringInstance(
        template,
        permanentTask.dueDate          // Bug 2: wrong base date
      );
      nextInstance.categoryId = template.categoryId;
      await savePermanentInstance(nextInstance);
      // Bug 3: no saveTask() — instance never appears in task list
    }
  } catch (error) {
    console.warn('Failed to create next recurring instance:', error);
    // Bug 1 causes throw here: factory reads 'interval', UI stores 'frequency'
    // → interval is undefined → "Unknown interval: undefined" → silently swallowed
  }
}
```

| Bug | Description |
|-----|-------------|
| Bug 1 | `createNextRecurringInstance` reads `interval`; UI stores `frequency` → throws every time |
| Bug 2 | Uses `dueDate` (old scheduled date) not `completedAt` (actual completion time) |
| Bug 3 | Missing `saveTask()` call — even if it ran, new instance never appeared in task list |

**The midnight scheduler bypasses all three** by never calling the factory and using
`createTask` directly.

---

## Desired Behaviour

- At midnight each day (checked on app start), for every template with `autoRepeat.enabled = true`:
  - If **no pending (incomplete) instance** exists for the template → create one
  - `dueDate = lastCompletionTimestamp + interval`
  - If the template has **never been completed** → skip (don't create speculative instances)
- Only ever **1 pending instance** per template at any time. No backlog ever.
- Completion flow, stats, and `completion_log` are completely unaffected.

---

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `app/features/permanentTask/utils/permanentTaskActions.ts` | Removed dead auto-repeat block from `handlePermanentCompletion` | ✅ Done |
| `app/core/services/storage/statsStorage.ts` | Added `getLastCompletionTimestamp(templateId)` — read-only query on `completion_log` | ✅ Done |
| `app/core/domain/taskActions.ts` | Added `computeNextDueDate()`, `autoScheduleRecurringTasks()`, `runMidnightJob()`; new imports for `getAllTemplates` and `getLastCompletionTimestamp` | ✅ Done |
| `app/core/hooks/useTasks.ts` | Replaced `autoFailOverdueTasks().then(loadTasks)` with `runMidnightJob().then(loadTasks)` | ✅ Done |

**`permanentTaskFactory.ts` — ZERO CHANGES.**
The scheduler computes due dates itself and never calls `createNextRecurringInstance`.

**`permanentTaskActions.ts` — only removed dead code.** No logic changes to completion or stats.

**No schema changes. No new tables.**

---

## Step-by-Step Implementation

### Step 1 — Remove dead auto-repeat block from `permanentTaskActions.ts` ✅

Deleted the entire `if (permanentTask.autoRepeat)` block at the bottom of
`handlePermanentCompletion`. It has never run successfully.

`handlePermanentCompletion` after removal ends at:

```typescript
  // Return as Task type
  return {
    ...task,
    completed: true,
    completedAt: new Date(completedAt),
  };
}
```

---

### Step 2 — Add `getLastCompletionTimestamp` to `statsStorage.ts` ✅

Read-only query. No writes, no behavior change.

```typescript
/**
 * Returns the most recent completion timestamp for a template,
 * or null if it has never been completed.
 * Used by the midnight scheduler to compute the next due date.
 */
export function getLastCompletionTimestamp(templateId: string): number | null {
  const rows = db.getAllSync<{ completed_at: number | null }>(
    `SELECT MAX(completed_at) AS completed_at
     FROM completion_log
     WHERE template_id = ?`,
    [templateId]
  );
  return rows.length && rows[0].completed_at != null ? rows[0].completed_at : null;
}
```

---

### Step 3 — Add midnight job functions to `taskActions.ts` ✅

Added the following imports at the top of `taskActions.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllTemplates } from '../../core/services/storage/permanentTaskStorage';
import { getLastCompletionTimestamp } from '../services/storage/statsStorage';
```

Add these functions to `taskActions.ts`:

```typescript
const MIDNIGHT_JOB_KEY = 'lastMidnightJobAt';

/**
 * Returns true if midnight has passed since the last midnight job ran.
 */
async function shouldRunMidnightJob(): Promise<boolean> {
  const stored = await AsyncStorage.getItem(MIDNIGHT_JOB_KEY);
  const lastRun = stored ? parseInt(stored) : 0;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  return lastRun < todayMidnight.getTime();
}

/**
 * Computes the next due date from a completion timestamp and autoRepeat config.
 * Pure function — no DB calls. Supports both 'frequency' (UI) and 'interval' (legacy).
 */
function computeNextDueDate(autoRepeat: Record<string, any>, completedAt: number): number {
  const freq = autoRepeat.frequency ?? autoRepeat.interval;
  const { dayOfWeek, dayOfMonth } = autoRepeat;
  let nextDue = completedAt;

  switch (freq) {
    case 'daily':
      nextDue = completedAt + 86_400_000;
      break;
    case 'weekly':
      nextDue = completedAt + 7 * 86_400_000;
      if (dayOfWeek !== undefined) {
        const d = new Date(nextDue);
        nextDue += ((dayOfWeek - d.getDay() + 7) % 7) * 86_400_000;
      }
      break;
    case 'monthly': {
      const d = new Date(completedAt);
      d.setMonth(d.getMonth() + 1);
      if (dayOfMonth !== undefined) d.setDate(dayOfMonth);
      nextDue = d.getTime();
      break;
    }
    default:
      throw new Error(`Unknown autoRepeat frequency: ${freq}`);
  }
  return nextDue;
}

/**
 * AUTO-SCHEDULE RECURRING TASKS
 * --------------------------------
 * Runs as part of the midnight job. Reads permanent task data (read-only)
 * and creates new instances via the normal createTask path.
 *
 * Zero coupling to permanentTaskActions or permanentTaskFactory.
 * Safe to call multiple times — "pending instance exists" check is idempotent.
 */
async function autoScheduleRecurringTasks(): Promise<void> {
  // Get all auto-repeat templates
  const templates = await getAllTemplates();
  const recurring = templates.filter(t => {
    const ar = t.autoRepeat;
    return ar && (ar.enabled === true || !('enabled' in ar)) && (ar.frequency ?? ar.interval);
  });

  if (recurring.length === 0) return;

  // Get all tasks once to check for pending instances
  const allTasks = await getAllTasks();

  for (const template of recurring) {
    // Skip if a pending (incomplete) instance already exists
    const hasPending = allTasks.some(t =>
      t.kind === 'permanent' &&
      !t.completed &&
      (t.metadata as any)?.permanentId === template.permanentId
    );
    if (hasPending) continue;

    // Get last completion timestamp from completion_log
    const lastCompletedAt = getLastCompletionTimestamp(template.permanentId);
    if (!lastCompletedAt) continue; // Never completed — don't create speculative instances

    try {
      const nextDueDate = computeNextDueDate(template.autoRepeat!, lastCompletedAt);
      await createTask(template.templateTitle, 'permanent', {
        templateId: template.permanentId,
        dueDate: nextDueDate,
        categoryId: template.categoryId,
      } as any);
    } catch (error) {
      console.warn(`[midnight] Failed to schedule next instance for ${template.permanentId}:`, error);
      // Continue — don't let one failure block other templates
    }
  }
}

/**
 * MIDNIGHT JOB
 * ------------
 * Call on every app start. Runs all maintenance tasks if midnight has passed
 * since the last run. Stores last-run timestamp in AsyncStorage.
 *
 * Job order:
 *   1. autoFailOverdueTasks        — push overdue tasks forward, log auto_failed
 *   2. autoScheduleRecurringTasks  — create next instances for auto-repeat templates
 *   3. archiveCompletedTasks       — (future, Sprint 5 §2.4)
 */
export async function runMidnightJob(): Promise<void> {
  if (!(await shouldRunMidnightJob())) return;

  await autoFailOverdueTasks();
  await autoScheduleRecurringTasks();
  // Future: await archiveCompletedTasks();

  await AsyncStorage.setItem(MIDNIGHT_JOB_KEY, Date.now().toString());
}
```

**Replace the existing `autoFailOverdueTasks` call site** (wherever it's currently called on
app start) with `runMidnightJob()`. `autoFailOverdueTasks` now runs inside the midnight job.

---

## What Is NOT Changed

| Thing | Why untouched |
|-------|---------------|
| `permanentTaskFactory.ts` | Scheduler computes due dates itself — `createNextRecurringInstance` never called |
| `permanentTaskActions.ts` | Only removes dead code; completion + stats logic unchanged |
| `updateTemplateStats` | Runs inside `handlePermanentCompletion`, completely independent |
| `completion_log` | Read-only by scheduler — only written by `logCompletion` in completeTask |
| `template_stats` | Unaffected |
| Schema / migrations | No new tables or columns |

---

## Midnight Timing

### Implemented: two-layer gate (SQLite + module variable)

The job uses two complementary guards. Full details in `docs/sprint-5/midnight-job.md`.

**Layer 1 — `_midnightJobRanThisSession` (module boolean, RAM)**
Blocks redundant runs when `useTasks` remounts within the same app session
(e.g. navigating between tabs). No DB read needed for these skips.

**Layer 2 — `app_settings['midnight_job_last_run_date']` (SQLite)**
Persists the last-run date (`'YYYY-MM-DD'`) across cold starts. On every cold
start, the stored date is compared against today. If they match, the job skips.
This is the real correctness guarantee — the module variable is just a cache in
front of it.

```
runMidnightJob()
  → _midnightJobRanThisSession == true?  → return   (same session, fast)
  → getAppSetting('midnight_job_last_run_date') == today?  → return   (already ran today)
  → run autoFailOverdueTasks() + autoScheduleRecurringTasks()
  → setAppSetting('midnight_job_last_run_date', today)
```

**Why SQLite instead of AsyncStorage:**
`@react-native-async-storage/async-storage` is not installed. SQLite is already
used for all storage in this project — a two-column `app_settings` table requires
no new package dependency.

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| Template never completed | `getLastCompletionTimestamp` returns `null` → skipped |
| Template has a pending instance | `hasPending` check → skipped, no duplicate |
| `autoRepeat.enabled = false` | Filtered out before loop |
| Old `{ interval: 'daily' }` format | `freq = frequency ?? interval` in `computeNextDueDate` |
| App opened twice before midnight | Second call: `shouldRunMidnightJob` returns false → no-op |
| Next due date falls in the past | Instance created as overdue; `autoFailOverdueTasks` on next midnight will push it forward |
| `createTask` throws for one template | Per-template try/catch — other templates still processed |
| Archival removes completed instances from `tasks` | Safe: scheduler reads `completion_log` (never archived) for last completion time |

---

## Stat Safety

The scheduler only writes to `template_instances` and `tasks` (via `createTask`).
It reads from `completion_log` and `templates`. It never touches `template_stats`.
All existing stats logic is unchanged.

---

## Implementation Notes

| Topic | Decision |
|-------|----------|
| Midnight date gate | Implemented via `app_settings` SQLite table — no AsyncStorage needed. Two-layer gate: module variable (in-session) + SQLite (cross-session). See `midnight-job.md`. |
| `permanentTaskFactory` | Zero changes — `createNextRecurringInstance` is never called by the scheduler. The factory bug (reads `interval`, UI stores `frequency`) is irrelevant to this feature. |
| `permanentTaskActions` | Only the dead auto-repeat block was removed. All completion and stats logic is unchanged. |
| `useTasks` call site | `autoFailOverdueTasks().then(loadTasks)` replaced with `runMidnightJob().then(loadTasks)` — `autoFail` now runs inside the job, so no external call site was lost. |

---

## Verification

1. Create a template with `autoRepeat: { enabled: true, frequency: 'daily' }`
2. Manually create first instance (UsePermanentTaskScreen)
3. Complete the instance from AllTasksScreen
4. Force-quit and reopen the app (resets `_midnightJobRan` to false, triggering the job)
5. Confirm: a new instance appears in the task list, due `lastCompletionAt + 1 day`
6. Reopen the app without force-quitting — confirm no duplicate instance created
   (module guard blocks the job from running twice in the same session)
7. Complete the new instance; force-quit and reopen — confirm another instance is created
8. Leave the new instance incomplete for 3 days; force-quit and reopen each day —
   confirm only 1 pending instance throughout (no backlog of missed days)
