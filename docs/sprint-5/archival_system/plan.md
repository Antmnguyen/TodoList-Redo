# Task Archival System — Implementation Plan

**Status:** ✅ Complete — Implemented 2026-02-28
**Sprint:** 5 (§2.4)
**Depends on:** Midnight job (`midnight-job.md`) — archival runs as job #3 inside `runMidnightJob()`

---

## What This Is

Every day when the midnight job runs, completed tasks are moved out of the live
`tasks` table into a compressed `task_archive` table. This keeps the main task
list clean and fast, while preserving a full history that the user can browse in
**Browse → History**.

**Two distinct concepts — don't confuse them:**

| Concept | What it does | Where |
|---------|-------------|-------|
| Auto-hide (§2.1) | Filters the UI — completed tasks disappear from `AllTasksScreen` after 24h | UI filter only, data stays in `tasks` |
| **Archival (this feature)** | Physically moves completed tasks to `task_archive`, deletes from `tasks` | Data layer — permanent move |

Auto-hide is a cosmetic filter. Archival is the real cleanup.

---

## Architecture

```
Midnight Job (runMidnightJob in taskActions.ts)
  │
  ├── 1. autoFailOverdueTasks()          (existing)
  ├── 2. autoScheduleRecurringTasks()    (existing)
  └── 3. archiveCompletedTasks()         ← THIS FEATURE
           │
           │  reads: tasks (completed rows), categories (for name denorm)
           │  writes: task_archive (new compressed rows)
           │  deletes: tasks (completed rows), template_instances (perm instances only)
           │
           └── archivalService.ts
```

**Why archival runs last in the midnight job:**
- `autoFail` must run first to correctly classify overdue tasks.
- `autoScheduleRecurring` must run before archival so that a completed instance
  is not archived before the scheduler has had a chance to check it. (The
  scheduler reads `completion_log` for last-completion time, not `tasks`, so
  archival wouldn't actually break it — but ordering by responsibility is cleaner.)
- Archival is the cleanup step: it runs after all other jobs have finished with
  the task data for the day.

---

## What Gets Archived

| Task type | Condition | Archive action |
|-----------|-----------|----------------|
| One-off task | `completed = 1` | Write to `task_archive`, delete from `tasks` |
| Permanent task instance | `completed = 1` (instance, not template) | Write to `task_archive`, delete from `tasks`, delete from `template_instances` |
| Permanent task template | Never | Templates are never archived — they are definitions, not events |
| Incomplete task | `completed = 0` | Never archived — only completed tasks are swept |

### What is stored in the archive

Only the minimum needed for history display. Full task objects are not kept.

```typescript
interface ArchivedTask {
  id:           string;   // original task id — kept for deduplication
  title:        string;   // task name at time of archival
  categoryId?:  string;   // for potential future filtering
  categoryName?: string;  // denormalised snapshot — category name at archival time.
                          // Stored as a string so the row remains readable even if
                          // the category is later renamed or deleted.
  completedAt:  number;   // Unix ms — primary sort key for the history list
  archivedAt:   number;   // Unix ms — when the archival job ran
  wasRecurring: boolean;  // true if this was a permanent task instance
}
```

### What is intentionally discarded

| Field | Why discarded |
|-------|--------------|
| `dueDate` | Not relevant for history — the task is done |
| `createdAt` | Not surfaced in the history UI |
| `completed` flag | Always `true` in the archive — redundant |
| `kind` | Encoded in `wasRecurring` boolean — simpler for the UI |
| `location` | Not surfaced in the history UI |
| `autoRepeat` | Scheduling config — not relevant to history |

---

## Schema

### New table: `task_archive`

```sql
CREATE TABLE IF NOT EXISTS task_archive (
  -- Original task id — kept so we can check if a task is already archived
  -- before inserting (idempotency guard). PRIMARY KEY ensures no duplicates.
  id            TEXT    PRIMARY KEY,

  -- Title at time of archival. TEXT, not a foreign key, so the history entry
  -- survives task/template deletion.
  title         TEXT    NOT NULL,

  -- Category id at time of archival. Nullable — task may have had no category.
  -- Kept as a separate column from category_name for potential future filtering.
  category_id   TEXT,

  -- Category name at time of archival. Denormalised — copied from the categories
  -- table at archival time so history rows are readable even if the category is
  -- later renamed, recoloured, or deleted. Nullable (uncategorised tasks).
  category_name TEXT,

  -- Unix ms timestamp of when the task was completed. This is the primary sort
  -- key — the history list groups and orders by this value.
  completed_at  INTEGER NOT NULL,

  -- Unix ms timestamp of when the archival job ran. Useful for debugging and
  -- future "archived X days ago" display.
  archived_at   INTEGER NOT NULL,

  -- 1 if this was a permanent task instance, 0 if one-off.
  -- Stored as INTEGER (SQLite has no BOOLEAN) — read as boolean in TypeScript.
  was_recurring INTEGER NOT NULL DEFAULT 0
);

-- Index for the history screen's date-range queries.
-- The history list always filters by completed_at (today / this week / etc.),
-- so this index covers the primary query pattern.
CREATE INDEX IF NOT EXISTS idx_archive_completed_at
  ON task_archive (completed_at DESC);
```

### Where it is registered

New file: `app/core/services/storage/schema/archive.ts`
Registered as **step 6** in `schema/index.ts` (after app_settings, no dependencies on other tables).

---

## Files to Create / Change

| File | Status | Change |
|------|--------|--------|
| `app/core/services/storage/schema/archive.ts` | **CREATE** ✅ | `task_archive` table + index |
| `app/core/services/storage/schema/index.ts` | modify ✅ | Register `initializeArchiveSchema` as step 6 |
| `app/core/services/storage/archiveStorage.ts` | **CREATE** ✅ | `writeArchivedTasks`, `getArchivedTasks` |
| `app/core/services/archivalService.ts` | **CREATE** ✅ | `archiveCompletedTasks()` — the archival job function |
| `app/core/domain/taskActions.ts` | modify ✅ | Import `archiveCompletedTasks`, wired into `runMidnightJob` as job #3 |
| `app/screens/browse/HistoryManagementScreen.tsx` | modify ✅ | Replaced "Coming Soon" placeholder with real history UI |

`BrowseScreen.tsx` does **not** need to change — the `history` key and routing branch already exist.

---

## Step-by-Step Implementation

---

### Step 1 — Schema: `app/core/services/storage/schema/archive.ts`

```typescript
import { db } from '../database';

/**
 * Creates the task_archive table and its index.
 * Safe to call on every launch — CREATE TABLE/INDEX IF NOT EXISTS is idempotent.
 */
export function initializeArchiveSchema(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS task_archive (
      id            TEXT    PRIMARY KEY,
      title         TEXT    NOT NULL,
      category_id   TEXT,
      category_name TEXT,
      completed_at  INTEGER NOT NULL,
      archived_at   INTEGER NOT NULL,
      was_recurring INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_archive_completed_at
      ON task_archive (completed_at DESC);
  `);

  console.log('✅ Archive schema initialized');
}
```

---

### Step 2 — Register in `schema/index.ts`

Add to imports:
```typescript
import { initializeArchiveSchema } from './archive';
```

Add as step 6 inside `initializeAllSchemas()`:
```typescript
// Step 6: Task archive table — stores compressed records of completed tasks
// after they are swept from the live tasks table.
// No dependencies on other tables — safe to run last.
initializeArchiveSchema();
```

---

### Step 3 — Storage layer: `app/core/services/storage/archiveStorage.ts`

```typescript
import { db } from './database';

/** Shape of a row in task_archive. Mirrors the schema exactly. */
export interface ArchivedTask {
  id:           string;
  title:        string;
  categoryId?:  string;
  categoryName?: string;
  completedAt:  number;
  archivedAt:   number;
  wasRecurring: boolean;
}

/**
 * Batch-inserts archived task rows.
 *
 * Uses INSERT OR IGNORE so that if the archival job is retried after a crash
 * (the midnight job writes its date AFTER archival completes) rows that were
 * already archived on the previous run are silently skipped. No duplicates.
 *
 * @param tasks - Array of tasks to archive. Empty array is a no-op.
 */
export function writeArchivedTasks(tasks: ArchivedTask[]): void {
  if (tasks.length === 0) return;

  for (const t of tasks) {
    db.runSync(
      `INSERT OR IGNORE INTO task_archive
         (id, title, category_id, category_name, completed_at, archived_at, was_recurring)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        t.title,
        t.categoryId  ?? null,
        t.categoryName ?? null,
        t.completedAt,
        t.archivedAt,
        t.wasRecurring ? 1 : 0,
      ],
    );
  }
}

/**
 * Reads archived tasks within an optional completed_at date range.
 *
 * @param fromMs - Optional inclusive lower bound (Unix ms). Omit for all-time.
 * @param toMs   - Optional inclusive upper bound (Unix ms). Omit for all-time.
 * @returns Rows ordered by completed_at DESC (most recent first).
 */
export function getArchivedTasks(fromMs?: number, toMs?: number): ArchivedTask[] {
  let query = `SELECT * FROM task_archive`;
  const params: number[] = [];

  if (fromMs !== undefined && toMs !== undefined) {
    query += ` WHERE completed_at BETWEEN ? AND ?`;
    params.push(fromMs, toMs);
  } else if (fromMs !== undefined) {
    query += ` WHERE completed_at >= ?`;
    params.push(fromMs);
  }

  query += ` ORDER BY completed_at DESC`;

  const rows = db.getAllSync<{
    id:            string;
    title:         string;
    category_id:   string | null;
    category_name: string | null;
    completed_at:  number;
    archived_at:   number;
    was_recurring: number;
  }>(query, params);

  return rows.map(r => ({
    id:           r.id,
    title:        r.title,
    categoryId:   r.category_id   ?? undefined,
    categoryName: r.category_name ?? undefined,
    completedAt:  r.completed_at,
    archivedAt:   r.archived_at,
    wasRecurring: r.was_recurring === 1,
  }));
}
```

---

### Step 4 — Archival service: `app/core/services/archivalService.ts`

```typescript
import { db } from './storage/database';
import { writeArchivedTasks, ArchivedTask } from './storage/archiveStorage';

/**
 * ARCHIVE COMPLETED TASKS
 * -----------------------
 * Moves all completed tasks out of the live `tasks` table into `task_archive`.
 * Called by runMidnightJob() as job #3 (after autoFail and autoSchedule).
 *
 * What it does, in order:
 *   1. Fetch all completed rows from `tasks`, joined to `categories` for names.
 *   2. Determine which are permanent task instances (via template_instances join).
 *   3. Write compressed ArchivedTask rows to task_archive (INSERT OR IGNORE).
 *   4. Delete the originals from `tasks`.
 *   5. Delete permanent instance rows from `template_instances`
 *      (WITHOUT decrementing instanceCount — that's a historical count).
 *
 * Idempotency:
 *   INSERT OR IGNORE in step 3 means re-running after a crash never duplicates
 *   archive rows. Steps 4 and 5 are DELETEs — running them twice on already-
 *   deleted rows is a safe no-op.
 *
 * Stats safety:
 *   - completion_log is NOT touched — it is append-only and permanent.
 *   - template_stats is NOT touched — it tracks aggregate counts, not rows.
 *   - instanceCount on templates is NOT decremented — it is a count of instances
 *     ever created, used as the denominator for completionRate. Decrementing on
 *     archival would retroactively change the historical rate, which is wrong.
 */
export async function archiveCompletedTasks(): Promise<void> {
  const archivedAt = Date.now();

  // ── Step 1: Fetch completed tasks with category names ─────────────────────
  // LEFT JOIN categories so uncategorised tasks (category_id IS NULL) are
  // still included — they just get null for category_name.
  // LEFT JOIN template_instances so we can detect permanent instances.
  // A row in template_instances means the task is a permanent task instance.
  const rows = db.getAllSync<{
    id:            string;
    title:         string;
    category_id:   string | null;
    category_name: string | null;
    completed_at:  number;
    is_recurring:  number;   // 1 if template_instances has a row for this task id
  }>(
    `SELECT
       t.id,
       t.title,
       t.category_id,
       c.name        AS category_name,
       t.completed_at,
       CASE WHEN ti.instanceId IS NOT NULL THEN 1 ELSE 0 END AS is_recurring
     FROM tasks t
     LEFT JOIN categories c         ON c.id         = t.category_id
     LEFT JOIN template_instances ti ON ti.instanceId = t.id
     WHERE t.completed = 1
       AND t.completed_at IS NOT NULL`,
    [],
  );

  if (rows.length === 0) return;  // Nothing to archive today.

  // ── Step 2: Build ArchivedTask objects ────────────────────────────────────
  const toArchive: ArchivedTask[] = rows.map(r => ({
    id:           r.id,
    title:        r.title,
    categoryId:   r.category_id   ?? undefined,
    categoryName: r.category_name ?? undefined,
    completedAt:  r.completed_at,
    archivedAt,
    wasRecurring: r.is_recurring === 1,
  }));

  // ── Step 3: Write to task_archive (INSERT OR IGNORE — safe on retry) ──────
  writeArchivedTasks(toArchive);

  // ── Step 4: Delete from tasks ─────────────────────────────────────────────
  // Collect the ids to delete so we can use a single WHERE id IN (...) statement.
  const ids = toArchive.map(t => t.id);
  // SQLite parameterised queries don't support array binding, so we build
  // the placeholders string manually: '?,?,?,...'
  const placeholders = ids.map(() => '?').join(',');

  db.runSync(
    `DELETE FROM tasks WHERE id IN (${placeholders})`,
    ids,
  );

  // ── Step 5: Delete permanent instance rows from template_instances ─────────
  // Only for rows that were identified as recurring in step 1.
  // We deliberately do NOT call deletePermanentInstance() because that function
  // decrements instanceCount, which we do not want here (see docblock above).
  const recurringIds = toArchive.filter(t => t.wasRecurring).map(t => t.id);
  if (recurringIds.length > 0) {
    const recurringPlaceholders = recurringIds.map(() => '?').join(',');
    db.runSync(
      `DELETE FROM template_instances WHERE instanceId IN (${recurringPlaceholders})`,
      recurringIds,
    );
  }
}
```

---

### Step 5 — Wire into `taskActions.ts`

Add import at the top:
```typescript
import { archiveCompletedTasks } from '../services/archivalService';
```

In `runMidnightJob`, replace the comment line:
```typescript
// Before:
// Future: await archiveCompletedTasks();

// After:
await archiveCompletedTasks();
```

---

### Step 6 — History screen: `app/screens/browse/HistoryManagementScreen.tsx`

**Replace** the current "Coming Soon" placeholder entirely.

#### Entry point in BrowseScreen

No changes needed — `BrowseScreen` already has:
```typescript
// SubScreen type already includes 'history'
type SubScreen = 'none' | 'categories' | 'history' | ...;

// FEATURES array already has the History card
{ key: 'history', title: 'History', description: 'see previously completed tasks', ... }

// Routing branch already exists
if (subScreen === 'history') {
  return <HistoryManagementScreen onBack={() => setSubScreen('none')} />;
}
```

#### Screen layout

```
HistoryManagementScreen
  ├── Header ("History", ← Back button)
  │
  ├── Time filter bar (horizontal scroll or tab row)
  │     [ All ]  [ Today ]  [ This Week ]  [ This Month ]  [ This Year ]
  │       ↑ selected tab highlighted
  │
  ├── SectionList — grouped by day
  │     ┌──────────────────────────────────────────┐
  │     │  Thursday, Feb 27 2026                   │  ← section header
  │     │  ✓  Morning Run        [Health]           │  ← recurring badge
  │     │  ✓  Call dentist       [Personal]         │
  │     ├──────────────────────────────────────────┤
  │     │  Wednesday, Feb 26 2026                  │
  │     │  ✓  Weekly report      [Work]  🔁         │  ← 🔁 if wasRecurring
  │     └──────────────────────────────────────────┘
  │
  └── Empty state
        "No completed tasks archived yet.
         Tasks are moved here automatically each day."
```

#### Props interface

```typescript
export interface HistoryManagementScreenProps {
  onBack: () => void;   // matches the pattern used by all BrowseScreen sub-screens
}
```

#### Filter ranges

| Tab | `fromMs` | `toMs` |
|-----|----------|--------|
| All | undefined | undefined |
| Today | start of today (00:00:00.000) | end of today (23:59:59.999) |
| This Week | start of current Monday | end of today |
| This Month | start of 1st of current month | end of today |
| This Year | Jan 1 00:00:00 | end of today |

All computed client-side in the component using `Date` arithmetic — no storage changes needed.

#### Grouping

Use `SectionList` with sections keyed by local date string (`'YYYY-MM-DD'`).
Group `ArchivedTask[]` by `toLocalDateString(new Date(completedAt))`.
Section headers display the full date (e.g. `"Thursday, Feb 27 2026"`).

#### Data loading

Synchronous — `getArchivedTasks(fromMs?, toMs?)` is a sync function (matches the
storage layer pattern). No `useState` + `useEffect` needed for the data load itself.
Filter tab changes re-call `getArchivedTasks` with new bounds and re-group.

#### Category badge

Display `categoryName` as a small pill badge if present. Colour is NOT stored in
the archive (to keep the row compact). Use a neutral grey badge for all entries —
category colours are a live-data concept and the archive record is a historical
snapshot.

---

## Stat Safety — Full Analysis

> **⚠️ WARNING: The original "Stats are completely safe" claim was wrong.**
> There is one real stat breakage that archival introduces. It must be fixed
> before archival is implemented. Read this section in full before writing code.

---

### Tables written by archival and their impact

| Table | Archival action | Safe? |
|-------|----------------|-------|
| `tasks` | Completed rows deleted | ✅ See below |
| `template_instances` | Completed instance rows deleted | ⚠️ See broken query below |
| `completion_log` | **Not touched** — append-only forever | ✅ Always safe |
| `template_stats` | **Not touched** | ✅ Not read by active stats system |
| `templates` | **Not touched** | ✅ Template definitions never archived |
| `categories` | **Not touched** | ✅ Lookup table, not an event log |

---

### ⚠️ BROKEN — Must fix before implementing archival

**Function:** `getPermanentTaskSummariesForCategory()` in `statsStorage.ts`

**Called by:** `useStats.getCategoryDetail()` → `CategoryDetailScreen` → `PermanentTaskListCard`

**What it shows:** For each permanent task template in a category — total completions
and total attempts, used to display counts and a completion rate on the card.

**The query (current broken version):**

```sql
SELECT ti.templateId,
       COUNT(CASE WHEN cl.outcome = 'completed' THEN 1 END) AS totalCompleted,
       COUNT(cl.id) AS totalAttempts
FROM completion_log cl
JOIN template_instances ti ON ti.instanceId = cl.task_id
WHERE cl.category_id = ?
GROUP BY ti.templateId
ORDER BY totalCompleted DESC
```

**Why it breaks after archival:**
Archival Step 5 deletes completed instance rows from `template_instances` (because
the instance is gone — there is no point keeping a junction entry for a task
that no longer exists in `tasks`). After that deletion, the INNER JOIN
`JOIN template_instances ti ON ti.instanceId = cl.task_id` no longer finds a
match for archived completions — those `completion_log` rows are silently dropped
from the result set.

**The symptom:**
After the first archival run, `PermanentTaskListCard` in `CategoryDetailScreen`
shows understated (possibly zero) completion counts for templates that have any
archived completions. The screen does not crash — the numbers are just wrong.
This is a silent data bug.

**Why the fix is straightforward:**
`completion_log` already stores `template_id` as a direct column. It is written
by `logCompletion()` in `taskActions.ts` at the moment of every completion:

```typescript
templateId: task.kind === 'permanent' ? (task.metadata as any)?.permanentId ?? null : null,
```

The JOIN through `template_instances` was never necessary — the templateId is
already in the log. Grouping by `cl.template_id` directly removes the dependency
on `template_instances` entirely.

**Required pre-implementation fix in `statsStorage.ts`:**
- Rewrite `getPermanentTaskSummariesForCategory` to `GROUP BY cl.template_id`
  instead of joining through `template_instances`.
- Filter to `cl.template_id IS NOT NULL` (excludes one-off tasks, which have
  `template_id = NULL` in the log).
- After this fix, the entire active stats system reads exclusively from
  `completion_log` — the ideal architecture that `completion_log` was designed
  for.

**After the fix, the query becomes:**

```sql
SELECT cl.template_id AS templateId,
       COUNT(CASE WHEN cl.outcome = 'completed' THEN 1 END) AS totalCompleted,
       COUNT(cl.id) AS totalAttempts
FROM completion_log cl
WHERE cl.category_id = ?
  AND cl.template_id IS NOT NULL
GROUP BY cl.template_id
ORDER BY totalCompleted DESC
```

This query is archival-safe: it reads only from `completion_log`, which is never
touched by archival.

---

### Everything else — verified safe

The following analysis was performed by reading all of `statsStorage.ts`,
`useStats.ts`, `completions.ts` (schema), and the three detail screens.

**`completion_log` — all the main stats functions read here only:**

Every core stats function reads exclusively from `completion_log`:
`getCompletionCount`, `getCompletionsByDay`, `getCompletionsByDayWithKind`,
`getCompletionsByMonth`, `getCompletionsByMonthWithKind`,
`getCompletionsByWeekday`, `getCompletionDates`, `getCurrentStreak`,
`getBestStreak`, `getStatSummary`, `getCompletionSummary`, `getTaskTypeSplit`,
`getTopCategories`, `getCompletionsByDayByCategory`,
`getCompletionsByMonthByCategory`, `getLastCompletionTimestamp`.

`completion_log` is **append-only and never touched by archival**. All of these
are unaffected.

---

**`getTodayRaw()` — reads both `tasks` and `completion_log`:**

This function has two parts:

1. *What was completed today* — reads `completion_log WHERE completed_date = today`.
   Archival does not touch `completion_log`. ✅ Safe.

2. *What is still pending today* — reads `tasks WHERE completed = 0`. Archival
   only deletes rows WHERE `completed = 1`. Pending (incomplete) tasks are never
   archived. ✅ Safe.

3. *Pending task kind detection* — `LEFT JOIN template_instances ti ON ti.instanceId = t.id`
   scoped to `WHERE t.completed = 0`. Because only incomplete tasks are queried,
   and archival only deletes `template_instances` rows for completed instances,
   this join always finds the correct rows. ✅ Safe.

---

**`template_stats` table:**

This table exists from an earlier design and is still populated by
`permanentTaskActions.updateTemplateStats()` on every completion. However, it is
**not read by any function in `statsStorage.ts` or `useStats.ts`**. The Sprint 4
stats rebuild replaced it with `completion_log`-based queries. Archival does not
touch it. ✅ Not affected — and also not used.

---

**`templates.instanceCount`:**

This column tracks how many instances have ever been created for a template.
Archival does **not** decrement it — that is intentional and correct (see the
note in Step 5 of the implementation plan). More importantly: `instanceCount` is
**not read by any active stats query** in `statsStorage.ts` or `useStats.ts`.
Stats derive all counts from `completion_log` events. ✅ Safe, and correctly
left alone.

---

### Summary

| Stats area | Source table | Archival safe? |
|------------|-------------|----------------|
| Streaks (current + best) | `completion_log` | ✅ Yes |
| Completion counts (all windows) | `completion_log` | ✅ Yes |
| Bar graphs (week/month/year) | `completion_log` | ✅ Yes |
| Calendar graph | `completion_log` | ✅ Yes |
| Day-of-week pattern | `completion_log` | ✅ Yes |
| Task type split (perm vs one-off) | `completion_log` | ✅ Yes |
| Category breakdown | `completion_log` | ✅ Yes |
| Today card (completions) | `completion_log` | ✅ Yes |
| Today card (pending counts) | `tasks WHERE completed=0` | ✅ Yes |
| `PermanentTaskListCard` counts | `completion_log JOIN template_instances` | ⚠️ **Broken — fix before implementing** |
| `template_stats` table | Not read by active stats | ✅ Not affected |
| `templates.instanceCount` | Not read by active stats | ✅ Not affected |

---

## Midnight Job Integration

After this feature is implemented, `runMidnightJob` in `taskActions.ts` looks like:

```typescript
export async function runMidnightJob(): Promise<void> {
  if (_midnightJobRanThisSession) return;

  const today = toLocalDateString(new Date());
  const lastRunDate = getAppSetting(MIDNIGHT_JOB_DATE_KEY);
  if (lastRunDate === today) {
    _midnightJobRanThisSession = true;
    return;
  }

  _midnightJobRanThisSession = true;

  await autoFailOverdueTasks();           // job 1 — push overdue, log auto_failed
  await autoScheduleRecurringTasks();     // job 2 — create next recurring instances
  await archiveCompletedTasks();          // job 3 — sweep completed tasks to archive

  setAppSetting(MIDNIGHT_JOB_DATE_KEY, today);
}
```

The date is still written AFTER all three jobs complete — crash safety applies to
archival too. If the app crashes after step 2 but before step 3, archival retries
on the next cold start. `writeArchivedTasks` uses `INSERT OR IGNORE`, so rows
already written in the partial run are harmlessly skipped.

### Dev testing mode (currently active)

`runMidnightJobDev()` in `taskActions.ts` runs all three jobs unconditionally
(no session flag, no date gate) and is called on a **3-minute `setInterval`**
from `useTasks.ts`. This lets the full archival pipeline be exercised without
waiting until midnight.

**To switch back to production**, see the instructions in `taskActions.ts` and
`useTasks.ts` — both files have prominent `⚠️ DEV TESTING` banners with
step-by-step revert instructions.

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| Task completed but `completedAt` is null | Excluded from archival (`WHERE completed_at IS NOT NULL`) — defensive guard |
| Archival job retried after crash | `INSERT OR IGNORE` skips already-archived rows; DELETE on already-deleted rows is a no-op — fully safe |
| Template deleted before instance is archived | `LEFT JOIN categories` handles missing category. Template deletion cascades to `template_instances` (via foreign key) — if the instance row is already gone, the Step 5 delete is a no-op |
| User has no completed tasks | `rows.length === 0` early return — no writes, no deletes |
| Category renamed after task completed | Archived with the name it had at archival time — historical accuracy |
| Category deleted after task completed | `LEFT JOIN` returns null — `category_name` stored as null, `categoryId` retained for potential recovery |
| Two midnight jobs run back-to-back (edge case) | The date gate prevents this in normal use. If it somehow happens, idempotency handles it |
| Very large archive (1000s of rows) | `getArchivedTasks` returns all matching rows — if this becomes slow, a `LIMIT`/pagination can be added to the screen without schema changes |
| `ON DELETE CASCADE` on `template_instances` | SQLite foreign key enforcement is **OFF** by default and no `PRAGMA foreign_keys = ON` is set in this codebase. The cascade never fires automatically. Step 5's explicit `DELETE FROM template_instances WHERE instanceId IN (...)` is the real cleanup. The `ON DELETE CASCADE` declaration is inert but harmless. |

---

## Pre-Implementation Checklist

Before writing any archival code, the following must be done:

- [x] **Fix `getPermanentTaskSummariesForCategory` in `statsStorage.ts`** ✅ Done 2026-02-27
      Rewrote the query to `GROUP BY cl.template_id` instead of using
      `JOIN template_instances`. See the "Broken query" section above for the
      exact replacement SQL. This is a prerequisite — implementing archival
      without this fix causes silent stat corruption on `CategoryDetailScreen`.

---

## Verification

1. Create and complete several one-off tasks
2. Assign one-off tasks to a category; confirm they appear in `CategoryDetailScreen`
3. Create a permanent task template (in the same category), complete 2+ instances
4. Open `CategoryDetailScreen` → `PermanentTaskListCard` — note the correct counts
5. Force-quit and reopen the app (midnight job runs, archival sweeps completed tasks)
6. Confirm: completed tasks are gone from `AllTasksScreen` / `TodayScreen`
7. Confirm: Browse → History shows all the completed tasks grouped by day
8. Confirm: recurring instance shows 🔁 indicator; one-off does not
9. **Stats regression check — open `OverallDetailScreen`**: confirm streak, counts,
   bar graphs, calendar, and type split all still show the same numbers as before
   archival (they read `completion_log` — must be unaffected)
10. **Stats regression check — open `CategoryDetailScreen`**: confirm `PermanentTaskListCard`
    still shows the correct completion count for the template from step 3.
    This is the specific query that broke before the fix — if the count drops to
    zero after archival, the fix was not applied correctly.
11. Confirm: the auto-repeat template still has a new pending instance (scheduler
    ran before archival in the midnight job order)
12. Change the History filter to "Today" — confirm only today's completions appear
13. Rename the category used in step 2, reopen Browse → History — confirm old
    history rows still show the original category name (denormalised snapshot)
