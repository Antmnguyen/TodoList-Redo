# Sprint 7 — Health Connect Auto-Complete

**Goal:** Automatically complete health-related permanent task instances when
Health Connect detects the user has done the activity (e.g. a workout, a run,
sleep goal met, step count reached).

**Platform:** Android only (Health Connect is a Google/Android platform).
Not available on iOS or web.

---

## What Is Health Connect?

Health Connect is Google's centralised health data platform on Android (Android 9+,
built-in from Android 14). Apps like Samsung Health, Google Fit, Fitbit, and Strava
all write data to Health Connect. This app reads from Health Connect to know when
the user completed a health activity — without needing to track the activity itself.

---

## How It Works (User Perspective)

1. User creates a permanent task template of type "Health" (e.g. "Morning Run", "Gym Session", "Sleep 8 Hours")
2. User links it to a Health Connect data type (e.g. Exercise Session, Steps, Sleep)
3. User works out — their fitness app writes to Health Connect as normal
4. This app reads Health Connect, detects the activity, and auto-completes the task

The user never has to manually check off health tasks — it just happens.

---

## Health Connect Data Types Relevant to Tasks

| Health Connect Record Type | Example task |
|---------------------------|-------------|
| `ExerciseSessionRecord` | "Gym Session", "Morning Run", "Yoga" |
| `StepsRecord` | "10,000 Steps Today" |
| `SleepSessionRecord` | "Sleep 8 Hours" |
| `ActiveCaloriesBurnedRecord` | "Burn 500 Calories" |
| `DistanceRecord` | "Run 5km" |
| `HeartRateRecord` | Advanced — probably out of scope for now |

Start with `ExerciseSessionRecord` and `StepsRecord` — these cover the most
common health tasks.

---

## Key Technical Decisions

| Question | Options |
|----------|---------|
| Polling or push? | Health Connect has no push — must poll on app open + background job |
| Match logic | How does "Gym Session" template → "ExerciseSession: STRENGTH_TRAINING" in HC? |
| Threshold for step tasks | User sets a step count goal on the template (e.g. 10000) |
| Background polling | `expo-background-fetch` or Android WorkManager via a native module |
| Library | `react-native-health-connect` (community library wrapping Health Connect API) |

---

## Template Changes Required

Templates need a new optional `healthConnect` configuration field:

```ts
// Addition to PermanentTask type
healthConnect?: {
  enabled:       boolean;
  dataType:      'exercise' | 'steps' | 'sleep' | 'calories' | 'distance';
  exerciseType?: string;     // e.g. 'RUNNING', 'STRENGTH_TRAINING', 'YOGA' (for exercise type)
  stepGoal?:     number;     // e.g. 10000 (for steps type)
  durationMins?: number;     // minimum session duration to count (for exercise/sleep)
  calorieGoal?:  number;     // for calories type
  distanceKm?:   number;     // for distance type
};
```

### Schema change required

```sql
ALTER TABLE templates ADD COLUMN health_connect TEXT; -- JSON blob
```

---

## New Components Needed

| Component | Purpose |
|-----------|---------|
| `HealthConnectSetupCard` | In template create/edit — lets user link template to a HC data type |
| `HealthConnectService` | Reads HC data, matches to templates, auto-completes instances |
| `HealthConnectPermissionScreen` | Request permissions for each data type used |
| Browse → "Health Connect" entry | Already exists in BrowseScreen as a placeholder — implement it here |

---

## Library

**`react-native-health-connect`** — community maintained, wraps the official
Health Connect Android SDK. Supports all major record types.

Install: `npm install react-native-health-connect`

Requires Expo bare workflow or Expo with a custom dev client (managed workflow
does not support Health Connect due to native module requirements).

> ⚠️ **This may require ejecting from Expo managed workflow to bare workflow.**
> Evaluate this before starting the sprint — it is the biggest risk.

---

## Permissions Required

Health Connect permissions are per data type and must be declared in
`AndroidManifest.xml` and requested at runtime:

```xml
<uses-permission android:name="android.permission.health.READ_EXERCISE"/>
<uses-permission android:name="android.permission.health.READ_STEPS"/>
<uses-permission android:name="android.permission.health.READ_SLEEP"/>
```

User must also grant permission inside the Health Connect app settings.

---

## Data Flow

```
App opens (or background job runs):
    HealthConnectService.sync()
        │
        ├── getTemplatesWithHealthConnect()   ← all templates with healthConnect.enabled
        │
        ├── for each template:
        │     find today's pending instance (if any)
        │     if no pending instance → skip
        │     │
        │     query Health Connect for today's records matching dataType
        │     apply threshold check (stepGoal, durationMins, etc.)
        │     │
        │     if threshold met → completeTask(instance)
        │                        logCompletion() → completion_log
        │
        └── done — user sees task auto-checked on next screen render
```

---

## BrowseScreen Integration

The BrowseScreen already has a "Health Connect" entry as a placeholder. In Sprint 7,
tapping it opens a `HealthConnectScreen` that shows:

- Connection status (connected / not connected / permission denied)
- Which Health Connect data types are active
- A list of templates linked to Health Connect + their sync status
- A "Sync Now" button to manually trigger a check

---

## Task List

- [ ] Evaluate whether Expo managed workflow supports `react-native-health-connect` — if not, plan bare workflow migration
- [ ] Install `react-native-health-connect`, test basic read on a physical Android device
- [ ] Extend `PermanentTask` type + DB schema (`health_connect` JSON column)
- [ ] Build `HealthConnectSetupCard` — shown in `CreatePermanentTaskScreen` / `EditPermanentTaskScreen` when taskType is health-related
- [ ] Build `HealthConnectService.sync()` — query HC, match to templates, complete instances
- [ ] Add permission request flow (per data type)
- [ ] Wire sync on app foreground (`AppState` change listener)
- [ ] Set up background sync (`expo-background-fetch` or WorkManager)
- [ ] Implement `HealthConnectScreen` in Browse
- [ ] Test end-to-end on physical Android device with Samsung Health or Google Fit writing data

---

## Known Limitations & Risks

| Risk | Mitigation |
|------|-----------|
| Expo managed workflow may not support native Health Connect module | Migrate to bare workflow before this sprint starts |
| Health Connect not available on Android < 9 | Show "not supported" message, disable the feature gracefully |
| Health Connect app not installed (Android 9-13) | Direct user to Play Store to install it |
| Duplicate completions (HC records arrive late) | Track `lastSyncedAt` per template, only process records newer than last sync |
| User denies HC permissions | Disable auto-complete for that data type, show explanation in HealthConnectScreen |
| iOS | Not applicable — Health Connect is Android only. iPhone users use the web version (Sprint 5.5) which does not have this feature |
