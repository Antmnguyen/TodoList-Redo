# Sprint 4 — Phase 4 & 5: Detail Screens Plan

**Created:** 2026-02-18
**Branch:** `Sprint4`
**Covers:** Phase 4 (detail components) + Phase 5 (screen assembly + navigation)
**Triggered by:** Tapping any `StatPreviewCard` in `StatsScreen`

---

## Overview

Three tappable card types on `StatsScreen` each navigate to their own detail screen:

| Card tapped from | Screen shown | Accent |
|-----------------|-------------|--------|
| Overall section (any time range) | `OverallDetailScreen` | `#FF9500` orange |
| Categories section | `CategoryDetailScreen` | Category's own color |
| Permanent Tasks section | `PermanentDetailScreen` | `#007AFF` blue |

All three screens are full-screen overlays (same pattern as CreateTaskScreen — tab bar hidden, back button in header).

---

## File Structure

```
app/
├── screens/stats/
│   ├── StatsScreen.tsx                    ✅ existing
│   └── detail/
│       ├── OverallDetailScreen.tsx        ☐ Phase 5
│       ├── CategoryDetailScreen.tsx       ☐ Phase 5
│       └── PermanentDetailScreen.tsx      ☐ Phase 5
│
├── components/stats/
│   ├── (TodayCard, StatPreviewCard, etc.) ✅ existing
│   └── detail/
│       │
│       ├── shared/            ← used by ALL THREE screen types
│       │   ├── DetailHeader.tsx            ☐ Phase 4
│       │   ├── CompletionSummaryCard.tsx   ☐ Phase 4
│       │   ├── StreakCard.tsx              ☐ Phase 4
│       │   ├── TimeRangeCountsCard.tsx     ☐ Phase 4
│       │   ├── TimeRangePicker.tsx         ☐ Phase 4  ← Week/Month/Year/All tabs
│       │   ├── WeekNavigator.tsx           ☐ Phase 4  ← browse past weeks
│       │   ├── WeekBarGraph.tsx            ☐ Phase 4
│       │   ├── MonthCalendarGraph.tsx      ☐ Phase 4
│       │   ├── YearOverviewGraph.tsx       ☐ Phase 4
│       │   ├── DayOfWeekPatternCard.tsx    ☐ Phase 4  ← all three screens
│       │   └── TaskTypeBreakdownCard.tsx   ☐ Phase 4  ← Overall + Category only
│       │
│       ├── overall/           ← Overall-specific
│       │   └── CategoryBreakdownCard.tsx   ☐ Phase 4
│       │
│       └── category/          ← Category-specific
│           └── PermanentTaskListCard.tsx   ☐ Phase 4
│
└── navigation/
    └── MainNavigator.tsx      ☐ Phase 5  ← add StatDetail to OverlayScreen
```
---

## Shared Stats — Universal Calculations & Display

These stats are **calculated identically** and **rendered identically** across all three screen types. The only difference is the SQL filter applied (no filter = overall, `category = ?`, `template_id = ?`).

### Universal Stats

| Stat | Calculation | Display Component |
|------|-------------|-------------------|
| Completion rate | `done / total × 100` | `CompletionSummaryCard` |
| Total completions | `COUNT(*)` where completed | `CompletionSummaryCard` |
| Current streak | Consecutive days with ≥1 done (from today backwards) | `StreakCard` |
| Best streak | Longest-ever consecutive run | `StreakCard` |
| This week count | Completions in current Mon–Sun week | `TimeRangeCountsCard` |
| This month count | Completions in current calendar month | `TimeRangeCountsCard` |
| This year count | Completions in current calendar year | `TimeRangeCountsCard` |
| All time count | Total completions ever | `TimeRangeCountsCard` |
| Weekly breakdown | 7 × DayData (Mon–Sun raw count) | `WeekBarGraph` |
| Monthly breakdown | Day-by-day data for current month | `MonthCalendarGraph` |
| Yearly breakdown | 12 × MonthData | `YearOverviewGraph` |

All of these hit the same storage functions from `statsStorage.ts` — just with a different `StatFilter` passed in.

### Stats Shared Between Overall + Category Only

| Stat | Calculation | Display Component |
|------|-------------|-------------------|
| Task type breakdown | Permanent count + % vs One-off count + % | `TaskTypeBreakdownCard` |

Permanent tasks only show one type so this breakdown is meaningless for them.

---

## Stat Breakdown by Screen Type

### Overall Detail Screen
Uses all universal stats **plus**:
- **Time range picker** — tabs for Week / Month / Year / All Time; scopes every stat on screen to that range
- **Week navigator** — in the Week tab, prev/next arrows let you browse past weeks (this is the "extra screens for week" — navigable state within the weekly view)
- **Category breakdown** — horizontal bar list showing which categories contribute the most completions (top 5 by count)
- **Task type breakdown** — permanent vs one-off split (shared with Category)

### Category Detail Screen
Uses all universal stats **plus**:
- **Task type breakdown** — what % of this category's tasks are permanent vs one-off (shared with Overall)
- **Permanent task list** — mini cards for each permanent task template in this category, showing that task's individual completion rate

### Permanent Task Detail Screen
Uses all universal stats **plus**:
- **Day-of-week pattern** — 7-bar chart (Mon–Sun) showing which days of the week this specific task is most commonly completed. Different from weekly breakdown (which is a rolling 7-day window) — this aggregates ALL completions by day-of-week over all time.

---

## Screen Layouts

### OverallDetailScreen

```
┌──────────────────────────────────────────┐
│  ←  All Tasks / This Week / ...          │   DetailHeader (orange accent)
├──────────────────────────────────────────┤
│  [ Week ]  [ Month ]  [ Year ]  [ All ] │   TimeRangePicker (tab strip)
├──────────────────────────────────────────┤
│                                          │
│     ┌───────┐   156 completed            │
│     │  78%  │   78% completion rate      │   CompletionSummaryCard
│     └───────┘                            │
│                                          │
├──────────────────────────────────────────┤
│  🔥 Current  12 days   │  Best  34 days  │   StreakCard
├──────────────────────────────────────────┤
│  Week  │  Month  │  Year  │  All Time    │
│   12   │   48    │  156   │    620       │   TimeRangeCountsCard
├──────────────────────────────────────────┤
│  [ WEEK VIEW — visible when Week tab ]   │
│  ‹ Feb 10–16  ›                          │   WeekNavigator (browse past weeks)
│  ██ █ ▄ ██ ▄  _  _                      │
│  M  T  W  T  F  S  S    [Count] [%]     │   WeekBarGraph (full-width, toggle)
├──────────────────────────────────────────┤
│  [ MONTH VIEW — visible when Month tab ] │
│  ●  ●  ◐  ○  ●  ●  ○                   │
│  ●  ○  ●  ●  ●  ◐  ○                   │   MonthCalendarGraph
│  ○  ●  ●  ●  ○  ...                     │
├──────────────────────────────────────────┤
│  [ YEAR VIEW — visible when Year tab ]   │
│  J  F  M  A  M  J  J  A  S  O  N  D    │
│  █  ▄  █  ██ ▄  ▂  █  ▄  ██ █  ▂  ▄   │   YearOverviewGraph
├──────────────────────────────────────────┤
│  🔁 Permanent   📝 One-off               │   TaskTypeBreakdownCard
│    60%  94       40%  62                 │
├──────────────────────────────────────────┤
│  By Category                             │
│  ● Work       ████████░░  64   85%       │   CategoryBreakdownCard
│  ● Health     █████░░░░░  38   70%       │   (horizontal bars, top 5)
│  ● Lifestyle  ████░░░░░░  31   65%       │
└──────────────────────────────────────────┘
```

**Week Navigator note:** In the Week tab, `‹` / `›` arrows cycle through past weeks (capped at earliest data). The current week is the default; future weeks are disabled. Each navigation updates all stats on screen to that week's data.

---

### CategoryDetailScreen

```
┌──────────────────────────────────────────┐
│  ←  Work                                 │   DetailHeader (category color)
├──────────────────────────────────────────┤
│     ┌───────┐   64 completed             │
│     │  85%  │   85% completion rate      │   CompletionSummaryCard
│     └───────┘                            │
├──────────────────────────────────────────┤
│  🔥 Current  9 days   │  Best  21 days   │   StreakCard
├──────────────────────────────────────────┤
│  Week  │  Month  │  Year  │  All Time    │
│   22   │   81    │  320   │    640       │   TimeRangeCountsCard
├──────────────────────────────────────────┤
│  ██ █ ▄ ██ ▄  _  _                      │
│  M  T  W  T  F  S  S    [Count] [%]     │   WeekBarGraph
├──────────────────────────────────────────┤
│  ●  ●  ◐  ○  ●  ●  ○  ...              │   MonthCalendarGraph
├──────────────────────────────────────────┤
│  J  F  M  A  M  J  J  A  S  O  N  D    │
│  █  ▄  █  ██ ▄  ▂  ...                 │   YearOverviewGraph
├──────────────────────────────────────────┤
│  🔁 Permanent   📝 One-off               │   TaskTypeBreakdownCard
│    70%  45       30%  19                 │
├──────────────────────────────────────────┤
│  Permanent Tasks in Work                 │
│  ┌───────────────────────────────────┐   │
│  │ Morning Standup    ████████░░ 80% │   │   PermanentTaskListCard
│  │ Weekly Review      ██████░░░░ 60% │   │   (mini rows, each tappable →
│  │ Code Review        █████░░░░░ 50% │   │    PermanentDetailScreen)
│  └───────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

---

### PermanentDetailScreen

```
┌──────────────────────────────────────────┐
│  ←  Morning Workout                      │   DetailHeader (blue accent)
├──────────────────────────────────────────┤
│     ┌───────┐   45 completed             │
│     │  90%  │   90% completion rate      │   CompletionSummaryCard
│     └───────┘                            │
├──────────────────────────────────────────┤
│  🔥 Current  7 days   │  Best  30 days   │   StreakCard
├──────────────────────────────────────────┤
│  Week  │  Month  │  Year  │  All Time    │
│   7    │   26    │   45   │     45       │   TimeRangeCountsCard
├──────────────────────────────────────────┤
│  ██ █ ▄ ██ ▄  _  _                      │
│  M  T  W  T  F  S  S    [Count] [%]     │   WeekBarGraph
├──────────────────────────────────────────┤
│  ●  ●  ◐  ○  ●  ●  ○  ...              │   MonthCalendarGraph
├──────────────────────────────────────────┤
│  J  F  M  A  M  J  J  A  S  O  N  D    │
│  █  ▄  █  ██ ▄  ▂  ...                 │   YearOverviewGraph
├──────────────────────────────────────────┤
│  Day of Week Pattern (all time)          │
│  ██ ██  █  ▄  █  ▂  ▂                  │   DayOfWeekPatternCard
│  M   T  W  T  F  S  S                   │   (aggregate by day across all history)
│  Best day: Monday                        │
└──────────────────────────────────────────┘
```

---

## Component Specs

### `DetailHeader` (shared)
```
┌──────────────────────────────────────────┐
│  ←   Name                                │
└──────────────────────────────────────────┘
```
- Full-width, colored background matching the stat's accent color
- Back button (← text or icon) calls `onBack`
- Title = stat name
- Handles safe area top inset

**Props:** `title: string`, `color: string`, `onBack: () => void`

---

### `CompletionSummaryCard` (shared)
Large circular ring (size 96) + completion count + rate text. Same visual language as `TodayCard` hero row but standalone card.

**Props:** `completed: number`, `total: number`, `color: string`

Calculates `rate = completed / total * 100` internally using the shared `safePct()` — extract this to a shared util.

---

### `StreakCard` (shared)
Two side-by-side pill boxes: current streak and best streak.
```
┌─────────────────┐  ┌─────────────────┐
│  🔥 Current     │  │  🏆 Best        │
│     12 days     │  │     34 days     │
└─────────────────┘  └─────────────────┘
```
**Props:** `currentStreak: number`, `bestStreak: number`, `color: string`

---

### `TimeRangeCountsCard` (shared)
Four count boxes in a row.
```
┌────────┬────────┬────────┬──────────┐
│  Week  │ Month  │  Year  │ All Time │
│   12   │   48   │  156   │   620    │
└────────┴────────┴────────┴──────────┘
```
**Props:** `weekCount: number`, `monthCount: number`, `yearCount: number`, `allTimeCount: number`, `color: string`

---

### `WeekBarGraph` (shared)
Full-width version of `WeeklyMiniChart` — taller bars, labels with actual counts, toggle between raw count and completion %.

```
Count / %  [toggle pill]

██  █  ▄  ██  ▄   _   _
M   T  W   T  F   S   S
8   6  4   8  2   0   0
```
**Props:** `data: DayData[]`, `color: string`

Internally maintains `mode: 'count' | 'percent'` toggle state.

---

### `MonthCalendarGraph` (shared)
Calendar grid. Each day is a circle: filled = completed, half = partial (if multiple tasks), empty = nothing done, grey = no tasks scheduled. //tba on circle design could be a growing circle

```
        Feb 2026
Mo Tu We Th Fr Sa Su
                1  2
 3  4  5  6  7  8  9
10 11 12 13 14 15 16
17 18 19 20 21 22 23
24 25 26 27 28
```
Each day circle is colored by the stat's accent color at varying opacity (0 = transparent, 100% = full color). Tapping a day could show a tooltip count (Phase 6).

**Props:** `year: number`, `month: number`, `data: CalendarDayData[]`, `color: string`

---

### `YearOverviewGraph` (shared)
12 vertical bars (Jan–Dec), labeled with month initials. Bar height scales to the month with the most completions. Shows counts on hover/tap (Phase 6).

```
████
     ███
          ██
J  F  M  A  M  J  J  A  S  O  N  D
56 42 38 71 29 ...
```
**Props:** `data: MonthData[]`, `color: string`

---

### `TaskTypeBreakdownCard` (shared — Overall + Category only)
Side-by-side mini stat showing permanent vs one-off split. Reuses the same pattern as `TypeMiniCard` inside `TodayCard` but as a standalone card.

**Props:** `permanentCount: number`, `oneOffCount: number`, `color: string`

---

### `TimeRangePicker` (shared — all three screens)
Horizontal tab strip with 4 options. Pill-style active indicator slides to the selected tab.
```
[ Week ]  [ Month ]  [ Year ]  [ All Time ]
```
**Props:** `selected: TimeRange`, `onChange: (r: TimeRange) => void`, `color: string`

`type TimeRange = 'week' | 'month' | 'year' | 'all'`

---

### `WeekNavigator` (shared — all three screens)
Shows current week range label with prev/next arrow buttons. Prev is always enabled (capped at earliest data). Next is disabled when on the current week.
```
  ‹   Feb 10 – Feb 16, 2026   ›
```
**Props:** `weekStart: Date`, `onPrev: () => void`, `onNext: () => void`, `isCurrentWeek: boolean`

---

### `CategoryBreakdownCard` (overall only)
Horizontal bar list, top 5 categories by total completions. Each row: colored dot + name + bar + count + %.
```
● Work       ████████░░  64   85%
● Health     █████░░░░░  38   70%
● Lifestyle  ████░░░░░░  31   65%
```
**Props:** `categories: CategoryBreakdownItem[]`, where each item has `name, color, count, percent`

---

### `PermanentTaskListCard` (category only)
Compact list of permanent task templates that belong to this category. Each row shows template name + inline completion bar + %. Tappable — navigates to that template's `PermanentDetailScreen`.

**Props:** `tasks: PermanentTaskStat[]`, `onTaskPress: (id: string, name: string) => void`

---

### `DayOfWeekPatternCard` (shared — all three screens)
Aggregates ALL historical completions grouped by day of week (Monday total, Tuesday total, etc.). Scoped to the active time range filter. Answers questions like "I do a lot of work on Mondays", "I complete this category mostly on Thursdays", "I always skip this task on Sundays".

Shows both raw count bars AND a completion rate line/label per day. Includes a "Best day: Monday" label below.

**Props:** `data: DayOfWeekData[]` (7 items, Mon–Sun, each with `day` label + `count`), `color: string`

---

## Data Types

```typescript
// ── Universal (all three screens) ───────────────────────────────────────────

interface DetailStats {
  type: 'all' | 'template' | 'category';
  id: string;       // 'all_time' | 'all_year' | 'all_month' | 'all_week' | templateId | categoryName
  name: string;
  color: string;

  // Completion
  completionRate: number;     // 0–100
  totalCompleted: number;

  // Streaks
  currentStreak: number;      // consecutive days (today inclusive)
  bestStreak: number;

  // Time range pill counts
  thisWeekCount: number;
  thisMonthCount: number;
  thisYearCount: number;
  allTimeCount: number;

  // Chart data
  weeklyData: DayData[];          // 7 items Mon–Sun  (reuse DayData from WeeklyMiniChart)
  monthlyData: CalendarDayData[]; // current month, one entry per day
  yearlyData: MonthData[];        // 12 entries Jan–Dec
}

interface CalendarDayData {
  date: number;        // day of month 1–31
  completed: number;
  total: number;
}

interface MonthData {
  month: number;       // 0–11
  completed: number;
  total: number;
}

// ── Overall + Category shared ────────────────────────────────────────────────

interface TaskTypeBreakdown {
  permanentCount: number;
  permanentPercent: number;
  oneOffCount: number;
  oneOffPercent: number;
}

// ── Overall-specific ─────────────────────────────────────────────────────────

type TimeRange = 'week' | 'month' | 'year' | 'all';

interface OverallDetailStats extends DetailStats {
  taskTypeBreakdown: TaskTypeBreakdown;
  categoryBreakdown: CategoryBreakdownItem[];
}

interface CategoryBreakdownItem {
  name: string;
  color: string;
  count: number;
  percent: number;   // % of total completions this category represents
}

// ── Category-specific ────────────────────────────────────────────────────────

interface CategoryDetailStats extends DetailStats {
  taskTypeBreakdown: TaskTypeBreakdown;
  permanentTaskList: PermanentTaskStat[];
}

interface PermanentTaskStat {
  id: string;
  name: string;
  completed: number;
  total: number;
  completionRate: number;
}

// ── Permanent-specific ───────────────────────────────────────────────────────

interface PermanentDetailStats extends DetailStats {
  dayOfWeekPattern: DayOfWeekData[];
}

interface DayOfWeekData {
  day: string;    // 'M' | 'T' | 'W' | 'T' | 'F' | 'S' | 'S'
  count: number;  // total completions ever on this weekday
}
```

---

## Navigation Changes (MainNavigator)

The app uses a custom overlay system in `MainNavigator.tsx`. Add `StatDetail` as a new overlay type.

```typescript
// MainNavigator.tsx changes

type OverlayScreen =
  | 'none'
  | 'CreateTask'
  | 'CreatePermanentTask'
  | 'UsePermanentTask'
  | 'StatDetail';            // ← ADD

interface StatDetailParams {
  type: 'all' | 'template' | 'category';
  id: string;
  name: string;
  color: string;
  initialTimeRange?: TimeRange;  // Overall only — pre-selects the tab
}
```

**Flow:**
1. `StatsScreen` receives `onStatCardPress: (params: StatDetailParams) => void` prop
2. `handleCardPress` in StatsScreen calls this prop instead of logging
3. `MainNavigator` sets `overlayScreen = 'StatDetail'` + stores `statDetailParams`
4. `renderOverlayScreen()` in MainNavigator renders the correct detail screen based on `params.type`
5. Detail screen receives `params` + `onBack` → calls `goBack()` on back press

```typescript
// StatsScreen — updated handleCardPress (conceptual)
const handleCardPress = (data: StatPreviewData) => {
  onStatCardPress({
    type: data.type,
    id: data.id,
    name: data.name,
    color: data.color,
    initialTimeRange: resolveInitialTimeRange(data.id), // 'all_week' → 'week', etc.
  });
};

// MainNavigator — renderOverlayScreen addition
case 'StatDetail': {
  const p = statDetailParams!;
  if (p.type === 'all')      return <OverallDetailScreen params={p} onBack={goBack} />;
  if (p.type === 'category') return <CategoryDetailScreen params={p} onBack={goBack} />;
  if (p.type === 'template') return <PermanentDetailScreen params={p} onBack={goBack} />;
}
```

---

## Phase 4 Task Checklist — Detail Components

### Shared Components (`components/stats/detail/shared/`)
- [ ] **4.1**  `DetailHeader.tsx` — back button + title + colored background
- [ ] **4.2**  `CompletionSummaryCard.tsx` — ring (size 96) + completed count + rate %
- [ ] **4.3**  `StreakCard.tsx` — current streak pill + best streak pill side by side
- [ ] **4.4**  `TimeRangeCountsCard.tsx` — 4-box row: week / month / year / all time
- [ ] **4.5**  `TimeRangePicker.tsx` — 4-tab strip (Week / Month / Year / All Time), all screens
- [ ] **4.6**  `WeekNavigator.tsx` — prev/next week arrows + date range label, all screens
- [ ] **4.7**  `WeekBarGraph.tsx` — full-width 7-bar chart with count/% toggle
- [ ] **4.8**  `MonthCalendarGraph.tsx` — calendar grid with colored day circles
- [ ] **4.9**  `YearOverviewGraph.tsx` — 12-bar monthly summary chart
- [ ] **4.10** `DayOfWeekPatternCard.tsx` — completions by day of week (Mon–Sun), all screens
- [ ] **4.11** `TaskTypeBreakdownCard.tsx` — permanent vs one-off split (Overall + Category only)

### Overall-specific Components (`components/stats/detail/overall/`)
- [ ] **4.12** `CategoryBreakdownCard.tsx` — top-5 categories horizontal bar list

### Category-specific Components (`components/stats/detail/category/`)
- [ ] **4.13** `PermanentTaskListCard.tsx` — list of permanent tasks in this category

---

## Phase 5 Task Checklist — Screen Assembly & Navigation

### Navigation wiring
- [ ] **5.1** Add `'StatDetail'` to `OverlayScreen` type in `MainNavigator.tsx`
- [ ] **5.2** Add `statDetailParams` state + `handleStatCardPress` to `MainNavigator`
- [ ] **5.3** Add `onStatCardPress` prop to `StatsScreen` + wire `handleCardPress`
- [ ] **5.4** Add `StatDetail` case to `renderOverlayScreen()` in `MainNavigator`
- [ ] **5.5** Add `resolveInitialTimeRange()` helper for mapping overall card IDs to time range tabs

### Screen files
- [ ] **5.6** `OverallDetailScreen.tsx` — assemble shared + overall-specific components, time range tab state, week navigator state
- [ ] **5.7** `CategoryDetailScreen.tsx` — assemble shared + category-specific components
- [ ] **5.8** `PermanentDetailScreen.tsx` — assemble shared + permanent-specific components

### Data (mock first, real data in Phase 3/6)
- [ ] **5.9** Define mock data builders for each detail type in their screen file
- [ ] **5.10** Wire `PermanentTaskListCard` press → navigate to `PermanentDetailScreen` from within `CategoryDetailScreen` (nested detail navigation)

---

## Shared Utility — `safePct`

Currently defined locally in `TodayCard.tsx`. Extract to a shared utility since every detail component needs it.

**Target file:** `app/core/utils/statUtils.ts`

```typescript
export function safePct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
```

Import into: `TodayCard`, `CompletionSummaryCard`, `WeekBarGraph`, `CategoryBreakdownCard`, etc.

---

## Mock Data Strategy

Each screen builds its mock data inline (same pattern as `getMockTodayStats()` in `StatsScreen`). When Phase 1 (storage) is ready:

| Mock function | Replace with |
|---------------|-------------|
| `getMockOverallDetail(id, timeRange)` | `useStats().getOverallDetailStats(id, timeRange)` |
| `getMockCategoryDetail(categoryName)` | `useStats().getCategoryDetailStats(categoryName)` |
| `getMockPermanentDetail(templateId)` | `useStats().getPermanentDetailStats(templateId)` |

---

## Extra Graphs Added Beyond Original Sprint 4 Plan

The Sprint 4 plan listed: `WeekBarGraph`, `MonthCalendarGraph`, `YearOverviewGraph`.

Added in this plan:

| Graph | Where | Why |
|-------|-------|-----|
| `DayOfWeekPatternCard` | Permanent task detail | Reveals behavioural patterns — does the user always skip Sundays? |
| `CategoryBreakdownCard` | Overall detail | Horizontal bar list showing which categories drive the most completions |
| `WeekNavigator` + browseable weeks | Overall detail → Week tab | Allows reviewing past performance, not just the current week |
| `TaskTypeBreakdownCard` | Overall + Category | Shows permanent vs one-off task mix — useful for understanding habits |
| `PermanentTaskListCard` | Category detail | Lets users drill from category → individual task without going back to the list |

---

## Success Criteria for Phase 4 & 5

- [ ] All three detail screens open correctly from their respective `StatPreviewCard` types
- [ ] Back navigation returns to `StatsScreen` with tab bar restored
- [ ] `OverallDetailScreen` time range picker correctly scopes all stats on screen
- [ ] `WeekNavigator` correctly navigates past weeks (disabled on current week's next arrow)
- [ ] `MonthCalendarGraph` renders correct days for any month (handles 28/29/30/31 days)
- [ ] `PermanentTaskListCard` rows are tappable and open that template's detail screen
- [ ] All shared components (`CompletionSummaryCard`, `StreakCard`, etc.) render identically across all three screen types
- [ ] Mock data is realistic and exercises all UI states (empty streak, 0% completion, etc.)
- [ ] `safePct` extracted and shared — no duplicate implementations
