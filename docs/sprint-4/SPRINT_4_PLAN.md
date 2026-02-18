# Sprint 4 Plan: Statistics System

**Status:** Planning
**Goal:** Build comprehensive statistics tracking and visualization system

---

## Overview

Create a statistics system that tracks task completion across three dimensions:
1. **All Tasks** - Cumulative stats for everything
2. **Per Permanent Task Template** - Stats for each template
3. **Per Category** - Stats grouped by task category

Each stat type uses the same reusable components and follows identical UI patterns.

---

## Architecture

### Component Hierarchy

```
StatsScreen (main tab)
  └── StatsListView
        ├── StatPreviewCard (All Tasks)
        ├── StatPreviewCard (Template 1)
        ├── StatPreviewCard (Template 2)
        ├── StatPreviewCard (Category: Work)
        ├── StatPreviewCard (Category: Health)
        └── ... (dynamic list)

StatDetailScreen (opened when card tapped)
  └── ScrollView (infinite scroll)
        ├── CompletionSummaryCard
        ├── WeeklyBarChart (reused from preview)
        ├── StreakCard (current + best)
        ├── TimeCompletionsCard (week/month/year counts)
        └── DetailedGraphsSection
              ├── WeekGraph (bar, toggle %)
              ├── MonthGraph (calendar circles)
              └── YearGraph (monthly summary)
```

### File Structure

```
app/
├── screens/stats/
│   ├── StatsScreen.tsx              # Main stats tab (list of preview cards)
│   └── StatDetailScreen.tsx         # Detail view (scrollable stats)
│
├── components/stats/
│   ├── StatPreviewCard.tsx          # Floating rectangle preview
│   ├── CircularProgress.tsx         # Circular completion indicator
│   ├── WeeklyMiniChart.tsx          # 7-day bar preview
│   ├── StreakBadge.tsx              # Streak display
│   ├── CompletionSummaryCard.tsx    # Total/percent header
│   ├── TimeCompletionsCard.tsx      # Week/month/year counts
│   ├── WeekBarGraph.tsx             # Full week bar graph
│   ├── MonthCalendarGraph.tsx       # Month with circle indicators
│   └── YearOverviewGraph.tsx        # Year summary visualization
│
├── core/
│   ├── services/storage/
│   │   ├── statsStorage.ts          # Stats queries
│   │   └── schema/stats.ts          # Stats tables (if needed)
│   │
│   ├── hooks/
│   │   └── useStats.ts              # Stats data hook
│   │
│   └── utils/
│       └── statsCalculations.ts     # Streak calc, percentages, etc.
│
└── types/
    └── stats.ts                     # Stats type definitions
```

---

## Data Requirements

### What We Need to Track

| Metric | Source | Notes |
|--------|--------|-------|
| Task completions | `tasks.completed` + `tasks.completed_at` | Need to add `completed_at` column |
| Completion date | New column needed | Track WHEN task was completed |
| Template ID | `tasks.template_id` or join | For per-template stats |
| Category | `tasks.category` | For per-category stats |

### Storage Amendments Needed

**1. Add `completed_at` column to tasks table:**
```sql
ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
-- Stores timestamp when task was marked complete
```

**2. Update toggle completion logic:**
- When completing: set `completed_at = Date.now()`
- When uncompleting: set `completed_at = NULL`

**3. Stats Query Examples:**
```sql
-- Completions this week
SELECT COUNT(*) FROM tasks
WHERE completed = 1
AND completed_at >= [start_of_week]
AND completed_at < [end_of_week];

-- Completions by day for week view
SELECT DATE(completed_at/1000, 'unixepoch') as day, COUNT(*)
FROM tasks WHERE completed = 1
GROUP BY day;

-- Per-template completions
SELECT COUNT(*) FROM tasks
WHERE completed = 1 AND template_id = ?;

-- Per-category completions
SELECT COUNT(*) FROM tasks
WHERE completed = 1 AND category = ?;
```

---

## UI Specifications

### StatPreviewCard (Floating Rectangle)

```
┌─────────────────────────────────────────┐
│  ┌───┐                                  │
│  │ ○ │  All Tasks              🔥 12    │
│  │78%│  156 completed                   │
│  └───┘                                  │
│  ┌─┬─┬─┬─┬─┬─┬─┐                        │
│  │▄│█│▂│█│▄│ │ │  M T W T F S S        │
│  └─┴─┴─┴─┴─┴─┴─┘                        │
└─────────────────────────────────────────┘
```

**Elements:**
- Circular progress (completion %)
- Title (All Tasks / Template Name / Category Name)
- Total completions count
- Streak badge (🔥 number)
- Mini weekly bar chart (7 bars, filled by %)

**Styling:**
- Rounded corners (borderRadius: 16)
- Subtle shadow
- White background
- Tap ripple effect

---

### StatDetailScreen (Scrollable)

```
┌─────────────────────────────────────────┐
│  ← All Tasks                            │  Header
├─────────────────────────────────────────┤
│                                         │
│     ┌─────────┐                         │
│     │   ○     │   156 Completed         │  Summary
│     │  78%    │   78% Completion Rate   │
│     └─────────┘                         │
│                                         │
├─────────────────────────────────────────┤
│  This Week                              │
│  ┌─┬─┬─┬─┬─┬─┬─┐                        │  Weekly
│  │▄│█│▂│█│▄│ │ │   12 tasks            │  Chart
│  └─┴─┴─┴─┴─┴─┴─┘                        │
│   M T W T F S S     [Total] [%]         │
│                                         │
├─────────────────────────────────────────┤
│  🔥 Streak                              │
│  ┌──────────┐  ┌──────────┐             │  Streaks
│  │ Current  │  │   Best   │             │
│  │    12    │  │    34    │             │
│  └──────────┘  └──────────┘             │
│                                         │
├─────────────────────────────────────────┤
│  Completions                            │
│  ┌──────────┬──────────┬──────────┐     │  Time
│  │This Week │This Month│This Year │     │  Counts
│  │    12    │    48    │   156    │     │
│  └──────────┴──────────┴──────────┘     │
│                                         │
├─────────────────────────────────────────┤
│  Monthly View                           │
│  ┌─────────────────────────────────┐    │
│  │  ○  ○  ●  ●  ◐  ○  ○           │    │  Month
│  │  ●  ●  ◐  ○  ●  ●  ●           │    │  Calendar
│  │  ...                            │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│  Yearly Overview                        │
│  ┌─────────────────────────────────┐    │  Year
│  │ J F M A M J J A S O N D        │    │  Graph
│  │ █ █ ▄ █ ▄ ▂ ...                │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Tasks Checklist

### Phase 1: Storage & Data Layer
- [ ] **1.1** Add `completed_at` column to tasks schema
- [ ] **1.2** Update `toggleTask()` to set/clear `completed_at`
- [ ] **1.3** Create `statsStorage.ts` with query functions
- [ ] **1.4** Create `statsCalculations.ts` utility
- [ ] **1.5** Create `useStats.ts` hook
- [ ] **1.6** Define stats types in `types/stats.ts`

### Phase 2: Reusable Components
- [ ] **2.1** Create `CircularProgress` component
- [ ] **2.2** Create `WeeklyMiniChart` component
- [ ] **2.3** Create `StreakBadge` component
- [ ] **2.4** Create `StatPreviewCard` (combines above)
- [ ] **2.5** Test preview card with mock data

### Phase 3: Stats List Screen
- [ ] **3.1** Update `StatsScreen` to show list of preview cards
- [ ] **3.2** Load "All Tasks" stats
- [ ] **3.3** Load per-template stats (dynamic list)
- [ ] **3.4** Load per-category stats (dynamic list)
- [ ] **3.5** Add pull-to-refresh

### Phase 4: Detail Screen Components
- [ ] **4.1** Create `CompletionSummaryCard`
- [ ] **4.2** Create `TimeCompletionsCard`
- [ ] **4.3** Create `WeekBarGraph` (with toggle)
- [ ] **4.4** Create `MonthCalendarGraph`
- [ ] **4.5** Create `YearOverviewGraph`

### Phase 5: Detail Screen Assembly
- [ ] **5.1** Create `StatDetailScreen` with scroll view
- [ ] **5.2** Wire up navigation from preview card tap
- [ ] **5.3** Pass stat type (all/template/category) + ID
- [ ] **5.4** Load appropriate data based on type
- [ ] **5.5** Render all detail components

### Phase 6: Polish & Edge Cases
- [ ] **6.1** Empty states (no data yet)
- [ ] **6.2** Loading states
- [ ] **6.3** Handle categories with no tasks
- [ ] **6.4** Handle templates with no completions
- [ ] **6.5** Smooth animations/transitions

---

## Type Definitions

```typescript
// types/stats.ts

export type StatType = 'all' | 'template' | 'category';

export interface StatSummary {
  type: StatType;
  id: string;              // 'all' | templateId | categoryName
  name: string;            // Display name
  totalCompleted: number;
  completionPercent: number;
  currentStreak: number;
  bestStreak: number;
  weeklyData: DayCompletion[];
}

export interface DayCompletion {
  date: Date;
  completed: number;
  total: number;
  percent: number;
}

export interface TimeRangeStats {
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  allTime: number;
}

export interface DetailedStats extends StatSummary {
  timeRange: TimeRangeStats;
  monthlyData: DayCompletion[];  // Current month
  yearlyData: MonthCompletion[]; // 12 months
}

export interface MonthCompletion {
  month: number;  // 0-11
  year: number;
  completed: number;
  total: number;
}
```

---

## Storage Functions Needed

```typescript
// statsStorage.ts

// Get completion counts
getCompletionsInRange(start: Date, end: Date, filter?: StatFilter): number
getCompletionsByDay(start: Date, end: Date, filter?: StatFilter): DayCompletion[]
getCompletionsByMonth(year: number, filter?: StatFilter): MonthCompletion[]

// Get streaks
getCurrentStreak(filter?: StatFilter): number
getBestStreak(filter?: StatFilter): number

// Get summary for preview cards
getStatSummary(type: StatType, id?: string): StatSummary
getAllStatSummaries(): StatSummary[]  // For list view

// Filters
interface StatFilter {
  templateId?: string;
  category?: string;
}
```

---

## Streak Calculation Logic

```typescript
// statsCalculations.ts

function calculateCurrentStreak(completionDates: Date[]): number {
  // Sort dates descending
  // Start from today, count consecutive days with completions
  // Break when a day has no completions
}

function calculateBestStreak(completionDates: Date[]): number {
  // Find longest consecutive run of days with completions
}
```

---

## Navigation Flow

```
StatsScreen (Tab)
    │
    ├── Tap "All Tasks" card
    │   └── StatDetailScreen(type='all')
    │
    ├── Tap "Morning Workout" card
    │   └── StatDetailScreen(type='template', id='abc123')
    │
    └── Tap "Work" category card
        └── StatDetailScreen(type='category', id='Work')
```

**Implementation in MainNavigator:**
- Add `StatDetail` to OverlayScreen type
- Pass `statType` and `statId` to detail screen
- Detail screen loads data based on type/id

---

## Dependencies

- No external charting library needed (custom components)
- May consider `react-native-svg` for advanced graphs (optional)

---

## Risks & Considerations

1. **Performance**: Large datasets may slow queries
   - Mitigation: Add indexes, cache results

2. **Migration**: Existing completed tasks won't have `completed_at`
   - Mitigation: Set `completed_at = created_at` for existing completed tasks

3. **Streak accuracy**: Timezone handling
   - Mitigation: Use device local time consistently

---

## Auto-Fail System (Task Due Date Enforcement)

Tasks that are not completed by their due date should automatically be marked as "failed" and pushed forward.

### Requirements

1. **Daily Check**: On app open (or background job), check for overdue uncompleted tasks
2. **Mark as Failed**: Record the failure in stats (affects completion rate, breaks streak)
3. **Increment Due Date**: Push the task to the next day automatically
4. **Track Failure**: Add `failed_at` timestamp for stats tracking

### Schema Amendments

```sql
-- Add to tasks table
ALTER TABLE tasks ADD COLUMN failed_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN last_failed_at INTEGER;
```

### Logic

```typescript
// Run on app startup or daily
async function processOverdueTasks() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find uncompleted tasks where due_date < today
  const overdueTasks = await getOverdueTasks(startOfToday);

  for (const task of overdueTasks) {
    // Record failure for stats
    await recordTaskFailure(task.id, task.dueDate);

    // Increment due date to today
    await updateTaskDueDate(task.id, startOfToday);

    // Increment fail count
    await incrementFailCount(task.id);
  }
}
```

### Stats Integration

- Failed tasks count against completion rate
- Failures break streaks
- Track "failure rate" per template/category
- Show failed vs completed in detailed stats

### Tasks Checklist (Auto-Fail)

- [ ] **AF.1** Add `failed_count` and `last_failed_at` columns
- [ ] **AF.2** Create `processOverdueTasks()` function
- [ ] **AF.3** Create `recordTaskFailure()` for stats
- [ ] **AF.4** Run check on app startup
- [ ] **AF.5** Update stats queries to include failures
- [ ] **AF.6** Show failure stats in detail view (optional)

---

## Success Criteria

- [ ] Preview cards load quickly (<500ms)
- [ ] Detail screen scrolls smoothly
- [ ] Streaks calculate correctly
- [ ] All three stat types work identically
- [ ] Data persists and updates in real-time
- [ ] Graphs are readable and informative
- [ ] Overdue tasks auto-fail and increment correctly
- [ ] Failures reflected in stats
