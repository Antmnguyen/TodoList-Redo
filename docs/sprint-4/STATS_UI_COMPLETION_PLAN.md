# Stats UI Completion Plan
**Goal:** Fully implement `OverallDetailScreen` and `CategoryDetailScreen`, completing all stats front-end UI.
**After this work:** Front-end stats UI is feature-complete. Next phase = storage layer + backend wiring.

---

## Reference Docs

| Doc | What to use it for |
|-----|--------------------|
| `docs/sprint-4/DETAIL_SCREEN_PLAN.md` | Full component specs, ASCII layouts, prop definitions, data types for every card |
| `docs/sprint-4/SPRINT_4_PROGRESS.md` | What's already built — don't rebuild anything listed there |
| `app/screens/stats/detail/PermanentDetailScreen.tsx` | **Primary reference implementation** — copy the mock-data-builder + ScrollView + card-assembly pattern exactly |

---

## What's Already Done (do not rebuild)

All shared cards in `app/components/stats/detail/shared/` are complete and ready to drop in:

| Component | Used by |
|-----------|---------|
| `DetailHeader` | All three screens |
| `CompletionSummaryCard` | All three screens |
| `StreakCard` | All three screens |
| `TimeRangeCountsCard` | All three screens |
| `WeekBarGraph` | All three screens — has built-in week nav |
| `MonthCalendarGraph` | All three screens — has built-in month nav |
| `YearOverviewGraph` | All three screens — has built-in year nav |
| `DayOfWeekPatternCard` | All three screens |
| `TaskTypeBreakdownCard` | Overall + Category — perm vs one-off split, already implemented |
| `TimeRangePicker` | Available if needed |

---

## Work Items — 4 tasks, in order

---

### 1. Build `CategoryBreakdownCard.tsx`
**File:** `app/components/stats/detail/overall/CategoryBreakdownCard.tsx`
**Used by:** `OverallDetailScreen` only
**Spec:** `DETAIL_SCREEN_PLAN.md` → "CategoryBreakdownCard (overall only)" section

Horizontal bar list — top 5 categories by completions:
```
● Work       ████████░░  64   85%
● Health     █████░░░░░  38   70%
● Lifestyle  ████░░░░░░  31   65%
```

Each row: colored dot + name + proportional fill bar + raw count + completion %.
Bar width scales relative to the top category (peak = full width).

```ts
interface CategoryBreakdownItem {
  name:    string;
  color:   string;
  count:   number;
  percent: number;  // completion rate for that category
}

// Props
interface CategoryBreakdownCardProps {
  categories: CategoryBreakdownItem[];
  color:      string;  // accent for section label
}
```

---

### 2. Build `PermanentTaskListCard.tsx`
**File:** `app/components/stats/detail/category/PermanentTaskListCard.tsx`
**Used by:** `CategoryDetailScreen` only
**Spec:** `DETAIL_SCREEN_PLAN.md` → "PermanentTaskListCard (category only)" section

Compact list of permanent task templates that belong to this category.
Each row: task name + inline completion bar + % — tappable → navigates to `PermanentDetailScreen` for that task.

```
Permanent Tasks in Work
┌───────────────────────────────────┐
│ Morning Standup    ████████░░ 80% │  ← tappable
│ Weekly Review      ██████░░░░ 60% │  ← tappable
│ Code Review        █████░░░░░ 50% │  ← tappable
└───────────────────────────────────┘
```

```ts
interface PermanentTaskStat {
  id:             string;
  name:           string;
  completed:      number;
  total:          number;
  completionRate: number;  // 0–100
}

// Props
interface PermanentTaskListCardProps {
  tasks:       PermanentTaskStat[];
  color:       string;
  onTaskPress: (id: string, name: string, color: string) => void;
  // onTaskPress fires handleStatCardPress({ type: 'template', id, name, color })
  // to navigate to PermanentDetailScreen for that task
}
```

---

### 3. Assemble `OverallDetailScreen.tsx`
**File:** `app/screens/stats/detail/OverallDetailScreen.tsx`
**Reference:** Copy structure from `PermanentDetailScreen.tsx` — same pattern: mock builder + `ScrollView` + cards top to bottom.

#### Card order (from `DETAIL_SCREEN_PLAN.md` layout):
1. `CompletionSummaryCard`
2. `StreakCard`
3. `TimeRangeCountsCard`
4. `WeekBarGraph`
5. `MonthCalendarGraph`
6. `YearOverviewGraph`
7. `DayOfWeekPatternCard`
8. `TaskTypeBreakdownCard` — perm vs one-off split
9. `CategoryBreakdownCard` ← new, built in step 1

#### Mock data (`getMockOverallDetail(id, initialTimeRange)`):
Vary output by `params.id` (`all_time` / `all_year` / `all_month` / `all_week`) using the same `idOffset(id)` hashing trick from `PermanentDetailScreen`.
`initialTimeRange` is available in `params` for future use (e.g. pre-selecting a tab) — not needed while UI is mock-only.

---

### 4. Assemble `CategoryDetailScreen.tsx`
**File:** `app/screens/stats/detail/CategoryDetailScreen.tsx`
**Reference:** Copy structure from `PermanentDetailScreen.tsx`.

#### Card order:
1. `CompletionSummaryCard`
2. `StreakCard`
3. `TimeRangeCountsCard`
4. `WeekBarGraph`
5. `MonthCalendarGraph`
6. `YearOverviewGraph`
7. `DayOfWeekPatternCard`
8. `TaskTypeBreakdownCard` — perm vs one-off split within this category
9. `PermanentTaskListCard` ← new, built in step 2

#### Mock data (`getMockCategoryDetail(id)`):
Vary by `params.id` (`cat_work` / `cat_health` / `cat_lifestyle`) using `idOffset(id)`.
`PermanentTaskListCard` needs a small list of mock `PermanentTaskStat[]` — 2–3 items is fine.

#### Navigation from `PermanentTaskListCard`:
`CategoryDetailScreen` receives `onBack` from `MainNavigator`. It also needs to fire `onStatCardPress` to open a nested `PermanentDetailScreen`. Pass this down from `MainNavigator` the same way `StatsScreen` does — or re-use the existing `handleStatCardPress` already wired in `MainNavigator` (preferred, no new state needed).

---

---

## Segmented Bars — Permanent vs One-Off Distinction

> **This is part of the current work section**, not a future phase. It must be done alongside screen assembly so Overall and Category screens show the correct visual breakdown.

### Concept

The bar graphs (`WeekBarGraph`, `YearOverviewGraph`) need to optionally split each bar into two colored segments — one for permanent task completions, one for one-off completions.

```
PermanentDetailScreen (no one-off tasks):
  January bar — entirely one color (solid, as today)

OverallDetailScreen / CategoryDetailScreen:
  January bar — two-color stacked:
    ████████████░░░░░░░  (top 30% = one-off, blue)
    ████████████████████ (bottom 70% = permanent, green)
```

### Key rule — backward compatible, opt-in only

Segmentation is driven by an **optional `segments` field** on the data types. When absent, the bar renders exactly as it does today (solid, single accent color). `PermanentDetailScreen` never passes `segments` → its bars are unchanged automatically.

| Screen | Bar behaviour |
|--------|--------------|
| `PermanentDetailScreen` | Solid single color — no `segments` passed |
| `OverallDetailScreen` | Two-color stacked — `segments` with perm + one-off split |
| `CategoryDetailScreen` | Two-color stacked — `segments` with perm + one-off split within that category |

### Segment colors (fixed, semantic — not the card accent color)

| Segment | Color |
|---------|-------|
| Permanent tasks | `#34C759` green |
| One-off tasks | `#007AFF` blue |

The card's accent `color` prop continues to drive the toggle button highlight — only the bar fill changes.

---

### Step A — Add `segments` to data types

**File:** `app/components/stats/WeeklyMiniChart.tsx` (exports `DayData`)

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
  segments?: DataSegment[];  // ← NEW — absent = solid bar (no change to existing callers)
}
```

**File:** `app/components/stats/detail/shared/YearOverviewGraph.tsx` (exports `MonthData`)

```ts
export interface MonthData {
  month:     number;
  completed: number;
  total:     number;
  segments?: DataSegment[];  // ← NEW — same optional pattern
}
```

Import `DataSegment` from `WeeklyMiniChart` in `YearOverviewGraph` to avoid duplication, or define once in a shared types file.

---

### Step B — Update `WeekBarGraph` bar rendering

**File:** `app/components/stats/detail/shared/WeekBarGraph.tsx`

In `BarColumn`, replace the single bar `<View>` with a conditional:

```
if item.segments present:
  render a column of stacked <View> slices, bottom to top
  each slice height = (segment.count / maxCount) * BAR_MAX_HEIGHT (Count mode)
               or   = (segment.count / item.total) * BAR_MAX_HEIGHT (% mode)
  each slice backgroundColor = segment.color

if item.segments absent:
  render existing solid bar — no change
```

Stacking approach — bottom-anchored column inside the existing `barArea`:
```tsx
<View style={[col.barArea, { height: BAR_MAX_HEIGHT }]}>
  {item.segments ? (
    <View style={{ width: BAR_WIDTH, overflow: 'hidden', borderRadius: 5 }}>
      {[...item.segments].reverse().map((seg, i) => (
        // reversed so first segment is on bottom visually
        <View key={i} style={{ height: segHeight, backgroundColor: seg.color }} />
      ))}
    </View>
  ) : (
    // existing solid bar
    <View style={[col.bar, { height: barHeight, backgroundColor: hasActivity ? color : '#e8e8e8' }]} />
  )}
</View>
```

---

### Step C — Update `YearOverviewGraph` bar rendering

**File:** `app/components/stats/detail/shared/YearOverviewGraph.tsx`

Same pattern as Step B — in `MonthBar`, replace the single bar `<View>` with a conditional that renders stacked segments when `item.segments` is present.

---

### Step D — Populate segments in mock data (Overall + Category screens)

When building mock data in `OverallDetailScreen` and `CategoryDetailScreen`, add `segments` to each `DayData` and `MonthData` item:

```ts
// Example — January in YearOverviewGraph for Overall screen
{
  month:     0,
  completed: 37,
  total:     50,
  segments: [
    { label: 'Permanent', color: '#34C759', count: 26 },  // 70%
    { label: 'One-off',   color: '#007AFF', count: 11 },  // 30%
  ],
}
```

Make counts vary by `idOffset(id)` — same stable-seed trick as the rest of the mock data. Ensure `segments` counts always sum to `completed`.

`PermanentDetailScreen` mock data — **do not add `segments`**. Solid bars are correct there.

---


- `DayOfWeekPatternCard` — aggregates all-time totals; ALSO CHANGE THIS TO HAVE THE TASK DISTINGUISHMENT AS WELL

### What does NOT change

- `MonthCalendarGraph` — calendar day rings are single-color by design; no segmentation needed
- `PermanentDetailScreen` — zero changes required; backward compatibility is automatic
- All props on the three graph components remain the same; `segments` is purely additive to the data shape

---

## What This Unlocks

Once all 4 tasks above are done:

- ✅ All three detail screens fully assembled with real UI
- ✅ All stats front-end components built
- ✅ Every card on every screen navigates correctly
- ✅ Mock data exercises all visual states per screen

**Next phase after this:** Storage layer + backend connection
- Add `completed_at` column, `statsStorage.ts`, `useStats.ts` hook
- Replace every `getMock*()` call with the real hook
- See `SPRINT_4_PLAN.md` → Phase 1 checklist for full storage task list

---

## Quick Reference — Import Paths

```ts
// Shared
import { DetailHeader }          from '../../../components/stats/detail/shared/DetailHeader';
import { CompletionSummaryCard } from '../../../components/stats/detail/shared/CompletionSummaryCard';
import { StreakCard }            from '../../../components/stats/detail/shared/StreakCard';
import { TimeRangeCountsCard }   from '../../../components/stats/detail/shared/TimeRangeCountsCard';
import { WeekBarGraph }          from '../../../components/stats/detail/shared/WeekBarGraph';
import { MonthCalendarGraph }    from '../../../components/stats/detail/shared/MonthCalendarGraph';
import { YearOverviewGraph }     from '../../../components/stats/detail/shared/YearOverviewGraph';
import { DayOfWeekPatternCard }  from '../../../components/stats/detail/shared/DayOfWeekPatternCard';
import { TaskTypeBreakdownCard } from '../../../components/stats/detail/shared/TaskTypeBreakdownCard';

// Overall-specific
import { CategoryBreakdownCard } from '../../../components/stats/detail/overall/CategoryBreakdownCard';

// Category-specific
import { PermanentTaskListCard } from '../../../components/stats/detail/category/PermanentTaskListCard';
```
