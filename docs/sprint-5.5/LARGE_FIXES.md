# Sprint 5.5 — Large Fixes Plan

**Covers:** L1 (Streak calculation) and L2 (Repeatable tasks)
**Status:** L1 complete — L2 pending
**Branch:** Sprint5_5

---

## Background & Architecture Context

Before describing the fixes, a brief recap of the relevant storage model so the
plan reads clearly without requiring the reader to cross-reference other docs.

### completion_log table (append-only)

One row written every time a task is marked complete or auto-failed.

| Column | Meaning |
|---|---|
| `completed_date` | Calendar day ('YYYY-MM-DD') the user pressed "done" |
| `scheduled_date` | Due date ('YYYY-MM-DD') the task was supposed to be done by; NULL for tasks with no due date |
| `outcome` | `'completed'` or `'auto_failed'` |
| `template_id` | The permanent task template ID; NULL for one-off tasks |
| `category_id` | The category ID at time of completion/failure |

### template_stats table (denormalized counters)

| Column | Known issue |
|---|---|
| `currentStreak` | Naive increment — increments on every completion, never resets |
| `maxStreak` | Same naive increment — meaningless after first missed day |

### Midnight job (runs once per calendar day on cold start)

1. `autoFailOverdueTasks` — marks missed tasks as `auto_failed` in completion_log, pushes their due date forward
2. `autoScheduleRecurringTasks` — creates the next pending instance for any auto-repeat template that has no current pending instance
3. `archiveCompletedTasks` — moves completed tasks to the archive table

---

## L1 — Streak Calculation

### What is currently broken

The current implementation in `statsCalculations.ts` — `calcCurrentStreak` and
`calcBestStreak` — counts **consecutive calendar days** with at least one
completion. This is the wrong model for this app.

Symptoms:
- A perm task that runs every Wednesday resets its streak every Thursday through
  Tuesday because those are empty calendar days with no completions.
- A user who completes a weekly task gets a streak of 1 that immediately resets
  the next day.
- Streaks show 0 or 1 for nearly all permanent tasks even when the user has
  been consistently on time.

### The correct streak model (from L1 spec)

There are two scope types with different rules:

---

#### Template / Category streaks

**Unit of measurement:** a scheduled-date slot (i.e., a distinct `scheduled_date`
that the template/category had at least one task due on).

**Increment rule:**
- +1 for each scheduled-date slot where you completed at least one task for that
  scope on or before its due date (no `auto_failed` on that slot).
- You can only earn +1 per day you actually complete a task — even if you
  complete 5 tasks that were due across Mon/Tue/Wed, all on Monday, that is
  +1 to the streak (not +3).
- Early completion is fine: completing a Wednesday task on Monday counts as
  on-time.

**Reset rule:**
- The streak resets to 0 the moment any `auto_failed` outcome appears for that
  scope.
- Empty calendar days between two scheduled-date slots are **completely neutral**
  — they do not increment and do not reset.

**Example:**
```
Template A has instances due Wednesday and Friday.

Wednesday:  user completes all → streak +1 (streak = 1)
Thursday:   nothing scheduled → streak unchanged (streak = 1)
Friday:     user completes all before deadline → streak +1 (streak = 2)
Saturday:   nothing scheduled → streak unchanged (streak = 2)
Next Fri:   user misses it → auto_failed logged → streak resets to 0
```

**Edge case — multiple tasks across multiple days all completed on one day:**
```
Tasks due Mon, Tue, Wed — user completes all three on Monday.
Streak increments by 1 only (not 3), because the increment is per-day-completed,
not per-task or per-due-date.
```

---

#### Overall streak

**Unit of measurement:** calendar days.

**Increment rule:**
- +1 for each calendar day where at least one task was completed AND no tasks
  were auto-failed (i.e., every scheduled task that day was completed on time).

**Reset rule:**
- Any single `auto_failed` outcome on a calendar day kills the overall streak.
- If a day passes with no tasks at all, the streak is neutral (no increment, no
  reset) — it was just an empty day.

---

### What needs to change

#### 1. New streak query in `statsStorage.ts`

Replace the current approach (returning a flat list of distinct `completed_date`
strings) with a richer query that returns, per scheduled-date slot, whether the
slot had any failures.

**For template / category streaks:**

```sql
-- Returns one row per distinct scheduled_date for the scope,
-- with failure count so we can identify broken slots.
SELECT
  scheduled_date,
  SUM(CASE WHEN outcome = 'auto_failed' THEN 1 ELSE 0 END) AS failures,
  SUM(CASE WHEN outcome = 'completed'   THEN 1 ELSE 0 END) AS successes
FROM completion_log
WHERE scheduled_date IS NOT NULL
  AND <filter clause: template_id = ? or category_id = ?>
GROUP BY scheduled_date
ORDER BY scheduled_date ASC
```

Also need the "actual completion days" to enforce the one-increment-per-day cap:

```sql
-- Returns distinct completed_date values for the scope (completed outcomes only)
SELECT DISTINCT completed_date
FROM completion_log
WHERE outcome = 'completed'
  AND <filter clause>
ORDER BY completed_date ASC
```

**For overall streaks:**

```sql
-- Returns one row per calendar day with any activity,
-- with failure count to identify broken days.
SELECT
  completed_date,
  SUM(CASE WHEN outcome = 'auto_failed' THEN 1 ELSE 0 END) AS failures,
  SUM(CASE WHEN outcome = 'completed'   THEN 1 ELSE 0 END) AS successes
FROM completion_log
GROUP BY completed_date
ORDER BY completed_date ASC
```

Add two new exported functions to `statsStorage.ts`:

- `getScheduledDateSlots(filter?: StatFilter): { scheduled_date: string; failures: number; successes: number }[]`
  — for template/category streak calculation
- `getCalendarDayActivity(): { completed_date: string; failures: number; successes: number }[]`
  — for overall streak calculation

#### 2. New streak calculation functions in `statsCalculations.ts`

Replace `calcCurrentStreak(dates: string[])` and `calcBestStreak(dates: string[])`
with two new function pairs — one pair for template/category scope, one pair for
overall.

**Template / Category current streak:**

```typescript
// Input: scheduled-date slots sorted ascending, each with failures/successes counts
// AND the distinct completion days (for the 1-increment-per-day cap)
function calcTemplateCurrentStreak(
  slots: { scheduled_date: string; failures: number; successes: number }[],
  completionDays: string[],  // distinct days where at least one completion happened
): number {
  // 1. Work backward from the most recent slot.
  // 2. For each slot going backward: if failures > 0 → stop (streak broken).
  // 3. For each successful slot: check if there is a completion day on or before
  //    that slot's date (and after the previous slot). If yes, count +1.
  // 4. Apply the 1-increment-per-day cap: a single completion day can only
  //    contribute +1 across all slots it covers.
  // Empty days between slots are skipped — we only iterate over slot rows.
}
```

**Template / Category best streak:**

```typescript
function calcTemplateBestStreak(
  slots: { scheduled_date: string; failures: number; successes: number }[],
  completionDays: string[],
): number {
  // Walk forward through slots.
  // Count consecutive successful slots (failures = 0) as one run.
  // A failed slot resets current run.
  // Return the longest run found.
}
```

**Overall current streak:**

```typescript
function calcOverallCurrentStreak(
  days: { completed_date: string; failures: number; successes: number }[],
): number {
  // Walk backward from most recent day.
  // A day with failures > 0 → streak = 0, stop.
  // A day with failures = 0 and successes > 0 → streak++.
  // A gap in dates (a day with no activity at all) → stop
  //   (overall requires consecutive calendar days — empty days ARE neutral
  //    only in the sense that they don't appear in the result set; a gap
  //    between two active days is still a gap for overall).
}
```

**Overall best streak:**

```typescript
function calcOverallBestStreak(
  days: { completed_date: string; failures: number; successes: number }[],
): number {
  // Walk forward. Consecutive days with no failures and at least one success = run.
  // Any failure or any date gap = reset run.
  // Return longest run.
}
```

#### 3. Update `useStats.ts` calls

Everywhere `useStats.ts` currently computes streaks (for the StreakCard in
OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen, and the
StatPreviewCard data), replace the old approach:

```typescript
// OLD (wrong)
const dates = getDistinctCompletionDates(filter);
const currentStreak = calcCurrentStreak(dates);
const bestStreak    = calcBestStreak(dates);
```

with the new approach:

```typescript
// NEW (for template or category scope)
const slots          = getScheduledDateSlots(filter);
const completionDays = getDistinctCompletionDays(filter);
const currentStreak  = calcTemplateCurrentStreak(slots, completionDays);
const bestStreak     = calcTemplateBestStreak(slots, completionDays);

// NEW (for overall scope — no filter)
const dayActivity    = getCalendarDayActivity();
const currentStreak  = calcOverallCurrentStreak(dayActivity);
const bestStreak     = calcOverallBestStreak(dayActivity);
```

#### 4. Stop writing to `template_stats.currentStreak` / `maxStreak`

The `updateTemplateStats` function in `permanentTaskStorage.ts` increments
`currentStreak` naively on every completion. Since streaks are now computed
from `completion_log` on-demand, these columns are wrong and misleading.

Options:
- Remove the `currentStreak` and `maxStreak` updates from `updateTemplateStats`
  (the columns can stay for now as dead storage, or be dropped later).
- Do NOT read these columns anywhere for display after this fix.

The StatPreviewCard and all detail screens must pull streak values from
`statsStorage` / `useStats`, never from `template_stats`.

#### 5. Backfilled rows have NULL `scheduled_date`

Rows backfilled into `completion_log` from the old `tasks` table (tasks completed
before the completion_log was introduced) have `scheduled_date = NULL` because
the original due date at time of completion was no longer reliably available.

These rows will be excluded from the new `getScheduledDateSlots` query (which
filters `WHERE scheduled_date IS NOT NULL`). This means historical streak data
before the migration date will be missing from slot-based queries.

**Mitigation:**
- This is an acceptable trade-off for historical data — document it.
- For overall streaks, `getCalendarDayActivity()` uses `completed_date` (never
  null), so overall graphs still work for all history.
- Going forward, all new completions correctly set `scheduled_date`.
## sanity check#
- Does scheduled date change when editing the due dates of tasks? Verify that task due date changes correctly update scheduled date

---

### L1 Implementation Checklist

| # | Task | File | Status |
|---|------|------|--------|
| L1.1 | Add `getScheduledDateSlots(filter?)` to `statsStorage.ts` | `statsStorage.ts` | ✅ done |
| L1.2 | Add `getCalendarDayActivity()` to `statsStorage.ts` | `statsStorage.ts` | ✅ done |
| L1.3 | Add `getDistinctCompletionDays(filter?)` to `statsStorage.ts` | `statsStorage.ts` | ✅ done |
| L1.4 | Add `calcTemplateCurrentStreak(slots, completionDays)` to `statsCalculations.ts` | `statsCalculations.ts` | ✅ done |
| L1.5 | Add `calcTemplateBestStreak(slots, completionDays)` to `statsCalculations.ts` | `statsCalculations.ts` | ✅ done |
| L1.6 | Add `calcOverallCurrentStreak(days)` to `statsCalculations.ts` | `statsCalculations.ts` | ✅ done |
| L1.7 | Add `calcOverallBestStreak(days)` to `statsCalculations.ts` | `statsCalculations.ts` | ✅ done |
| L1.8 | Update `useStats.ts` — replace all 7 streak computation call sites with new functions | `useStats.ts` | ✅ done |
| L1.9 | Remove naive streak increment from `updateTemplateStats` and `revertTemplateStats` in `permanentTaskStorage.ts` | `permanentTaskStorage.ts` | ✅ done |
| L1.10 | Verify `scheduled_date` propagates correctly through due-date edits | sanity check | ✅ confirmed — no bug |

---

## Files Touched Summary

| File | L1 | L2 |
|---|---|---|
| `app/core/services/storage/statsStorage.ts` | New query functions (L1.1–1.3) | New query (L2.1) |
| `app/core/utils/statsCalculations.ts` | New streak functions (L1.4–1.7) | — |
| `app/core/hooks/useStats.ts` | Update streak call sites (L1.8) | — |
| `app/core/services/storage/permanentTaskStorage.ts` | Remove naive streak write (L1.9) | — |
| `app/core/domain/taskActions.ts` | — | computeNextDueDate, scheduleNextInstance (L2.2–2.5) |
| `app/core/hooks/useTasks.ts` | — | Possibly call scheduleNextInstance (L2.5) |
| Create/Edit permanent task screens | — | Audit only (L2.6–2.7) |

---

## What Is NOT Changing

- `completion_log` schema — no new columns needed
- `template_stats` columns — left in place as dead storage (not dropped yet)
- The midnight job gate logic — unchanged; Bug 2 is fixed by a separate
  per-completion trigger, not by loosening the gate
- `logCompletion` and `logAutoFail` write paths — unchanged
- Any UI component other than `StreakCard` and `StatPreviewCard` streak display
