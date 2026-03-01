# Stats Storage Expansion Plan

**Last updated:** 2026-02-22 (Steps 1–4 implemented; storage outcome-filtering bugs fixed)
**Branch:** Sprint4
**Companion doc:** `STORAGE_ARCHITECTURE.md` (current state)
**Goal:** Add the minimum necessary storage to power all Sprint 4 stats UI — without redesigning existing tables.

---

## 1. Gap Analysis

The table below maps every stat the UI needs (from `DETAIL_SCREEN_PLAN.md`) to whether the current schema can produce it efficiently.

| UI stat / query | Needed by | Current support | Gap |
|-----------------|-----------|-----------------|-----|
| Total completions all-time | All screens — CompletionSummaryCard | `COUNT(*) WHERE completed = 1` on `tasks` | ⚠️ Works but scan; deleting a task loses its history |
| Completions in date range (week/month/year) | All screens — TimeRangeCountsCard | `WHERE completed_at >= ?` on `tasks` | ⚠️ Scan; no index on `completed_at`; deletion loses history |
| Completions grouped by calendar day | WeekBarGraph, MonthCalendarGraph | Derived from `tasks.completed_at` | ⚠️ Full scan; deletion loses history; no `completed_date` column |
| Completions grouped by month | YearOverviewGraph | Derived from `tasks.completed_at` | Same as above |
| Completions grouped by weekday (all-time) | DayOfWeekPatternCard | Derived from `tasks.completed_at` | Same; need `strftime('%w', …)` on every row |
| Scheduled (total) per day for % mode | MonthCalendarGraph %, WeekBarGraph % | `tasks.due_date` per day | ✅ For tasks with due_date; ❌ tasks with no due_date have no "scheduled" day |
| Current streak (consecutive days with ≥1 completion) | StreakCard | `template_stats.currentStreak` | ❌ Naive increment — never resets; not computable from `tasks` without a sorted distinct-date scan |
| Best streak | StreakCard | `template_stats.maxStreak` | ❌ Same as above |
| Per-template completions (for PermanentDetailScreen) | All per-template queries | `WHERE id IN (SELECT instanceId FROM template_instances WHERE templateId = ?)` on `tasks` | ⚠️ Works; but queries join two tables and scan; deleting instances loses stats |
| Per-category completions | CategoryDetailScreen | `WHERE category_id = ?` on `tasks` | ⚠️ Works; no index on `category_id`; deletion loses history |
| Task-type split (perm vs one-off) | TaskTypeBreakdownCard | Requires distinguishing rows in `tasks` that have a `template_instances` record | ⚠️ Possible via subquery; expensive without denormalization |
| Category breakdown (top-N categories by completions) | CategoryBreakdownCard (Overall) | `GROUP BY category_id` on `tasks WHERE completed = 1` | ⚠️ Works; full scan + join for names |
| DayOfWeekPattern for a single template | DayOfWeekPatternCard (Permanent) | `WHERE id IN (SELECT instanceId …) GROUP BY strftime('%w', …)` | ⚠️ Expensive join + date parse; deletion loses history |

**Core problems, in priority order:**

1. **No immutable completion event log** — task deletion silently destroys stats history.
2. **No `completed_date` column** — every calendar-grid query has to call `strftime` on a raw millisecond timestamp.
3. **Incorrect streak calculation** — counter never resets; completely wrong after the first missed day.
4. **No indexes on the columns most used in stats queries** — `completed_at`, `category_id`.
5. **No "scheduled" count per day** — % mode in WeekBarGraph / MonthCalendarGraph has no reliable denominator for one-off tasks without a due_date.

---

## 2. Proposed Changes

### 2-A  New table: `completion_log`

An **append-only event log** — one row written for each task evaluation event (completion or auto-fail). Rows are never deleted or updated; they are a permanent historical record. This decouples stats from the mutable `tasks` table.

```sql
CREATE TABLE IF NOT EXISTS completion_log (
    id              TEXT    PRIMARY KEY,   -- 'clog_<timestampMs>_<4-char random>'
    task_id         TEXT    NOT NULL,      -- tasks.id at time of event (informational; row may be deleted later)
    template_id     TEXT,                  -- templates.permanentId — NULL for one-off tasks
    category_id     TEXT,                  -- category_id at time of event (snapshot)
    task_kind       TEXT    NOT NULL,      -- 'one_off' | 'permanent'
    outcome         TEXT    NOT NULL,      -- 'completed' | 'auto_failed' (see §2-A.1 for evaluation rules)
    completed_at    INTEGER NOT NULL,      -- Unix ms timestamp of the event (completion time or failure detection time)
    completed_date  TEXT    NOT NULL,      -- 'YYYY-MM-DD' in device-local time — primary grouping key
                                           --   for 'completed' rows: the day the task was marked done
                                           --   for 'auto_failed' rows: the day the task was DUE (not the detection day)
    scheduled_date  TEXT                   -- 'YYYY-MM-DD' of task's due_date, or NULL if no due_date
);
```

**Why `completed_date` as TEXT?**
SQLite has no native date type. Storing `'YYYY-MM-DD'` allows direct `GROUP BY completed_date` and `WHERE completed_date BETWEEN ? AND ?` without any `strftime()` call. The format sorts lexicographically and is timezone-correct (derived from the device clock at event time, same as `completed_at`).

**Why `outcome`?**
The system explicitly tracks whether a task event was a success or a failure. This enables the correct completion rate formula (see §2-A.1) and ensures streak calculations only count genuine completions. The two values are:
- `'completed'` — task was marked done before its due_date (Condition A)
- `'auto_failed'` — task was still open at the daily cutoff and was auto-pushed (Condition B)

**Why `scheduled_date`?**
For a task with a `due_date`, `scheduled_date = toLocalDateString(due_date)`. For a task completed without a due_date, `scheduled_date = NULL`. Retained for MonthCalendarGraph and WeekBarGraph which can display "scheduled vs completed" in % mode. For `auto_failed` rows, `scheduled_date` always equals `completed_date` (the task was due that day).

---

### 2-A.1  Completion rate evaluation logic (the three conditions)

The system evaluates task status once per day at the daily cutoff (00:00 device-local time, or on next app open if the app was closed at midnight).

| Condition | Trigger | Effect on `completion_log` | Effect on `tasks` |
|-----------|---------|---------------------------|-------------------|
| **A — Completion** | `task.completed = true` before `due_date` | INSERT row with `outcome = 'completed'` | No change (already saved by `completeTask()`) |
| **B — Auto-Push** | `task.completed = false` AND `now > due_date` AND user did not manually reschedule | INSERT row with `outcome = 'auto_failed'`, `completed_date = toLocalDateString(due_date)` | `due_date` pushed to next day |
| **C — Manual Reassign** | User changes `due_date` to a future date before the current `due_date` expires | **No log entry written** | `due_date` updated to new date |

**Completion rate formula:**

```
rate = success_count / total_attempts

where:
  success_count  = COUNT(*) WHERE outcome = 'completed'   (Condition A events)
  total_attempts = COUNT(*)                                (Condition A + B events)
```

Condition C events produce no log row and therefore do not affect `total_attempts` — the user is not penalized for proactively rescheduling before a deadline is missed.

Tasks without a `due_date` can still be completed (they produce `outcome = 'completed'` rows with `scheduled_date = NULL`) but they can never trigger Condition B — there is no deadline to miss. They contribute to `success_count` but never to the "failed" side of `total_attempts`.

**Distinguishing B from C at detection time:**
When the daily check runs, a task is treated as Condition B only if its `due_date` has passed AND `task.completed = false`. If the user changed the `due_date` (Condition C), the new `due_date` will be in the future and the task is skipped by the check. No flag or separate column is needed to distinguish B from C — the due_date state alone is sufficient.

---

### 2-B  Streak calculation — query-based, not incremental

**Current:** `template_stats.currentStreak` is incremented on every completion and never reset. This is meaningless after the first skipped day.

**Fix:** Do not maintain a streak counter at all. Compute streaks on demand by querying `completion_log` for the distinct calendar dates with at least one completion, then walking backwards from today counting consecutive days.

```typescript
// statsCalculations.ts

/**
 * Returns the length of the current streak (days ending today or yesterday
 * that each have at least one completion matching the filter).
 *
 * @param dates - sorted ascending array of 'YYYY-MM-DD' strings with ≥1 completion each
 */
export function calcCurrentStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const today = toLocalDateString(new Date());
  let streak = 0;
  let cursor = today;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] === cursor) {
      streak++;
      cursor = prevDay(cursor);
    } else if (dates[i] < cursor) {
      break; // gap — streak is over
    }
  }
  return streak;
}

/**
 * Returns the longest-ever consecutive run of days with ≥1 completion.
 */
export function calcBestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  let best = 1, current = 1;
  for (let i = 1; i < dates.length; i++) {
    if (isNextDay(dates[i - 1], dates[i])) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}
```

The query feeding these functions:

```sql
SELECT DISTINCT completed_date
FROM completion_log
WHERE outcome = 'completed'                                -- auto_failed rows do NOT count toward streak
  AND completed_date >= date('now', '-400 days', 'localtime')
  -- optional filter:
  AND template_id = ?      -- for permanent task streak
  -- AND category_id = ?   -- for category streak
ORDER BY completed_date ASC;
```

For overall streak, omit the template/category filter entirely.
A day where all events are `auto_failed` (nothing completed) is treated as a missed day and breaks the streak — this is correct and intentional.

`template_stats.currentStreak` and `template_stats.maxStreak` should be removed or marked deprecated once this is wired. Until they are removed, they will continue to be written (for backward compat) but should not be read by any UI that uses the new `statsStorage.ts`.

---

### 2-C  New service: `statsStorage.ts`

**File:** `app/core/services/storage/statsStorage.ts`

Single service that owns all reads from `completion_log` (and targeted reads from `tasks`/`categories` for supplementary data). UI hooks never import from `completion_log` directly — they go through this service.

#### Write side

```typescript
/**
 * Called when a task is marked complete (Condition A).
 * Written by taskActions.completeTask() — not by UI.
 * Always inserts with outcome = 'completed'.
 */
export function logCompletion(entry: {
  taskId:        string;
  templateId:    string | null;
  categoryId:    string | null;
  taskKind:      'one_off' | 'permanent';
  completedAt:   number;        // Date.now() — time of completion
  scheduledDate: string | null; // 'YYYY-MM-DD' of due_date at time of completion, or null
}): void;

/**
 * Called when a task is auto-pushed past its due_date (Condition B).
 * Written by taskActions.autoFailOverdueTasks() — runs at the daily cutoff
 * or on app open when overdue tasks are detected.
 * Always inserts with outcome = 'auto_failed'.
 *
 * Note: completed_date is set to toLocalDateString(task.due_date) — the day
 * the task WAS DUE, not the day the failure was detected. This ensures
 * calendar graphs attribute the failure to the correct day.
 */
export function logAutoFail(entry: {
  taskId:        string;
  templateId:    string | null;
  categoryId:    string | null;
  taskKind:      'one_off' | 'permanent';
  failedAt:      number;        // Date.now() — time failure was detected
  scheduledDate: string;        // 'YYYY-MM-DD' of the missed due_date — always non-null for auto_failed
}): void;
```

#### Read side — all functions accept an optional `StatFilter`

```typescript
interface StatFilter {
  templateId?:  string;    // restrict to one template's instances
  categoryId?:  string;    // restrict to one category
  // (no filter = overall / all tasks)
}

// ── Count queries ────────────────────────────────────────────────────────────

/** Raw completion count in a calendar date range (inclusive). */
getCompletionCount(
  startDate: string,     // 'YYYY-MM-DD'
  endDate:   string,
  filter?:   StatFilter
): number;

/**
 * One row per calendar day in the range that had ≥1 completion.
 * Returns ONLY days with activity — caller must zero-fill missing days.
 * (e.g. a week with 4 active days returns 4 rows, not 7)
 */
getCompletionsByDay(
  startDate: string,
  endDate:   string,
  filter?:   StatFilter
): Array<{ date: string; completed: number; scheduled: number }>;

/**
 * Same as getCompletionsByDay but splits completions by task_kind.
 * Used by WeekBarGraph and MonthCalendarGraph segment rendering.
 * Returns ONLY days with activity — caller must zero-fill.
 */
getCompletionsByDayWithKind(
  startDate: string,
  endDate:   string,
  filter?:   StatFilter
): Array<{ date: string; permanent: number; oneOff: number; scheduled: number }>;

/**
 * One row per calendar month for a given year (always 12 rows).
 * Future months return completed = 0, scheduled = 0.
 */
getCompletionsByMonth(
  year:    number,
  filter?: StatFilter
): Array<{ month: number; completed: number; scheduled: number }>;

/**
 * Same as getCompletionsByMonth but splits by task_kind.
 * Used by YearOverviewGraph segment rendering.
 */
getCompletionsByMonthWithKind(
  year:    number,
  filter?: StatFilter
): Array<{ month: number; permanent: number; oneOff: number; scheduled: number }>;

/**
 * Completions grouped by weekday within an optional date range.
 * startDate / endDate scope the window (omit for all-time).
 * Used by DayOfWeekPatternCard — the date range is the bucket's window:
 *   all_week  → Mon–Sun of current week
 *   all_month → 1st–last of current month
 *   all_year  → Jan 1 – Dec 31 current year
 *   all_time  → omit startDate/endDate
 *
 * NOTE ON WEEKDAY VALUES:
 * SQLite strftime('%w') returns 0=Sunday … 6=Saturday.
 * The hook remaps to Mon-first: JS index = (sqliteWeekday + 6) % 7
 * So index 0 = Monday, index 6 = Sunday — matching the UI's day arrays.
 */
getCompletionsByWeekday(
  startDate?: string,
  endDate?:   string,
  filter?:    StatFilter
): Array<{ weekday: number; completed: number; scheduled: number }>;

/**
 * Completions grouped by (day × category) for CategoryWeekBarGraph.
 * Returns ONLY days/categories with activity.
 * No filter param — category IS the breakdown dimension here.
 */
getCompletionsByDayByCategory(
  startDate: string,
  endDate:   string
): Array<{ date: string; categoryId: string; count: number }>;

/**
 * Completions grouped by (month × category) for CategoryYearOverviewGraph.
 * Always returns all months, empty array of segments for future months.
 */
getCompletionsByMonthByCategory(
  year: number
): Array<{ month: number; categoryId: string; count: number }>;

// ── Streak queries ───────────────────────────────────────────────────────────

/**
 * Distinct calendar dates with ≥1 completion (outcome = 'completed' only), sorted ASC.
 * auto_failed rows are excluded — a day where every attempt failed does not count.
 * startDate caps the lookback window — pass the bucket's start date so
 * bucket-scoped streaks don't count days outside the window.
 * Omit startDate for all-time (defaults to 400-day lookback).
 */
getCompletionDates(startDate?: string, filter?: StatFilter): string[];

/**
 * Convenience: current streak length.
 * Pass startDate to cap the streak window to the bucket (e.g. '2026-02-01'
 * for a month bucket so a streak can't extend beyond that month).
 */
getCurrentStreak(startDate?: string, filter?: StatFilter): number;

/**
 * Convenience: best-ever streak length within the window.
 * Pass startDate for bucket-scoped best streak.
 */
getBestStreak(startDate?: string, filter?: StatFilter): number;

// ── Summary queries ──────────────────────────────────────────────────────────

/**
 * Four time-range counts for TimeRangeCountsCard.
 * These are always the four canonical windows regardless of which bucket
 * opened the screen — the card always shows all four rows.
 */
getStatSummary(filter?: StatFilter): {
  allTimeCount: number;
  weekCount:    number;
  monthCount:   number;
  yearCount:    number;
};

/**
 * Completion count and total attempt count for a specific date range.
 * Used by CompletionSummaryCard which must be scoped to the bucket's window.
 * e.g. for all_week: startDate = this Monday, endDate = this Sunday.
 *
 * completed      = COUNT(*) WHERE outcome = 'completed'  (Condition A successes)
 * totalAttempts  = COUNT(*)                              (Condition A + B — all evaluated tasks)
 *
 * Rate is computed in the hook: Math.round(completed / totalAttempts * 100).
 * Tasks without due_dates contribute to 'completed' but never to 'auto_failed',
 * so they can only raise the rate, never lower it.
 */
getCompletionSummary(
  startDate: string,
  endDate:   string,
  filter?:   StatFilter
): { completed: number; totalAttempts: number };

/** Task-type split for TaskTypeBreakdownCard. */
getTaskTypeSplit(
  startDate?: string,
  endDate?:   string,
  filter?:    StatFilter
): {
  permanentCount: number;
  oneOffCount:    number;
};

/**
 * Top-N categories by completion count (for CategoryBreakdownCard).
 * Returns count + rate per category.
 * rate = COUNT(outcome='completed') / COUNT(*) × 100  — uses total attempts as denominator.
 * Join with categories table in the hook to attach name + color.
 */
getTopCategories(
  limit:      number,
  startDate?: string,
  endDate?:   string
): Array<{ categoryId: string; count: number; rate: number }>;

/**
 * Per-template completion summary within a category for PermanentTaskListCard.
 * Returns one row per template that belongs to the category and has ≥1 completion.
 * Hook joins with templates table to get name + color.
 */
getPermanentTaskSummariesForCategory(
  categoryId: string,
  startDate?: string,
  endDate?:   string
): Array<{
  templateId:     string;
  totalCompleted: number;  // COUNT(outcome = 'completed')
  totalAttempts:  number;  // COUNT(*) — includes auto_failed rows
}>;
```

---

### 2-D  Integration points — `taskActions.ts`

`completion_log` is written from exactly two places in `taskActions.ts`. No other file imports `statsStorage.ts` for writes.

#### Write point 1 — `completeTask()` → `logCompletion()` (Condition A)

```typescript
// In taskActions.ts — completeTask()

import { logCompletion } from '../services/storage/statsStorage';

function completeTask(task: Task): void {
  const completedAt = Date.now();

  // Existing logic (unchanged):
  const completed = TaskFactory.complete(task, completedAt);
  saveTask(completed);

  if (task.kind === 'permanent') {
    handlePermanentCompletion(completed);
  }

  // Stats log — Condition A: task completed before its due_date.
  logCompletion({
    taskId:        task.id,
    templateId:    task.kind === 'permanent' ? getTemplateIdForInstance(task.id) : null,
    categoryId:    task.category_id ?? null,
    taskKind:      task.kind === 'permanent' ? 'permanent' : 'one_off',
    completedAt,
    scheduledDate: task.due_date ? toLocalDateString(new Date(task.due_date)) : null,
  });
}
```

`uncompleteTask()` does **not** delete the log row — the log is immutable. Toggling back to incomplete does not erase history.

#### Write point 2 — `autoFailOverdueTasks()` → `logAutoFail()` (Condition B)

This function runs at the daily cutoff (00:00) or when the app opens and detects tasks whose `due_date` has passed and `completed = false`.

```typescript
// In taskActions.ts — autoFailOverdueTasks()

import { logAutoFail } from '../services/storage/statsStorage';

function autoFailOverdueTasks(): void {
  // Find all tasks past due and not yet completed.
  // 'today' is the start of the current local day in ms.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const overdueTasks = getAllTasks().filter(
    t => !t.completed && t.dueDate && t.dueDate.getTime() < todayStart.getTime()
  );

  for (const task of overdueTasks) {
    const scheduledDate = toLocalDateString(task.dueDate!);

    // Condition B: log the failure attributed to the day the task was due.
    logAutoFail({
      taskId:        task.id,
      templateId:    task.kind === 'permanent' ? getTemplateIdForInstance(task.id) : null,
      categoryId:    task.categoryId ?? null,
      taskKind:      task.kind === 'permanent' ? 'permanent' : 'one_off',
      failedAt:      Date.now(),
      scheduledDate,                 // the day the task was due — becomes completed_date in the log
    });

    // Push the due_date forward by one day (Condition B side-effect).
    const nextDay = new Date(task.dueDate!);
    nextDay.setDate(nextDay.getDate() + 1);
    updateTaskDueDate(task.id, nextDay);
  }
}
```

**When to call `autoFailOverdueTasks()`:**
- On app launch (before rendering the task list) — catches failures from any day the app was closed.
- At midnight if the app is open — use a timer or `AppState` change listener.
- It is idempotent for any given task on any given day because once the due_date is pushed forward, the task no longer qualifies as overdue at the old date.

**Condition C is not handled here.** When the user manually reschedules a task before it expires, they update the `due_date` directly via the normal edit flow. No log entry is written. When `autoFailOverdueTasks()` later runs, the task's `due_date` is in the future and it is skipped — no penalty recorded.

---

### 2-E  Schema file placement

The DDL for `completion_log` goes in:

```
app/core/services/storage/schema/completions.ts
```

This file is listed as a placeholder in the current architecture. `initializeAllSchemas()` in `schema/index.ts` must call the new initializer after `initializeCoreSchema()`.

**Initialization order (updated):**

1. `initializeCoreSchema()` — `tasks`
2. `createPermanentTasksSchema()` — `templates`, `template_instances`, `template_stats`
3. `initializeCategoriesSchema()` — `categories`, seed defaults
4. `initializeCompletionsSchema()` — `completion_log` ← **new**

---

### 2-F  Indexes

Add these indexes alongside the DDL in `schema/completions.ts` and `schema/core.ts`:

```sql
-- completion_log — primary access patterns
CREATE INDEX IF NOT EXISTS idx_clog_date        ON completion_log (completed_date);
CREATE INDEX IF NOT EXISTS idx_clog_template    ON completion_log (template_id, completed_date);
CREATE INDEX IF NOT EXISTS idx_clog_category    ON completion_log (category_id, completed_date);
CREATE INDEX IF NOT EXISTS idx_clog_kind_date   ON completion_log (task_kind, completed_date);

-- tasks — used by live queries that still hit the tasks table
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at  ON tasks (completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id   ON tasks (category_id);
```

The `(template_id, completed_date)` and `(category_id, completed_date)` composite indexes cover the two most common filtered range queries in a single index scan.

---

## 3. Query Patterns by UI Component

### WeekBarGraph — Count mode (Mon–Sun completions this week)

```sql
-- Count only genuine completions for the bar height.
-- auto_failed rows are excluded here — bars show actual completed tasks only.
SELECT completed_date,
       COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS completed,
       COUNT(*)                                           AS totalAttempts
FROM completion_log
WHERE completed_date BETWEEN '2026-02-16' AND '2026-02-22'
  -- AND template_id = ?   ← permanent task filter
  -- AND category_id = ?   ← category filter
GROUP BY completed_date;
```

Days with no rows → `completed = 0, totalAttempts = 0` (filled in by the hook/service).

### WeekBarGraph — % mode (completion rate denominator)

```sql
-- Completion rate = completed / totalAttempts.
-- totalAttempts includes auto_failed rows (tasks that missed their deadline).
-- A day where all tasks were auto_failed shows 0%.
SELECT completed_date,
       COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS completed,
       COUNT(*)                                           AS totalAttempts
FROM completion_log
WHERE completed_date BETWEEN '2026-02-16' AND '2026-02-22'
GROUP BY completed_date;
```

`rate = completed / totalAttempts` — caps naturally at 100% because a row is either `completed` or `auto_failed`, never both.

### MonthCalendarGraph — one month's daily data

```sql
-- Ring fill per day = completed / totalAttempts.
-- A day with only auto_failed rows shows an empty ring (0%).
SELECT completed_date,
       COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS completed,
       COUNT(*)                                           AS totalAttempts
FROM completion_log
WHERE completed_date BETWEEN '2026-02-01' AND '2026-02-28'
GROUP BY completed_date;
```

### YearOverviewGraph — 12 monthly totals

```sql
-- Bar height = completed; rate overlay = completed / totalAttempts.
SELECT substr(completed_date, 1, 7)                           AS year_month,
       COUNT(CASE WHEN outcome = 'completed' THEN 1 END)      AS completed,
       COUNT(*)                                                AS totalAttempts
FROM completion_log
WHERE completed_date BETWEEN '2026-01-01' AND '2026-12-31'
GROUP BY year_month;
```

### DayOfWeekPatternCard — completions by weekday (bucket-scoped)

The date range maps to the bucket that opened the screen:

```sql
-- all_month bucket: current month only
-- Shows completed count per weekday; totalAttempts enables % mode.
SELECT CAST(strftime('%w', completed_date) AS INTEGER)        AS weekday,  -- 0=Sun, 6=Sat
       COUNT(CASE WHEN outcome = 'completed' THEN 1 END)      AS completed,
       COUNT(*)                                                AS totalAttempts
FROM completion_log
WHERE completed_date BETWEEN '2026-02-01' AND '2026-02-28'
  -- AND template_id = ?   ← PermanentDetailScreen
  -- AND category_id = ?   ← CategoryDetailScreen
GROUP BY weekday;

-- all_time bucket: omit the WHERE date filter entirely
```

**Weekday remapping (hook responsibility):**
SQLite returns `weekday 0 = Sunday`. The UI arrays are Monday-first (index 0 = Mon).
The hook remaps: `uiIndex = (sqliteWeekday + 6) % 7`

```typescript
// In the hook — after querying:
const mapped = Array(7).fill(null).map((_, uiIdx) => {
  const sqliteWeekday = (uiIdx + 1) % 7; // Mon=1, Tue=2, … Sun=0
  const row = rows.find(r => r.weekday === sqliteWeekday);
  return { day: DOW_LABELS[uiIdx], count: row?.completed ?? 0, total: row?.scheduled ?? 0 };
});
```

### WeekBarGraph / YearOverviewGraph — perm + one-off segment breakdown

Segments show only `outcome = 'completed'` rows — auto_failed tasks do not appear
as coloured bar segments (they are failures, not a task-type breakdown).

```sql
-- Per-day perm/one-off split (WeekBarGraph segments)
SELECT completed_date,
       COUNT(CASE WHEN outcome = 'completed' AND task_kind = 'permanent' THEN 1 END) AS permanent,
       COUNT(CASE WHEN outcome = 'completed' AND task_kind = 'one_off'   THEN 1 END) AS oneOff,
       COUNT(*)                                                                       AS totalAttempts
FROM completion_log
WHERE completed_date BETWEEN '2026-02-16' AND '2026-02-22'
GROUP BY completed_date;

-- Per-month perm/one-off split (YearOverviewGraph segments)
SELECT substr(completed_date, 1, 7)                                                  AS year_month,
       COUNT(CASE WHEN outcome = 'completed' AND task_kind = 'permanent' THEN 1 END) AS permanent,
       COUNT(CASE WHEN outcome = 'completed' AND task_kind = 'one_off'   THEN 1 END) AS oneOff,
       COUNT(*)                                                                       AS totalAttempts
FROM completion_log
WHERE completed_date BETWEEN '2026-01-01' AND '2026-12-31'
GROUP BY year_month;
```

### CategoryWeekBarGraph / CategoryYearOverviewGraph — completions by category

```sql
-- Per-day × per-category (CategoryWeekBarGraph)
SELECT completed_date,
       category_id,
       COUNT(*) AS count
FROM completion_log
WHERE completed_date BETWEEN '2026-02-16' AND '2026-02-22'
  AND category_id IS NOT NULL
GROUP BY completed_date, category_id;

-- Per-month × per-category (CategoryYearOverviewGraph)
SELECT substr(completed_date, 1, 7) AS year_month,
       category_id,
       COUNT(*) AS count
FROM completion_log
WHERE completed_date BETWEEN '2026-01-01' AND '2026-12-31'
  AND category_id IS NOT NULL
GROUP BY year_month, category_id;
```

The hook joins `categoryId → { name, color }` from the `categories` table to build the `CategorySegment[]` arrays expected by the components.

### PermanentTaskListCard — per-template summary within a category

```sql
SELECT ti.templateId,
       COUNT(CASE WHEN cl.outcome = 'completed' THEN 1 END) AS totalCompleted,
       COUNT(*)                                              AS totalAttempts
FROM completion_log cl
JOIN template_instances ti ON ti.instanceId = cl.task_id
WHERE cl.category_id = ?
GROUP BY ti.templateId;
```

Hook joins result with `templates` table to get `templateTitle` and with `categories` for `color`. Streak per template is computed via `getCurrentStreak(startDate?, { templateId })`. Per-template rate = `totalCompleted / totalAttempts`.

### CompletionSummaryCard — bucket-scoped completed + total attempts

```sql
-- e.g. for all_month bucket:
-- completed     = Condition A successes within the window
-- totalAttempts = Condition A + B events (all evaluated tasks in the window)
-- Rate = completed / totalAttempts
SELECT COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS completed,
       COUNT(*)                                           AS totalAttempts
FROM completion_log
WHERE completed_date BETWEEN '2026-02-01' AND '2026-02-28'
  -- AND filter clause
;
```

`total` in the card = `totalAttempts` (tasks that were formally evaluated — either completed on time or auto-failed). Tasks completed without a due_date contribute to `completed` but not to `totalAttempts` via auto_failed rows, so they can only improve the rate.

### StreakCard — current streak

```sql
-- Only 'completed' rows contribute to streaks.
-- A day where every task auto_failed (nothing done) breaks the streak.
SELECT DISTINCT completed_date
FROM completion_log
WHERE outcome = 'completed'
  AND completed_date >= date('now', '-400 days', 'localtime')
  -- AND template_id = ?   ← for template-scoped streak
  -- AND category_id = ?   ← for category-scoped streak
ORDER BY completed_date ASC;
```

Pass the result array to `calcCurrentStreak()` and `calcBestStreak()` in `statsCalculations.ts`.

### TimeRangeCountsCard — four buckets in one call

The card shows successful completion counts (outcome = 'completed') for each window, not raw attempt counts.

```typescript
// In statsStorage.ts — getStatSummary()
// Four COUNT queries, each using the idx_clog_date index:

const weekStart  = startOfCurrentWeek();   // 'YYYY-MM-DD' Monday
const monthStart = startOfCurrentMonth();
const yearStart  = `${year}-01-01`;

const week  = db.getAllSync(
  `SELECT COUNT(*) AS n FROM completion_log WHERE outcome = 'completed' AND completed_date >= ?`,
  [weekStart]
)[0].n;
const month = db.getAllSync(
  `SELECT COUNT(*) AS n FROM completion_log WHERE outcome = 'completed' AND completed_date >= ?`,
  [monthStart]
)[0].n;
const yr    = db.getAllSync(
  `SELECT COUNT(*) AS n FROM completion_log WHERE outcome = 'completed' AND completed_date >= ?`,
  [yearStart]
)[0].n;
const all   = db.getAllSync(
  `SELECT COUNT(*) AS n FROM completion_log WHERE outcome = 'completed'`
)[0].n;
```

All four use the `idx_clog_date` index — no full table scan.

---

## 4. Migration Plan

Existing completed tasks in the `tasks` table have `completed_at` set (if the column exists) or NULL. They have no rows in `completion_log`.

**Migration strategy:** On first launch after the schema upgrade, run a one-time backfill that inserts a `completion_log` row for every completed task that has `completed_at IS NOT NULL`.

```typescript
// In schema/completions.ts — initializeCompletionsSchema()

function backfillCompletionLog(): void {
  const alreadyBackfilled = db.getAllSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM completion_log`
  )[0].n;
  if (alreadyBackfilled > 0) return; // idempotent — skip if already done

  const completedTasks = db.getAllSync<{
    id: string; category_id: string | null; completed_at: number;
  }>(
    `SELECT id, category_id, completed_at FROM tasks
     WHERE completed = 1 AND completed_at IS NOT NULL`
  );

  for (const t of completedTasks) {
    const date = toLocalDateString(new Date(t.completed_at));
    // Check whether this task is a permanent instance
    const inst = db.getAllSync<{ templateId: string }>(
      `SELECT templateId FROM template_instances WHERE instanceId = ?`, [t.id]
    );
    db.runSync(
      `INSERT OR IGNORE INTO completion_log
         (id, task_id, template_id, category_id, task_kind, completed_at, completed_date, scheduled_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        `clog_${t.completed_at}_${Math.random().toString(36).slice(2, 6)}`,
        t.id,
        inst.length > 0 ? inst[0].templateId : null,
        t.category_id,
        inst.length > 0 ? 'permanent' : 'one_off',
        t.completed_at,
        date,
      ]
    );
  }
}
```

`scheduled_date` is set to NULL for all backfilled rows because the original due_date information at time of completion is no longer reliably available (due_date may have been updated since). These rows will contribute to completion counts but not to the scheduled denominator.

---

## 5. Coupling Notes

The design deliberately keeps coupling minimal:

| Layer | Knows about | Does NOT know about |
|-------|-------------|---------------------|
| `taskActions.ts` | `statsStorage.logCompletion()`, `statsStorage.logAutoFail()` | UI, hooks, `useStats` |
| `statsStorage.ts` | `completion_log` table, `statsCalculations.ts` | UI, hooks, `tasks` internals |
| `statsCalculations.ts` | Date math, streak logic | SQLite, UI |
| `useStats.ts` (hook) | `statsStorage.ts` (read side only) | SQL, `taskActions.ts` |
| UI components | Data props (plain objects) | All storage |

`statsStorage.ts` is the only file that reads `completion_log`. No UI or hook touches SQLite directly for stats.

---

## 6. `useStats.ts` Hook Sketch

```typescript
// app/core/hooks/useStats.ts

/** Maps params.id to a concrete date range for bucket-scoped queries. */
function bucketDateRange(bucketId: string): { startDate: string; endDate: string } | null {
  const now = new Date();
  if (bucketId === 'all_week') {
    return { startDate: startOfCurrentWeek(), endDate: endOfCurrentWeek() };
  }
  if (bucketId === 'all_month') {
    return { startDate: startOfCurrentMonth(), endDate: endOfCurrentMonth() };
  }
  if (bucketId === 'all_year') {
    return { startDate: `${now.getFullYear()}-01-01`, endDate: `${now.getFullYear()}-12-31` };
  }
  return null; // all_time — no date restriction
}

export function useStats() {
  /**
   * Full detail bundle for OverallDetailScreen.
   * bucketId = params.id ('all_time' | 'all_year' | 'all_month' | 'all_week')
   */
  function getOverallDetail(bucketId: string): OverallDetailData {
    const now    = new Date();
    const year   = now.getFullYear();
    const range  = bucketDateRange(bucketId);

    // CompletionSummaryCard — scoped to the bucket's window
    const summary = range
      ? getCompletionSummary(range.startDate, range.endDate)
      : getCompletionSummary('2000-01-01', toLocalDateString(now)); // all-time fallback

    // TimeRangeCountsCard — always all four canonical windows
    const timeSummary = getStatSummary();

    // StreakCard — cap lookback to the bucket's startDate so streaks don't
    // bleed outside the window (e.g. week streak can't exceed 7 days)
    const dates         = getCompletionDates(range?.startDate);
    const currentStreak = calcCurrentStreak(dates);
    const bestStreak    = calcBestStreak(dates);

    // WeekBarGraph — current week, perm/one-off segments
    const weekRange = { startDate: startOfCurrentWeek(), endDate: endOfCurrentWeek() };
    const weeklyRaw = getCompletionsByDayWithKind(weekRange.startDate, weekRange.endDate);
    const weeklyData = buildWeekDayData(weeklyRaw); // zero-fills Mon–Sun

    // MonthCalendarGraph
    const monthRange = { startDate: startOfCurrentMonth(), endDate: endOfCurrentMonth() };
    const monthlyRaw = getCompletionsByDay(monthRange.startDate, monthRange.endDate);
    const monthlyData = buildCalendarData(monthlyRaw); // sparse → CalendarDayData[]

    // YearOverviewGraph — perm/one-off segments
    const yearlyRaw  = getCompletionsByMonthWithKind(year);
    const yearlyData = buildMonthData(yearlyRaw); // always 12 rows

    // DayOfWeekPatternCard — scoped to bucket window
    const dowRaw  = getCompletionsByWeekday(range?.startDate, range?.endDate);
    const dowData = buildDayOfWeekData(dowRaw); // remaps Sun=0 → Mon=0

    // TaskTypeBreakdownCard
    const typeSplit = getTaskTypeSplit(range?.startDate, range?.endDate);

    // CategoryBreakdownCard
    const categories = getCategoryBreakdown(5, range?.startDate, range?.endDate);

    // CategoryWeekBarGraph
    const catWeekRaw  = getCompletionsByDayByCategory(weekRange.startDate, weekRange.endDate);
    const catWeekData = buildCategoryWeekData(catWeekRaw);

    // CategoryYearOverviewGraph
    const catYearRaw  = getCompletionsByMonthByCategory(year);
    const catYearData = buildCategoryYearData(catYearRaw);

    return {
      completed: summary.completed,
      total:     summary.totalAttempts,
      currentStreak, bestStreak,
      ...timeSummary,
      weeklyData, monthlyData, yearlyData, dowData,
      ...typeSplit,
      categories, catWeekData, catYearData,
    };
  }

  /**
   * Full detail bundle for CategoryDetailScreen.
   * id = params.id ('cat_work', 'cat_health', …)
   */
  function getCategoryDetail(categoryId: string): CategoryDetailData {
    const filter: StatFilter = { categoryId };
    const now  = new Date();
    const year = now.getFullYear();

    const summary       = getCompletionSummary('2000-01-01', toLocalDateString(now), filter);
    const timeSummary   = getStatSummary(filter);
    const dates         = getCompletionDates(undefined, filter);
    const currentStreak = calcCurrentStreak(dates);
    const bestStreak    = calcBestStreak(dates);

    const weekRange  = { startDate: startOfCurrentWeek(), endDate: endOfCurrentWeek() };
    const weeklyRaw  = getCompletionsByDayWithKind(weekRange.startDate, weekRange.endDate, filter);
    const weeklyData = buildWeekDayData(weeklyRaw);

    const monthRange  = { startDate: startOfCurrentMonth(), endDate: endOfCurrentMonth() };
    const monthlyRaw  = getCompletionsByDay(monthRange.startDate, monthRange.endDate, filter);
    const monthlyData = buildCalendarData(monthlyRaw);

    const yearlyRaw  = getCompletionsByMonthWithKind(year, filter);
    const yearlyData = buildMonthData(yearlyRaw);

    const dowRaw  = getCompletionsByWeekday(undefined, undefined, filter); // all-time for categories
    const dowData = buildDayOfWeekData(dowRaw);

    const typeSplit  = getTaskTypeSplit(undefined, undefined, filter);
    const taskList   = buildPermanentTaskList(categoryId);

    return {
      completed: summary.completed,
      total:     summary.totalAttempts,
      currentStreak, bestStreak,
      ...timeSummary,
      weeklyData, monthlyData, yearlyData, dowData,
      ...typeSplit,
      taskList,
    };
  }

  /**
   * Full detail bundle for PermanentDetailScreen.
   * id = params.id ('tpl_morning', …)
   */
  function getPermanentDetail(templateId: string): PermanentDetailData {
    const filter: StatFilter = { templateId };
    const now  = new Date();
    const year = now.getFullYear();

    const summary       = getCompletionSummary('2000-01-01', toLocalDateString(now), filter);
    const timeSummary   = getStatSummary(filter);
    const dates         = getCompletionDates(undefined, filter);
    const currentStreak = calcCurrentStreak(dates);
    const bestStreak    = calcBestStreak(dates);

    const weekRange  = { startDate: startOfCurrentWeek(), endDate: endOfCurrentWeek() };
    const weeklyRaw  = getCompletionsByDay(weekRange.startDate, weekRange.endDate, filter);
    const weeklyData = buildWeekDayData(weeklyRaw);

    const monthRange  = { startDate: startOfCurrentMonth(), endDate: endOfCurrentMonth() };
    const monthlyRaw  = getCompletionsByDay(monthRange.startDate, monthRange.endDate, filter);
    const monthlyData = buildCalendarData(monthlyRaw);

    const yearlyRaw  = getCompletionsByMonth(year, filter);
    const yearlyData = buildMonthData(yearlyRaw);

    const dowRaw  = getCompletionsByWeekday(undefined, undefined, filter);
    const dowData = buildDayOfWeekData(dowRaw);

    return {
      completed: summary.completed,
      total:     summary.totalAttempts,
      currentStreak, bestStreak,
      ...timeSummary,
      weeklyData, monthlyData, yearlyData, dowData,
    };
  }

  function getCategoryBreakdown(
    limit = 5,
    startDate?: string,
    endDate?:   string,
  ): CategoryBreakdownItem[] {
    const rows = getTopCategories(limit, startDate, endDate);
    return rows.map(r => enrichWithCategoryMeta(r)); // join name + color from categories table
  }

  return { getOverallDetail, getCategoryDetail, getPermanentDetail };
}
```

**Zero-filling rule (all `buildXxx` helpers must follow this):**
Storage functions return sparse rows (only dates/months/weekdays with activity).
Every builder must fill in zeros for missing slots before returning to the screen:
- `buildWeekDayData` → always 7 items Mon–Sun
- `buildCalendarData` → one entry per day 1–lastDay (only days with tasks scheduled)
- `buildMonthData` → always 12 items Jan–Dec (future months: 0/0)
- `buildDayOfWeekData` → always 7 items Mon–Sun after weekday remapping
```

---

## 7. What Is NOT Planned Here (Out of Scope)

- **`failed_count` / auto-fail system** — ~~not tackled~~ **NOW IN SCOPE.** The `outcome` column on `completion_log` and the `logAutoFail()` / `autoFailOverdueTasks()` functions documented in §2-A.1 and §2-D implement this. No separate `failure_log` table is needed.
- **`daily_stats` aggregate cache** — a pre-aggregated table (one row per calendar day × filter combo) would make repeated reads faster but adds write-side complexity. Not needed until query times are observed to be slow on real data.
- **Removing `template_stats.currentStreak / maxStreak`** — will still be written by `updateTemplateStats` for backward compat until all reads are migrated to `statsStorage`. Once migrated, mark them as deprecated in `STORAGE_ARCHITECTURE.md` and stop writing them.
- **Foreign key enforcement** — `completion_log.category_id` and `completion_log.template_id` are soft references; SQLite FK enforcement is off by default and enabling it would require `PRAGMA foreign_keys = ON` on every connection open (a larger refactor).

---

## 8. File Checklist

```
app/core/services/storage/
├── statsStorage.ts                     ✅ DONE: logCompletion(), logAutoFail() + all read functions
├── schema/
│   ├── completions.ts                  ✅ DONE: completion_log DDL + outcome col + indexes + migration + backfill
│   └── index.ts                        ✅ DONE: initializeCompletionsSchema() registered as step 4

app/core/
├── hooks/
│   ├── useTasks.ts                     ✅ DONE: autoFailOverdueTasks().then(loadTasks) on mount
│   └── useStats.ts                     ☐ NOT YET BUILT (Step 5 — next)
├── utils/
│   └── statsCalculations.ts            ✅ DONE: all date helpers + calcCurrentStreak, calcBestStreak
└── domain/
    └── taskActions.ts                  ✅ DONE: completeTask() logs; autoFailOverdueTasks() added
```

### Implementation status

1. ✅ **`statsCalculations.ts`** — complete
2. ✅ **`schema/completions.ts`** — complete (includes `outcome` column + `addOutcomeMigration()`)
3. ✅ **`schema/index.ts`** — complete
4. ✅ **`statsStorage.ts`** — complete (all read + write functions)
5. ✅ **`taskActions.ts`** + **`useTasks.ts`** — write side wired
6. ☐ **`useStats.ts`** — NOT YET BUILT (Step 5)
7. ☐ **Screen mock replacement** — NOT YET DONE (Step 6)

### ⚠️ Permanent task logging — needs verification

`logCompletion()` and `logAutoFail()` read `templateId` from `(task.metadata as any)?.permanentId`. Must manually verify that permanent instances have this field populated correctly when the functions are called. See `STATS_COMPLETION_ROADMAP.md` Step 4 for test checklist.

---

## 9. Success Criteria

Legend: ✅ implemented (code written) · ⚠️ implemented but needs manual testing · ☐ not yet done

**Completion log — write side**
- ⚠️ Every task completion writes exactly one row to `completion_log` with `outcome = 'completed'` *(code done — needs run-time test)*
- ⚠️ Every auto-fail writes exactly one row with `outcome = 'auto_failed'` and `completed_date = toLocalDateString(task.dueDate)` (the DUE day, not detection day) *(code done — needs run-time test)*
- ✅ Manual reschedule (user changes due_date before cutoff) writes NO row to `completion_log` — `autoFailOverdueTasks` skips tasks whose dueDate is in the future
- ✅ Toggling a task back to incomplete does NOT delete the log row — `uncompleteTask` never touches `completion_log`
- ✅ Deleting a task does NOT remove its `completion_log` rows — no FK cascade; `task_id` is informational only
- ⚠️ Backfill runs once on first launch after upgrade; running again is a no-op *(idempotent guard on row count implemented — needs first-launch test)*

**Permanent task logging** *(⚠️ all need manual testing)*
- ⚠️ Completing a permanent task instance writes `task_kind = 'permanent'` and populates `template_id` from `task.metadata.permanentId`
- ⚠️ Completing a one-off task writes `task_kind = 'one_off'` and `template_id = NULL`
- ⚠️ Auto-failing a permanent instance writes correct `template_id` and `completed_date = dueDate` (not today)
- ⚠️ Permanent task **templates** (no dueDate, `metadata.isTemplate = true`) are never processed by `autoFailOverdueTasks()`

**Completion rate**
- ✅ `logCompletion` always inserts `outcome = 'completed'`; `logAutoFail` always inserts `outcome = 'auto_failed'` — rate formula is `COUNT(outcome='completed') / COUNT(*)` in storage queries
- ✅ Completing a task without a due_date writes `outcome = 'completed'` with `scheduledDate = NULL` and can never trigger `autoFailOverdueTasks` (filter requires `dueDate` to be set)
- ⚠️ A task completed on time: confirm rate contribution = 1/1 in `getCompletionSummary` output
- ⚠️ A task auto-failed: confirm rate contribution = 0/1 in `getCompletionSummary` output
- ✅ A task manually rescheduled before deadline: rate contribution = 0/0 — no log row written

**Streaks** *(logic implemented in `statsCalculations.ts` — needs run-time verification)*
- ⚠️ `calcCurrentStreak` returns 0 when there are no completions today or yesterday
- ⚠️ `calcCurrentStreak` returns the correct count after a gap in completions
- ⚠️ `getCurrentStreak('2026-02-01')` (month bucket) correctly caps streak to days within that month
- ⚠️ `getCurrentStreak('2026-02-17')` (week bucket) caps streak to at most 7 days
- ✅ Streak queries filter `WHERE outcome = 'completed'` — `getCompletionDates` excludes `auto_failed` rows. Auto_failed days correctly break streaks.

**Count queries** *(all storage functions written — need run-time verification)*
- ⚠️ `getCompletionsByDay` returns only rows with activity (caller zero-fills)
- ⚠️ `getCompletionsByDayWithKind` correctly splits permanent vs one-off per day
- ⚠️ `getCompletionsByMonth` returns exactly 12 rows; future months return 0/0
- ⚠️ `getCompletionsByMonthWithKind` correctly splits permanent vs one-off per month
- ⚠️ `getCompletionsByWeekday` without dates returns all-time totals
- ⚠️ `getCompletionsByWeekday` with dates returns only completions within that range
- ☐ Weekday remapping in the hook: SQLite weekday 0 (Sunday) → UI index 6 *(hook not yet built)*

**Category queries** *(all storage functions written — need run-time verification)*
- ⚠️ `getCompletionsByDayByCategory` returns correct per-category counts per day
- ⚠️ `getCompletionsByMonthByCategory` returns correct per-category counts per month
- ⚠️ `getTopCategories` returns rate = completed / totalAttempts × 100 (only completed rows in numerator; COUNT(*) as denominator)
- ⚠️ `getPermanentTaskSummariesForCategory` returns one row per template in the category with `{ totalCompleted, totalAttempts }` (not `totalScheduled`)

**Hook integration** *(hook not yet built — all ☐)*
- ☐ `getOverallDetail('all_week')` — CompletionSummaryCard shows this week's count only
- ☐ `getOverallDetail('all_month')` — CompletionSummaryCard shows this month's count only
- ☐ `getOverallDetail('all_time')` — CompletionSummaryCard shows all-time count
- ☐ `getCategoryDetail('cat_work')` — all cards show Work category data only
- ☐ `getPermanentDetail('tpl_morning')` — all cards show that template's data only
- ☐ All filter combinations (no filter / templateId / categoryId) return correct results

**Performance** *(cannot verify until hook + screens connected)*
- ☐ StatsScreen preview cards load in < 200 ms on a device with 1 000 tasks
- ☐ Detail screen full load (all cards) completes in < 500 ms on a device with 1 000 tasks
