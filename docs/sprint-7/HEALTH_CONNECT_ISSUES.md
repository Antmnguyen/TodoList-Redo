# Health Connect — Known Issues
**Last updated:** 2026-04-06

---

## Phase 5 — Manual Device Testing (NOT STARTED)

All 24 tests below require a physical Android device with Health Connect installed and real data
synced. Run them in order — earlier tests cover the plumbing that later tests depend on.

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

## ~~Bug 1 — Task mappings show `permanentId` instead of task name~~ ✅ FIXED

**Fix applied 2026-04-06:**
- `templateTitle?: string` added to `HealthConnectMapping` (`healthConnect.ts`)
- `getAllMappings()` and `getAllEnabledMappings()` now `SELECT m.*, t.templateTitle` (`healthConnectStorage.ts`)
- `rowToMapping()` populates the field (`healthConnectStorage.ts`)
- `MappingRow` in all three detail screens renders `mapping.templateTitle ?? mapping.permanentId`

---

## ~~Bug 2 — Week navigation changes the label but not the chart data~~ ✅ FIXED

**Fix applied 2026-04-06:**
- `selectedWeekStart: string` state added to both screens (init: `startOfCurrentWeek()`)
- `selectedWeekRows` derived via `useMemo` — calls `getStepsInRange` / `getSleepInRange` for `selectedWeekStart → selectedWeekStart+6d`
- `barData` now depends on `selectedWeekRows` instead of the always-current `weekRows`
- `onWeekChange={(monday) => setSelectedWeekStart(toLocalDateString(monday))}` wired into `WeekBarGraph` in both screens
- `addDays(dateStr, n)` module-level helper added to each screen file (constructs via date parts, no UTC shift)
- `weekRows` (current calendar week) retained for the stats row and streak card — those always show the current week regardless of which week is being browsed

---

## Bug 3 — Auto-completer creates a duplicate instance when task is already completed today

**File:** `app/features/googleFit/utils/healthConnectActions.ts` — `findTodaysPendingInstance()`

**Symptom:** If a user manually completes a mapped task and then a sync fires (app foreground or
background), the sync creates a brand-new instance of the task and auto-completes it. The task
list shows two completed entries for the same template on the same day. This occurs if we sync twice as well.

**Root cause:** `findTodaysPendingInstance()` queries `WHERE t.completed = 0`. When the existing
instance is already completed, it returns `null`. The sync then falls through to the `autoSchedule`
branch, which unconditionally creates and completes a new instance.

**Fix:**

Replace `findTodaysPendingInstance` with a two-part check:

1. Add `findTodaysAnyInstance()` — same query but **without** the `completed = 0` filter:
   ```ts
   function findTodaysAnyInstance(permanentId: string): boolean {
     const now = new Date();
     const dayStart = new Date(now); dayStart.setHours(0,0,0,0);
     const dayEnd   = new Date(now); dayEnd.setHours(23,59,59,999);

     const row = db.getFirstSync<{ id: string }>(
       `SELECT t.id
        FROM   tasks t
        INNER JOIN template_instances ti ON ti.instanceId = t.id
        WHERE  ti.templateId = ?
          AND  t.due_date BETWEEN ? AND ?`,
       [permanentId, dayStart.getTime(), dayEnd.getTime()]
     );
     return row !== null;
   }
   ```

2. In `sync()`, guard the `autoSchedule` branch with this check:
   ```ts
   const pending = findTodaysPendingInstance(mapping.permanentId);

   if (pending) {
     await completeTask({ ... });
   } else if (mapping.autoSchedule && !findTodaysAnyInstance(mapping.permanentId)) {
     // Only create a new instance if NONE exists today (completed or not)
     const created = await createTask(...);
     await completeTask(created);
   }
   // If an instance exists but is already completed → do nothing
   ```

---

## Bug 4 — WeekBarGraph `%` mode shows partial percentage for health data (should be 100% or 0%)

**Screens affected:** `StepsDetailScreen`, `SleepDetailScreen` (WeekBarGraph % toggle only)

**Symptom:** In % mode the bar label shows e.g. `84%` for a day where the user walked 8,400 of
10,000 steps. For health goals the meaningful question is binary: "Did I hit my goal today?"
not "What fraction of my goal did I reach?". The user wants `100%` or `0%`.

**Root cause:** `WeekBarGraph` computes `safePct(count, total)` for the % label. The health
screens pass `count = actual steps` and `total = stepsGoal`, so partial percentages are produced.

**Fix — health screens only (do not change WeekBarGraph itself):**

Transform `barData` so that in the `count` field the value is already snapped to the goal:
```ts
const barData: DayData[] = useMemo(
  () =>
    ['M','T','W','T','F','S','S'].map((day, i) => {
      const actual = weekRows.find(r => getDayOfWeek(r.date) === i)?.steps ?? 0;
      return {
        day,
        count: actual >= stepsGoal ? stepsGoal : 0,   // snap: either full goal or zero
        total: stepsGoal,
      };
    }),
  [weekRows, stepsGoal]
);
```

With `count = stepsGoal` when met, `safePct(stepsGoal, stepsGoal) = 100%`.
With `count = 0` when not met, the label shows `0%`.

The bar height in Count mode will be full-height or absent — which is acceptable because
Count mode is less meaningful for health data (actual step counts are better read from the
Avg chart below). If full Count-mode bars with actual values are still desired, a separate
`rawCount` field could be threaded through, but that requires modifying `WeekBarGraph`. The
simplest ship is to accept this trade-off or hide the Count/% toggle entirely on health screens
and use Avg/% naming in the WeekBarGraph title via a prop.

Apply the same snap logic to `SleepDetailScreen` with `sleepHours >= sleepGoal`.

---

## Bug 5 — `HealthDayOfWeekCard` % mode should show goal-met rate, not avg-as-%-of-goal

**Screens affected:** `StepsDetailScreen`, `SleepDetailScreen` (HealthDayOfWeekCard % toggle)

**Symptom:** In % mode the card shows "What percentage of my goal do I average on Mondays?"
(e.g. 84% if average Monday steps are 8,400/10,000). The user wants "What percentage of
Mondays did I actually hit my goal?" (e.g. 60% if goal was met on 3 of 5 Mondays).

**Root cause:** `HealthDayOfWeekCard` only receives `avgValue` and computes
`Math.round((avgValue / goal) * 100)` for the % label and bar height. It has no knowledge
of how many days the goal was actually met for that weekday.

**Fix:**

1. Add `goalMetCount` to `HealthDayOfWeekData`:
   ```ts
   export interface HealthDayOfWeekData {
     day: string;
     avgValue: number;
     count: number;
     goalMetCount: number;   // ← new: days this weekday where goal was met
   }
   ```

2. Populate it in the screens' `useMemo`:
   ```ts
   // Steps
   if (row.steps >= stepsGoal) goalMet[dow]++;

   // Sleep
   if (row.sleepHours >= sleepGoal) goalMet[dow]++;

   return DAY_LABELS.map((day, i) => ({
     day,
     avgValue: counts[i] > 0 ? sums[i] / counts[i] : 0,
     count: counts[i],
     goalMetCount: goalMet[i],
   }));
   ```

3. In `HealthDayOfWeekCard`'s `DayBar`, switch the % calculation:
   ```ts
   // % mode: goal-met rate (goalMetCount ÷ count), not avgValue ÷ goal
   if (mode === 'percent') {
     const rate = item.count > 0 ? item.goalMetCount / item.count : 0;
     barHeight = Math.max(rate * BAR_MAX_HEIGHT, item.goalMetCount > 0 ? BAR_MIN_HEIGHT : BAR_MIN_HEIGHT);
     valueLabel = `${Math.round(rate * 100)}%`;
   }
   ```

4. Update `bestDayIndex` in % mode to rank by `goalMetCount / count` rather than
   `avgValue / goal`.

5. Update the footer to read "Goal met most often: Monday" in % mode.
