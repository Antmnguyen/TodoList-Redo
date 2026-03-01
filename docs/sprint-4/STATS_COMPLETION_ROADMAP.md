# Stats — Completion Roadmap

**Current state (2026-02-22):** Steps 1–7 + TodayCard complete. All storage bugs fixed (including category stacked-graph `COUNT(*)` issue). All screens on real data. Only remaining work: Step 8 (empty states / edge cases) and Step 4 manual runtime verification.

---

## ✅ Step 1 — Pure utilities (no dependencies)
**File:** `app/core/utils/statsCalculations.ts`
**Status: DONE (2026-02-21)**

- `toLocalDateString`, `startOfCurrentWeek`, `startOfCurrentMonth`, `endOfCurrentWeek`, `endOfCurrentMonth`, `prevDay`, `isNextDay`
- `calcCurrentStreak(dates[])`, `calcBestStreak(dates[])`

---

## ✅ Step 2 — Schema + backfill
**Files:** `schema/completions.ts` → `schema/index.ts`
**Status: DONE (2026-02-21)**

- `completion_log` table created with all columns including `outcome TEXT NOT NULL DEFAULT 'completed'`
- All 4 indexes created (`idx_clog_date`, `idx_clog_template`, `idx_clog_category`, `idx_clog_kind_date`)
- `addOutcomeMigration()` added — `ALTER TABLE ADD COLUMN` with silent catch for existing installs
- One-time backfill from existing `tasks` rows (idempotent guard on row count)
- Registered as step 4 in `schema/index.ts`

---

## ✅ Step 3 — Storage service
**File:** `app/core/services/storage/statsStorage.ts`
**Status: DONE (2026-02-21)**

All functions implemented:
- Write: `logCompletion()`, `logAutoFail()`
- Day reads: `getCompletionsByDay`, `getCompletionsByDayWithKind`
- Month reads: `getCompletionsByMonth`, `getCompletionsByMonthWithKind`
- Weekday: `getCompletionsByWeekday` (with optional date range)
- Category breakdowns: `getCompletionsByDayByCategory`, `getCompletionsByMonthByCategory`
- Summary: `getCompletionSummary`, `getStatSummary`
- Type split: `getTaskTypeSplit`, `getTopCategories`, `getPermanentTaskSummariesForCategory`
- Streak: `getCompletionDates`, `getCurrentStreak`, `getBestStreak`

Note: The `outcome` column is included in both `logCompletion` (hardcoded `'completed'`) and `logAutoFail` (hardcoded `'auto_failed'`). All read queries now correctly filter by outcome — streak queries use `WHERE outcome = 'completed'` only (auto_failed days break streaks as intended); count/summary queries use `COUNT(CASE WHEN outcome = 'completed' THEN 1 END)` for the completed column and `COUNT(*)` as `totalAttempts`. `getCompletionSummary` returns `{ completed, totalAttempts }` (not `scheduled`).

---

## ✅ Step 4 — Wire the write side
**Files:** `app/core/domain/taskActions.ts`, `app/core/hooks/useTasks.ts`
**Status: DONE (2026-02-21)**

**What was implemented:**
- `completeTask()` restructured: captures result in `completed`, then calls `logCompletion()` before returning. If `handlePermanentCompletion` throws (template completed, already done), the exception propagates before `logCompletion()` — no false log entry written.
- `autoFailOverdueTasks()` added: filters `!completed && dueDate < todayStart`, calls `logAutoFail()` for each (with `completed_date = task.dueDate` — the due day, not detection day), then `pushTaskForward(task, 1)`.
- `useTasks.ts` mount effect changed to `autoFailOverdueTasks().then(loadTasks)` — auto-fail runs before task list renders.

**⚠️ TO VERIFY — Permanent task logging:**
The write-side code reads `templateId` from `(task.metadata as any)?.permanentId`. This relies on permanent task instances always having `metadata.permanentId` set when passed to `completeTask()` and `autoFailOverdueTasks()`. Needs manual testing:

1. Complete a permanent task instance → confirm `completion_log` row has `template_id` populated and `task_kind = 'permanent'`
2. Complete a regular (one_off) task → confirm `template_id = NULL` and `task_kind = 'one_off'`
3. Set a permanent task instance's `dueDate` to yesterday → restart app → confirm `auto_failed` row written with correct `template_id` and `completed_date = yesterday`
4. Confirm that permanent task **templates** (where `metadata.isTemplate = true`) are never accidentally passed to `autoFailOverdueTasks()` — templates typically have no `dueDate` so they would be skipped by the filter, but worth checking `getAllTasks()` output to be sure

---

## ✅ Step 5 — React hook
**File:** `app/core/hooks/useStats.ts`
**Status: DONE (2026-02-22)**

Three detail functions (`getOverallDetail`, `getCategoryDetail`, `getPermanentDetail`), three preview list functions (`getOverallStatsList`, `getTemplateStatsList`, `getCategoryStatsList`), `getTodayStats()`, and seven navigation functions (`getWeekBarData`, `getWeekBarDataSimple`, `getMonthCalendarData`, `getYearBarData`, `getYearBarDataSimple`, `getCategoryWeekBarData`, `getCategoryYearBarData`). Builder helpers handle zero-filling, weekday remapping (SQLite 0=Sun → UI `(n+6)%7` = Mon), and category name/color enrichment.

---

## ✅ Step 6 — Replace mocks
**Status: DONE (2026-02-22)**

All `getMock*` functions deleted from all four screens. Real hook wired in. See `docs/sprint-4/2026-02-22/CHANGES.md §3` for per-screen details.

---

## ✅ Step 7 — Past-period navigation
**Status: DONE (2026-02-22)**

All five graph components wired to real navigation callbacks:

| Component | Callback | Hook function | Filter |
|-----------|----------|---------------|--------|
| `WeekBarGraph` | `onWeekChange(weekStart)` | `getWeekBarData` / `getWeekBarDataSimple` | category / template / none |
| `MonthCalendarGraph` | `onMonthChange(year, month)` | `getMonthCalendarData` | category / template / none |
| `YearOverviewGraph` | `onYearChange(year)` | `getYearBarData` / `getYearBarDataSimple` | category / template / none |
| `CategoryWeekBarGraph` | `onWeekChange(weekStart)` | `getCategoryWeekBarData` | none (overall only) |
| `CategoryYearOverviewGraph` | `onYearChange(year)` | `getCategoryYearBarData` | none (overall only) |

Detail screens use `useState` per graph piece + `useMemo` for static summary fields, so navigation callbacks update only the affected graph without re-fetching the full screen data.

✅ **Fixed (2026-02-22):** `getCompletionsByDayByCategory` and `getCompletionsByMonthByCategory` both updated to `COUNT(CASE WHEN outcome = 'completed' THEN 1 END)`. `CategoryWeekBarGraph` and `CategoryYearOverviewGraph` now exclude auto-failed rows.

---

## ✅ TodayCard real data
**Status: DONE (2026-02-22)**

`getTodayRaw()` added to `statsStorage.ts`. Queries `completion_log` for today's completions and `tasks LEFT JOIN template_instances` for pending tasks (kind inferred from junction table since `tasks` has no `kind` column). `getTodayStats()` in hook assembles `TodayStats` from raw counts + category enrichment.

---

## ← NEXT → Step 8 — Empty states + edge cases
**Ref:** `docs/sprint-4/STATS_BACKEND_INTEGRATION.md` — §6 (data checks and edge case rules: zero totals, future months, streak caps, segment consistency)

- Zero completions → cards show zero values gracefully (already handled by components)
- New user with no history → verify no crashes, rings show 0%, streaks show 0
- Single completion → streak = 1, one bar visible, calendar shows one cell

---

## Done

Stats page is fully live. All cards pull real data, navigation through past periods shows real history, streaks calculate correctly.

---

## Doc index

| Doc | What it covers |
|-----|----------------|
| `docs/storage/STATS_STORAGE_PLAN.md` | Schema DDL, indexes, backfill, every storage function signature + SQL query, hook sketch |
| `docs/storage/STORAGE_ARCHITECTURE.md` | Existing tables, services, init order, current data flow |
| `docs/sprint-4/STATS_BACKEND_INTEGRATION.md` | Every card's prop contract, time-framing rules, mock→hook swap table, visibility matrix, edge case rules |
