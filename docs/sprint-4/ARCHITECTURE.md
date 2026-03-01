# Sprint 4 — Stats Architecture
2026-02-24

---

## What Sprint 4 is

Sprint 4 adds a full statistics system to the app. Every time a task is completed or auto-failed, a row is written to `completion_log`. The stats screens read from that log to show the user how they're doing — today's progress, streaks, completion rates, breakdowns by category and permanent task, and historical graphs navigable by week, month, and year.

There are three detail views: **Overall** (the app as a whole, across four time buckets), **Category** (one category's history), and **Permanent Task** (one recurring task's history). All three share the same card set and graph components; they differ only in how the underlying queries are filtered.

The system is entirely synchronous — expo-sqlite's sync API means every storage call returns immediately, so there is no loading state anywhere in the stats UI.

---

## Data flow

```
task completed / auto-failed
        ↓
  taskActions.ts  →  statsStorage.logCompletion() / logAutoFail()
                              ↓
                       completion_log table
                              ↓
                       statsStorage (reads)
                              ↓
                         useStats.ts
                              ↓
                    StatsScreen / Detail screens
```

---

## Files and purposes

### Storage

| File | Purpose |
|------|---------|
| `statsStorage.ts` | **Only file that touches `completion_log`.** Write: `logCompletion`, `logAutoFail`. Read: all query functions (by day, month, weekday, category, template, summary, streaks, today). |
| `taskStorage.ts` | Loads tasks from `tasks` table. Calls `getAllInstanceMetaSync()` to reconstruct `kind` and `metadata` on permanent instances — these columns don't exist in `tasks`. |
| `permanentTaskStorage.ts` | Owns `templates` and `template_instances` tables. `getAllInstanceMetaSync()` is the batch JOIN used by `taskStorage` to restore permanent task identity. |

### Logic

| File | Purpose |
|------|---------|
| `statsCalculations.ts` | Pure date math and streak logic. No imports from storage or React. `calcCurrentStreak`, `calcBestStreak`, week/month boundary helpers. |
| `statUtils.ts` | `safePct(done, total)` — div-by-zero safe percentage. Used everywhere a rate % is displayed. |

### Hook

| File | Purpose |
|------|---------|
| `useStats.ts` | Assembles all UI-ready data bundles. Calls storage reads, zero-fills sparse results, applies SQLite→UI weekday remap `(n+6)%7`. Returns one function per screen + past-period nav helpers. **All synchronous — no loading state.** |

### Screens

| File | Purpose |
|------|---------|
| `StatsScreen.tsx` | Preview lists — TodayCard + three collapsible sections (Overall, Categories, Permanent Tasks). Calls four `useStats()` functions on every render. |
| `OverallDetailScreen.tsx` | Bucket-scoped detail (all_time / all_year / all_month / all_week). Summary cards scoped to bucket; graph cards always show current period. |
| `CategoryDetailScreen.tsx` | All-time detail for one category. Same card set as Overall minus category stacked graphs. Includes tappable permanent task list → drills to PermanentDetailScreen. |
| `PermanentDetailScreen.tsx` | All-time detail for one template. Solid bars (no perm/one-off split — single task type by definition). |

### Components

**Shared detail cards** (`components/stats/detail/shared/`):
- `CompletionSummaryCard` — ring + completed count + rate %
- `StreakCard` — current + best streak pills
- `TimeRangeCountsCard` — 4-window counts with optional perm/one-off breakdown
- `WeekBarGraph` — 7-bar chart, built-in week navigation, Count/% toggle
- `MonthCalendarGraph` — calendar grid, built-in month navigation, square progress borders
- `YearOverviewGraph` — 12-bar Jan–Dec, built-in year navigation, Count/% toggle
- `DayOfWeekPatternCard` — all-time pattern by weekday
- `TaskTypeBreakdownCard` — permanent vs one-off split

**Overall-only** (`components/stats/detail/overall/`):
- `CategoryBreakdownCard` — top-5 categories horizontal bar list
- `CategoryWeekBarGraph` — 7-bar chart stacked by category color
- `CategoryYearOverviewGraph` — 12-bar chart stacked by category color

**Category-only** (`components/stats/detail/category/`):
- `PermanentTaskListCard` — tappable list of templates in this category

---

## Key design decisions

- **`completion_log` is append-only.** No updates or deletes. `outcome` = `'completed'` or `'auto_failed'`. Completion rate = `completed / COUNT(*)` (all evaluated tasks).
- **`tasks` table has no `kind` column.** Permanent identity is reconstructed at load time via `template_instances` JOIN, not stored on the task row.
- **All stats reads are synchronous** (expo-sqlite sync API). `useStats.ts` returns plain objects — no async, no loading state, no useState.
- **Graph components own navigation UI** (‹ › arrows). Parent screens hold graph data in `useState` and update it via `onWeekChange` / `onMonthChange` / `onYearChange` callbacks, which call `useStats` nav helpers synchronously.
- **Bucket scoping (OverallDetailScreen only).** The selected bucket (week/month/year/all_time) scopes summary cards only. Graph cards always show the current period regardless of bucket.
- **StatFilter** `{ templateId? | categoryId? }` threads through all storage reads to scope any query to a single template or category. Never both simultaneously.
