# Sprint 7 — Next Steps
**Date:** 2026-03-30

**⚠️ STATUS AS OF 2026-04-06: ALL PHASES COMPLETE — SEE `NEXT_STEPS_2026-04-05.md` FOR FULL DETAIL**

Phases 1–4 are fully implemented and the hooks violations are fixed. Only Phase 5
(manual device testing, T1–T24) remains. Jump straight to `NEXT_STEPS_2026-04-05.md`
for the current checklist.

**Status entering this session (updated 2026-04-05):** Phase 1 types + storage complete. Phase 2 (actions) next.

**Original status (2026-03-30):** Setup complete. Permissions granted (Steps, StepsCadence, SleepSession). SDK verified. Screen is clean placeholder. No feature code written yet.

---

## Phase 1 — Types + Storage Layer `[x] COMPLETE`

### `app/features/googleFit/types/healthConnect.ts` `[x]`
- `HealthDataType`, `ExerciseTypeValue`, `ExerciseTypeMap`
- `HealthConnectMapping`, `WorkoutSession`, `TodaySummary`, `HealthConnectStatus`

### `app/core/services/storage/schema/healthConnect.ts` `[x]`
Schema init for four tables:
```
health_connect_mappings  — threshold → template assignments
health_connect_meta      — key-value store (goals, colour toggles, last_synced_at)
health_steps_log         — one row per 'YYYY-MM-DD', total step count for that day
health_sleep_log         — one row per 'YYYY-MM-DD' (morning), sleep hours for that night
```
Registered as Step 7 in `app/core/services/storage/schema/index.ts`.

Steps/sleep history tables are upserted on every sync so stats survive Health Connect
being wiped (which happens regularly on test devices and after reinstalls).

### `app/core/services/storage/healthConnectStorage.ts` `[x]`
Public API:

**Mappings:**
- `saveMapping(mapping)` — upsert
- `deleteMapping(id)`
- `getAllEnabledMappings()` — INNER JOIN against templates to filter orphans
- `getAllMappings()` — all rows for UI display
- `pruneOrphanedMappings()` — delete rows whose permanentId no longer exists

**Meta:**
- `getLastSyncedAt()` / `setLastSyncedAt(iso)`
- `getStepsGoal()` / `setStepsGoal(n)` — display goal (default 10000)
- `getSleepGoal()` / `setSleepGoal(h)` — display goal in hours (default 8)
- `getStepsColorEnabled()` / `setStepsColorEnabled(b)`
- `getSleepColorEnabled()` / `setSleepColorEnabled(b)`

**Steps history:**
- `upsertStepsForDate(date, steps)` — called by sync after summing HC intervals
- `getStepsInRange(from, to)` → `StepsDayRecord[]` — used by charts + stats
- `getStepsPersonalBest()` → `StepsDayRecord | null`

**Sleep history:**
- `upsertSleepForDate(date, sleepHours)` — called by sync
- `getSleepInRange(from, to)` → `SleepDayRecord[]` — used by charts + stats
- `getSleepPersonalBest()` → `SleepDayRecord | null`

> **Architecture note:** Schema lives in `core/services/storage/schema/` and storage
> layer in `core/services/storage/` — same pattern as categories and permanentTask.
> Types remain in `app/features/googleFit/types/` as they are feature-specific.

---

## Phase 2 — Health Connect Actions `[x] COMPLETE`

### `app/features/googleFit/utils/healthConnectActions.ts`

| Function | Notes |
|---|---|
| `checkStatus()` | `getSdkStatus()` → `HealthConnectStatus` enum |
| `requestPermissions()` | Steps + Sleep + Exercise read permissions |
| `getTodaySummary()` | Steps: sum `count` since midnight. Sleep: 24h lookback, `endTime >= today`. Workouts: ExerciseSession since midnight. |
| `sync()` | Status check → summary → upsert history → prune → evaluate mappings → complete/auto-schedule |

Internal helpers (not exported):
- `evaluateThreshold(mapping, summary)` — pure boolean per dataType
- `findTodaysPendingInstance(permanentId)` — queries tasks + template_instances for incomplete instance due today

`sync()` is always fire-and-forget — never awaited on the render path.

---

## Phase 3 — Screen UI `[x] COMPLETE`

### `app/screens/browse/HealthManagementScreen.tsx` `[x]`

Hub screen — status badge + 3 section rows + Sync Now button.

Sub-screen routing via local `subScreen` state (same pattern as BrowseScreen):
```
'none'     → hub
'steps'    → StepsDetailScreen stub (to be replaced Phase 3b)
'sleep'    → SleepDetailScreen stub (to be replaced Phase 3c)
'workouts' → WorkoutsDetailScreen stub (to be replaced Phase 3d)
```

Hub loads on mount:
- `checkStatus()` → status badge
- `getLastSyncedAt()` → "Last synced X min ago"
- `getStepsInRange(today, today)` → today's step count subtitle
- `getSleepInRange(today, today)` → today's sleep subtitle

Sync Now calls `sync()` (awaited for UX, still safe — it's a user tap not app start).
Stubs for detail screens are inline components that will be extracted to their own
files in Phase 3b–3d.

### Create `app/screens/browse/StepsDetailScreen.tsx` `[x]`

Full-screen steps detail (pushed via navigation):
- `CircularProgress` ring (green when `todaySteps >= stepsGoal` AND colour toggle on)
- Editable goal field + goal colour toggle (persisted to `health_connect_meta`)
- Week/Month toggle (`TimeRangePicker` reused)
- `WeekBarGraph` — bars green for goal-met days when toggle on
- `MonthCalendarGraph` — cells green for goal-met days when toggle on
- Stats: week avg + month avg + `StreakCard` + personal best
- Mapping rows + `[+ Add Task Mapping]`

### Create `app/screens/browse/SleepDetailScreen.tsx` `[x]`

Full-screen sleep detail:
- `CompletionSummaryCard` ring (green when goal met + toggle on)
- Editable sleep goal (hours) + goal colour toggle
- Sleep stage mini-bar (hidden if no stage data)
- Week/Month toggle, `WeekBarGraph`, `MonthCalendarGraph` (green when goal met + toggle on)
- Stats: week avg + month avg + `StreakCard` + best night
- Mapping rows + `[+ Add Task Mapping]`

### Create `app/screens/browse/WorkoutsDetailScreen.tsx` `[x]`

Full-screen workouts detail:
- Today's sessions list (type label + duration), or "No workouts today"
- Mapping rows + `[+ Add Task Mapping]`
- No chart, no stats

### Create `app/screens/browse/HealthMappingEditor.tsx` `[x]`

Modal/sub-screen for add/edit:
- Task picker → `getAllPermanentTemplates()` (read-only)
- Threshold fields (step goal / sleep hours / exercise type + min duration)
- Auto-schedule toggle
- Save / Delete buttons

Exercise type picker: iterate `ExerciseType` constants at runtime to build label map. Store integer values, not key strings.

> **Goal vs mapping threshold:** The section goal in `health_connect_meta` (the value
> the user sets in the detail screen) is the global display goal. Individual mappings
> in `health_connect_mappings` can have their own threshold — this allows mapping
> "Daily Walk" to 8,000 steps while the display goal is 10,000. Keep them independent.

---

## Phase 4 — Sync Wiring `[x] COMPLETE`

Wire up sync in three places:

1. **App start** (`App.tsx` or `index.js`): call `healthConnectActions.sync()` as
   fire-and-forget after DB init. Do NOT await — must not block app render.
2. **AppState foreground** (`MainNavigator.tsx`): call `sync()` when `AppState`
   transitions to `'active'` (catch-up for edge cases).
3. **Background** (`react-native-background-fetch`): register task that calls `sync()`
   every 15 min (Android minimum interval).

---

## Phase 5 — Testing `[ ] NOT STARTED`

Manual device testing checklist (T1–T24) is in `NEXT_STEPS_2026-04-05.md`.

---

## Order of Work

```
Phase 1 (types + storage) [x]  →  Phase 2 (actions) [x]  →  Phase 3 (UI) [x]  →  Phase 4 (sync wiring) [x]  →  Phase 5 (testing) [ ]
```

---

## Key Reminders

- Exercise type values are **integers** (e.g. `STRENGTH_TRAINING = 70`, `RUNNING = 56`)
- Steps are stored as **short intervals** — always sum `count` across all records for the day
- Sleep sessions span midnight — use the 24h lookback + `endTime >= startOfToday` filter
- `android/` is gitignored — `app.json` is the durable config for `minSdkVersion: 26`
- Permanent task layer is **never modified** — HC calls into it as a consumer only
- All health UI must use `useTheme()` — no hardcoded hex colours. Test dark + light mode.
- Workout auto-complete only targets today's instances — `getPendingInstanceByTemplateId` always receives `todayDateString()`
- Goal colour toggle controls visuals only — task auto-complete always runs regardless of toggle state
- App-start sync is fire-and-forget — never block the UI render on its completion
