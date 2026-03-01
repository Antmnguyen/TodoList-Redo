# Changes — 2026-02-24

Three fixes: permanent task kind/metadata missing from loaded tasks; graph components using seeded mock data instead of real DB data for past-period navigation; completion rates showing over 100%.

---

## 1. Permanent task completion logging fix

**Files changed:**
- `app/core/services/storage/permanentTaskStorage.ts` — added `getAllInstanceMetaSync()`
- `app/core/services/storage/taskStorage.ts` — import + call in `getAllTasks()`

**Problem:** `tasks` table has no `kind` or `metadata` columns. `getAllTasks()` returned tasks without them → `task.kind === undefined` → `completeTask()` and `autoFailOverdueTasks()` fell to the one_off branch → `logCompletion()` wrote `task_kind='one_off'` and `template_id=NULL` for permanent instances → all permanent task stats broken.

**Fix:** `getAllInstanceMetaSync()` does a single JOIN across `template_instances` + `templates` and returns `Map<instanceId, {templateId, templateTitle, autoRepeat}>`. `getAllTasks()` calls it once at the top, then reconstructs `kind: 'permanent'` and full `metadata` from the map for each matching row. Non-permanent tasks get `undefined` for both — identical to previous behavior.

**Downstream fixed automatically (no other code changed):**

| Call site | Before | After |
|-----------|--------|-------|
| `completeTask()` switch on `task.kind` | falls to one_off | hits 'permanent' branch |
| `logCompletion()` — `taskKind` | `'one_off'` | `'permanent'` |
| `logCompletion()` — `templateId` | `null` | real template ID |
| `handlePermanentCompletion()` — `metadata.permanentId` | `undefined` | real template ID |
| `handlePermanentCompletion()` — `metadata.autoRepeat` | `undefined` | correct config |
| `autoFailOverdueTasks()` — `taskKind` | `'one_off'` | `'permanent'` |
| `autoFailOverdueTasks()` — `templateId` | `null` | real template ID |

**Runtime testing still required** — see open issues in `2026-02-22/CHANGES.md`.

---

## 2. Graph components — mock data removed for past-period navigation

**Files changed:**
- `app/components/stats/detail/shared/MonthCalendarGraph.tsx`
- `app/components/stats/detail/shared/WeekBarGraph.tsx`
- `app/components/stats/detail/shared/YearOverviewGraph.tsx`
- `app/components/stats/detail/overall/CategoryWeekBarGraph.tsx`
- `app/components/stats/detail/overall/CategoryYearOverviewGraph.tsx`

**Problem:** All five graph components had a seeded pseudo-random fallback (`seededRand` + `generate*MockData`) that fired when the user navigated to any past period. Real data from `onWeekChange` / `onMonthChange` / `onYearChange` was ignored for any period other than the current one.

**Fix:** Removed all mock fallback logic from each component. `displayData = data` — the component always uses the prop directly. The parent screens already update that prop via the navigation callbacks (which call synchronous SQLite reads in `useStats.ts`), so the data is always correct before the next render.

**Removed per file:**

| File | Removed |
|------|---------|
| `MonthCalendarGraph.tsx` | `seededRand`, `generateMonthMockData`, useMemo fallback, unused `useMemo` import |
| `WeekBarGraph.tsx` | `seededRand`, `generateWeekData`, useMemo wrapper, unused `useMemo` import |
| `YearOverviewGraph.tsx` | `seededRand`, `generateYearMockData`, useMemo fallback, unused `useMemo` import |
| `CategoryWeekBarGraph.tsx` | `seededRand`, `weekSeed`, mock branch in `displayItems`, nullable `segments` in `BarColumn` |
| `CategoryYearOverviewGraph.tsx` | `seededRand`, `generatePastYearTotals`, mock branch in `displayItems`, nullable `segments` in `MonthBar` |

---

## 3. StatsScreen memoization — assessed, not needed

`useMemo` on the four `useStats()` calls in `StatsScreen` is not worth implementing:
- Typical user (~5 templates, ~5 categories): ~47 sync SQLite reads per render ≈ 10–30ms. Imperceptible.
- No viable dep array: DB changes (task completions) have no corresponding React dep. `useMemo([])` would serve stale data.
- If perf ever matters: introduce a `statsVersion` context counter incremented on task completion, not `useMemo`.

---

---

## 4. Completion rate over 100% — fixed

**File changed:** `app/core/services/storage/statsStorage.ts`

**Problem:** Five read queries computed a `scheduled` denominator that was a strict *subset* of the `completed` numerator, making `completed / scheduled > 1` common:

| Query | Broken denominator |
|-------|--------------------|
| `getCompletionsByDay` | `COUNT(CASE WHEN scheduled_date = completed_date THEN 1 END)` — only tasks completed on their own due date |
| `getCompletionsByDayWithKind` | same |
| `getCompletionsByMonth` | `COUNT(CASE WHEN scheduled_date IS NOT NULL AND same-month THEN 1 END)` — tasks in the same month as their due date |
| `getCompletionsByMonthWithKind` | same |
| `getCompletionsByWeekday` | `COUNT(CASE WHEN scheduled_date IS NOT NULL THEN 1 END)` — tasks that had any due date |

**Example of the bug:** Complete 5 tasks on Monday, 2 of which had no due date. `completed = 5`, `scheduled = 3` → `safePct(5, 3) = 167%`.

**Fix:** All five queries now use `COUNT(*) AS scheduled` — total rows for that time bucket (completed + auto_failed). This is the correct denominator: every row is exactly one evaluated task, so `completed ≤ COUNT(*)` always holds and rates are capped at 100%.

The semantic meaning of `%` mode in graphs is now: "of all tasks evaluated on this day/month/weekday, what fraction succeeded?" — consistent with how `getCompletionSummary` (used by `CompletionSummaryCard`) already worked.

---

## Remaining open items

| Item | Status |
|------|--------|
| Step 4 runtime verification (manual testing) | ⚠️ needs manual testing |
| Step 8 — empty states + edge cases | ⬜ pending |
| `CategoryWeekBarGraph` legend (uses Monday only, not all 7 days) | ⬜ minor |
