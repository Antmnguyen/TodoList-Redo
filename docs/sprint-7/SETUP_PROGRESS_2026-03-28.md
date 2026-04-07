# Sprint 7 — Health Connect Setup Progress
**Date:** 2026-03-28

> **STATUS AS OF 2026-04-06:** Setup was fully complete at the end of this session.
> All 6 remaining setup tasks are `[x]`. Full implementation (Phases 1–4) is also
> complete. Only manual device testing (Phase 5) remains — see `NEXT_STEPS_2026-04-05.md`.

---

## What We Set Up

### 1. npm Packages Installed
```
react-native-health-connect ^3.5.0
react-native-background-fetch ^4.3.0
expo-font ~14.0.11
```
`expo` bumped from `~54.0.30` → `~54.0.33` (patch update, same session).

---

### 2. Native Build Fix — minSdkVersion

`react-native-health-connect` requires `minSdkVersion = 26`. The project was defaulting to 24 (set by `expo-modules-core`).

**Fix applied in two places:**

`android/build.gradle` — `ext` block declared *before* `apply plugin: "expo-root-project"` so the plugin's `setIfNotExist` sees the value and skips its default:
```groovy
ext {
    minSdkVersion = 26
}
apply plugin: "expo-root-project"
apply plugin: "com.facebook.react.rootproject"
```

`app.json` — persists through future `expo prebuild` runs:
```json
"android": {
  "minSdkVersion": 26
}
```

> **Why both:** `android/` is in `.gitignore` so the `build.gradle` change won't be in the repo. The `app.json` entry is the durable source of truth.

---

### 3. AndroidManifest.xml Additions

File: `android/app/src/main/AndroidManifest.xml`

**Read permissions added inside `<manifest>`:**
```xml
<uses-permission android:name="android.permission.health.READ_STEPS"/>
<uses-permission android:name="android.permission.health.READ_SLEEP"/>
<uses-permission android:name="android.permission.health.READ_EXERCISE"/>
```

**Queries block additions (inside `<queries>`):**
```xml
<package android:name="com.google.android.apps.healthdata"/>
<intent>
  <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"/>
</intent>
```

**Application-level additions (inside `<application>`):**
```xml
<activity
  android:name="androidx.health.connect.client.PermissionController$HealthDataRequestPermissionsActivity"
  android:exported="true"/>

<service
  android:name=".HealthConnectSyncService"
  android:permission="android.permission.BIND_JOB_SERVICE"
  android:exported="false">
  <intent-filter>
    <action android:name="androidx.work.impl.background.systemjob.SystemJobService"/>
  </intent-filter>
</service>
```

---

### 4. MainActivity.kt — Permission Delegate

File: `android/app/src/main/java/com/anonymous/TaskTrackerApp/MainActivity.kt`

Without this, calling `requestPermission()` crashes the app. The library uses Android's `ActivityResultContracts` and needs the delegate registered before any permission request.

```kotlin
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate

override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    super.onCreate(null)
    HealthConnectPermissionDelegate.setPermissionDelegate(this)
}
```

---

## What We Verified

### SDK Status
- `getSdkStatus()` returns `3` on the test device → Health Connect is available and ready.
- `initialize()` returns `true` → client initialised successfully.

### Exercise Type Constants (Step 7)
- Import: `import { ExerciseType } from 'react-native-health-connect'`
- **Values are integers**, not strings.
- Key values for this project:

| Key | Value |
|-----|-------|
| `OTHER_WORKOUT` | 0 |
| `STRENGTH_TRAINING` | 70 |
| `WEIGHTLIFTING` | 81 |
| `RUNNING` | 56 |
| `RUNNING_TREADMILL` | 57 |
| `WALKING` | 79 |
| `SWIMMING_POOL` | 74 |
| `SWIMMING_OPEN_WATER` | 73 |
| `YOGA` | 83 |
| `HIGH_INTENSITY_INTERVAL_TRAINING` | 36 |

Full range: 0–83. All exercise type comparisons in `evaluateThreshold()` and the picker must use these integer values, not the string keys.

### Sleep & Steps (Step 7b — in progress)
- `readRecords('Steps', ...)` and `readRecords('SleepSession', ...)` confirmed as the correct record type names.

#### Permission Grant Issue — Troubleshooting Log

**Problem 1 — `requestPermission()` crashed the app**
- Root cause: `MainActivity.kt` was missing `HealthConnectPermissionDelegate.setPermissionDelegate(this)` in `onCreate`. The library uses Android's `ActivityResultContracts` and needs the delegate registered before any permission request.
- Fix: Added the delegate call to `MainActivity.kt`. Requires native rebuild.

**Problem 2 — `requestPermission()` returned `[]` immediately (no dialog shown)**
- After the delegate fix and rebuild, `requestPermission` returned `[]` with no dialog appearing.
- `getGrantedPermissions()` also returned `[]` — confirming zero permissions granted at OS level.
- Root cause: Health Connect could not discover the app. For HC to register an app and show it in its permissions list, the app's `MainActivity` must declare a specific `intent-filter`. Without it, HC ignores permission requests silently.
- Fix: Added the following `intent-filter` inside the `MainActivity` `<activity>` block in `AndroidManifest.xml`:
```xml
<intent-filter>
  <action android:name="androidx.health.connect.client.SHOW_PERMISSIONS_RATIONALE"/>
</intent-filter>
```
- Requires native rebuild.

**Problem 3 — app not appearing in Health Connect app list (permissions still rejected)**
- After adding `SHOW_PERMISSIONS_RATIONALE` intent-filter, the dialog still didn't appear and the app was invisible to HC.
- Root cause: Two missing pieces. First, `health_connect_privacy_policy_url` meta-data is required by Health Connect for any app to be registered — without it HC silently ignores the app. Second, a `<activity-alias>` for `VIEW_PERMISSION_USAGE` is required so that HC can surface the app in its permissions management UI.
- Fix applied by user to `AndroidManifest.xml`:
  1. Added `health_connect_privacy_policy_url` meta-data inside `MainActivity`
  2. Added `<activity-alias>` block:
```xml
<activity-alias
    android:name="ViewPermissionUsageActivity"
    android:exported="true"
    android:targetActivity=".MainActivity"
    android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
    <intent-filter>
        <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
        <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
    </intent-filter>
</activity-alias>
```
  3. Moved `SHOW_PERMISSIONS_RATIONALE` intent-filter onto the `PermissionController` activity (not just MainActivity)

**Outcome:** App now appears in Health Connect. Permission dialog shows correctly. `requestPermission` returns granted permissions.

---

### Steps Record Structure — Confirmed

**Permissions granted:** `Steps`, `StepsCadence`, `SleepSession`

**Steps:** 841 records over 7 days. Source: `com.google.android.apps.fitness` (Google Fit).

```json
{
  "metadata": {
    "id": "5aae68ba-...",
    "dataOrigin": "com.google.android.apps.fitness",
    "lastModifiedTime": "2026-03-29T02:27:18.160Z",
    "recordingMethod": 2,
    "device": { "model": "CPH2417", "manufacturer": "OnePlus", "type": 0 }
  },
  "count": 44,
  "startTime": "2026-03-22T04:01:13.883Z",
  "endTime": "2026-03-22T04:02:41.884Z"
}
```

**Key findings:**
- `count` = integer step count for that interval
- Steps are stored as **short intervals**, not daily totals — 841 records across 7 days means many small bursts per day
- To get today's total steps: sum `count` across all records where `startTime >= start of today`
- Do NOT treat a single record as the day's total

### Sleep Record Structure — From SDK types (no live data on test device)

`SleepSession` returned 0 records — sleep is not synced to Health Connect on this device. Structure is from SDK types:

```ts
{
  metadata: { id, dataOrigin, lastModifiedTime, ... },
  startTime: string,   // ISO 8601 — session start (e.g. "2026-03-28T22:30:00.000Z")
  endTime: string,     // ISO 8601 — session end (e.g. "2026-03-29T06:30:00.000Z")
  title?: string,
  notes?: string,
  stages?: [           // optional — not all apps provide stage breakdown
    {
      startTime: string,
      endTime: string,
      stage: number    // integer — use SleepStageType constants
    }
  ]
}
```

**How to calculate sleep duration:**
```ts
const durationMs = new Date(record.endTime).getTime() - new Date(record.startTime).getTime();
const hours = durationMs / (1000 * 60 * 60);
```

**Lookback strategy:** Sleep sessions span midnight — a session starting at 22:30 and ending at 06:30 has `endTime` the next day. To find last night's sleep, query with `endTime >= startOfToday` and a 24h lookback window, not just `startTime >= today`.

**Implementation note:** Must handle 0 records gracefully — show "No data" rather than crashing or showing 0h.

---

### Exercise Record Structure — From SDK types (not verified with live data)

```ts
{
  metadata: { id, dataOrigin, lastModifiedTime, ... },
  startTime: string,         // ISO 8601 — workout start
  endTime: string,           // ISO 8601 — workout end
  exerciseType: number,      // integer — compare against ExerciseType constants
  title?: string,
  notes?: string,
  laps?: ExerciseLap[],
  segments?: ExerciseSegment[]
}
```

**How to calculate workout duration:**
```ts
const durationMs = new Date(record.endTime).getTime() - new Date(record.startTime).getTime();
const minutes = durationMs / (1000 * 60);
```

**How to match exercise type in `evaluateThreshold()`:**
```ts
// threshold stores exerciseType as integer e.g. 70
record.exerciseType === threshold.exerciseType
// OR for "Any" workout (OTHER_WORKOUT = 0 used as wildcard in our schema):
threshold.exerciseType === 0 // match any type
```

**Important:** Fitbit may log strength training as `WEIGHTLIFTING (81)` OR `STRENGTH_TRAINING (70)` depending on how it maps. Consider matching both or using "Any" for workout thresholds.

### Fitbit / Google Fit Mapping
Data written by Fitbit/Google Fit to Health Connect maps to these record types:

| Activity | Record type | Notes |
|----------|-------------|-------|
| Run | `ExerciseSessionRecord` `exerciseType: 56` | |
| Treadmill run | `ExerciseSessionRecord` `exerciseType: 57` | |
| Swim | `ExerciseSessionRecord` `exerciseType: 74/73` | Pool vs open water |
| Weight training | `ExerciseSessionRecord` `exerciseType: 70 or 81` | Fitbit may use either |
| Sleep | `SleepSessionRecord` | Separate record type |
| Steps | `StepsRecord` | Separate record type |

---

## Remaining Setup Before Implementation

| # | Task | Status |
|---|------|--------|
| 1 | Rebuild after `MainActivity.kt` delegate fix | `[x]` |
| 2 | Rebuild after manifest fixes | `[x]` |
| 3 | Permission dialog appears + grant Steps + Sleep | `[x]` |
| 4 | App appears in Health Connect app permissions list | `[x]` |
| 5 | Log raw `Steps` and `SleepSession` record structure | `[x]` |
| 6 | Remove temp diagnostic code from `HealthManagementScreen.tsx` | `[x]` |

**Setup is complete. Phase 1 implementation (types + data model) can begin.**

---

## Key Files Changed During Setup

| File | Change |
|------|--------|
| `package.json` | Added health-connect, background-fetch, expo-font |
| `app.json` | Added `expo-font` plugin, `android.minSdkVersion: 26` |
| `android/build.gradle` | `ext { minSdkVersion = 26 }` before plugin apply |
| `android/app/src/main/AndroidManifest.xml` | HC permissions, queries, activity, WorkManager service, `SHOW_PERMISSIONS_RATIONALE` intent-filter on MainActivity |
| `android/app/src/main/java/.../MainActivity.kt` | `HealthConnectPermissionDelegate.setPermissionDelegate(this)` |
| `app/screens/browse/HealthManagementScreen.tsx` | Temp diagnostic code (to be removed after step 7b) |
