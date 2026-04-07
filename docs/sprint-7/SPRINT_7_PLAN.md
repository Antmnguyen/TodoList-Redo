# Sprint 7 — Health Connect Integration

> **STATUS AS OF 2026-04-06: ALL IMPLEMENTATION DONE. Only Phase 5 testing remains.**
> See §13 Task List for per-task status. See `NEXT_STEPS_2026-04-05.md` for the
> testing checklist (T1–T24) and a summary of what was implemented.

**Goal:** Read sleep, steps, and workout data from Health Connect (Android) on app
open and in the background.

- **Steps & Sleep** are first-class tracking sections: each has its own persistent
  history table, statistics (averages, streaks, personal bests), and visual displays
  (charts/graphs). Task auto-completion is a feature within these sections but not
  their primary purpose.
- **Workouts** are lightweight: minimal display (today's sessions only), no historical
  storage, no charts. Their sole purpose is to auto-complete assigned permanent task
  templates when a workout threshold is met.

Users configure task mappings (threshold → permanent template) from within the
Health Connect screen. When a threshold is met the mapped task instance is
auto-completed. If no instance is scheduled and `autoSchedule` is on, one is created.

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

### Step 1 — Install npm packages `[x]`

```bash
npm install react-native-health-connect
npm install react-native-background-fetch
```

### Step 2 — Connect a physical Android device `[x]`

Health Connect does not work in the emulator. You need a real device.

1. On your Android phone go to **Settings → About phone** and tap **Build number**
   seven times to enable Developer Options.
2. Go to **Settings → Developer Options** and turn on **USB Debugging**.
3. Plug the phone into your PC with a USB cable.
4. A prompt will appear on the phone asking to allow USB debugging — tap **Allow**.
5. Verify the device is visible:
   ```
   adb devices
   ```
   You should see your device listed with the status `device`. If it shows
   `unauthorized`, re-check the phone for the allow prompt.

> `adb` is part of Android SDK Platform Tools. If the command is not found,
> install it via Android Studio → SDK Manager → SDK Tools → Android SDK
> Platform-Tools, or add its path to your system PATH.

### Step 3 — Rebuild the native Android app `[x]`

Installing native modules changes the native layer. A JS-only reload is not
enough — you must do a full native rebuild. Use `npx expo` (not `expo` directly):

```bash
npx expo run:android
```

> If the build fails after installing `react-native-health-connect`, check the
> library's README for any `build.gradle` or `settings.gradle` changes required
> for the installed version.

### Step 4 — Add permissions to `android/app/src/main/AndroidManifest.xml` `[x]`

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

### Step 5 — Verify Health Connect is available on your test device `[x]`

| Android version | What to do |
|----------------|------------|
| Android 14+ | Health Connect is built in — nothing to install |
| Android 9–13 | Install **Health Connect** from the Google Play Store |
| Android < 9 | Not supported — feature will be hidden automatically |

### Step 6 — Install a fitness app and grant permissions `[x]`

Health Connect is only useful if another app is writing data to it.

1. Install **Samsung Health**, **Google Fit**, or any Health Connect-compatible
   app on your device.
2. Open that app at least once and connect it to Health Connect when prompted.
3. After building and running this app, open **Browse → Health Connect** and tap
   **"Grant"** to approve the read permissions for Steps, Sleep, and Exercise.
4. You can also verify permissions inside the Health Connect app itself
   (Settings → Apps → Health Connect → App permissions).

### Step 7 — Verify the SDK exercise type values `[x]`

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

**Result (confirmed 2026-03-28):** Values are **integers**. e.g. `STRENGTH_TRAINING: 70`, `RUNNING: 56`, `WALKING: 79`, `YOGA: 83`, `OTHER_WORKOUT: 0`. Full range is 0–83.

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

## Section Design Philosophy

### Navigation pattern — dedicated detail screens

Each health section (Steps, Sleep, Workouts) is a **tappable summary row** on the
main `HealthManagementScreen`. Tapping opens a **dedicated full-screen detail view**
for that section. This mirrors the stats screen pattern: `StatPreviewCard` → detail
screen (`OverallDetailScreen`, `CategoryDetailScreen`, `PermanentDetailScreen`).

**Main screen** shows: section icon + title + today's key stat + goal-met indicator.
**Detail screens** (`StepsDetailScreen`, `SleepDetailScreen`, `WorkoutsDetailScreen`)
contain all charts, stats, and mapping rows.

This replaces the earlier collapsible-section-card design. No `Animated` expand/collapse
is used — navigation is instant with a full-screen push (same as stats detail screens).

### Goal threshold — unified colour feedback

The goal value (step count for steps; hours for sleep) drives **two things**:

1. **Graph success colour.** Any day/night that meets or exceeds the goal turns green
   ("success colour") in all graph views — `WeekBarGraph` bars, `MonthCalendarGraph`
   cells, and the today progress ring. Failing-goal days use the section's default accent
   colour; goal-met days use `theme.colors.success` (green).
2. **Task auto-complete trigger.** The same goal value is the threshold for
   `evaluateThreshold()`. Only one goal value is stored per section — it drives both
   visuals and task completion. The user sets their goal once.

**Toggle.** A per-section toggle (`goalColorEnabled: boolean`, stored in meta)
controls whether the green colouring is applied. When disabled, all days use the
section accent colour regardless of goal status. The toggle is visible inside the
detail screen. The task auto-complete threshold is NOT affected by this toggle —
tasks complete whenever the goal is met regardless of the visual setting.

### Reuse of existing stats components

The following components from `app/components/stats/` are used **as-is** — no
modifications. The health sections are built by composing them with health data:

| Component | Where reused | Data mapping |
|-----------|-------------|--------------|
| `WeekBarGraph` | Steps + Sleep **weekly view** | `DayData.count` = steps or sleep minutes per day; `DayData.color` overridden to `theme.colors.success` when value ≥ goal and toggle enabled |
| `MonthCalendarGraph` | Steps + Sleep **monthly view** | `CalendarDayData.completed` = steps or sleep minutes, `.total` = daily goal (drives fill ratio); goal-met cells use success colour |
| `TimeRangePicker` | Chart view toggle (Week / Month) in Steps + Sleep | Only two tabs needed; `color` = section accent |
| `StreakCard` | Steps + Sleep streak display | step-goal streak / sleep-goal streak |
| `CircularProgress` | Steps today ring | `percent` = (todaySteps / goal) × 100; ring colour = success green when goal met |
| `CompletionSummaryCard` | Sleep last-night ring | `completed` = sleep minutes, `total` = goal minutes; ring colour = success green when goal met |

> **Dark mode:** All components must use `useTheme()` for colours. No hardcoded hex
> values in health components. Use `theme.colors.success` for the goal-met green,
> `theme.colors.primary` (or section accent) for default bars. Card backgrounds must
> use `theme.colors.card` / `theme.colors.background`. Text must use
> `theme.colors.text` / `theme.colors.textSecondary`. Test both light and dark modes.

Three components from earlier plan drafts (`HealthBarChart`, `HealthStatsPanel`,
`HealthWeeklyAveragesChart`) are **not needed** — existing components cover all
chart and stats use cases without modification.

---

### Steps — rich tracking section
Steps is a primary health metric. The section stores and displays:
- **Today's live count** with a progress ring toward the daily goal (green when goal met)
- **Chart area** with a Week / Month toggle:
  - **Weekly view** (`WeekBarGraph`) — one bar per day (Mon–Sun), height = step count,
    bars coloured green for goal-met days (when toggle on), navigable to past weeks
  - **Monthly view** (`MonthCalendarGraph`) — calendar grid, each day cell filled by
    steps/goal ratio; goal-met cells coloured green, navigable to past months
- **Statistics panel:** this-week average, this-month average, personal best day,
  current streak (consecutive days meeting the goal), longest streak ever
- **Goal setting:** editable numeric field (e.g. 10,000). The same value drives
  both the green-threshold colouring and the task auto-complete threshold.
- **Goal colour toggle:** on/off switch that enables/disables green colouring for goal-met days
- **Task mappings** — step goal → permanent template

Steps history is persisted to `health_steps_history` (one row per day). All chart
views and stats are computed from this table — no re-querying Health Connect.

### Sleep — rich tracking section
Sleep is a primary health metric. The section stores and displays:
- **Last night's duration** ring (h m vs goal) — green when goal met
- **Sleep stage breakdown** if stages available (light / deep / REM / awake inline bar)
- **Chart area** with a Week / Month toggle:
  - **Weekly view** (`WeekBarGraph`) — one bar per night (Mon–Sun), height = sleep
    minutes, bars green for goal-met nights (when toggle on), navigable to past weeks
  - **Monthly view** (`MonthCalendarGraph`) — calendar grid, each night's cell filled
    by sleepMins/goalMins ratio; goal-met cells green, navigable to past months
- **Statistics panel:** this-week average sleep, this-month average sleep, personal
  best night, current streak (nights meeting the sleep goal), longest streak
- **Goal setting:** editable hours field (e.g. 8.0). The same value drives both
  the green-threshold colouring and the task auto-complete threshold.
- **Goal colour toggle:** on/off switch that enables/disables green colouring for goal-met nights
- **Task mappings** — sleep hours threshold → permanent template

Sleep history is persisted to `health_sleep_history`.

### Workouts — lightweight task-completion trigger
Workouts do not need history, charts, or statistics. The section shows:
- **Today's sessions** — a brief list: exercise type label + duration (e.g. "Strength Training · 45 min")
- **Task mapping rows** — each with met/unmet badge
- **"+ Add Task Mapping"** button

No `health_workouts_history` table. Workout data is read fresh each sync and
discarded after threshold evaluation. The workout section's entire value is
auto-completing the right tasks; the display is just context for the user.

> **Auto-complete scope:** Workout task auto-complete only targets **today's task
> instances**. A mapping will never complete an instance from a previous day.

---

## 1. User-Facing Flow

### Setup (done entirely from the Health Connect screen)

1. User opens **Browse → Health Connect**.
2. Main screen shows three tappable rows: **Steps**, **Sleep**, **Workouts**.
3. Tapping a row opens the dedicated detail screen for that section.
4. Inside a detail screen, the user sets their **goal** (step count or sleep hours).
   This single goal value drives both:
   - The green "goal met" colouring across all graph views for that section
   - The task auto-complete threshold for any mapped tasks
5. User taps **"+ Add Task Mapping"** to link a permanent task template.
6. A picker shows all existing permanent task templates (read-only — no template
   is modified).
7. User picks a template and saves. The mapping is stored in the Health Connect
   mappings table only.
8. Multiple templates can be mapped to the same data type.
9. Each mapping has an **auto-schedule** toggle: if on and no instance exists for
   today when the threshold is met, one will be auto-created.
10. A **"Goal colour" toggle** inside each detail screen enables/disables the green
    colouring for goal-met days. Task auto-complete is NOT affected by this toggle.

### Daily auto-complete

Sync runs in three modes:

- **App start (guaranteed):** `sync()` runs once when the app loads — before any
  React navigation renders. This ensures the task list is up-to-date on every open.
- **Background (primary):** A Headless JS / WorkManager job fires periodically
  while the app is closed or backgrounded — typically every 15–30 minutes.
- **Manual (optional):** A **"Sync Now"** button on the main Health Connect screen
  triggers an immediate `sync()`. This is a convenience fallback and is unlikely
  to be needed often.

> The earlier `AppState` listener is kept as a lightweight catch-up but is no longer
> the primary trigger — app-start sync supersedes it.

Both automatic paths call the same `sync()` function.

In all cases:
1. Service reads today's data from Health Connect.
2. For each mapping: evaluate threshold → find **today's** pending instance only.
3. If threshold met and a pending instance exists: `taskActions.completeTask()`.
4. If threshold met and no instance but auto-schedule on: create then complete.
5. If the task was already manually completed by the user: `findTodaysPendingInstance()`
   returns `null` (it filters `completed = 0`) — sync does nothing. No double-completion.

> **Workout scope guard:** Workout auto-complete only targets task instances whose
> `due_date` matches today. `getPendingInstanceByTemplateId(templateId, today)` already
> scopes to today — no additional guard needed, but the date parameter is mandatory
> and must always pass `todayDateString()`, never a past date.

---

## 2. Health Connect Screen UI

### 2a. Main screen — `HealthManagementScreen.tsx`

**File:** `app/screens/browse/HealthManagementScreen.tsx` (replace the placeholder)

The main screen is a lightweight hub: connection status + three tappable section rows.
Tapping a row navigates to the dedicated detail screen for that section.

```
┌─────────────────────────────────────┐
│  ← Back          Health Connect     │   (purple header)
├─────────────────────────────────────┤
│  ● Connected   [Sync Now]           │
│  Last synced: 2 min ago             │
├─────────────────────────────────────┤
│  👟  Steps                    ›     │   ← tappable row → StepsDetailScreen
│      Today: 6,432 / 10,000 ✓       │     (green ✓ when goal met)
├─────────────────────────────────────┤
│  🌙  Sleep                    ›     │   ← tappable row → SleepDetailScreen
│      Last night: 7h 12m ✓ Goal met │
├─────────────────────────────────────┤
│  🏋  Workouts                 ›     │   ← tappable row → WorkoutsDetailScreen
│      Today: Strength Training · 45m │
└─────────────────────────────────────┘
```

Each row shows a one-line summary of today's key stat. The `›` chevron signals
navigation. No charts, no mapping rows, no collapsible animation on this screen.

### Connection status

- `healthy` → green dot "Connected"
- `permission_missing` → amber "Permissions needed" + "Grant" button
- `not_installed` → red "Health Connect not installed" + "Install" button
- `not_supported` → grey "Not supported on this device" — section rows hidden

---

### 2b. Steps detail screen — `StepsDetailScreen.tsx`

**File:** `app/screens/browse/StepsDetailScreen.tsx` (new)

Full-screen view pushed from the main Health Connect screen. Back button returns to
the main screen.

```
┌─────────────────────────────────────┐
│  ← Back               Steps        │   (purple header)
├─────────────────────────────────────┤
│        ◯ 6,432 / 10,000            │   ← CircularProgress ring
│          Goal: 10,000 steps [edit] │     (green ring when met)
│                                     │
│  Goal colour  ●────  (on)           │   ← toggle for green threshold visuals
├─────────────────────────────────────┤
│     [ Week ]  [ Month ]             │   ← TimeRangePicker toggle
│                                     │
│  (Week view — WeekBarGraph)         │
│  [Mo][Tu][We][Th][Fr][Sa][Su]       │
│  ████ 🟩🟩 ████ ██░ 🟩🟩🟩 ░░░       │   green bars = days that met goal
│  8,204 10,200 …                     │
│                                     │
│  (Month view — MonthCalendarGraph)  │
│  Su Mo Tu We Th Fr Sa               │
│  [  ][  ][🟡][🟢][🔴][🟢][  ]      │   green cells = days that met goal
│  …                                  │
├─────────────────────────────────────┤
│  Avg this week:  8,204 steps        │
│  Avg this month: 7,890 steps        │
│  Best day: 14,320                   │
│  ── Streak ──────────────────────── │
│  [StreakCard: 4d streak / 12d best] │
├─────────────────────────────────────┤
│  ── Task Mappings ─────────────────  │
│  Daily Walk    10,000 steps  ●──   │
│  [+ Add Task Mapping]               │
└─────────────────────────────────────┘
```

**Steps detail content:**

- **Today's progress ring** — `CircularProgress` with `percent` = (todaySteps / stepGoal) × 100.
  Ring colour = `theme.colors.success` when goal met and toggle on, else section accent.
- **Goal field** — inline editable numeric (tapping opens a numeric input). Persisted to
  `health_connect_meta` key `steps_goal`. This same value is used as `step_goal` in
  `health_connect_mappings` rows for auto-complete thresholds.
- **Goal colour toggle** — switches green threshold visuals on/off. Persisted to
  `health_connect_meta` key `steps_goal_color_enabled`. Does NOT affect auto-complete.
- **Chart toggle** — `TimeRangePicker` with two tabs: **Week** and **Month**.
- **Weekly view** — `WeekBarGraph`, `DayData.count` = steps per day. When goal colour
  toggle is on, each bar's colour is `theme.colors.success` if `count >= stepGoal`,
  otherwise section accent. Pass per-bar colour via `DayData.color` if the component
  supports it; otherwise wrap with conditional styling at the call site.
- **Monthly view** — `MonthCalendarGraph`, `CalendarDayData.completed` = steps,
  `.total` = stepGoal. Existing component already colours cells green ≥ 60% fill.
  When goal colour toggle is on and completed >= total, the cell is `theme.colors.success`.
- **Stats panel** — week avg, month avg, personal best, `StreakCard`.
- **Mapping rows** + **"+ Add Task Mapping"** button.

---

### 2c. Sleep detail screen — `SleepDetailScreen.tsx`

**File:** `app/screens/browse/SleepDetailScreen.tsx` (new)

```
┌─────────────────────────────────────┐
│  ← Back               Sleep        │   (indigo header)
├─────────────────────────────────────┤
│  [CompletionSummaryCard ring]        │
│   7h 12m slept  /  8h 0m goal       │   ← green ring when goal met
│   ✓ Goal met                         │
│   Goal: 8.0 hours [edit]            │
│                                     │
│  Goal colour  ●────  (on)           │
│  ── Stage breakdown ─────────────── │
│  [Light 2h][Deep 1.5h][REM 2h][…]  │   hidden if no stage data
├─────────────────────────────────────┤
│     [ Week ]  [ Month ]             │
│                                     │
│  (Week view — WeekBarGraph)         │
│  [Mo][Tu][We][Th][Fr][Sa][Su]       │
│  🟩🟩 ███ ██░ 🟩🟩 ██░ 🟩🟩🟩 ░░░    │   green = nights that met goal
│  8h   6h  5h   8h  5h   9h   0h    │
│                                     │
│  (Month view — MonthCalendarGraph)  │
│  Su Mo Tu We Th Fr Sa               │
│  [  ][  ][🔴][🟢][🟡][🟢][  ]     │
│  …                                  │
├─────────────────────────────────────┤
│  Avg this week:  6h 54m             │
│  Avg this month: 6h 38m             │
│  Best night: 9h 10m                 │
│  ── Streak ──────────────────────── │
│  [StreakCard: 4d streak / 8d best]  │
├─────────────────────────────────────┤
│  ── Task Mappings ─────────────────  │
│  Sleep Goal    8h 00m  ●──          │
│  [+ Add Task Mapping]               │
└─────────────────────────────────────┘
```

**Sleep detail content:**

- **Last night summary ring** — `CompletionSummaryCard`, `completed` = sleep minutes,
  `total` = goalMins. Ring colour = `theme.colors.success` when goal met + toggle on.
- **Goal field** — inline editable hours (e.g. 8.0). Persisted to `health_connect_meta`
  key `sleep_goal_hours`. Drives both ring colour threshold and auto-complete threshold.
- **Goal colour toggle** — `health_connect_meta` key `sleep_goal_color_enabled`.
- **Stage mini-bar** — proportional light/deep/REM/awake segments, hidden when no stage data.
- **Chart toggle**, **Weekly view**, **Monthly view** — same pattern as Steps.
  Bar/cell colours follow goal colour toggle: green when slept ≥ goal.
- **Stats panel** + **Mapping rows** + **"+ Add Task Mapping"**.

---

### 2d. Workouts detail screen — `WorkoutsDetailScreen.tsx`

**File:** `app/screens/browse/WorkoutsDetailScreen.tsx` (new)

```
┌─────────────────────────────────────┐
│  ← Back             Workouts       │   (teal header)
├─────────────────────────────────────┤
│  ── Today's Sessions ────────────── │
│  Strength Training · 45 min         │
│  Running · 32 min                   │
│  (or "No workouts recorded today")  │
├─────────────────────────────────────┤
│  ── Task Mappings ─────────────────  │
│  Push Day   Strength  30m min  ✓    │
│  Pull Day   Strength  30m min  –    │
│  Leg Day    Any       0m min   –    │
│                                     │
│  [+ Add Task Mapping]               │
└─────────────────────────────────────┘
```

No charts, no goal setting, no colour toggle. Workout data is read fresh each sync.

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

### 4a. `health_steps_history` table (new — steps only)

Stores one row per calendar day. Written by `sync()` after reading HC steps data.
Powers the 7-day chart and statistics panel without requiring a fresh HC query.

```sql
CREATE TABLE IF NOT EXISTS health_steps_history (
  date       TEXT PRIMARY KEY,  -- 'YYYY-MM-DD'
  step_count INTEGER NOT NULL,
  goal       INTEGER,           -- the step goal active on that day (nullable — stored for streak calc)
  synced_at  TEXT NOT NULL      -- ISO 8601 timestamp of last HC read for this date
);
```

Statistics computed from this table at display time:
- **7-day average:** `AVG(step_count) WHERE date >= 7 days ago`
- **Personal best:** `MAX(step_count) WHERE step_count > 0`
- **Current streak:** count consecutive recent days where `step_count >= goal`
- **Longest streak:** computed over full history

### 4b. `health_sleep_history` table (new — sleep only)

Stores one row per night (keyed to the day the sleep *ended*, matching the
24h-lookback query strategy). Written by `sync()`.

```sql
CREATE TABLE IF NOT EXISTS health_sleep_history (
  date          TEXT PRIMARY KEY,  -- 'YYYY-MM-DD' — the date sleep ended (morning of)
  duration_mins INTEGER NOT NULL,  -- total sleep in minutes
  goal_hours    REAL,              -- minimum hours goal active that night (nullable)
  has_stages    INTEGER NOT NULL DEFAULT 0,  -- 1 if stage breakdown was available
  light_mins    INTEGER,           -- SleepStageType LIGHT
  deep_mins     INTEGER,           -- SleepStageType DEEP
  rem_mins      INTEGER,           -- SleepStageType REM
  awake_mins    INTEGER,           -- SleepStageType AWAKE (in-session wakes)
  synced_at     TEXT NOT NULL
);
```

Statistics computed from this table at display time:
- **7-day average:** `AVG(duration_mins) WHERE date >= 7 days ago` → convert to h m
- **Personal best:** `MAX(duration_mins) WHERE duration_mins > 0`
- **Nights met goal this week:** `COUNT(*) WHERE date >= 7 days ago AND duration_mins >= goal_hours * 60`

### 4c. `health_connect_mappings` table

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

### 4d. `health_connect_meta` table

Stores display metadata only — not used as a sync guard.

```sql
CREATE TABLE IF NOT EXISTS health_connect_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Keys stored in this table:
--   last_synced_at          ISO 8601 timestamp — display only ("Last synced: X min ago")
--   steps_goal              integer string, e.g. "10000" — shared goal for graph colour + auto-complete
--   steps_goal_color_enabled "1" or "0" — whether green colouring is active for steps graphs
--   sleep_goal_hours        real string, e.g. "8.0" — shared goal for graph colour + auto-complete
--   sleep_goal_color_enabled "1" or "0" — whether green colouring is active for sleep graphs
```

> **Why no `last_read_date` sync guard?** The previous design blocked re-reads if
> `last_read_date === today`. This caused a correctness bug: a user with 2,000 steps
> at 9 AM opens the app (guard set), reaches 10,000 steps at 2 PM, opens the app
> again — sync is skipped and the task is never completed.
>
> The guard is removed entirely. Sync always reads HC and always evaluates thresholds.
> Double-completion is prevented by `findTodaysPendingInstance()` filtering
> `completed = 0` — not by date-blocking. See §8.

### 4e. TypeScript types (Health Connect feature only)

**File:** `app/features/googlefit/types/healthConnect.ts` (new)

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

export interface SleepStageBreakdown {
  lightMins:  number;
  deepMins:   number;
  remMins:    number;
  awakeMins:  number;
}

export interface TodaySummary {
  steps: number | null;
  /** Total sleep hours from sessions that ENDED today (handles overnight sessions) */
  sleepHours: number | null;
  /** Stage breakdown — null if no stage data was available from the sleep record */
  sleepStages: SleepStageBreakdown | null;
  workouts: WorkoutSession[] | null;
}

/** One row from health_steps_history */
export interface StepsDayRecord {
  date:      string;   // 'YYYY-MM-DD'
  stepCount: number;
  goal:      number | null;
}

/** One row from health_sleep_history */
export interface SleepDayRecord {
  date:          string;   // 'YYYY-MM-DD' — the morning the sleep ended
  durationMins:  number;
  goalHours:     number | null;
  stages:        SleepStageBreakdown | null;  // null if has_stages = 0
}

/** Computed from history table — passed to the Steps statistics panel */
export interface StepsStats {
  avgWeekSteps:    number | null;   // avg per active day this calendar week
  avgMonthSteps:   number | null;   // avg per active day this calendar month
  personalBest:    number | null;
  currentStreak:   number;  // days
  longestStreak:   number;  // days
}

/** Computed from history table — passed to the Sleep statistics panel */
export interface SleepStats {
  avgWeekMins:      number | null;  // avg sleep minutes per night this calendar week
  avgMonthMins:     number | null;  // avg sleep minutes per night this calendar month
  personalBestMins: number | null;
  currentStreak:    number;  // nights
  longestStreak:    number;  // nights
}

export type HealthConnectStatus =
  | 'healthy'
  | 'permission_missing'
  | 'not_installed'
  | 'not_supported';

/**
 * User-configurable goals stored in health_connect_meta.
 * Loaded once on screen open, updated when user edits the goal field.
 * This single goal value drives BOTH graph green-threshold colouring
 * AND task auto-complete threshold for the section.
 */
export interface HealthGoalSettings {
  stepsGoal:            number;   // default 10000
  stepsGoalColorEnabled: boolean; // default true
  sleepGoalHours:       number;   // default 8.0
  sleepGoalColorEnabled: boolean; // default true
}
```

---

## 5. Health Connect Actions

**File:** `app/features/googlefit/utils/healthConnectActions.ts` (new)

Main entry point for the feature. All Health Connect library calls go through
here. No screen or component touches the HC library directly.

### Public API

```ts
checkStatus(): Promise<HealthConnectStatus>

requestPermissions(dataTypes: HealthDataType[]): Promise<boolean>

getTodaySummary(): Promise<TodaySummary>
// Returns steps count, sleep hours + stage breakdown (null if unavailable), workouts list

sync(): Promise<void>
// Reads HC, persists steps + sleep history rows, evaluates thresholds, auto-completes tasks

getGoalSettings(): Promise<HealthGoalSettings>
// Reads steps_goal, steps_goal_color_enabled, sleep_goal_hours, sleep_goal_color_enabled
// from health_connect_meta. Returns defaults if not yet set.

saveGoalSettings(settings: Partial<HealthGoalSettings>): Promise<void>
// Upserts changed keys into health_connect_meta.
```

### Sync trigger points

`sync()` is called from three places:

1. **App start** — called once in `App.tsx` (or `index.js`) after the DB is initialised,
   before the main navigator mounts. Runs in the background (fire-and-forget) — does not
   block app render.
2. **AppState foreground** — called when `AppState` transitions to `'active'` (existing
   catch-up path). Kept as a lightweight supplement.
3. **Manual** — called from the "Sync Now" button on `HealthManagementScreen`.

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

  summary = getTodaySummary()  // single HC read covers all data types

  // ── Persist history rows (steps + sleep only; workouts not stored) ────────
  if summary.steps !== null:
    healthConnectStorage.upsertStepsDay({
      date: today, stepCount: summary.steps, goal: userStepGoal()
    })

  if summary.sleepHours !== null:
    healthConnectStorage.upsertSleepDay({
      date: today, durationMins: summary.sleepHours * 60,
      goalHours: userSleepGoal(), stages: summary.sleepStages
    })
  // (upsert = INSERT OR REPLACE — safe to call on every sync)

  // ── Task auto-completion ──────────────────────────────────────────────────
  mappings = healthConnectStorage.getAllEnabledMappings()
  // cross-joins with templates — orphaned mappings are filtered out automatically

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

> **`userStepGoal()` / `userSleepGoal()`:** Read from `health_connect_meta` keys
> `steps_goal` and `sleep_goal_hours` via `getGoalSettings()`. These are the same
> values the user edits in the detail screens — one goal per section. Defaults are
> 10,000 steps / 8.0 hours if the user has not set a value yet. Store the goal that
> was active at the time of recording so streak calculations remain historically correct
> even if the user later changes their goal.
>
> The step/sleep mappings in `health_connect_mappings` still hold their own
> `step_goal` / `sleep_hours` threshold for `evaluateThreshold()`, but the global
> goal in `health_connect_meta` is the canonical display goal used for history rows,
> graph colouring, and streak calculations.

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
| `healthConnectStorage.ts` | Add `upsertStepsDay()`, `getStepsHistory()`, `upsertSleepDay()`, `getSleepHistory()`, `getGoalSettings()`, `saveGoalSettings()` | History persistence + unified goal management |
| `CreatePermanentTaskScreen.tsx` | **None** | Untouched |
| `database.ts` (schema init) | Add `createHealthConnectSchema()` call | New schema only |
| `useTasks.ts` | Subscribe to `DeviceEventEmitter('healthConnectSyncComplete')` → call `loadTasks()` | ~5 lines |
| `App.tsx` / `index.js` | Call `healthConnectActions.sync()` once after DB init (fire-and-forget) | App-start sync; does not block render |
| `MainNavigator.tsx` | Add `AppState` listener → `healthConnectActions.sync()` on foreground (catch-up) | ~5 lines |
| `index.js` | Register Headless JS task for background sync | ~4 lines |
| `AndroidManifest.xml` | Add HC service declaration for Android 14+ battery exemption | ~8 lines |
| `HealthManagementScreen.tsx` | Hub screen: status badge + three tappable section rows | New implementation |
| `StepsDetailScreen.tsx` | New — full steps detail view | New file |
| `SleepDetailScreen.tsx` | New — full sleep detail view | New file |
| `WorkoutsDetailScreen.tsx` | New — workouts + mappings | New file |
| `BrowseNavigator.tsx` (or equivalent) | Add routes for StepsDetailScreen, SleepDetailScreen, WorkoutsDetailScreen | Register new screens |

---

## 11. Directory Structure & New Files

The Health Connect feature follows the same pattern as `app/features/permanentTask/`.
All backend lives under `app/features/googlefit/`. UI screens live in
`app/screens/browse/`. Shared display components live in `app/components/healthConnect/`.

```
app/
├── features/
│   └── googlefit/
│       ├── types/
│       │   └── healthConnect.ts          # All HC-specific TS types: HealthConnectMapping,
│       │                                 # TodaySummary, WorkoutSession, HealthConnectStatus,
│       │                                 # StepsDayRecord, SleepDayRecord, StepsStats, SleepStats,
│       │                                 # SleepStageBreakdown, EXERCISE_TYPE_LABELS
│       ├── utils/
│       │   ├── healthConnectActions.ts   # checkStatus, requestPermissions, getTodaySummary, sync
│       │   │                             # getGoalSettings, saveGoalSettings
│       │   │                             # sync() writes history rows + evaluates thresholds
│       │   ├── healthConnectUtils.ts     # evaluateThreshold, createDefaultInstance,
│       │   │                             # pruneOrphanedMappings, computeStepsStats, computeSleepStats
│       └── storage/
│           ├── schema/
│           │   └── healthConnect.ts      # DDL: health_connect_mappings, health_connect_meta,
│           │                             #      health_steps_history, health_sleep_history
│           └── healthConnectStorage.ts   # saveMapping, getAllEnabledMappings, deleteMapping,
│                                         # getMappingById, setLastSyncedAt, getLastSyncedAt,
│                                         # pruneOrphanedMappings,
│                                         # upsertStepsDay, getStepsHistory(startDate, endDate),
│                                         # upsertSleepDay, getSleepHistory(startDate, endDate),
│                                         # getGoalSettings, saveGoalSettings
│
├── components/
│   └── healthConnect/
│       ├── HealthConnectStatusBadge.tsx  # Connection status badge (new — HC-specific)
│       └── HealthSectionRow.tsx          # Tappable summary row used on the main hub screen
│                                         # (icon + title + today's key stat + chevron)
│
│   # ── Reused from app/components/stats/ — no changes to these files ──────────
│   #   WeekBarGraph        →  7-day chart in Steps + Sleep detail screens
│   #   MonthCalendarGraph  →  monthly calendar in Steps + Sleep detail screens
│   #   TimeRangePicker     →  Week/Month toggle in Steps + Sleep detail screens
│   #   StreakCard          →  streak stats in Steps + Sleep detail screens
│   #   CircularProgress    →  today's step progress ring in StepsDetailScreen
│   #   CompletionSummaryCard → last-night sleep ring in SleepDetailScreen
│   #
│   # NOT needed (dropped from earlier plan):
│   #   StepsSectionCard.tsx  — replaced by StepsDetailScreen (full screen)
│   #   SleepSectionCard.tsx  — replaced by SleepDetailScreen (full screen)
│   #   WorkoutsSectionCard.tsx — replaced by WorkoutsDetailScreen (full screen)
│   #   HealthBarChart.tsx    — WeekBarGraph covers this entirely
│   #   HealthStatsPanel.tsx  — StreakCard + inline row covers this
│
└── screens/
    └── browse/
        ├── HealthManagementScreen.tsx    # Hub: status badge + three HealthSectionRow tappable rows
        ├── StepsDetailScreen.tsx         # Full steps view: ring + goal + toggle + charts + stats + mappings
        ├── SleepDetailScreen.tsx         # Full sleep view: ring + goal + toggle + stage bar + charts + stats + mappings
        ├── WorkoutsDetailScreen.tsx      # Today's sessions + mapping rows (no charts)
        └── HealthMappingEditor.tsx       # Add/edit/delete a single mapping
```

### File responsibilities

| File | Purpose |
|------|---------|
| `features/googlefit/types/healthConnect.ts` | All types: `HealthConnectMapping`, `TodaySummary`, `WorkoutSession`, `HealthConnectStatus`, `HealthDataType`, `StepsDayRecord`, `SleepDayRecord`, `StepsStats`, `SleepStats`, `SleepStageBreakdown`, `HealthGoalSettings`, `EXERCISE_TYPE_LABELS` |
| `features/googlefit/utils/healthConnectActions.ts` | `checkStatus()`, `requestPermissions()`, `getTodaySummary()`, `sync()`, `getGoalSettings()`, `saveGoalSettings()` |
| `features/googlefit/utils/healthConnectUtils.ts` | `evaluateThreshold()`, `createDefaultInstance()`, `pruneOrphanedMappings()`, `computeStepsStats(history)`, `computeSleepStats(history)` |
| `features/googlefit/storage/schema/healthConnect.ts` | `createHealthConnectSchema()` — DDL for all four tables |
| `features/googlefit/storage/healthConnectStorage.ts` | Mapping CRUD + meta + steps/sleep history upsert/query + `getGoalSettings()` / `saveGoalSettings()` |
| `components/healthConnect/HealthConnectStatusBadge.tsx` | HC-specific status badge |
| `components/healthConnect/HealthSectionRow.tsx` | Tappable row component for the hub screen |
| `components/stats/detail/shared/WeekBarGraph` | **Reused as-is** — per-bar colour override via `DayData.color` where supported |
| `components/stats/detail/shared/MonthCalendarGraph` | **Reused as-is** |
| `components/stats/detail/shared/TimeRangePicker` | **Reused as-is** |
| `components/stats/detail/shared/StreakCard` | **Reused as-is** |
| `components/stats/CircularProgress` | **Reused as-is** |
| `components/stats/detail/shared/CompletionSummaryCard` | **Reused as-is** |
| `screens/browse/HealthManagementScreen.tsx` | Hub screen — status badge + three `HealthSectionRow` rows |
| `screens/browse/StepsDetailScreen.tsx` | Full steps detail — ring + goal edit + colour toggle + charts + stats + mappings |
| `screens/browse/SleepDetailScreen.tsx` | Full sleep detail — ring + goal edit + colour toggle + stage bar + charts + stats + mappings |
| `screens/browse/WorkoutsDetailScreen.tsx` | Today's workouts + mapping rows (no charts, no stats) |
| `screens/browse/HealthMappingEditor.tsx` | Template picker + threshold fields + auto-schedule toggle |

### Schema init

`features/googlefit/storage/schema/healthConnect.ts` exports
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
| P1 | Verify Expo managed vs bare workflow compatibility. If bare needed, plan migration | `[x]` |
| P2 | Install `react-native-health-connect`, test basic HC read on physical Android device | `[x]` |
| P3 | Create schema file — DDL for all HC tables (actual path: `core/services/storage/schema/healthConnect.ts`) | `[x]` |
| P4 | Wire `initializeHealthConnectSchema()` into `core/services/storage/schema/index.ts` as Step 7 | `[x]` |

### Phase 2 — Storage Layer

> **Note:** Storage lives in `core/services/storage/healthConnectStorage.ts` (not `features/googlefit/storage/`) to match the existing project architecture pattern.

| # | Task | Status |
|---|------|--------|
| D1 | Build `healthConnectStorage.ts` — `saveMapping`, `getAllEnabledMappings` (orphan-filtered via INNER JOIN), `getAllMappings`, `deleteMapping`, `setLastSyncedAt`, `getLastSyncedAt`, goal getters/setters | `[x]` |
| D2 | `findTodaysPendingInstance(permanentId)` — implemented as private helper inside `healthConnectActions.ts` (queries tasks + template_instances directly; same result as plan) | `[x]` |
| D3 | `upsertStepsForDate(date, steps)` + `getStepsInRange(from, to)` + `getStepsPersonalBest()` in `healthConnectStorage.ts` | `[x]` |
| D4 | `upsertSleepForDate(date, hours)` + `getSleepInRange(from, to)` + `getSleepPersonalBest()` in `healthConnectStorage.ts` | `[x]` |

### Phase 3 — Business Logic Layer

| # | Task | Status |
|---|------|--------|
| S1 | Build `features/googleFit/types/healthConnect.ts` — `HealthDataType`, `ExerciseTypeValue`, `ExerciseTypeMap`, `HealthConnectMapping`, `WorkoutSession`, `TodaySummary`, `HealthConnectStatus` | `[x]` |
| S2 | `checkStatus()` — maps `getSdkStatus()` to `HealthConnectStatus` enum | `[x]` |
| S3 | `requestPermissions()` — Steps + SleepSession + ExerciseSession read permissions | `[x]` |
| S4 | `getTodaySummary()` — steps (sum intervals since midnight), sleep (24h lookback + endTime filter), workouts (ExerciseSession since midnight) | `[x]` |
| S5 | `evaluateThreshold()` — private function in `healthConnectActions.ts` | `[x]` |
| S6 | `createDefaultInstance()` — inline inside `sync()` | `[x]` |
| S7 | `pruneOrphanedMappings()` — in `healthConnectStorage.ts`, called from `sync()` | `[x]` |
| S8 | `computeStepsStats()` — `healthConnectUtils.ts` | `[x]` |
| S9 | `computeSleepStats()` — `healthConnectUtils.ts` | `[x]` |
| S10 | `sync()` — status check → summary → upsert history → prune → evaluate mappings → auto-complete today-only instances | `[x]` |
| S11 | Goal getters/setters (`getStepsGoal`, `setStepsGoal`, `getSleepGoal`, `setSleepGoal`, `getStepsColorEnabled`, `getSleepColorEnabled`, etc.) in `healthConnectStorage.ts` | `[x]` |
| S12 | Subscribe to `healthConnectSyncComplete` in `useTasks.ts` + emit in `healthConnectActions.ts` | `[x]` |
| S13 | Wire `sync()` fire-and-forget in `App.tsx` after DB init | `[x]` |
| S14 | Wire `sync()` into `AppState` foreground listener in `MainNavigator.tsx` | `[x]` |
| S15 | `index.ts` — `BackgroundFetch.configure()` + `registerHeadlessTask()` | `[x]` |

### Phase 4 — UI

No new chart or stats primitives need to be built — existing stats components are
reused directly. The new UI files below are full screens, not inline cards.

All components must use `useTheme()` throughout — no hardcoded hex values.
Test both light and dark modes on device before marking any UI task complete.

| # | Task | Status |
|---|------|--------|
| U1 | `HealthConnectStatusBadge` — inline in `HealthManagementScreen` (dot + label) | `[x]` |
| U2 | `HealthSectionRow` — tappable row with icon + title + today's key stat + `›` chevron, inline in `HealthManagementScreen` | `[x]` |
| U3 | Rewrite `HealthManagementScreen` — status badge + three section rows + Sync Now + "Last synced". Sub-screen routing to detail screens. | `[x]` |
| U4 | Build `StepsDetailScreen` — ring + goal edit + colour toggle + charts + stats + `StreakCard` + mapping rows | `[x]` |
| U5 | Build `SleepDetailScreen` — ring + goal edit + colour toggle + stage bar + charts + stats + `StreakCard` + mapping rows | `[x]` |
| U6 | Build `WorkoutsDetailScreen` — today's sessions list + mapping rows + "Add" button (hooks violation fixed) | `[x]` |
| U7 | Build `HealthMappingEditor` — template picker + threshold fields + exercise type picker + auto-schedule toggle | `[x]` |
| U8 | Detail screens navigate via local sub-screen state in `HealthManagementScreen` — no separate navigator registration needed | `[x]` |

### Phase 5 — Testing

| # | Task | Status |
|---|------|--------|
| T1 | Steps: walk → today's count updates on app-start sync, ring turns green when goal met | `[ ]` |
| T2 | Steps: week bar graph — bars for goal-met days are green, other days use accent colour | `[ ]` |
| T3 | Steps: goal colour toggle off → all bars use accent colour regardless of goal | `[ ]` |
| T4 | Steps: monthly view → calendar cells green for goal-met days when toggle on | `[ ]` |
| T5 | Steps: week avg and month avg values match manual calculation | `[ ]` |
| T6 | Steps: add mapping → reach step goal → task auto-completes (today's instance only) | `[ ]` |
| T7 | Steps: task from yesterday with same template NOT completed by today's sync | `[ ]` |
| T8 | Sleep: log overnight sleep → open app → last night ring shown, green when goal met | `[ ]` |
| T9 | Sleep: week bar graph + monthly calendar green colouring mirrors goal status | `[ ]` |
| T10 | Sleep: goal colour toggle off → all bars/cells revert to accent colour | `[ ]` |
| T11 | Sleep: add mapping → sleep meets threshold → today's task auto-completes | `[ ]` |
| T12 | Sleep edge case: session 11 PM–7 AM → counted for "today" (endTime filter) | `[ ]` |
| T13 | Sleep extreme case: 14h session started yesterday afternoon, ended today → captured by 24h lookback | `[ ]` |
| T14 | Sleep: no stage data → stage bar hidden, no crash | `[ ]` |
| T15 | Workout: log session → sessions list shows correct type + duration | `[ ]` |
| T16 | Workout: mapping completes today's instance, not yesterday's recurring instance | `[ ]` |
| T17 | `autoSchedule = true` with no instance today → default created + completed | `[ ]` |
| T18 | User manually completes task → next sync does NOT double-complete | `[ ]` |
| T19 | Open app twice after threshold met → task NOT double-completed | `[ ]` |
| T20 | Permission denial → no crash, Health screen shows "Grant" | `[ ]` |
| T21 | Repeatable template → next occurrence scheduled correctly after HC auto-complete | `[ ]` |
| T22 | Delete template with mapping → orphan invisible to sync, pruned when Health screen opens | `[ ]` |
| T23 | Dark mode: all health screens / detail screens render correctly with theme colours | `[ ]` |
| T24 | Light mode: same screens, verify no hardcoded colours bleed through | `[ ]` |

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
| Steps/sleep history grows unboundedly | Add a periodic trim (e.g. keep last 90 days) inside `upsertStepsDay` / `upsertSleepDay`. Low priority — SQLite handles thousands of rows fine, but worth capping for cleanliness |
| No sleep data on device | `getTodaySummary()` returns `sleepHours: null`; SleepSectionCard shows "No sleep data" rather than an empty chart. `upsertSleepDay` is not called for null values |
| Sleep stage data absent (most devices) | `SleepStageBreakdown` is null; stage bar is hidden. All other sleep UI remains visible |
| Streak calculation expensive on large history | `computeStepsStats` / `computeSleepStats` run in JS over at most 90 rows — trivially fast. No DB-side streak computation needed |
| Orphaned mappings after template deletion | `getAllEnabledMappings()` INNER JOINs against `templates` — orphans are invisible to sync. `pruneOrphanedMappings()` cleans them when the Health screen opens. |
| Double-completion (sync + manual, or two sync runs) | `getPendingInstanceByTemplateId()` filters `completed = 0` — handles both cases naturally, no date guard needed |
| Android 14+ kills background job | Service declared in `AndroidManifest.xml` with health category; app-start sync is always the guaranteed catch-up |
| Background sync native module complexity | Fall back to foreground-only sync if needed; show "Syncing…" indicator on task list to manage user expectation |
| Multiple templates mapped to same workout type | Each mapping evaluated independently — all matching pending instances complete. Intended. |
| Repeatability broken by HC completion | HC uses `taskActions.completeTask()` — identical to manual tap; `createNextRecurringInstance()` fires normally |
| App-start sync blocks render | `sync()` is fire-and-forget — `then()` with no await. Never block the navigator mount on sync completion |
| Goal colour toggle ignored on MonthCalendarGraph | `MonthCalendarGraph` already colours by fill ratio. When toggle is off, pass a neutral accent for the 100% colour; when on, pass `theme.colors.success` for cells with `completed >= total` |
| WeekBarGraph does not support per-bar colour | Check at implementation time. If `DayData.color` is not supported, create a thin wrapper component `HealthWeekBarGraph` that renders coloured bars by conditional styling at the call site only — do not modify the original `WeekBarGraph` |
| Dark mode: hardcoded colours in health screens | Enforce `useTheme()` for all colour references in health components. No hex literals outside theme tokens |
