# Changes — 2026-02-22

Stats backend wired end-to-end: storage bugs fixed, `useStats.ts` hook built and documented, all four stats screens swapped from mock data to real storage, past-period graph navigation wired, TodayCard connected to real data.

---

## ⚠️ OPEN ISSUES — fix before marking stats complete

### ~~1. Category stacked graphs count `auto_failed` rows~~ ✅ FIXED (2026-02-22)

**Files:** `app/core/services/storage/statsStorage.ts`
**Functions:** `getCompletionsByDayByCategory`, `getCompletionsByMonthByCategory`

Both functions changed from `COUNT(*) AS count` to `COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS count`. `CategoryWeekBarGraph` and `CategoryYearOverviewGraph` now exclude auto-failed rows from stacked segment heights.

### 2. Step 4 runtime verification not done

The write-side code reads `templateId` from `(task.metadata as any)?.permanentId`. Whether permanent task instances always carry this field in production has not been manually verified.

**Required tests:**
1. Complete a permanent task → confirm `completion_log` row has `template_id` populated, `task_kind = 'permanent'`
2. Complete a one-off task → confirm `template_id = NULL`, `task_kind = 'one_off'`
3. Let a permanent task go overdue → restart app → confirm `auto_failed` row with correct `template_id` and `completed_date = due day`
4. Confirm permanent **templates** (`metadata.isTemplate = true`) are never passed to `autoFailOverdueTasks()` (they typically have no `dueDate` so they'd be filtered, but worth verifying `getAllTasks()` output)

### 3. Step 8 — empty states not done

Not yet verified: zero completions, brand-new user with no history, single-completion edge case. Components are expected to handle zeros gracefully but this has not been tested against real data.

### 4. StatsScreen hook calls unmemorized

`stats.getTodayStats()`, `stats.getOverallStatsList()`, `stats.getTemplateStatsList()`, `stats.getCategoryStatsList()` all run on every `StatsScreen` render. These are synchronous SQLite reads, which are fast, but if perf becomes noticeable wrap them in `useMemo`.

---

---

## 1. Bug fixes — `app/core/services/storage/statsStorage.ts`

Ten outcome-filtering bugs where `COUNT(*)` was counting `auto_failed` rows alongside `completed` rows, inflating completion counts and corrupting streak data.

| # | Function | Bug | Fix |
|---|----------|-----|-----|
| 1 | `getCompletionsByDay` | `COUNT(*) AS completed` | `COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS completed` |
| 2 | `getCompletionsByDayWithKind` | permanent/oneOff CASE expressions had no outcome guard | Added `AND outcome = 'completed'` to both CASE conditions |
| 3 | `getCompletionsByMonth` | same as #1 | same fix |
| 4 | `getCompletionsByMonthWithKind` | same as #2 | same fix |
| 5 | `getCompletionsByWeekday` | same as #1 | same fix |
| 6 | `getCompletionDates` | missing `WHERE outcome = 'completed'` — auto_failed days were treated as streak-keeping days | Added `WHERE outcome = 'completed'` before `AND completed_date >= ?` |
| 7 | `getStatSummary` | all four COUNT queries unfiltered | All now filter `outcome = 'completed'` |
| 8 | `getCompletionSummary` | `completed` unfiltered; return key named `scheduled` | `completed` fixed; `scheduled` → `totalAttempts = COUNT(*)` (all evaluated tasks); return type `{ completed, totalAttempts }` |
| 9 | `getTopCategories` | `count` unfiltered; rate denominator was `MAX(scheduled, count)` | `count = COUNT(CASE WHEN outcome = 'completed' THEN 1 END)`; rate denominator = `totalAttempts = COUNT(*)` |
| 10 | `getPermanentTaskSummariesForCategory` | `totalCompleted` unfiltered; return key `totalScheduled` | `totalCompleted` fixed; `totalScheduled` → `totalAttempts = COUNT(cl.id)` |

**Key principle enforced after these fixes:**
- `COUNT(CASE WHEN outcome = 'completed' THEN 1 END)` → completion counts
- `COUNT(*)` → `totalAttempts` (completed + auto_failed, the correct denominator for rate %)
- Streak queries filter `WHERE outcome = 'completed'` — auto_failed days break streaks, correctly

---

## 2. New file — `app/core/hooks/useStats.ts`

React hook that assembles UI-ready stat bundles for the three detail screens and the StatsScreen preview card lists. Synchronous by design (expo-sqlite sync API).

### Exported interfaces

| Interface | Used by |
|-----------|---------|
| `OverallDetailData` | `OverallDetailScreen` |
| `CategoryDetailData` | `CategoryDetailScreen` |
| `PermanentDetailData` | `PermanentDetailScreen` |

### Public functions (returned from hook)

| Function | Returns | Replaces |
|----------|---------|---------|
| `getOverallDetail(bucketId)` | `OverallDetailData` | `getMockOverallDetail()` |
| `getCategoryDetail(categoryId)` | `CategoryDetailData` | `getMockCategoryDetail()` |
| `getPermanentDetail(templateId)` | `PermanentDetailData` | `getMockPermanentDetail()` |
| `getOverallStatsList()` | `StatPreviewData[]` | `getMockOverallStats()` |
| `getTemplateStatsList()` | `StatPreviewData[]` | `getMockTemplateStats()` |
| `getCategoryStatsList()` | `StatPreviewData[]` | `getMockCategoryStats()` |

### Private helpers

| Helper | Purpose |
|--------|---------|
| `addDays(dateStr, n)` | Date arithmetic for week slot anchoring |
| `bucketDateRange(bucketId)` | Maps bucket id → `{startDate, endDate}` or `null` for all_time |
| `getCategoryMap()` | Single sync query → `Map<id, {name, color}>`, called once per function |
| `getTemplateName(templateId)` | Single-row lookup for template title |
| `buildBreakdown(filter?)` | 4× `getTaskTypeSplit` calls for TimeRangeCountsCard |
| `buildWeekBars(rows)` | Sparse → 7-item `DayData[]` with perm/one-off segments |
| `buildWeekBarsSimple(rows)` | Same, no segments (permanent detail + preview cards) |
| `buildCalendarData(rows)` | Passes through sparse rows, extracts day-of-month number |
| `buildMonthBars(rows)` | 12-item `MonthData[]` with segments |
| `buildMonthBarsSimple(rows)` | Same, no segments |
| `buildDowData(rows)` | Sparse → 7-item DOW array with SQLite→UI weekday remap: `uiIndex = (sqliteWeekday + 6) % 7` |
| `buildCategoryWeekData(rows, catMap)` | O(n) group-then-map for CategoryWeekBarGraph |
| `buildCategoryYearData(rows, catMap)` | Same pattern for CategoryYearOverviewGraph |
| `buildPreviewWeek(filter?)` | 7-item simple week for StatsScreen preview cards |

### Key design decisions

- **Bucket scoping:** only summary cards (CompletionSummaryCard, StreakCard, DayOfWeekPatternCard, TaskTypeBreakdownCard, CategoryBreakdownCard) are bucket-scoped. Graph cards (WeekBarGraph, MonthCalendarGraph, YearOverviewGraph, category graphs) always show the current period regardless of which bucket opened the screen.
- **Streak queries:** `getCompletionDates` called once, result passed to both `calcCurrentStreak` and `calcBestStreak` (avoids two identical queries).
- **Category map:** `getCategoryMap()` called once per function, reused across all category-enrichment steps (avoids N category table queries).
- **DOW `total` field:** left `undefined` (not `0`) when a weekday has no rows. `DayOfWeekPatternCard` interprets undefined as "no denominator" and falls back to relative-to-max rendering rather than showing a misleading 0%.
- **Templates/categories with zero completions:** included in preview lists. Cards render with 0 completed, 0% rate, 0 streak.
- **Direct db queries:** permitted only for `categories` and `templates` lookup tables. All `completion_log` reads go through `statsStorage.ts`.

---

## 3. Mock replacement — four screens (Step 6)

All `getMock*` functions deleted; real hook wired in.

### `app/screens/stats/StatsScreen.tsx`

- Removed: `week()` helper, `getMockOverallStats()`, `getMockTemplateStats()`, `getMockCategoryStats()`, `DayData` import
- Added: `import { useStats }` ; `stats.getOverallStatsList()`, `stats.getTemplateStatsList()`, `stats.getCategoryStatsList()`
- Kept: `getMockTodayStats()` — TodayCard not yet wired to real data

### `app/screens/stats/detail/OverallDetailScreen.tsx`

- Removed: `OverallDetailMockData` interface, `idOffset()`, `getMockOverallDetail()`, 7 type-only named imports (`TimeRangeBreakdown`, `CalendarDayData`, `MonthData`, `DayOfWeekData`, `CategoryBreakdownItem`, `CategoryDayData`, `CategoryMonthData`, `DayData`)
- Kept: `OverallBucket` type, `getBucket()` — still used for conditional card visibility (`showMonth`, `showYear`, `showDayOfWeek`, `showCategoryYear`)
- Added: `import { useStats }`; `useStats().getOverallDetail(params.id)`

### `app/screens/stats/detail/CategoryDetailScreen.tsx`

- Removed: `CategoryDetailMockData` interface, `idOffset()`, `getMockCategoryDetail()`, 5 type-only named imports (`TimeRangeBreakdown`, `CalendarDayData`, `MonthData`, `DayOfWeekData`, `DayData`)
- Added: `import { useStats }`; `useStats().getCategoryDetail(params.id)`

### `app/screens/stats/detail/PermanentDetailScreen.tsx`

- Removed: `PermanentDetailMockData` interface, `idOffset()`, `getMockPermanentDetail()`, 4 type-only named imports (`CalendarDayData`, `MonthData`, `DayOfWeekData`, `DayData`)
- Added: `import { useStats }`; `useStats().getPermanentDetail(params.id)`

---

## 4. Past-period navigation — detail screens (Step 7)

All three detail screens now update graph data when the user navigates to a past period.

### Pattern (same for all three screens)

```tsx
// Static summary — recomputed only if params.id changes
const data = useMemo(() => stats.getOverallDetail(params.id), [params.id]);

// Graph slices — each updated independently by navigation callbacks
const [weeklyData,  setWeeklyData]  = useState(data.weeklyData);
const [monthlyData, setMonthlyData] = useState(data.monthlyData);
const [yearlyData,  setYearlyData]  = useState(data.yearlyData);
```

### Per-screen details

| Screen | Graphs wired | Hook functions used | Filter |
|--------|-------------|---------------------|--------|
| `OverallDetailScreen` | WeekBarGraph, MonthCalendarGraph, YearOverviewGraph, CategoryWeekBarGraph, CategoryYearOverviewGraph | `getWeekBarData`, `getMonthCalendarData`, `getYearBarData`, `getCategoryWeekBarData`, `getCategoryYearBarData` | none |
| `CategoryDetailScreen` | WeekBarGraph, MonthCalendarGraph, YearOverviewGraph | `getWeekBarData`, `getMonthCalendarData`, `getYearBarData` | `{ categoryId: params.id }` |
| `PermanentDetailScreen` | WeekBarGraph, MonthCalendarGraph, YearOverviewGraph | `getWeekBarDataSimple`, `getMonthCalendarData`, `getYearBarDataSimple` | `{ templateId: params.id }` |

`PermanentDetailScreen` uses the `*Simple` variants (no perm/one-off segments) because a single template can only produce permanent completions.

### Navigation functions added to `useStats.ts`

| Function | Storage call | Builds |
|----------|-------------|--------|
| `getWeekBarData(weekStart, filter?)` | `getCompletionsByDayWithKind` | 7-item `DayData[]` with segments |
| `getWeekBarDataSimple(weekStart, filter?)` | `getCompletionsByDay` | 7-item `DayData[]`, no segments |
| `getMonthCalendarData(year, month, filter?)` | `getCompletionsByDay` | `CalendarDayData[]` |
| `getYearBarData(year, filter?)` | `getCompletionsByMonthWithKind` | 12-item `MonthData[]` with segments |
| `getYearBarDataSimple(year, filter?)` | `getCompletionsByMonth` | 12-item `MonthData[]`, no segments |
| `getCategoryWeekBarData(weekStart)` | `getCompletionsByDayByCategory` | `CategoryDayData[]` |
| `getCategoryYearBarData(year)` | `getCompletionsByMonthByCategory` | `CategoryMonthData[]` |

---

## 5. TodayCard real data (Step 9)

### `app/core/services/storage/statsStorage.ts` — `getTodayRaw()`

New function added (before `getPermanentTaskSummariesForCategory`). Executes three synchronous queries:

1. `completion_log WHERE completed_date = today AND outcome = 'completed'` → `completedTasks`, `permanentDone`, `oneOffDone`
2. `tasks LEFT JOIN template_instances WHERE completed = 0 AND due_date = today` → `permanentPending`, `oneOffPending` (kind inferred from junction table — `tasks` has no `kind` column)
3. Two `GROUP BY category_id` queries for `doneByCategory[]` and `pendingByCategory[]`

Returns:
```typescript
{
  completedTasks: number;
  permanentDone: number;   oneOffDone: number;
  permanentPending: number; oneOffPending: number;
  doneByCategory:    Array<{ categoryId: string; count: number }>;
  pendingByCategory: Array<{ categoryId: string; count: number }>;
}
```

### `app/core/hooks/useStats.ts` — `getTodayStats()`

Assembles `TodayStats` (the shape `TodayCard` expects) from `getTodayRaw()` + `getCategoryMap()`:

- Merges done/pending by category into enriched category objects (with `name`, `color`)
- Computes `totalTasks = completedTasks + permanentPending + oneOffPending`
- Adds streak from `getCompletionDates()` → `calcCurrentStreak()`
- Returns full `TodayStats` object

### `app/screens/stats/StatsScreen.tsx`

- Removed `getMockTodayStats()` function and `TodayStats` import
- `const todayStats = stats.getTodayStats()` (called right after `const stats = useStats()`)

---

## 7. Doc updates

### `docs/sprint-4/STATS_COMPLETION_ROADMAP.md`

- Updated current state header: Steps 1–7 + TodayCard complete; known bugs and Step 8 status noted
- Steps 5, 6, 7 and TodayCard marked ✅ done with details
- Step 3 note describes correct post-fix behaviour
- ⚠️ category stacked graph `COUNT(*)` bug called out inline in Step 7 entry

### `docs/storage/STATS_STORAGE_PLAN.md`

- Updated last-modified date to 2026-02-22
- `summary.scheduled` → `summary.totalAttempts` in hook sketch (3 occurrences)
- §9 streak checklist item updated: `☐ Decide…` → `✅ Streak queries filter WHERE outcome = 'completed'`
- `getTopCategories` and `getPermanentTaskSummariesForCategory` descriptions corrected to reflect `totalAttempts`

---

## 5. TypeScript verification

`npx tsc --noEmit` after all changes — only two pre-existing errors in `CreateTaskModal.tsx` and `HomeScreen.tsx` (unrelated to stats). Zero new errors introduced.

---

## Remaining roadmap

| Step | Status |
|------|--------|
| Step 1 — pure utilities | ✅ done |
| Step 2 — schema + backfill | ✅ done |
| Step 3 — storage service | ✅ done (bugs fixed 2026-02-22) |
| Step 4 — write-side wiring | ✅ done |
| Step 5 — `useStats.ts` hook | ✅ done (2026-02-22) |
| Step 6 — replace mocks | ✅ done (2026-02-22) |
| Step 7 — past-period navigation | ✅ done (2026-02-22) |
| TodayCard real data | ✅ done (2026-02-22) |
| Fix `getCompletionsByDayByCategory` / `getCompletionsByMonthByCategory` `COUNT(*)` bug | ✅ done (2026-02-22) |
| Step 4 runtime verification | ⚠️ needs manual testing |
| Step 8 — empty states + edge cases | ⬜ pending |
