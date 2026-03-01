# Stats UI Completion Plan
**Goal:** Fully implement `OverallDetailScreen` and `CategoryDetailScreen`, completing all stats front-end UI.
**Status: ✅ COMPLETE** — Front-end stats UI is feature-complete. Next phase = storage layer + backend wiring.

---

## What Was Built This Session

### Segmented Bars — Permanent vs One-Off Distinction

All three bar/chart components now support an optional `segments` field that splits each bar into stacked colored slices. When `segments` is absent the bar renders as a solid single color (backward compatible — `PermanentDetailScreen` unchanged).

**Segment colors (fixed, semantic):**
| Segment | Color |
|---------|-------|
| Permanent tasks | `#34C759` green |
| One-off tasks | `#007AFF` blue |

#### Step A — `DataSegment` type + `segments?` field added to three interfaces ✅

**`app/components/stats/WeeklyMiniChart.tsx`**
```ts
export interface DataSegment {
  label: string;   // 'Permanent' | 'One-off'
  color: string;   // '#34C759' | '#007AFF'
  count: number;
}

export interface DayData {
  day:       string;
  count:     number;
  total?:    number;
  segments?: DataSegment[];  // absent = solid bar (no change to existing callers)
}
```

**`app/components/stats/detail/shared/YearOverviewGraph.tsx`**
```ts
export interface MonthData {
  month:     number;
  completed: number;
  total:     number;
  segments?: DataSegment[];  // imported from WeeklyMiniChart
}
```

**`app/components/stats/detail/shared/DayOfWeekPatternCard.tsx`**
```ts
export interface DayOfWeekData {
  day:       string;
  count:     number;
  total?:    number;
  segments?: DataSegment[];
}
```

#### Step B — `WeekBarGraph.tsx` stacked bar rendering ✅

`BarColumn` conditionally renders stacked `<View>` slices (reversed array so first segment sits at the bottom visually) when `item.segments` is present. Segment heights scale with `mode` (count vs %) exactly as the solid bar does. Falls back to solid bar when absent.

#### Step C — `YearOverviewGraph.tsx` stacked bar rendering ✅

Same pattern as Step B — `MonthBar` renders stacked segments when `item.segments` is present.

#### Step D — `DayOfWeekPatternCard.tsx` stacked bar rendering ✅

`DayBar` renders stacked segments when `item.segments` is present. Respects the best-day bar width distinction.

---

### New Components Built ✅

#### `app/components/stats/detail/overall/CategoryBreakdownCard.tsx`
Horizontal bar list — top 5 categories by completions. Used by `OverallDetailScreen` only.

```
BY CATEGORY
● Work       ████████░░  64   85%
● Health     █████░░░░░  38   70%
● Lifestyle  ████░░░░░░  31   65%
```

Row layout: colored dot · fixed-width name · proportional fill bar · raw count · completion %.
Bar width scales relative to peak category (peak = full width).

```ts
export interface CategoryBreakdownItem {
  name:    string;
  color:   string;
  count:   number;
  percent: number;  // completion rate 0–100
}

interface CategoryBreakdownCardProps {
  categories: CategoryBreakdownItem[];
  color:      string;  // accent for section label
}
```

---

#### `app/components/stats/detail/category/PermanentTaskListCard.tsx`
Compact tappable list of permanent task templates in this category. Used by `CategoryDetailScreen` only.

```
PERMANENT TASKS
┌──────────────────────────────────────────┐
│ Morning Standup    ████████░░ 80%  ›     │  ← tappable
│ Weekly Review      ██████░░░░ 60%  ›     │  ← tappable
│ Code Review        █████░░░░░ 50%  ›     │  ← tappable
└──────────────────────────────────────────┘
```

Tapping a row calls `onTaskPress(id, name, '#007AFF')` which `CategoryDetailScreen` maps to `handleStatCardPress({ type: 'template', ... })`.

```ts
export interface PermanentTaskStat {
  id:             string;
  name:           string;
  completed:      number;
  total:          number;
  completionRate: number;  // 0–100
}

interface PermanentTaskListCardProps {
  tasks:       PermanentTaskStat[];
  color:       string;
  onTaskPress: (id: string, name: string, color: string) => void;
}
```

---

### `TimeRangeCountsCard` — Breakdown Mode Added ✅

`app/components/stats/detail/shared/TimeRangeCountsCard.tsx` now supports an optional `breakdown` prop. When provided, the card switches to a 4-column table layout. When absent (PermanentDetailScreen), the original 2-column layout is unchanged.

**Breakdown layout:**
```
TIMES COMPLETED
                   PERM    ONE-OFF   TOTAL
─────────────────────────────────────────────
This Week            8         4       12
This Month          30        18       48
This Year           94        62      156
All Time           380       240      620
```

Column colors: Perm = `#34C759` green · One-off = `#007AFF` blue · Total = screen accent

```ts
export interface CountBreakdown {
  perm:  number;
  oneOff: number;
}

export interface TimeRangeBreakdown {
  week:    CountBreakdown;
  month:   CountBreakdown;
  year:    CountBreakdown;
  allTime: CountBreakdown;
}
```

---

### Screens Assembled ✅

#### `app/screens/stats/detail/OverallDetailScreen.tsx`

Card order as implemented:
1. `CompletionSummaryCard`
2. `StreakCard`
3. `TaskTypeBreakdownCard` — perm vs one-off split (moved above counts for prominence)
4. `TimeRangeCountsCard` — with `breakdown` prop (Perm / One-off / Total columns)
5. `WeekBarGraph` — segmented bars
6. `MonthCalendarGraph`
7. `YearOverviewGraph` — segmented bars
8. `DayOfWeekPatternCard` — segmented bars
9. `CategoryBreakdownCard` — top 5 categories

Mock data builder: `getMockOverallDetail(id)` — varies by `idOffset(id)` so `all_time` / `all_year` / `all_month` / `all_week` each show distinct stable data. Computes `breakdown` from the overall perm fraction applied to each time range count.

---

#### `app/screens/stats/detail/CategoryDetailScreen.tsx`

Card order as implemented:
1. `CompletionSummaryCard`
2. `StreakCard`
3. `TaskTypeBreakdownCard` — perm vs one-off split within this category
4. `TimeRangeCountsCard` — with `breakdown` prop
5. `WeekBarGraph` — segmented bars
6. `MonthCalendarGraph`
7. `YearOverviewGraph` — segmented bars
8. `DayOfWeekPatternCard` — segmented bars
9. `PermanentTaskListCard` — tappable, navigates to `PermanentDetailScreen`

Mock data builder: `getMockCategoryDetail(id)` — varies by `idOffset(id)`.

**Navigation wiring:** `CategoryDetailScreen` receives `onStatCardPress: (p: StatDetailParams) => void` from `MainNavigator`. `PermanentTaskListCard` rows call `onStatCardPress({ type: 'template', id, name, color: '#007AFF' })` to open the nested `PermanentDetailScreen`. `MainNavigator` passes its existing `handleStatCardPress` — no new state required.

---

### `MainNavigator.tsx` update ✅

`CategoryDetailScreen` in the `StatDetail` case now receives `onStatCardPress={handleStatCardPress}`:

```tsx
if (statDetailParams.type === 'category') {
  return (
    <CategoryDetailScreen
      params={statDetailParams}
      onBack={goBack}
      onStatCardPress={handleStatCardPress}
    />
  );
}
```

---

## Shared Components — Full Status

| Component | Status | Used by |
|-----------|--------|---------|
| `DetailHeader` | ✅ Done | All three screens |
| `CompletionSummaryCard` | ✅ Done | All three screens |
| `StreakCard` | ✅ Done | All three screens |
| `TimeRangeCountsCard` | ✅ Done + breakdown mode | All three screens |
| `WeekBarGraph` | ✅ Done + segmented bars | All three screens |
| `MonthCalendarGraph` | ✅ Done | All three screens |
| `YearOverviewGraph` | ✅ Done + segmented bars | All three screens |
| `DayOfWeekPatternCard` | ✅ Done + segmented bars | All three screens |
| `TaskTypeBreakdownCard` | ✅ Done | Overall + Category |
| `CategoryBreakdownCard` | ✅ Done | Overall only |
| `PermanentTaskListCard` | ✅ Done | Category only |

---

## What Does NOT Change

- `MonthCalendarGraph` — calendar day rings are single-color by design; no segmentation
- `PermanentDetailScreen` — zero changes; solid bars and simple `TimeRangeCountsCard` are correct there
- `WeeklyMiniChart` (the mini chart on `StatPreviewCard`) — unchanged; `segments` field is ignored by it

---

## What's Next — Storage Layer

Front-end is feature-complete. The next phase replaces every `getMock*()` call with real storage hooks.

| Mock function | Replace with |
|---------------|-------------|
| `getMockOverallDetail(id)` in `OverallDetailScreen` | `useStats().getOverallDetailStats(id)` |
| `getMockCategoryDetail(id)` in `CategoryDetailScreen` | `useStats().getCategoryDetailStats(id)` |
| `getMockPermanentDetail(id)` in `PermanentDetailScreen` | `useStats().getPermanentDetailStats(id)` |

Storage tasks:
- Add `completed_at` timestamp column to tasks table
- Build `statsStorage.ts` — raw SQL queries with `StatFilter` (none / category / template)
- Build `statsCalculations.ts` — streak logic, day-of-week aggregation, segment splitting
- Build `useStats.ts` hook — wraps storage, returns typed data for each detail screen
- See `SPRINT_4_PLAN.md` → Phase 1 checklist for the full task list

---

## Import Paths — Quick Reference

```ts
// Shared
import { DetailHeader }                          from '../../../components/stats/detail/shared/DetailHeader';
import { CompletionSummaryCard }                 from '../../../components/stats/detail/shared/CompletionSummaryCard';
import { StreakCard }                            from '../../../components/stats/detail/shared/StreakCard';
import { TimeRangeCountsCard, TimeRangeBreakdown } from '../../../components/stats/detail/shared/TimeRangeCountsCard';
import { WeekBarGraph }                          from '../../../components/stats/detail/shared/WeekBarGraph';
import { MonthCalendarGraph, CalendarDayData }   from '../../../components/stats/detail/shared/MonthCalendarGraph';
import { YearOverviewGraph, MonthData }          from '../../../components/stats/detail/shared/YearOverviewGraph';
import { DayOfWeekPatternCard, DayOfWeekData }   from '../../../components/stats/detail/shared/DayOfWeekPatternCard';
import { TaskTypeBreakdownCard }                 from '../../../components/stats/detail/shared/TaskTypeBreakdownCard';

// Data types
import { DayData, DataSegment }                  from '../../../components/stats/WeeklyMiniChart';

// Overall-specific
import { CategoryBreakdownCard, CategoryBreakdownItem } from '../../../components/stats/detail/overall/CategoryBreakdownCard';

// Category-specific
import { PermanentTaskListCard, PermanentTaskStat }     from '../../../components/stats/detail/category/PermanentTaskListCard';
```
