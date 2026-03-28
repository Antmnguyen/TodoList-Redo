# Sprint 7 — Health Connect Auto-Complete

**Goal:** Read sleep, steps, and workout data from Health Connect (Android) on app
open and in the background. Let users assign health thresholds to permanent task
templates — entirely from within the Health Connect screen. When a threshold is met,
auto-complete the mapped permanent task instance for that day. If no instance is
scheduled, auto-schedule a default one.

**Platform:** Android only (Health Connect is Google/Android).

**Architecture principle:** Permanent tasks have zero knowledge of Health Connect.
No changes to `PermanentTask` types, permanent task storage, permanent task actions,
or any permanent task UI. The Health Connect system holds all mappings and calls
into the existing task action layer as a consumer.

**Status key:**
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

## Setup — Do This Before Writing Any Code

Everything below must be done once before implementation begins. The project
already has an `android/` directory (bare workflow) so no ejection is needed.

### Step 1 — Install npm packages

```bash
npm install react-native-health-connect
npm install react-native-background-fetch
```

### Step 2 — Rebuild the native Android app

Installing native modules changes the native layer. A JS-only reload is not
enough — you must do a full native rebuild:

```bash
expo run:android
```

> If the build fails after installing `react-native-health-connect`, check the
> library's README for any `build.gradle` or `settings.gradle` changes required
> for the installed version.

### Step 3 — Add permissions to `android/app/src/main/AndroidManifest.xml`

Inside `<manifest>`, add the Health Connect read permissions:

```xml
<uses-permission android:name="android.permission.health.READ_STEPS"/>
<uses-permission android:name="android.permission.health.READ_SLEEP"/>
<uses-permission android:name="android.permission.health.READ_EXERCISE"/>
```

Inside `<queries>`, add the Health Connect intent so Android lets the app
communicate with the Health Connect provider:

```xml
<package android:name="com.google.android.apps.healthdata"/>
<intent>
  <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"/>
</intent>
```

Inside `<application>`, add the activity that handles the Health Connect
permissions rationale screen (required by the library):

```xml
<activity
  android:name="androidx.health.connect.client.PermissionController$HealthDataRequestPermissionsActivity"
  android:exported="true"/>
```

Also add the WorkManager service declaration for Android 14+ battery exemption
(see §12 for the full block).

### Step 4 — Verify Health Connect is available on your test device

| Android version | What to do |
|----------------|------------|
| Android 14+ | Health Connect is built in — nothing to install |
| Android 9–13 | Install **Health Connect** from the Google Play Store |
| Android < 9 | Not supported — feature will be hidden automatically |

Health Connect does **not** work in the Android emulator. You need a physical
Android device for all testing.

### Step 5 — Install a fitness app and grant permissions

Health Connect is only useful if another app is writing data to it.

1. Install **Samsung Health**, **Google Fit**, or any Health Connect-compatible
   app on your device.
2. Open that app at least once and connect it to Health Connect when prompted.
3. After building and running this app, open **Browse → Health Connect** and tap
   **"Grant"** to approve the read permissions for Steps, Sleep, and Exercise.
4. You can also verify permissions inside the Health Connect app itself
   (Settings → Apps → Health Connect → App permissions).

### Step 6 — Verify the SDK exercise type values

`react-native-health-connect` exports exercise type constants but the exact form
(integer vs lowercase string) may vary by version. Before building the exercise
type picker, check what the installed version actually provides:

```ts
import { ExerciseSessionRecord } from 'react-native-health-connect';
console.log(ExerciseSessionRecord.EXERCISE_TYPES);
// Inspect the output — are the values integers or strings?
```

Log this once on a physical device and record the result. The picker and
`evaluateThreshold()` must use these values, not the key strings.

---

## Table of Contents

1. [User-Facing Flow](#1-user-facing-flow)
2. [Health Connect Screen UI](#2-health-connect-screen-ui)
3. [Mapping Configuration UI](#3-mapping-configuration-ui)
4. [Data Model — Health Connect Only](#4-data-model--health-connect-only)
5. [Health Connect Actions](#5-health-connect-actions)
6. [Auto-Complete Logic Detail](#6-auto-complete-logic-detail)
7. [Default Task Fallback](#7-default-task-fallback)
8. [Sync Correctness — No Double-Completion](#8-sync-correctness--no-double-completion)
9. [Background Sync](#9-background-sync)
10. [Integration Points with Existing Code](#10-integration-points-with-existing-code)
11. [Directory Structure & New Files](#11-directory-structure--new-files)
12. [Permissions & Library Setup](#12-permissions--library-setup)
13. [Task List](#13-task-list)
14. [Known Risks & Mitigations](#14-known-risks--mitigations)

---

## 1. User-Facing Flow

### Setup (done entirely from the Health Connect screen)

1. User opens **Browse → Health Connect**.
2. They see three sections: **Steps**, **Sleep**, **Workouts**.
3. Inside a section, user taps **"+ Add Task Mapping"**.
4. A picker shows all existing permanent task templates (read-only list — no
   template is modified).
5. User picks a template (e.g. "Push Day") and sets the threshold for that section:
   - **Steps** → step count goal (e.g. 8000)
   - **Sleep** → minimum hours (e.g. 7.0)
   - **Workout** → exercise type filter (any / specific) + optional min duration
6. User saves. The mapping is stored in the Health Connect mappings table only.
   The permanent task template is not touched in any way.
7. Multiple templates can be mapped to the same data type
   (e.g. "Push Day", "Pull Day", "Leg Day" all under Workouts).
8. Each mapping has an **auto-schedule** toggle: if on and no instance exists for
   today when the threshold is met, one will be auto-created.

### Daily auto-complete

Sync runs in two modes:

- **Background (primary):** A Headless JS / WorkManager job fires periodically
  while the app is closed or backgrounded — typically every 15–30 minutes. This
  ensures tasks are completed throughout the day without the user having to open
  the app.
- **Foreground (supplementary):** `sync()` also runs on app foreground via an
  `AppState` listener as a catch-up for any mappings the background job may have
  missed (e.g. after first install before background job is registered).

Both paths call the same `sync()` function.

In both cases:
1. Service reads today's data from Health Connect.
2. For each mapping: evaluate threshold → find today's pending or manually-uncompleted instance.
3. If threshold met and a pending instance exists: `taskActions.completeTask()`.
4. If threshold met and no instance but auto-schedule on: create then complete.
5. If the task was already manually completed by the user: `findTodaysPendingInstance()`
   returns `null` (it filters `completed = 0`) — sync does nothing. No double-completion.

---

## 2. Health Connect Screen UI

**File:** `app/screens/browse/HealthManagementScreen.tsx` (replace the placeholder)

```
┌─────────────────────────────────────┐
│  ← Back          Health Connect     │   (purple header)
├─────────────────────────────────────┤
│  ● Connected   [Sync Now]           │
│  Last synced: 2 min ago             │
├─────────────────────────────────────┤
│  ▼  Steps                           │
│     Today: 6,432 steps              │
│     ─────────────────────────────── │
│     Daily Walk       8,000 steps    │
│     Progress: ████████░░ 80%   –    │
│                                     │
│     [+ Add Task Mapping]            │
├─────────────────────────────────────┤
│  ▼  Sleep                           │
│     Last night: 7h 12m              │
│     ─────────────────────────────── │
│     Sleep Goal       7h 00m min     │
│     Status: ✓ Met                   │
│                                     │
│     [+ Add Task Mapping]            │
├─────────────────────────────────────┤
│  ▼  Workouts                        │
│     Today: 1 session (45 min)       │
│     Strength Training               │
│     ─────────────────────────────── │
│     Push Day   Strength  30m min ✓  │
│     Pull Day   Strength  30m min –  │
│     Leg Day    Any       0m min  –  │
│                                     │
│     [+ Add Task Mapping]            │
└─────────────────────────────────────┘
```

### Section content

Each section shows:
- **Today's summary** from `healthConnectActions.getTodaySummary()`
- **Mapping rows** — template name + threshold summary + met/not-met badge
- **"+ Add Task Mapping"** button — opens the mapping editor (§3)
- Tapping an existing mapping row opens the editor to edit or delete it

### Connection status

- `healthy` → green dot "Connected"
- `permission_missing` → amber "Permissions needed" + "Grant" button
- `not_installed` → red "Health Connect not installed" + "Install" button
- `not_supported` → grey "Not supported on this device" — sections hidden

---

## 3. Mapping Configuration UI

**Where:** Modal or sub-screen opened from within the Health Connect screen only.
No part of this UI lives in or near permanent task screens.

**Component:** `HealthMappingEditor`
**File:** `app/screens/browse/HealthMappingEditor.tsx`

```
┌──────────────────────────────────────┐
│  Add / Edit Mapping                  │
│                                      │
│  Task                                │
│  [Pick a permanent task ▾]           │
│  (shows all templates from           │
│   getAllPermanentTemplates())         │
│                                      │
│  --- threshold fields per section -- │
│  [Steps section]                     │
│  Step goal:  [  8000  ]              │
│                                      │
│  [Sleep section]                     │
│  Minimum sleep:  [  7.0  ] hours     │
│                                      │
│  [Workouts section]                  │
│  Exercise type:  [Any ▾]             │
│    options: Any, Running, Cycling,   │
│    Strength Training, Swimming, …    │
│  Min duration:   [  30  ] minutes    │
│                                      │
│  Auto-schedule if no task today  [✓] │
│                                      │
│  [Save]          [Delete mapping]    │
└──────────────────────────────────────┘
```

The exercise type picker displays human-readable labels but stores the exact
`react-native-health-connect` enum constant (see §4c). The editor calls
`healthConnectStorage.saveMapping()` on save. It does not call any permanent task
function except `getAllPermanentTemplates()` to populate the picker (read-only).

---

## 4. Data Model — Health Connect Only

All new tables and types live entirely within the Health Connect feature.
Zero changes to any existing table or type.

### 4a. `health_connect_mappings` table

Stores each threshold → template assignment.

```sql
CREATE TABLE IF NOT EXISTS health_connect_mappings (
  id                TEXT PRIMARY KEY,
  data_type         TEXT NOT NULL,     -- 'steps' | 'sleep' | 'workout'
  permanent_id      TEXT NOT NULL,     -- permanentId of the target template (no FK — perm tasks unaware)
  enabled           INTEGER NOT NULL DEFAULT 1,
  step_goal         INTEGER,           -- for 'steps'
  sleep_hours       REAL,              -- for 'sleep'
  exercise_type     TEXT,              -- for 'workout', NULL = any; stores HC SDK enum constant
  min_duration_mins INTEGER DEFAULT 0, -- for 'workout'
  auto_schedule     INTEGER NOT NULL DEFAULT 1  -- 1 = create default instance if none today
);
```

No foreign key to `templates` — permanent task layer stays unaware of this table.

**Orphan handling:** `getAllEnabledMappings()` cross-joins against the `templates`
table to silently filter out any mapping whose `permanent_id` no longer exists:

```sql
SELECT hcm.*
FROM health_connect_mappings hcm
INNER JOIN templates t ON hcm.permanent_id = t.permanentId
WHERE hcm.enabled = 1
```

This means orphaned rows are invisible to sync but remain in the table. A separate
`pruneOrphanedMappings()` function deletes them — but it is only called when the
user opens the **Health Connect screen**, not on every app open. Running a delete
sweep on every `AppState` change is unnecessary overhead; the INNER JOIN already
neutralises orphans at sync time, so the prune is cosmetic cleanup only.

### 4b. `health_connect_meta` table

Stores display metadata only — not used as a sync guard.

```sql
CREATE TABLE IF NOT EXISTS health_connect_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Used to store: last_synced_at (display timestamp for "Last synced: X min ago")
```

> **Why no `last_read_date` sync guard?** The previous design blocked re-reads if
> `last_read_date === today`. This caused a correctness bug: a user with 2,000 steps
> at 9 AM opens the app (guard set), reaches 10,000 steps at 2 PM, opens the app
> again — sync is skipped and the task is never completed.
>
> The guard is removed entirely. Sync always reads HC and always evaluates thresholds.
> Double-completion is prevented by `findTodaysPendingInstance()` filtering
> `completed = 0` — not by date-blocking. See §8.

### 4c. TypeScript types (Health Connect feature only)

**File:** `app/features/healthConnect/types/healthConnect.ts` (new)

```ts
export type HealthDataType = 'steps' | 'sleep' | 'workout';

/**
 * Exercise type picker entries.
 *
 * react-native-health-connect exports ExerciseSessionRecord.EXERCISE_TYPES as an
 * object whose VALUES are what the SDK actually stores in records (integers or
 * lowercase strings depending on the library version — verify at install time).
 * The picker must be built by iterating ExerciseSessionRecord.EXERCISE_TYPES
 * directly so that stored values always match what the SDK returns at read time.
 *
 * Example (verify against installed library version):
 *   import { ExerciseSessionRecord } from 'react-native-health-connect';
 *   // ExerciseSessionRecord.EXERCISE_TYPES.RUNNING  → actual stored value
 *
 * NEVER hardcode the string keys ('EXERCISE_TYPE_RUNNING') as the stored value.
 * The keys are for human reference only; the VALUES are what the SDK compares.
 *
 * EXERCISE_TYPE_DISPLAY_NAMES maps the SDK value → human label for the UI.
 * Build this map at runtime from ExerciseSessionRecord.EXERCISE_TYPES.
 */
export type ExerciseTypeValue = string | number;  // depends on library version

/** Built at runtime: SDK value → display label */
export type ExerciseTypeMap = Map<ExerciseTypeValue, string>;

export interface HealthConnectMapping {
  id: string;
  dataType: HealthDataType;
  permanentId: string;
  enabled: boolean;
  stepGoal?: number;
  sleepHours?: number;
  /**
   * Stored as the actual SDK value from ExerciseSessionRecord.EXERCISE_TYPES
   * (not the key string). undefined = match any exercise type.
   */
  exerciseType?: ExerciseTypeValue;
  minDurationMins?: number;
  autoSchedule: boolean;
}

export interface WorkoutSession {
  /** Actual SDK value from ExerciseSessionRecord.EXERCISE_TYPES */
  type: ExerciseTypeValue;
  durationMins: number;
  startTime: number;  // UTC ms
  endTime: number;    // UTC ms
}

export interface TodaySummary {
  steps: number | null;
  /** Total sleep hours from sessions that ENDED today (handles overnight sessions) */
  sleepHours: number | null;
  workouts: WorkoutSession[] | null;
}

export type HealthConnectStatus =
  | 'healthy'
  | 'permission_missing'
  | 'not_installed'
  | 'not_supported';
```

---

## 5. Health Connect Actions

**File:** `app/features/healthConnect/utils/healthConnectActions.ts` (new)

Main entry point for the feature. All Health Connect library calls go through
here. No screen or component touches the HC library directly.

### Public API

```ts
checkStatus(): Promise<HealthConnectStatus>

requestPermissions(dataTypes: HealthDataType[]): Promise<boolean>

getTodaySummary(): Promise<TodaySummary>

sync(): Promise<void>
```

### Sleep query window

Sleep sessions span midnight — a session starting Tuesday night ends Wednesday
morning. Querying `startTime >= startOfToday()` will miss all overnight sleep.

**Fix:** For sleep, query sessions where `endTime` falls within today, using a
**24-hour lookback** for the `startTime` filter to catch any session — including
extreme cases like a 14-hour illness/depression sleep that started yesterday
afternoon and ended today:

```ts
// Inside getTodaySummary() — sleep query
const startOfToday    = new Date(); startOfToday.setHours(0, 0, 0, 0);
const startOfTomorrow = new Date(startOfToday.getTime() + 86_400_000);

const sleepRecords = await readRecords('SleepSessionRecord', {
  timeRangeFilter: {
    operator:  'between',
    startTime: new Date(startOfToday.getTime() - 24 * 3_600_000).toISOString(), // 24h lookback
    endTime:   startOfTomorrow.toISOString(),
  },
});

// Sum only sessions whose endTime falls today
// (filters out yesterday's nap that also ended yesterday, captured by the 24h window)
const todaySleepMs = sleepRecords
  .filter(r => new Date(r.endTime) >= startOfToday)
  .reduce((acc, r) =>
    acc + (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()), 0);

const sleepHours = todaySleepMs / 3_600_000;
```

The 24-hour `startTime` window ensures the SDK returns any session that *could*
have ended today. The `endTime >= startOfToday` filter on the result then keeps
only the sessions that actually ended today, preventing yesterday's sleep from
being double-counted.

Steps and workouts use `startTime >= startOfToday()` as before.

### sync() logic (pseudocode)

```
sync():
  status = checkStatus()
  if status !== 'healthy' → return  // silent, no crash, no error shown

  today = todayDateString()   // 'YYYY-MM-DD'

  mappings = healthConnectStorage.getAllEnabledMappings()
  // cross-joins with templates — orphaned mappings are filtered out automatically
  if mappings.length === 0 → return

  summary = getTodaySummary()  // single HC read covers all data types

  for each mapping of mappings:
    met = evaluateThreshold(mapping, summary)
    if not met → continue

    instance = taskStorage.getPendingInstanceByTemplateId(mapping.permanentId, today)
    // query lives in taskStorage — HC feature does not own this SQL
    // returns null if no instance OR if instance is already completed (by user or prior sync)

    if instance is null:
      if mapping.autoSchedule:
        instance = createDefaultInstance(mapping.permanentId, today)
      else:
        continue

    taskActions.completeTask(instance)

  healthConnectStorage.setLastSyncedAt(Date.now())  // for "Last synced: X min ago" display only
```

### evaluateThreshold()

```ts
function evaluateThreshold(m: HealthConnectMapping, s: TodaySummary): boolean {
  if (!m.enabled) return false;
  switch (m.dataType) {
    case 'steps':
      return s.steps !== null && s.steps >= (m.stepGoal ?? 0);
    case 'sleep':
      return s.sleepHours !== null && s.sleepHours >= (m.sleepHours ?? 0);
    case 'workout':
      if (!s.workouts || s.workouts.length === 0) return false;
      return s.workouts.some(w =>
        (m.exerciseType == null || w.type === m.exerciseType) &&  // exact SDK constant comparison
        w.durationMins >= (m.minDurationMins ?? 0)
      );
  }
}
```

---

## 6. Auto-Complete Logic Detail

### Finding today's pending instance — via taskStorage

The HC feature does **not** own the SQL for querying tasks. Instead, a new helper
is added to `taskStorage.ts`:

```ts
// app/core/services/storage/taskStorage.ts — new export
export function getPendingInstanceByTemplateId(
  templateId: string,
  date: string,        // 'YYYY-MM-DD'
): Task | null
```

Internal query (stays inside `taskStorage.ts`):

```sql
SELECT t.*
FROM tasks t
JOIN template_instances ti ON t.id = ti.instanceId
WHERE ti.templateId = ?
  AND date(t.due_date / 1000, 'unixepoch') = ?
  AND t.completed = 0
LIMIT 1
```

Returning `null` covers two cases:
- No instance scheduled for today at all
- An instance exists but the user already completed it manually

Health Connect checks for `null` and stops — it never double-completes a task the
user has already ticked off.

### Completing via taskActions

```ts
await taskActions.completeTask(instance);
```

Same code path as a user manually tapping the checkbox. Handles:
- `updateTemplateStats()` — streaks, completion rate
- `saveTask()` with `completedAt`
- `createNextRecurringInstance()` if `autoRepeat` is set on the template

### No interference with repeatability

`createNextRecurringInstance()` fires inside `handlePermanentCompletion()` on every
completion regardless of source. Health Connect auto-complete triggers it identically
to a manual tap. The template's `autoRepeat` config is read by the existing
completion path — Health Connect never reads or writes it.

---

## 7. Default Task Fallback

When `autoSchedule = true` and `getPendingInstanceByTemplateId()` returns `null`
(no instance scheduled today, and no manually-completed instance):

```ts
// healthConnectUtils.ts
async function createDefaultInstance(permanentId: string, today: string): Promise<Task> {
  const template = await getTemplateById(permanentId);  // read-only, permanentTaskStorage
  return await taskActions.createTask({
    title: template.templateTitle,
    kind: 'permanent',
    templateId: permanentId,
    dueDate: startOfDay(today),
  });
}
```

This is the normal instance-creation path (`createPermanentTask` with `templateId`):
- Writes a row to `tasks`
- Writes a row to `template_instances`
- Increments `instanceCount` on the template

`sync()` then immediately calls `taskActions.completeTask(instance)`.

Default instances appear once for today. If the template has `autoRepeat`, the
existing completion handler schedules the next occurrence normally.

---

## 8. Sync Correctness — No Double-Completion

### Why there is no date-based sync guard

An earlier design stored a `last_read_date` per data type and skipped HC reads if
that date matched today. This caused a correctness failure:

1. User opens app at 9 AM (2,000 steps). `last_read_date` = today. Guard engages.
2. User walks to 10,000 steps by 2 PM.
3. User opens app at 3 PM. Sync is blocked by guard. Task never completes.

**The `last_read_date` guard is removed.** Every sync call reads HC fresh.

### How double-completion is prevented instead

`getPendingInstanceByTemplateId()` filters `completed = 0`. Once a task is
completed — whether by a prior sync run or by the user manually — the query
returns `null` and the sync loop skips it. No second completion is possible.

### Manual completion is handled automatically

If the user manually ticks off a task before the background sync fires:
- `completed = 1` in the `tasks` table
- `getPendingInstanceByTemplateId()` returns `null`
- Sync sees no pending instance, does nothing

No special-casing needed. The filter handles it.

### The `health_connect_meta` table is display-only

`setLastSyncedAt(timestamp)` is called at the end of each successful sync. This
value is read by the Health Connect screen to show "Last synced: X min ago". It
has no effect on sync behaviour.

---

## 9. Background Sync

Foreground-only sync means a task stays "Pending" all day until the user opens
the app. Background sync fixes this.

### Implementation

Use **Headless JS** (React Native's background task mechanism) combined with
**Android WorkManager** to schedule a periodic background task:

```ts
// Register in index.js (app entry point)
AppRegistry.registerHeadlessTask('HealthConnectSync', () => async () => {
  await healthConnectActions.sync();
});
```

Schedule the WorkManager job via a small native module or
`react-native-background-fetch` (community library). Target interval: every
15–30 minutes (Android enforces a minimum of ~15 minutes for battery reasons).

### Constraints

- Background task runs only if Health Connect is available and permissions are granted
- `sync()` is already safe to call concurrently — `getPendingInstanceByTemplateId()`
  is the natural idempotency guard, so simultaneous foreground + background runs
  are harmless

### UI refresh after sync

Background tasks write to SQLite but cannot update React state directly. The
`useTasks` hook must be told to re-fetch after any sync completes — foreground
or background.

**Implementation:** emit a `DeviceEventEmitter` event from `sync()` after it
finishes, and subscribe to it inside `useTasks`:

```ts
// At the end of sync() in healthConnectActions.ts
DeviceEventEmitter.emit('healthConnectSyncComplete');

// Inside useTasks.ts
useEffect(() => {
  const sub = DeviceEventEmitter.addListener('healthConnectSyncComplete', loadTasks);
  return () => sub.remove();
}, []);
```

This means:
- If the user has the task list open when a background sync completes, the list
  refreshes automatically without any user action
- The same event fires after foreground sync, so a single subscriber handles both

### Fallback

If background sync proves difficult to configure (native module complexity), the
foreground `AppState` listener is still present as a guaranteed catch-up. In this
case the task list should show a subtle "Syncing health data…" indicator on app
open so users understand the data may be a few seconds stale.

---

## 10. Integration Points with Existing Code

| Touch point | Change | Notes |
|-------------|--------|-------|
| `permanentTask.ts` types | **None** | Untouched |
| `permanentTask.ts` schema | **None** | Untouched |
| `permanentTaskStorage.ts` | **None** | Untouched |
| `permanentTaskActions.ts` | **None** | Untouched |
| `taskActions.ts` | **None** | Called as a consumer, not modified |
| `taskStorage.ts` | Add `getPendingInstanceByTemplateId(templateId, date)` | Single new export — Task feature owns its own SQL |
| `CreatePermanentTaskScreen.tsx` | **None** | Untouched |
| `database.ts` (schema init) | Add `createHealthConnectSchema()` call | New schema only |
| `useTasks.ts` | Subscribe to `DeviceEventEmitter('healthConnectSyncComplete')` → call `loadTasks()` | ~5 lines |
| `MainNavigator.tsx` | Add `AppState` listener → `healthConnectActions.sync()` on foreground | ~5 lines |
| `index.js` | Register Headless JS task for background sync | ~4 lines |
| `AndroidManifest.xml` | Add HC service declaration for Android 14+ battery exemption | ~8 lines |
| `HealthManagementScreen.tsx` | Replace placeholder with real screen | New implementation |

---

## 11. Directory Structure & New Files

The Health Connect feature follows the same pattern as `app/features/permanentTask/`.
All backend lives under `app/features/healthConnect/`. UI screens live in
`app/screens/browse/`. Shared display components live in `app/components/healthConnect/`.

```
app/
├── features/
│   └── healthConnect/
│       ├── types/
│       │   └── healthConnect.ts          # All HC-specific TS types + EXERCISE_TYPE_LABELS map
│       ├── utils/
│       │   ├── healthConnectActions.ts   # checkStatus, requestPermissions, getTodaySummary, sync
│       │   └── healthConnectUtils.ts     # evaluateThreshold, createDefaultInstance, pruneOrphanedMappings
│       └── storage/
│           ├── schema/
│           │   └── healthConnect.ts      # DDL: health_connect_mappings + health_connect_meta
│           └── healthConnectStorage.ts   # saveMapping, getAllEnabledMappings, deleteMapping,
│                                         # getMappingById, setLastSyncedAt, getLastSyncedAt,
│                                         # pruneOrphanedMappings
│
├── components/
│   └── healthConnect/
│       ├── HealthConnectStatusBadge.tsx  # Connection status badge
│       └── HealthSectionCard.tsx         # Per-data-type section card (summary + mapping rows)
│
└── screens/
    └── browse/
        ├── HealthManagementScreen.tsx    # Rewritten in place (was placeholder)
        └── HealthMappingEditor.tsx       # Add/edit/delete a single mapping
```

### File responsibilities

| File | Purpose |
|------|---------|
| `features/healthConnect/types/healthConnect.ts` | `HealthConnectMapping`, `TodaySummary`, `WorkoutSession`, `HealthConnectStatus`, `HealthDataType`, `EXERCISE_TYPE_LABELS` |
| `features/healthConnect/utils/healthConnectActions.ts` | `checkStatus()`, `requestPermissions()`, `getTodaySummary()` (with correct sleep window), `sync()` |
| `features/healthConnect/utils/healthConnectUtils.ts` | `evaluateThreshold()`, `createDefaultInstance()`, `pruneOrphanedMappings()` (called from Health screen on open, not on app start) |
| `features/healthConnect/storage/schema/healthConnect.ts` | `createHealthConnectSchema()` — DDL for both tables |
| `features/healthConnect/storage/healthConnectStorage.ts` | `saveMapping()`, `getAllEnabledMappings()` (orphan-filtered), `getMappingById()`, `deleteMapping()`, `setLastSyncedAt()`, `getLastSyncedAt()` |
| `components/healthConnect/HealthConnectStatusBadge.tsx` | Reusable status badge |
| `components/healthConnect/HealthSectionCard.tsx` | Per-data-type card — today's summary + mapping rows + "Add" button |
| `screens/browse/HealthManagementScreen.tsx` | Full Health screen — three section cards + status badge + Sync Now |
| `screens/browse/HealthMappingEditor.tsx` | Template picker + threshold fields + exercise type picker (labels → SDK constants) + auto-schedule toggle |

### Schema init

`features/healthConnect/storage/schema/healthConnect.ts` exports
`createHealthConnectSchema()`. Called from `app/core/services/storage/database.ts`
alongside all other `create*Schema()` calls.

---

## 12. Permissions & Library Setup

### Libraries

```
npm install react-native-health-connect
npm install react-native-background-fetch   # or alternative for WorkManager scheduling
```

Requires Expo bare workflow or custom dev client. Managed workflow does NOT support
native modules. **Evaluate / migrate before starting implementation — biggest risk.**

### AndroidManifest.xml additions

```xml
<!-- Health Connect read permissions -->
<uses-permission android:name="android.permission.health.READ_STEPS"/>
<uses-permission android:name="android.permission.health.READ_SLEEP"/>
<uses-permission android:name="android.permission.health.READ_EXERCISE"/>

<!-- Required for WorkManager background job to survive Android 14+ battery
     optimisation. Without this the OS may kill the background process.
     Declare the background service with the health data category so Android
     treats it as an exempt health-data sync rather than an arbitrary wake-lock. -->
<service
  android:name=".HealthConnectSyncService"
  android:permission="android.permission.BIND_JOB_SERVICE"
  android:exported="false">
  <intent-filter>
    <action android:name="androidx.work.impl.background.systemjob.SystemJobService"/>
  </intent-filter>
</service>
```

> **Android 14+ note:** Android 14 introduced stricter "User-Initiated Data
> Transfer" rules. Tagging the WorkManager job with the health category signals
> to the OS that this is a legitimate health-data sync, reducing the likelihood
> of the background job being deferred or killed. Always keep the foreground
> `AppState` catch-up sync in `MainNavigator.tsx` as the guaranteed fallback.

### Runtime permission request

`healthConnectActions.requestPermissions(dataTypes)` derives the required data
types from the enabled mappings and requests only those. Do not request all
permissions upfront.

---

## 13. Task List

### Phase 1 — Setup & Library

| # | Task | Status |
|---|------|--------|
| P1 | Verify Expo managed vs bare workflow compatibility. If bare needed, plan migration | `[ ]` |
| P2 | Install `react-native-health-connect`, test basic HC read on physical Android device | `[ ]` |
| P3 | Create `features/healthConnect/storage/schema/healthConnect.ts` — DDL for `health_connect_mappings` + `health_connect_meta` | `[ ]` |
| P4 | Wire `createHealthConnectSchema()` into `database.ts` init chain | `[ ]` |

### Phase 2 — Storage Layer

| # | Task | Status |
|---|------|--------|
| D1 | Build `features/healthConnect/storage/healthConnectStorage.ts` — `saveMapping`, `getAllEnabledMappings` (orphan-filtered via INNER JOIN), `getMappingById`, `deleteMapping`, `setLastSyncedAt`, `getLastSyncedAt` | `[ ]` |
| D2 | Add `getPendingInstanceByTemplateId(templateId, date)` to `core/services/storage/taskStorage.ts` | `[ ]` |

### Phase 3 — Business Logic Layer

| # | Task | Status |
|---|------|--------|
| S1 | Build `features/healthConnect/types/healthConnect.ts` — all types + `EXERCISE_TYPE_LABELS` map | `[ ]` |
| S2 | Build `healthConnectActions.checkStatus()` | `[ ]` |
| S3 | Build `healthConnectActions.requestPermissions()` | `[ ]` |
| S4 | Build `healthConnectActions.getTodaySummary()` — steps (`startTime >= today`), sleep (24h lookback, `endTime >= startOfToday` filter), workouts (`startTime >= today`) | `[ ]` |
| S5 | Build `healthConnectUtils.evaluateThreshold()` — compares `exerciseType` using actual SDK values from `ExerciseSessionRecord.EXERCISE_TYPES`, not string keys | `[ ]` |
| S6 | Build `healthConnectUtils.createDefaultInstance()` — calls `taskActions.createTask()` | `[ ]` |
| S7 | Build `healthConnectUtils.pruneOrphanedMappings()` — called from `HealthManagementScreen` on open, not on every app start | `[ ]` |
| S8 | Build `healthConnectActions.sync()` — no date guard; emits `DeviceEventEmitter('healthConnectSyncComplete')` on finish | `[ ]` |
| S9 | Subscribe to `healthConnectSyncComplete` in `useTasks.ts` to trigger `loadTasks()` | `[ ]` |
| S10 | Wire `sync()` into `AppState` foreground listener in `MainNavigator.tsx` | `[ ]` |
| S11 | Register Headless JS background task in `index.js`; schedule with WorkManager / `react-native-background-fetch`; add service declaration to `AndroidManifest.xml` | `[ ]` |

### Phase 4 — UI

| # | Task | Status |
|---|------|--------|
| U1 | Build `HealthConnectStatusBadge` component | `[ ]` |
| U2 | Build `HealthSectionCard` component — today's summary + mapping rows + "Add" button | `[ ]` |
| U3 | Build `HealthMappingEditor` — template picker, threshold fields, exercise type picker (human labels → SDK constants), auto-schedule toggle | `[ ]` |
| U4 | Rewrite `HealthManagementScreen` — status badge + three section cards + Sync Now button + "Last synced: X" | `[ ]` |

### Phase 5 — Testing

| # | Task | Status |
|---|------|--------|
| T1 | Steps: add mapping → reach step goal during the day → verify background sync auto-completes | `[ ]` |
| T2 | Sleep: log overnight sleep in Samsung Health → open app next morning → verify auto-complete | `[ ]` |
| T3 | Sleep edge case: session starts 11 PM, ends 7 AM → verify counted for "today" (endTime filter) | `[ ]` |
| T3b | Sleep extreme case: session starts 2 AM, ends 4 PM (14h) → verify 24h lookback catches it | `[ ]` |
| T4 | Workout: log session → correct template completed; exercise type SDK value matches (verify integer vs string against installed library version) | `[ ]` |
| T5 | Multiple templates same data type (Push / Pull / Leg day all → Workout) | `[ ]` |
| T6 | `autoSchedule = true` with no instance scheduled → default created + completed | `[ ]` |
| T7 | User manually completes task → background sync fires → task NOT double-completed | `[ ]` |
| T8 | Open app twice same day after threshold met → task NOT double-completed | `[ ]` |
| T9 | Permission denial → no crash, graceful no-op, Health screen shows "Grant" | `[ ]` |
| T10 | Repeatable template → next occurrence scheduled correctly after HC auto-complete | `[ ]` |
| T11 | Delete a template that has a mapping → orphan pruned on next sync → no errors | `[ ]` |
| T12 | Permanent task UI (CreatePermanentTaskScreen etc.) unaffected — no HC fields visible | `[ ]` |

---

## 14. Known Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Expo managed workflow may not support native modules | Migrate to bare workflow before sprint starts — biggest blocker |
| Health Connect not installed (Android 9-13) | `checkStatus()` returns `not_installed`; sync silently returns; Health screen shows install prompt |
| Android < 9 | `checkStatus()` returns `not_supported`; feature entirely hidden |
| User denies permissions | `checkStatus()` returns `permission_missing`; sync no-ops; Health screen shows "Grant" button |
| Sleep query misses overnight sessions | 24h lookback on `startTime` ensures any session that could end today is fetched; `endTime >= startOfToday` filter on the result keeps only sessions that actually ended today |
| Sleep extreme case (14h+ sleep) | 24h lookback covers sessions starting up to 24 hours before midnight — any realistic sleep duration is captured |
| Exercise type mismatch (key string vs SDK value) | Types file documents that `exerciseType` must be the SDK *value* from `ExerciseSessionRecord.EXERCISE_TYPES`, not the key. Picker is built by iterating the SDK object directly at runtime. Verify integer vs string at install time. |
| Stale task list after background sync | `sync()` emits `DeviceEventEmitter('healthConnectSyncComplete')`; `useTasks` subscribes and calls `loadTasks()` — UI updates immediately regardless of sync origin |
| Orphaned mappings after template deletion | `getAllEnabledMappings()` INNER JOINs against `templates` — orphans are invisible to sync. `pruneOrphanedMappings()` cleans them when the Health screen opens. |
| Double-completion (sync + manual, or two sync runs) | `getPendingInstanceByTemplateId()` filters `completed = 0` — handles both cases naturally, no date guard needed |
| Android 14+ kills background job | Service declared in `AndroidManifest.xml` with health category; foreground sync on app open is always the guaranteed catch-up |
| Background sync native module complexity | Fall back to foreground-only sync if needed; show "Syncing…" indicator on task list to manage user expectation |
| Multiple templates mapped to same workout type | Each mapping evaluated independently — all matching pending instances complete. Intended. |
| Repeatability broken by HC completion | HC uses `taskActions.completeTask()` — identical to manual tap; `createNextRecurringInstance()` fires normally |
