# Stats Storage Expansion Plan

**Last updated:** 2026-02-19
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

An **append-only event log** — one row written each time any task is marked complete. Rows are never deleted or updated (they are a historical record). This decouples stats from the mutable `tasks` table.

```sql
CREATE TABLE IF NOT EXISTS completion_log (
    id              TEXT    PRIMARY KEY,   -- 'clog_<timestampMs>_<4-char random>'
    task_id         TEXT    NOT NULL,      -- tasks.id at time of completion (informational; row may be deleted later)
    template_id     TEXT,                  -- templates.permanentId — NULL for one-off tasks
    category_id     TEXT,                  -- category_id at time of completion (snapshot)
    task_kind       TEXT    NOT NULL,      -- 'one_off' | 'permanent'
    completed_at    INTEGER NOT NULL,      -- Unix ms timestamp of completion
    completed_date  TEXT    NOT NULL,      -- 'YYYY-MM-DD' in device-local time — primary grouping key
    scheduled_date  TEXT                   -- 'YYYY-MM-DD' of task's due_date, or NULL if no due_date
);
```

**Why `completed_date` as TEXT?**
SQLite has no native date type. Storing `'YYYY-MM-DD'` allows direct `GROUP BY completed_date` and `WHERE completed_date BETWEEN ? AND ?` without any `strftime()` call. The format sorts lexicographically and is timezone-correct (derived from the device clock at completion time, same as `completed_at`).

**Why `scheduled_date`?**
This is the denominator for % mode. For a task with a `due_date`, `scheduled_date = toLocalDateString(due_date)`. For a task completed without a due_date, `scheduled_date = NULL`. This allows the UI to compute:

- Count mode: `GROUP BY completed_date` → count of `id` per day
- % mode: `GROUP BY completed_date` → count of `id` (numerator) vs count of rows where `scheduled_date = completed_date` in the same date range (denominator)

Rows with `scheduled_date = NULL` contribute to the numerator but not the denominator in % mode (they were not committed to a specific day).

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
WHERE completed_date >= date('now', '-365 days', 'localtime')
  -- optional filter:
  AND template_id = ?      -- for permanent task streak
  -- OR category_id = ?    -- for category streak
ORDER BY completed_date ASC;
```

For overall streak, omit the WHERE filter entirely.

`template_stats.currentStreak` and `template_stats.maxStreak` should be removed or marked deprecated once this is wired. Until they are removed, they will continue to be written (for backward compat) but should not be read by any UI that uses the new `statsStorage.ts`.

---

### 2-C  New service: `statsStorage.ts`

**File:** `app/core/services/storage/statsStorage.ts`

Single service that owns all reads from `completion_log` (and targeted reads from `tasks`/`categories` for supplementary data). UI hooks never import from `completion_log` directly — they go through this service.

#### Write side

```typescript
/** Called once per task completion. Written by taskActions.ts — not by UI. */
export function logCompletion(entry: {
  taskId:        string;
  templateId:    string | null;
  categoryId:    string | null;
  taskKind:      'one_off' | 'permanent';
  completedAt:   number;   // Date.now()
  scheduledDate: string | null; // 'YYYY-MM-DD' of due_date, or null
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

/** One row per calendar day in the range that had ≥1 completion. */
getCompletionsByDay(
  startDate: string,
  endDate:   string,
  filter?:   StatFilter
): Array<{ date: string; completed: number; scheduled: number }>;

/** One row per calendar month for a given year. */
getCompletionsByMonth(
  year:    number,
  filter?: StatFilter
): Array<{ month: number; completed: number; scheduled: number }>;

/** Completion totals grouped by weekday (0=Sun … 6=Sat, SQLite strftime '%w'). */
getCompletionsByWeekday(
  filter?: StatFilter
): Array<{ weekday: number; completed: number; scheduled: number }>;

// ── Streak queries ───────────────────────────────────────────────────────────

/** Distinct calendar dates with ≥1 completion, sorted ASC, last 12 months. */
getCompletionDates(filter?: StatFilter): string[];

/** Convenience: current streak length. */
getCurrentStreak(filter?: StatFilter): number;

/** Convenience: best-ever streak length. */
getBestStreak(filter?: StatFilter): number;

// ── Summary queries ──────────────────────────────────────────────────────────

/** Quick preview data (total completed + this-week count) for StatPreviewCard. */
getStatSummary(filter?: StatFilter): {
  allTimeCount: number;
  weekCount:    number;
  monthCount:   number;
  yearCount:    number;
};

/** Task-type split for TaskTypeBreakdownCard. */
getTaskTypeSplit(filter?: StatFilter): {
  permanentCount: number;
  oneOffCount:    number;
};

/** Top-N categories by completion count (for CategoryBreakdownCard). */
getTopCategories(
  limit:   number,
  filter?: StatFilter
): Array<{ categoryId: string; count: number }>;
```

---

### 2-D  Integration point — `taskActions.ts`

The `completion_log` write is a **single INSERT** added to `taskActions.ts`. This keeps all other service files clean — they never import `statsStorage.ts`.

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

  // Stats log — one INSERT, no coupling to UI or other services:
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

`uncompleteTask()` does **not** delete the log row — the log is immutable. If a task is toggled back to incomplete, the completion is still recorded (accurately reflecting that it was done). This is intentional: toggling back and forth should not erase history. If this turns out to be undesirable, a `voided INTEGER DEFAULT 0` column can be added later to mark reversals without deletion.

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
SELECT completed_date, COUNT(*) AS completed
FROM completion_log
WHERE completed_date BETWEEN '2026-02-16' AND '2026-02-22'
  -- AND template_id = ?   ← permanent task filter
  -- AND category_id = ?   ← category filter
GROUP BY completed_date;
```

Days with no rows → `completed = 0` (filled in by the hook/service).

### WeekBarGraph — % mode (scheduled denominator)

```sql
SELECT completed_date,
       COUNT(*)                                                  AS completed,
       COUNT(CASE WHEN scheduled_date = completed_date THEN 1 END) AS scheduled
FROM completion_log
WHERE completed_date BETWEEN '2026-02-16' AND '2026-02-22'
GROUP BY completed_date;
```

`rate = completed / MAX(scheduled, completed)` — the `MAX` ensures that completing more tasks than were formally "scheduled" caps at 100%, not above.

### MonthCalendarGraph — one month's daily data

```sql
SELECT completed_date,
       COUNT(*)                                                       AS completed,
       COUNT(CASE WHEN scheduled_date = completed_date THEN 1 END)    AS scheduled
FROM completion_log
WHERE completed_date BETWEEN '2026-02-01' AND '2026-02-28'
GROUP BY completed_date;
```

### YearOverviewGraph — 12 monthly totals

```sql
SELECT substr(completed_date, 1, 7)  AS year_month,   -- 'YYYY-MM'
       COUNT(*)                      AS completed,
       COUNT(CASE WHEN scheduled_date IS NOT NULL
                   AND substr(scheduled_date, 1, 7) = substr(completed_date, 1, 7)
                  THEN 1 END)        AS scheduled
FROM completion_log
WHERE completed_date BETWEEN '2026-01-01' AND '2026-12-31'
GROUP BY year_month;
```

### DayOfWeekPatternCard — all-time completions by weekday

```sql
SELECT CAST(strftime('%w', completed_date) AS INTEGER)  AS weekday,  -- 0=Sun, 6=Sat
       COUNT(*)                                          AS completed,
       COUNT(CASE WHEN scheduled_date IS NOT NULL THEN 1 END) AS scheduled
FROM completion_log
WHERE template_id = ?    -- PermanentDetailScreen: scoped to one template
GROUP BY weekday;
```

For Overall or Category screens, drop or change the WHERE clause.

### StreakCard — current streak

```sql
SELECT DISTINCT completed_date
FROM completion_log
WHERE completed_date >= date('now', '-400 days', 'localtime')
  -- filter by template_id or category_id as needed
ORDER BY completed_date ASC;
```

Pass the result array to `calcCurrentStreak()` and `calcBestStreak()` in `statsCalculations.ts`.

### TimeRangeCountsCard — four buckets in one call

```typescript
// In statsStorage.ts — getStatSummary()
// Four COUNT queries, each using the idx_clog_date index:

const weekStart  = startOfCurrentWeek();   // 'YYYY-MM-DD' Monday
const monthStart = startOfCurrentMonth();
const yearStart  = `${year}-01-01`;

const week  = db.getAllSync(`SELECT COUNT(*) AS n FROM completion_log WHERE completed_date >= ?`, [weekStart])[0].n;
const month = db.getAllSync(`SELECT COUNT(*) AS n FROM completion_log WHERE completed_date >= ?`, [monthStart])[0].n;
const yr    = db.getAllSync(`SELECT COUNT(*) AS n FROM completion_log WHERE completed_date >= ?`, [yearStart])[0].n;
const all   = db.getAllSync(`SELECT COUNT(*) AS n FROM completion_log`)[0].n;
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
| `taskActions.ts` | `statsStorage.logCompletion()` | UI, hooks, `useStats` |
| `statsStorage.ts` | `completion_log` table, `statsCalculations.ts` | UI, hooks, `tasks` internals |
| `statsCalculations.ts` | Date math, streak logic | SQLite, UI |
| `useStats.ts` (hook) | `statsStorage.ts` (read side only) | SQL, `taskActions.ts` |
| UI components | Data props (plain objects) | All storage |

`statsStorage.ts` is the only file that reads `completion_log`. No UI or hook touches SQLite directly for stats.

---

## 6. `useStats.ts` Hook Sketch

```typescript
// app/core/hooks/useStats.ts

export function useStats() {
  /**
   * Full detail bundle for a single stat screen.
   * Pass no filter for Overall; pass templateId or categoryId for scoped screens.
   */
  function getDetailStats(filter?: StatFilter): DetailStats {
    const now  = new Date();
    const year = now.getFullYear();

    const weekDays  = buildWeekDayData(filter);   // calls getCompletionsByDay for Mon–Sun
    const monthDays = buildMonthDayData(filter);  // calls getCompletionsByDay for current month
    const yearData  = buildYearData(year, filter);// calls getCompletionsByMonth
    const summary   = getStatSummary(filter);
    const dates     = getCompletionDates(filter);

    return {
      ...summary,
      currentStreak: calcCurrentStreak(dates),
      bestStreak:    calcBestStreak(dates),
      weeklyData:    weekDays,
      monthlyData:   monthDays,
      yearlyData:    yearData,
    };
  }

  function getDayOfWeekPattern(filter?: StatFilter): DayOfWeekData[] {
    return buildDayOfWeekData(filter); // calls getCompletionsByWeekday
  }

  function getCategoryBreakdown(limit = 5): CategoryBreakdownItem[] {
    const rows = getTopCategories(limit);
    // Join category names + colors from categories table
    return rows.map(r => enrichWithCategoryMeta(r));
  }

  return { getDetailStats, getDayOfWeekPattern, getCategoryBreakdown };
}
```

---

## 7. What Is NOT Planned Here (Out of Scope)

- **`failed_count` / auto-fail system** — described in `SPRINT_4_PLAN.md` under "Auto-Fail System." Not tackled in this plan; it would add a `failure_log` table with similar structure to `completion_log`, inserted when a task expires.
- **`daily_stats` aggregate cache** — a pre-aggregated table (one row per calendar day × filter combo) would make repeated reads faster but adds write-side complexity. Not needed until query times are observed to be slow on real data.
- **Removing `template_stats.currentStreak / maxStreak`** — will still be written by `updateTemplateStats` for backward compat until all reads are migrated to `statsStorage`. Once migrated, mark them as deprecated in `STORAGE_ARCHITECTURE.md` and stop writing them.
- **Foreign key enforcement** — `completion_log.category_id` and `completion_log.template_id` are soft references; SQLite FK enforcement is off by default and enabling it would require `PRAGMA foreign_keys = ON` on every connection open (a larger refactor).

---

## 8. File Checklist

```
app/core/services/storage/
├── statsStorage.ts                     ← NEW: logCompletion() + all read functions
├── schema/
│   ├── completions.ts                  ← FILL: completion_log DDL + indexes + backfill
│   └── index.ts                        ← EDIT: call initializeCompletionsSchema() (4th)

app/core/
├── hooks/
│   └── useStats.ts                     ← NEW: wraps statsStorage read functions for React
├── utils/
│   └── statsCalculations.ts            ← NEW: calcCurrentStreak, calcBestStreak, date helpers
└── domain/
    └── taskActions.ts                  ← EDIT: call logCompletion() in completeTask()
```

### Implementation order (avoids circular dependency / broken states)

1. **`statsCalculations.ts`** — pure date math, no imports from storage
2. **`schema/completions.ts`** — DDL + backfill function
3. **`schema/index.ts`** — register new schema init
4. **`statsStorage.ts`** — write `logCompletion()` first; then read functions
5. **`taskActions.ts`** — add `logCompletion()` call; run app, verify log fills
6. **`useStats.ts`** — wrap read functions for React; replace mock data in detail screens

---

## 9. Success Criteria

- [ ] Every task completion writes exactly one row to `completion_log`
- [ ] Toggling a task back to incomplete does NOT delete the log row
- [ ] `calcCurrentStreak` returns 0 when there are no completions today or yesterday
- [ ] `calcCurrentStreak` returns the correct count after a gap in completions
- [ ] `getCompletionsByDay` returns correct counts for a week with one completed task per day
- [ ] `getCompletionsByMonth` returns 12 rows for the current year with correct totals
- [ ] All `statsStorage` read functions accept an empty filter and return overall (all tasks) results
- [ ] All `statsStorage` read functions accept a `templateId` filter and return only that template's data
- [ ] All `statsStorage` read functions accept a `categoryId` filter and return only that category's data
- [ ] Backfill runs once on first launch after upgrade; running again is a no-op
- [ ] Deleting a task does NOT remove its `completion_log` rows (history preserved)
- [ ] StatsScreen preview cards load in < 200 ms on a device with 1 000 tasks
