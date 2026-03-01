# Stats UI — Backend Integration Guide

How to wire real data into the stats detail screens.
All three screens (`OverallDetailScreen`, `CategoryDetailScreen`, `PermanentDetailScreen`) use the same pattern: replace the `getMock*` function with a real hook, keep every prop shape identical.

---

## 1. Entry point — how a screen is opened

```
StatsScreen
  └─ onStatCardPress(params: StatDetailParams)
       └─ MainNavigator renders the correct detail screen
```

### `StatDetailParams`
```ts
{
  type:  'all' | 'category' | 'template'
  id:    string   // 'all_time' | 'all_year' | 'all_month' | 'all_week'
                  // 'cat_work' | 'cat_health' | ...
                  // 'tpl_morning' | ...
  name:  string   // shown in header
  color: string   // hex accent for the whole screen
}
```

**The `id` is the contract between the UI and the backend.** The backend receives this id and returns data pre-filtered to the correct scope.

---

## 2. Time-framing rules (backend responsibility)

The UI does **zero** time-window filtering. The backend does all of it before returning data. The UI just renders what it receives.

| Screen opened from | id example | Expected time window |
|---|---|---|
| "This Week" overall card | `all_week` | Mon–Sun of the current week |
| "This Month" overall card | `all_month` | 1st–last day of current month |
| "This Year" overall card | `all_year` | Jan 1 – Dec 31 current year |
| "All Time" overall card | `all_time` | Full history |
| Category card | `cat_work` | Full history, filtered to category |
| Template card | `tpl_morning` | Full history, filtered to template |

For **day-of-week pattern** data specifically: the backend filters records to the bucket's window, then aggregates by weekday. No date math happens on the client.

For **streak values**: return values capped to a window that makes sense for the bucket. A "week" bucket streak can't exceed 7; a "month" bucket streak can't exceed 28–31.

---

## 3. Where to swap in real data

Each screen has one mock function at the top of the file. Replace only that function (or its call site) with a hook.

| Screen | Mock function | Replace with |
|---|---|---|
| `OverallDetailScreen.tsx` | `getMockOverallDetail(id)` | `useOverallStats(id)` |
| `CategoryDetailScreen.tsx` | `getMockCategoryDetail(id)` | `useCategoryStats(id)` |
| `PermanentDetailScreen.tsx` | `getMockPermanentDetail(id)` | `usePermanentStats(id)` |

The hook should return the same shape as the mock's return type. No other code in the screen needs to change.

---

## 4. Card data contracts

### CompletionSummaryCard
```ts
completed: number   // tasks completed in the bucket's window
total:     number   // tasks scheduled in the bucket's window
color:     string   // from params — no backend field needed
```
- `total = 0` hides the denominator row. Safe to pass 0 if not calculable.
- Rate is computed client-side: `Math.round(completed / total * 100)`.

---

### StreakCard
```ts
currentStreak: number   // consecutive days ending today with ≥1 completion
bestStreak:    number   // longest consecutive run within the bucket's window
```
- Both are in **days**.
- `currentStreak` / `bestStreak` should already be scoped to the bucket's window by the backend.

---

### TaskTypeBreakdownCard
```ts
permanentCount: number   // perm task completions in window
oneOffCount:    number   // one-off task completions in window
```
- Colors (green / blue) are hardcoded in the component — no color fields needed.
- Not used on `PermanentDetailScreen`.

---

### TimeRangeCountsCard
```ts
weekCount:    number
monthCount:   number
yearCount:    number
allTimeCount: number

// Optional — enables the 4-column perm/one-off breakdown layout
breakdown?: {
  week:    { perm: number; oneOff: number }
  month:   { perm: number; oneOff: number }
  year:    { perm: number; oneOff: number }
  allTime: { perm: number; oneOff: number }
}
```
- Pass `breakdown` on Overall and Category screens.
- Omit `breakdown` on Permanent screen (falls back to simple 2-column layout).
- All four time counts are always shown regardless of which bucket opened the screen.

---

### WeekBarGraph
```ts
data: Array<{
  day:      string          // 'M' | 'T' | 'W' | 'T' | 'F' | 'S' | 'S'
  count:    number          // completions this day
  total:    number          // tasks scheduled this day (denominator for % mode)
  segments?: Array<{        // omit for solid bars
    label: string           // 'Permanent' | 'One-off'
    color: string           // '#34C759' | '#007AFF'
    count: number
  }>
}>   // exactly 7 items, Mon index 0 → Sun index 6
```
- Pass data for the **current week**. The component handles its own week navigator — past weeks generate seeded fallback data internally (replace that with a `onWeekChange` callback fetching real past-week data when ready).
- `total = 0` on a day = task not scheduled → bar is hidden.

---

### MonthCalendarGraph
```ts
year:  number   // e.g. 2026
month: number   // 0-indexed (0 = Jan)
data: Array<{
  date:      number   // 1-based day of month
  completed: number
  total:     number   // tasks scheduled that day
}>
// Only include days that have scheduled tasks — absent days show no ring.
```
- Pass initial month. Component handles its own month navigator.
- Use `onMonthChange?: (year, month) => void` to fetch real data for navigated months when ready.

---

### YearOverviewGraph
```ts
data: Array<{              // exactly 12 items, index = month (0–11)
  month:     number        // 0–11
  completed: number        // 0 for future months
  total:     number        // 0 for future months
  segments?: Array<{       // optional perm/one-off breakdown
    label: string
    color: string
    count: number
  }>
}>
```
- Future months: pass `completed: 0, total: 0` — rendered at 30% opacity automatically.
- Use `onYearChange?: (year) => void` to fetch past year data when ready.

---

### DayOfWeekPatternCard
```ts
data: Array<{             // exactly 7 items, Mon index 0 → Sun index 6
  day:       string       // 'M' | 'T' | 'W' | 'T' | 'F' | 'S' | 'S'
  count:     number       // completions on this weekday within the bucket's window
  total?:    number       // times scheduled on this weekday (enables true % mode)
  segments?: Array<{
    label: string
    color: string
    count: number
  }>
}>
```
- The backend pre-filters to the bucket's time window, then aggregates by weekday. No client-side time logic.
- `total` is optional but strongly recommended — without it, `%` mode falls back to relative-to-peak.

---

### CategoryBreakdownCard *(OverallDetailScreen only)*
```ts
categories: Array<{
  name:    string   // category display name
  color:   string   // category hex color
  count:   number   // completions in this category within the window
  percent: number   // completion rate 0–100 for this category
}>
// Up to 5 items, sorted descending by count
```

---

### CategoryWeekBarGraph *(OverallDetailScreen only)*
```ts
data: Array<{              // exactly 7 items Mon → Sun
  day:      string
  segments: Array<{
    name:  string          // category name
    color: string          // category hex color
    count: number          // completions in this category on this day
  }>
}>
```
- Segments ordered however — the component stacks them bottom-up.
- Past weeks currently show seeded solid bars. Hook up `onWeekChange` to return real category data for past weeks when ready.

---

### CategoryYearOverviewGraph *(OverallDetailScreen only)*
```ts
data: Array<{              // exactly 12 items Jan → Dec
  month:    number         // 0–11
  segments: Array<{
    name:  string
    color: string
    count: number
  }>
  // empty segments array = future month (no data)
}>
```
- Hook up `onYearChange` to fetch real past-year data when ready (currently shows seeded solid bars for past years).

---

### PermanentTaskListCard *(CategoryDetailScreen only)*
```ts
tasks: Array<{
  id:            string
  name:          string
  completedCount: number
  totalCount:    number   // scheduled occurrences in window
  streak:        number   // current streak for this task
  color:         string   // category color
}>
onTaskPress?: (taskId: string) => void
```

---

## 5. Card visibility by bucket (OverallDetailScreen)

| Card | week | month | year | all_time |
|---|---|---|---|---|
| CompletionSummaryCard | ✓ | ✓ | ✓ | ✓ |
| StreakCard | ✓ | ✓ | ✓ | ✓ |
| TaskTypeBreakdownCard | ✓ | ✓ | ✓ | ✓ |
| TimeRangeCountsCard | ✓ | ✓ | ✓ | ✓ |
| WeekBarGraph | ✓ | ✓ | ✓ | ✓ |
| MonthCalendarGraph | ✗ | ✓ | ✓ | ✓ |
| YearOverviewGraph | ✗ | ✗ | ✓ | ✓ |
| DayOfWeekPatternCard | ✗ | ✓ | ✓ | ✓ |
| CategoryBreakdownCard | ✓ | ✓ | ✓ | ✓ |
| CategoryWeekBarGraph | ✓ | ✓ | ✓ | ✓ |
| CategoryYearOverviewGraph | ✗ | ✗ | ✓ | ✓ |

Visibility is controlled in `OverallDetailScreen` via `getBucket(params.id)` — no changes needed in the card components themselves.

---

## 6. Data checks / edge case rules

| Situation | What to do |
|---|---|
| `total = 0` | Safe everywhere — components handle divide-by-zero via `safePct()` |
| `completed > total` | Don't send this — the ring will overflow. Clamp on the backend. |
| Future month in year graph | `completed: 0, total: 0` — dimmed automatically |
| No completions yet | All `count = 0` is valid — components show empty/stub state |
| `segments` present but all counts are 0 | Fine — bars render as empty stubs |
| `segments` counts don't sum to `count` | Components trust `segments` for bar heights — keep them consistent |
| `streak > window length` | Backend should cap streaks to the bucket's max (7 for week, 28–31 for month) |
