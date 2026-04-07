# Sprint 7 — Remaining Work
**Date:** 2026-04-05  |  **Last updated:** 2026-04-06

## ✅ IMPLEMENTATION COMPLETE — ONLY TESTING REMAINS

Everything from S8 through S15 and U4 through U7 is fully implemented. The only
remaining work is **Phase 5: manual device testing (T1–T24)** at the bottom of
this document.

**Quick summary of what was done in the 2026-04-05/06 session:**
- `healthConnectUtils.ts` — `computeStepsStats()` (S8) + `computeSleepStats()` (S9)
- `StepsDetailScreen.tsx` (U4) — ring, goals, charts, stats, mapping rows, DayOfWeekPatternCard
- `SleepDetailScreen.tsx` (U5) — ring, goals, charts, stats, mapping rows, DayOfWeekPatternCard
- `WorkoutsDetailScreen.tsx` (U6) — today's sessions list, mapping rows
- `HealthMappingEditor.tsx` (U7) — template picker, threshold fields, exercise picker
- `HealthManagementScreen.tsx` — stub detail screens replaced with real imports
- `useTasks.ts` + `healthConnectActions.ts` — DeviceEventEmitter sync event (S12)
- `App.tsx` — fire-and-forget app-start sync (S13)
- `MainNavigator.tsx` — AppState foreground catch-up sync (S14)
- `index.ts` — BackgroundFetch configure + registerHeadlessTask (S15)
- **React hooks violation fixed** in `WorkoutsDetailScreen.tsx` — `if (showEditor)`
  early return was moved to after all hook declarations (Rules of Hooks compliance)
- **React hooks violation fixed** in `HealthManagementScreen.tsx` — sub-screen early
  returns moved after all hub state hooks (was crashing when opening any detail screen)
- **DayOfWeekPatternCard added** to `StepsDetailScreen` and `SleepDetailScreen` —
  shows all-time goal-met count/rate by weekday; reuses existing component from
  `app/components/stats/detail/shared/DayOfWeekPatternCard.tsx`. Data uses full
  history query (`'2000-01-01'` → today) so pattern improves as sync data accumulates.

---

**Status entering this session (original 2026-04-05):** Phases 1–2 (storage) complete. Phase 3 (actions)
mostly complete — `sync()`, `checkStatus()`, `requestPermissions()`, `getTodaySummary()`
all done. Hub screen (`HealthManagementScreen`) done with stub detail screens.
Remaining: stats helpers, sync wiring, three detail screens, mapping editor, testing.

---

## Order of Work

```
S8–S9 (stats helpers)  →  U4–U6 (detail screens)  →  U7 (mapping editor)
  →  S12–S15 (sync wiring)  →  Phase 5 (testing)
```

Build stats helpers first since the detail screens depend on them.
Build the mapping editor after the detail screens so you can test it in context.
Wire sync last (non-breaking additions to App.tsx / MainNavigator.tsx / useTasks.ts).

---

## S8 — `computeStepsStats()` ✅ DONE

**Where:** `app/features/googleFit/utils/healthConnectUtils.ts` (new file)

Takes rows from `getStepsInRange()` and computes display stats. Called by
`StepsDetailScreen` at render time — no SQLite queries in this function.

```ts
import { StepsDayRecord } from '../types/healthConnect';
import { calcCurrentStreak, calcBestStreak } from '../../../core/utils/statsCalculations';

export interface StepsStats {
  weekAvg:      number | null;   // avg steps on days with data this calendar week
  monthAvg:     number | null;   // avg steps on days with data this calendar month
  personalBest: number | null;   // from getStepsPersonalBest()
  currentStreak: number;         // consecutive days meeting goal ending today
  bestStreak:    number;
}

export function computeStepsStats(
  rows: StepsDayRecord[],   // all rows in the query range, ordered by date ASC
  goal: number,             // current steps goal from getStepsGoal()
): StepsStats
```

**Streak input:** `calcCurrentStreak` and `calcBestStreak` (already in
`statsCalculations.ts`) accept a `string[]` of `'YYYY-MM-DD'` dates. Pass only the
dates where `steps >= goal`:
```ts
const goalMetDates = rows.filter(r => r.steps >= goal).map(r => r.date);
const currentStreak = calcCurrentStreak(goalMetDates);
const bestStreak    = calcBestStreak(goalMetDates);
```

**Averages:** filter rows with `steps > 0` (skip days with no data) then average.
Pass week rows and month rows separately from the screen — or compute both here if
you pass the full history and filter inside by date range.

---

## S9 — `computeSleepStats()` ✅ DONE

**Same file:** `app/features/googleFit/utils/healthConnectUtils.ts`

```ts
import { SleepDayRecord } from '../types/healthConnect';

export interface SleepStats {
  weekAvg:       number | null;  // avg sleep hours on nights with data this week
  monthAvg:      number | null;
  personalBest:  number | null;  // from getSleepPersonalBest()
  currentStreak: number;         // consecutive nights meeting goal ending today
  bestStreak:    number;
}

export function computeSleepStats(
  rows: SleepDayRecord[],
  goalHours: number,
): SleepStats
```

Same streak pattern as steps — filter `sleepHours >= goalHours`, pass dates to
`calcCurrentStreak` / `calcBestStreak`.

---

## U4 — `StepsDetailScreen` ✅ DONE

**Where:** `app/screens/browse/StepsDetailScreen.tsx` — extracted from stub and
imported into `HealthManagementScreen.tsx`. All hooks declared before early return
(Rules of Hooks compliant). Includes `DayOfWeekPatternCard` (section 7).

**Props:** `{ onBack: () => void }`

### Layout (top to bottom)

```
Header (← Back | Steps)
─────────────────────────────────
CircularProgress ring (large, ~120px)
  "6,432 steps today"
  "Goal: 10,000  [edit]"
  Goal colour  [Switch]
─────────────────────────────────
TimeRangePicker  (Week | Month only)
WeekBarGraph  OR  MonthCalendarGraph
─────────────────────────────────
Stats row: Week avg · Month avg · Best day
StreakCard
─────────────────────────────────
── Task Mappings ──
  MappingRow × n
  [+ Add Task Mapping]
```

### Key implementation details

**State loaded on mount:**
```ts
const today      = toLocalDateString(new Date());
const weekStart  = startOfCurrentWeek();   // from statsCalculations
const monthStart = startOfCurrentMonth();

const stepsGoal        = getStepsGoal();
const colorEnabled     = getStepsColorEnabled();
const lastSyncedAt     = getLastSyncedAt();

// For ring: today only
const todayRows   = getStepsInRange(today, today);
const todaySteps  = todayRows[0]?.steps ?? 0;

// For charts + stats
const weekRows    = getStepsInRange(weekStart, today);
const monthRows   = getStepsInRange(monthStart, today);
const personalBest = getStepsPersonalBest();

const weekStats  = computeStepsStats(weekRows,  stepsGoal);
const monthStats = computeStepsStats(monthRows, stepsGoal);
```

**CircularProgress:**
```tsx
<CircularProgress
  percent={Math.min((todaySteps / stepsGoal) * 100, 100)}
  size={120}
  color={colorEnabled && todaySteps >= stepsGoal ? '#34C759' : HC_COLOR}
  trackWidth={10}
/>
```

**Goal edit:** Tapping the goal value opens a numeric `Alert.prompt` (or an inline
`TextInput` that becomes editable). On confirm call `setStepsGoal(newValue)` then
reload state.

**WeekBarGraph** (when `timeRange === 'week'`):
```ts
// DayData: count = steps that day, total = goal (used by % mode in the graph)
const barData: DayData[] = ['M','T','W','T','F','S','S'].map((day, i) => ({
  day,
  count: weekRows.find(r => getDayOfWeek(r.date) === i)?.steps ?? 0,
  total: stepsGoal,
}));
```
Pass `color={HC_COLOR}` — WeekBarGraph does not support per-bar color. The
MonthCalendarGraph's built-in color thresholds (≥60% = green) naturally handle
goal-met highlighting when `completed=steps, total=goal`.

**MonthCalendarGraph** (when `timeRange === 'month'`):
```ts
const calData: CalendarDayData[] = monthRows.map(r => ({
  date:      parseInt(r.date.split('-')[2], 10),  // day of month
  completed: r.steps,
  total:     stepsGoal,
}));
```
`color={HC_COLOR}` for the active tab toggle — the cell fill colours are built-in.

**Stats row** (simple inline text):
```
Week avg: {weekStats.weekAvg?.toLocaleString() ?? '—'}  steps
Month avg: {monthStats.monthAvg?.toLocaleString() ?? '—'}  steps
Best day: {personalBest?.steps.toLocaleString() ?? '—'}
```

**StreakCard:**
```tsx
<StreakCard
  currentStreak={weekStats.currentStreak}
  bestStreak={weekStats.bestStreak}
  color={HC_COLOR}
/>
```
Use the week stats object for streak — it already computed from all rows passed in.
You may want to pass the full month rows to get a more accurate best streak. Pass
`monthRows` to `computeStepsStats` and use those streak values.

**Mapping rows:** `getAllMappings()` filtered to `dataType === 'steps'`. Each row
shows template title + threshold + enabled toggle. Tapping opens `HealthMappingEditor`
in 'steps' mode. "+ Add Task Mapping" opens editor in create mode.

---

## U5 — `SleepDetailScreen` ✅ DONE

**Where:** `app/screens/browse/SleepDetailScreen.tsx` — includes `DayOfWeekPatternCard` (section 7).

**Props:** `{ onBack: () => void }`

### Layout

```
Header (← Back | Sleep)
─────────────────────────────────
CompletionSummaryCard ring
  "7h 12m  /  8h 0m goal"
  Goal colour  [Switch]
  ── Stage bar (hidden if no stage data) ──
─────────────────────────────────
TimeRangePicker (Week | Month)
WeekBarGraph  OR  MonthCalendarGraph
─────────────────────────────────
Stats row: Week avg · Month avg · Best night
StreakCard
─────────────────────────────────
── Task Mappings ──
  MappingRow × n
  [+ Add Task Mapping]
```

### Key implementation details

**CompletionSummaryCard** uses minutes internally:
```tsx
<CompletionSummaryCard
  completed={Math.round(lastNightHours * 60)}   // sleep minutes
  total={Math.round(sleepGoalHours * 60)}       // goal minutes
  color={colorEnabled && lastNightHours >= sleepGoalHours ? '#34C759' : HC_COLOR}
/>
```

**Sleep display:** Format hours as "7h 12m":
```ts
function formatHours(h: number): string {
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}
```

**Stage mini-bar:** The current `SleepDayRecord` from our storage only stores
`sleepHours` — no stage breakdown (we didn't add stage columns to keep the schema
simple). Hide the stage bar entirely. Add a TODO comment for future stage support.

**WeekBarGraph data** — same pattern as Steps but with hours:
```ts
const barData: DayData[] = ['M','T','W','T','F','S','S'].map((day, i) => ({
  day,
  count: weekRows.find(r => getDayOfWeek(r.date) === i)?.sleepHours ?? 0,
  total: sleepGoalHours,
}));
```

**MonthCalendarGraph** — `completed = sleepHours * 10`, `total = sleepGoalHours * 10`
(multiply to avoid decimal issues with the integer-expected `completed/total` ratio).

**Mapping rows:** filter `getAllMappings()` to `dataType === 'sleep'`.

---

## U6 — `WorkoutsDetailScreen` ✅ DONE

**Where:** `app/screens/browse/WorkoutsDetailScreen.tsx`

**Props:** `{ onBack: () => void }`

No history table — workouts are read fresh from Health Connect on mount.

**Hooks fix applied:** The `if (showEditor)` early return was originally placed before
`useState`/`useCallback` declarations, violating the Rules of Hooks. Fixed by moving
all hook declarations (showEditor, editingMapping, workouts, loading, mappings,
loadMappings, useEffect) to the top of the component, with `if (showEditor)` placed
after the `useEffect` registration.

### Layout

```
Header (← Back | Workouts)
─────────────────────────────────
── Today's Sessions ──
  ExerciseTypeLabel · Xm
  (or "No workouts recorded today")
─────────────────────────────────
── Task Mappings ──
  MappingRow × n
  [+ Add Task Mapping]
```

### Key implementation details

**Load today's workouts on mount:**
```ts
const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
const [loading, setLoading]   = useState(true);

useEffect(() => {
  getTodaySummary()
    .then(s => setWorkouts(s.workouts))
    .catch(() => setWorkouts([]))
    .finally(() => setLoading(false));
}, []);
```

**Exercise type label:** Use `ExerciseTypeMap` from the types file:
```ts
import { ExerciseTypeMap } from '../../features/googleFit/types/healthConnect';

function exerciseLabel(type: number): string {
  return Object.entries(ExerciseTypeMap).find(([, v]) => v === type)?.[0] ?? `Type ${type}`;
}
```

**Session row:**
```
Strength Training · 45 min
Running · 32 min
```

**Mapping rows:** filter `getAllMappings()` to `dataType === 'workout'`. Each row
shows exercise type label + min duration + enabled toggle.

---

## U7 — `HealthMappingEditor` ✅ DONE

**Where:** `app/screens/browse/HealthMappingEditor.tsx`

Modal/sub-screen for creating or editing a single mapping. Opened from within
any detail screen's "+ Add Task Mapping" button or by tapping an existing row.

**Props:**
```ts
interface HealthMappingEditorProps {
  dataType:   'steps' | 'sleep' | 'workout';  // pre-selected, not changeable
  mapping?:   HealthConnectMapping;            // undefined = create mode
  onSave:     () => void;
  onCancel:   () => void;
}
```

### Layout

```
Header: Add Mapping / Edit Mapping
─────────────────────────────────
Task
  [Pick a permanent task ▾]      ← FlatList picker of getAllPermanentTemplates()

── Threshold ──
  [Steps]    Step goal:  [ 10000 ]
  [Sleep]    Min hours:  [  7.0  ]
  [Workout]  Exercise:   [Any ▾]
             Min duration: [ 30 ] min

Auto-schedule if no task today   [Switch]

[Save]          [Delete]  (Delete hidden in create mode)
```

### Key implementation details

**Template picker:** Call `getAllPermanentTemplates()` (from
`permanentTaskActions.ts`). Show as a scrollable list or a `Modal` with a
`FlatList`. Store selected `permanentId`.

**ID generation on create:** Use `'hcm_' + Date.now() + '_' + Math.random().toString(36).slice(2,6)`.

**Exercise type picker:** Build options from `ExerciseTypeMap`:
```ts
const exerciseOptions = Object.entries(ExerciseTypeMap).map(([label, value]) => ({
  label,
  value,
}));
```
Show as a scrollable picker or segmented buttons. Store the integer value, not the label.

**Save:**
```ts
saveMapping({
  id:                  mapping?.id ?? generateId(),
  permanentId:         selectedTemplateId,
  dataType,
  stepsGoal:           dataType === 'steps'   ? Number(stepsGoalInput)  : undefined,
  sleepHours:          dataType === 'sleep'   ? Number(sleepHoursInput) : undefined,
  exerciseType:        dataType === 'workout' ? selectedExerciseType    : undefined,
  minDurationMinutes:  dataType === 'workout' ? Number(durationInput)   : undefined,
  autoSchedule,
  enabled: true,
});
onSave();
```

**Delete:** Call `deleteMapping(mapping.id)` then `onSave()`.

---

## S12 — `useTasks.ts` — sync event listener ✅ DONE

**File:** `app/core/hooks/useTasks.ts`

Add a `DeviceEventEmitter` subscription so the task list refreshes automatically
after any sync (foreground or background):

```ts
import { DeviceEventEmitter } from 'react-native';

// Inside the hook, alongside existing useEffect:
useEffect(() => {
  const sub = DeviceEventEmitter.addListener('healthConnectSyncComplete', loadTasks);
  return () => sub.remove();
}, []);
```

Also emit the event at the end of `sync()` in `healthConnectActions.ts`:
```ts
import { DeviceEventEmitter } from 'react-native';
// At the end of sync(), after setLastSyncedAt():
DeviceEventEmitter.emit('healthConnectSyncComplete');
```

---

## S13 — App-start sync (`App.tsx`) ✅ DONE

**File:** `App.tsx`

Call `sync()` fire-and-forget after `initializeAllSchemas()`. Must NOT block render.

```ts
import { sync } from './app/features/googleFit/utils/healthConnectActions';

// After initializeAllSchemas():
initializeAllSchemas();
sync().catch(e => console.warn('[HC] App-start sync failed:', e));  // fire-and-forget
```

---

## S14 — Foreground catch-up (`MainNavigator.tsx`) ✅ DONE

**File:** `app/navigation/MainNavigator.tsx`

Add an `AppState` listener that calls `sync()` when the app comes to foreground:

```ts
import { AppState } from 'react-native';
import { sync } from '../features/googleFit/utils/healthConnectActions';

// Inside the component, add alongside existing useEffects:
useEffect(() => {
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active') {
      sync().catch(e => console.warn('[HC] Foreground sync failed:', e));
    }
  });
  return () => sub.remove();
}, []);
```

---

## S15 — Background sync (`react-native-background-fetch`) ✅ DONE

**File:** `index.js` (app entry point)

```ts
import BackgroundFetch from 'react-native-background-fetch';
import { sync } from './app/features/googleFit/utils/healthConnectActions';

// Register background task
BackgroundFetch.configure(
  {
    minimumFetchInterval: 15,          // minutes (Android minimum)
    stopOnTerminate:      false,
    startOnBoot:          true,
    enableHeadless:       true,
  },
  async (taskId) => {
    await sync().catch(e => console.warn('[HC] Background sync failed:', e));
    BackgroundFetch.finish(taskId);
  },
  (taskId) => {
    console.warn('[HC] Background fetch timeout:', taskId);
    BackgroundFetch.finish(taskId);
  }
);

// Headless task (runs when app is fully terminated)
BackgroundFetch.registerHeadlessTask(async ({ taskId }) => {
  await sync().catch(e => console.warn('[HC] Headless sync failed:', e));
  BackgroundFetch.finish(taskId);
});
```

**AndroidManifest.xml** — the service declaration was already added during setup.
Verify it is present in `android/app/src/main/AndroidManifest.xml`.

---

## Phase 5 — Testing Checklist ⬜ NOT STARTED — THIS IS THE ONLY REMAINING WORK

Work through these in order on a physical Android device. Each row is one manual
test. Mark `[x]` when confirmed working.

### Steps
| # | Test | Status |
|---|------|--------|
| T1 | Walk to a step count → app-start sync → ring updates, green when goal met | `[ ]` |
| T2 | Week bar graph shows bars for each day; goal-met days show green fill via MonthCalendarGraph logic | `[ ]` |
| T3 | Goal colour toggle off → all calendar cells revert to accent colour | `[ ]` |
| T4 | Monthly calendar cells: goal-met days green (≥60% fill), partial days yellow/red | `[ ]` |
| T5 | Week avg + month avg values match manual calculation from stored rows | `[ ]` |
| T6 | Add mapping → reach step goal → mapped task auto-completes (today only) | `[ ]` |
| T7 | Instance from yesterday with same template NOT completed by today's sync | `[ ]` |

### Sleep
| # | Test | Status |
|---|------|--------|
| T8 | Log overnight sleep → open app → last-night ring shown, green when goal met | `[ ]` |
| T9 | Week bar graph + monthly calendar colouring mirrors goal status | `[ ]` |
| T10 | Goal colour toggle off → all cells revert to accent colour | `[ ]` |
| T11 | Add mapping → sleep meets threshold → today's task auto-completes | `[ ]` |
| T12 | Session 11 PM–7 AM → counted for "today" (endTime filter working) | `[ ]` |
| T13 | No sleep data → ring shows 0/goal, no crash | `[ ]` |

### Workouts
| # | Test | Status |
|---|------|--------|
| T14 | Log workout → sessions list shows correct type label + duration | `[ ]` |
| T15 | Workout mapping completes today's instance, not yesterday's recurring instance | `[ ]` |
| T16 | `autoSchedule = true` with no instance today → default created + completed | `[ ]` |

### Sync correctness
| # | Test | Status |
|---|------|--------|
| T17 | User manually completes task → next sync does NOT double-complete it | `[ ]` |
| T18 | Open app twice after threshold met → task NOT double-completed | `[ ]` |
| T19 | Background sync fires → task list refreshes automatically (DeviceEventEmitter) | `[ ]` |
| T20 | Permission denial → no crash, Health screen shows status correctly | `[ ]` |

### Edge cases
| # | Test | Status |
|---|------|--------|
| T21 | Repeatable template → next occurrence scheduled after HC auto-complete | `[ ]` |
| T22 | Delete template with mapping → orphan invisible to sync, cleaned on Health screen open | `[ ]` |
| T23 | Dark mode: all health screens render correctly with theme colours | `[ ]` |
| T24 | Light mode: same screens, no hardcoded colours bleeding through | `[ ]` |

---

## Key Reminders

- `getDayOfWeek(dateStr)` helper: parse 'YYYY-MM-DD', call `.getDay()`, map Sun=0
  to index 6, Mon=1 to index 0 (for Mon–Sun bar order).
- `StepsDayRecord.steps` and `SleepDayRecord.sleepHours` — the field names from our
  storage (not `stepCount` / `durationMins` from the plan's original type definitions).
- `HealthMappingEditor` must call `pruneOrphanedMappings()` before loading the
  template list — or just rely on `getAllMappings()` INNER JOIN filtering.
- `getAllMappings()` returns all rows (enabled + disabled) for UI display.
  `getAllEnabledMappings()` is sync-only.
- `HC_COLOR = '#33ace5'` — the brand colour used across all health screens.
- All screen components must use `useTheme()` + `useMemo(() => makeStyles(theme), [theme])`.
  No hardcoded hex values for themed surfaces/text.
