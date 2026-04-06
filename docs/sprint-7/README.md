# Sprint 7 — Health Connect Integration

**Status:** Implementation complete. Only manual device testing (T1–T24) remains.
**Platform:** Android only. Health Connect does not run in the emulator — use a physical device.

---

## Architecture Overview

```
Physical Device (Health Connect)
         │
         ▼
healthConnectActions.ts  ←── sync(), checkStatus(), requestPermissions(), getTodaySummary()
         │
    ┌────┴────┐
    ▼         ▼
healthConnectStorage.ts   healthConnectUtils.ts
(SQLite reads/writes)     (computeStepsStats, computeSleepStats)
         │
    ┌────┴────┐
    ▼         ▼
 UI Screens           Task Layer (read-only consumer)
(detail screens)      taskActions.ts / useTasks.ts
```

**Key principle:** Permanent tasks have zero knowledge of Health Connect.
The HC system calls into the existing task layer as a consumer — never the other way around.

---

## Frontend

### Screens (`app/screens/browse/`)

| File | Purpose |
|------|---------|
| `HealthManagementScreen.tsx` | Hub screen — shows status, permissions, and navigates to detail screens |
| `StepsDetailScreen.tsx` | Ring, charts (week/month), stats, streaks, task mappings for steps |
| `SleepDetailScreen.tsx` | Ring, charts, stats, streaks, task mappings for sleep |
| `WorkoutsDetailScreen.tsx` | Today's sessions list + task mappings for workouts |
| `HealthMappingEditor.tsx` | Create/edit a single threshold → task mapping |

### How to add a new section to a detail screen

1. Add state in the component body (before any early return — Rules of Hooks).
2. Load data inside `useEffect` on mount using storage functions from `healthConnectStorage.ts`.
3. Pass data through `computeStepsStats` / `computeSleepStats` (in `healthConnectUtils.ts`) for derived stats.
4. Render using existing shared components: `CircularProgress`, `WeekBarGraph`, `MonthCalendarGraph`, `StreakCard`, `DayOfWeekPatternCard`.

### How to add a new detail screen

1. Create `app/screens/browse/YourDetailScreen.tsx` with `{ onBack: () => void }` props.
2. Declare all hooks unconditionally at the top — no early returns before hook declarations.
3. Add a navigation case to `HealthManagementScreen.tsx` (it controls sub-screen routing via local state, not a navigator stack).
4. Import from `healthConnectStorage.ts` for data and `healthConnectActions.ts` for side effects.

### Styling rules

- Brand colour: `HC_COLOR = '#33ace5'` — used on all health screens.
- Always use `useTheme()` + `useMemo(() => makeStyles(theme), [theme])`. No hardcoded hex values for surfaces or text.
- Goal-met highlight colour: `'#34C759'` (green), only applied when `colorEnabled` toggle is on.

---

## Backend (Actions & Sync)

### Core file: `app/features/googleFit/utils/healthConnectActions.ts`

| Export | What it does |
|--------|-------------|
| `sync()` | Reads steps, sleep, workouts from Health Connect; upserts to SQLite; evaluates all enabled mappings; emits `healthConnectSyncComplete` event |
| `checkStatus()` | Returns current Health Connect availability + permission status |
| `requestPermissions()` | Prompts the user for READ_STEPS / READ_SLEEP / READ_EXERCISE |
| `getTodaySummary()` | Returns today's steps, last-night sleep, and today's workout sessions (no SQLite — reads directly from HC) |

### Stats helpers: `app/features/googleFit/utils/healthConnectUtils.ts`

| Export | Input | Output |
|--------|-------|--------|
| `computeStepsStats(rows, goal)` | `StepsDayRecord[]` + goal int | `StepsStats` (weekAvg, monthAvg, personalBest, currentStreak, bestStreak) |
| `computeSleepStats(rows, goalHours)` | `SleepDayRecord[]` + goal float | `SleepStats` (same shape) |

### Sync wiring (where sync is triggered)

| File | Trigger |
|------|---------|
| `App.tsx` | App start — fire-and-forget after `initializeAllSchemas()` |
| `app/navigation/MainNavigator.tsx` | `AppState` change to `'active'` (app comes to foreground) |
| `index.js` | `react-native-background-fetch` — every 15 min, including when app is terminated (headless task) |
| `app/core/hooks/useTasks.ts` | Listens for `healthConnectSyncComplete` via `DeviceEventEmitter` — triggers task list reload |

### How to add a new sync trigger

1. Import `sync` from `healthConnectActions.ts`.
2. Call `sync().catch(e => console.warn('[HC] ...', e))` — always fire-and-forget, never `await` on a critical path.
3. The `DeviceEventEmitter` event at the end of `sync()` will automatically refresh the task list.

### How to add a new data type (e.g. heart rate)

1. Add a new `DataType` union to `app/features/googleFit/types/healthConnect.ts`.
2. Add a new history table in `app/core/services/storage/schema/healthConnect.ts`.
3. Add upsert/query functions in `healthConnectStorage.ts`.
4. Add a compute stats helper in `healthConnectUtils.ts`.
5. Add the Health Connect read call inside `sync()` in `healthConnectActions.ts`.
6. Add a new detail screen and wire it into `HealthManagementScreen.tsx`.

---

## Storage

### Database tables (`app/core/services/storage/schema/healthConnect.ts`)

| Table | Primary Key | Purpose |
|-------|------------|---------|
| `health_connect_mappings` | `id TEXT` | One row per threshold → template mapping |
| `health_connect_meta` | `key TEXT` | Key-value store: goals, colour toggles, `last_synced_at` |
| `health_steps_log` | `date TEXT` (`'YYYY-MM-DD'`) | One row per calendar day — total step count |
| `health_sleep_log` | `date TEXT` (`'YYYY-MM-DD'`) | One row per morning — total sleep hours for that night |

All four tables are initialised via `initializeHealthConnectSchema()` which is called from `app/core/services/storage/schema/index.ts` → `initializeAllSchemas()` at app start.

### Storage API (`app/core/services/storage/healthConnectStorage.ts`)

**Mappings**
```ts
saveMapping(mapping)           // INSERT OR REPLACE
deleteMapping(id)              // DELETE by id
getAllMappings()                // all rows (UI display) — orphans excluded via INNER JOIN
getAllEnabledMappings()         // enabled rows only — used by sync
pruneOrphanedMappings()        // removes mappings whose template was deleted
```

**Meta (goals & settings)**
```ts
getStepsGoal() / setStepsGoal(n)
getSleepGoal() / setSleepGoal(h)
getStepsColorEnabled() / setStepsColorEnabled(b)
getSleepColorEnabled() / setSleepColorEnabled(b)
getLastSyncedAt() / setLastSyncedAt(iso)
```

**Steps history**
```ts
upsertStepsForDate(date, steps)          // called by sync
getStepsInRange(from, to)                // returns StepsDayRecord[]
getStepsPersonalBest()                   // returns highest single-day record
```

**Sleep history**
```ts
upsertSleepForDate(date, sleepHours)     // called by sync
getSleepInRange(from, to)                // returns SleepDayRecord[]
getSleepPersonalBest()                   // returns highest single-night record
```

### Row shapes

```ts
// Steps
interface StepsDayRecord { date: string; steps: number; syncedAt: number; }

// Sleep
interface SleepDayRecord { date: string; sleepHours: number; syncedAt: number; }

// Mapping
interface HealthConnectMapping {
  id: string;
  permanentId: string;
  dataType: 'steps' | 'sleep' | 'workout';
  stepsGoal?: number;
  sleepHours?: number;
  exerciseType?: number;        // integer constant; see ExerciseTypeMap
  minDurationMinutes?: number;
  autoSchedule: boolean;
  enabled: boolean;
}
```

### How to add a new column to an existing table

Because the schema uses `CREATE TABLE IF NOT EXISTS`, changing the `CREATE` statement
alone will not alter an existing database. You must also add a migration:

1. Increment the schema version in `app/core/services/storage/database.ts`.
2. Add an `ALTER TABLE ... ADD COLUMN ...` statement to the migration block for that version.
3. Update the `CREATE TABLE IF NOT EXISTS` statement for fresh installs.

### Sleep date convention

Sleep sessions that span midnight are stored under the **morning date** (the date the session ended). A session from 23:00 on the 5th to 07:00 on the 6th is stored as `date = '2026-04-06'`. This matches the user's mental model of "last night's sleep."

---

## Testing

24 manual device tests are tracked in `NEXT_STEPS_2026-04-05.md` (T1–T24).
Run on a physical Android device. Steps and sleep require actual Health Connect data — use the Health Connect app to add sample data if needed.
