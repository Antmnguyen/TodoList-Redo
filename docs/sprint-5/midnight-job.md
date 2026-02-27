# Midnight Job — Implementation & Date Gate

> **Status: COMPLETE** — Implemented 2026-02-27.
> Modified files: `taskActions.ts`, `appSettingsStorage.ts` (new),
> `schema/appSettings.ts` (new), `schema/index.ts`.

---

## What This Is

`runMidnightJob()` is the single entry point for all once-per-day app maintenance.
It is called from `useTasks` on mount, runs before the task list loads, and ensures
the app always starts in a consistent state.

Current jobs, in execution order:

| # | Function | What it does |
|---|----------|-------------|
| 1 | `autoFailOverdueTasks()` | Finds overdue incomplete tasks, logs `auto_failed` to `completion_log`, pushes each forward 1 day |
| 2 | `autoScheduleRecurringTasks()` | Creates the next pending instance for auto-repeat templates that have no pending instance |
| 3 | `archiveCompletedTasks()` | *(future — Sprint 5 §2.4)* Moves completed tasks to `task_archive` |

Job order matters: `autoFail` runs first so that overdue-but-still-pending instances are
correctly detected by the scheduler's "pending instance exists" guard in step 2.

---

## The Problem With the Original Implementation

The first version used a module-level boolean:

```typescript
let _midnightJobRan = false;

export async function runMidnightJob(): Promise<void> {
  if (_midnightJobRan) return;
  _midnightJobRan = true;
  // ...
}
```

**This did not enforce a midnight gate.** A module variable lives in RAM and resets
every time the JS engine process starts (i.e. every cold start). The job would run:

- At 9 AM if the user opened the app
- Again at 9:05 AM if the user force-quit and reopened

There was no check of what *date* (or *time*) it was. The name "midnight job" was
aspirational — the implementation was just "once per session".

---

## The Fix — Two-Layer Gate

The real gate uses **two layers**:

```
runMidnightJob() called
    │
    ├── Layer 1: _midnightJobRanThisSession (module bool, RAM only)
    │     → true:  skip (no DB read needed — already ran this session)
    │     → false: continue to layer 2
    │
    └── Layer 2: app_settings['midnight_job_last_run_date'] (SQLite, persists across cold starts)
          → stored date == today:  job already ran today, set layer 1 flag, return
          → stored date != today:  run jobs, then write today's date to SQLite
```

Layer 1 prevents redundant SQLite reads when `useTasks` remounts within a session
(navigation between tabs triggers remounts). Layer 2 is the real correctness guarantee.

### Why SQLite instead of AsyncStorage

`@react-native-async-storage/async-storage` is not installed in this project.
SQLite is already used for everything else — adding a two-column `app_settings`
table to the same database requires no new package, no new build step, and stays
consistent with the storage architecture.

---

## New Files

### `app/core/services/storage/schema/appSettings.ts`

Creates the `app_settings` table:

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

A general-purpose key-value store for app-level persistent state that doesn't
belong in any feature table. Keys and values are both TEXT — callers are
responsible for any serialisation (e.g. date strings, JSON).

Registered as **step 5** in `schema/index.ts` (last, no dependencies on other tables).

### `app/core/services/storage/appSettingsStorage.ts`

Two synchronous helpers (matching the sync API style of the rest of the storage layer):

```typescript
getAppSetting(key: string): string | null
setAppSetting(key: string, value: string): void
```

`getAppSetting` returns `null` (not `undefined`) if the key doesn't exist, so callers
can use strict equality: `if (getAppSetting('x') === null)`.

`setAppSetting` uses `INSERT OR REPLACE` — upsert behaviour, no separate create/update
paths needed.

---

## Current `app_settings` Keys

| Key | Value format | Written by | Read by |
|-----|-------------|------------|---------|
| `midnight_job_last_run_date` | `'YYYY-MM-DD'` local date string | `runMidnightJob` (after jobs complete) | `runMidnightJob` (at start, to gate the run) |

---

## Behaviour Table

| Scenario | Layer 1 | Layer 2 | Result |
|----------|---------|---------|--------|
| First ever app launch | false | null (key doesn't exist) | Jobs run, today's date written |
| Same session, useTasks remounts | true | not checked | Skipped (no DB read) |
| Force-quit, reopen same day | false | date == today | Skipped, layer 1 set to true |
| Force-quit, reopen next day | false | date != today | Jobs run, new date written |
| App crashes mid-job | false | date NOT written (write happens after) | Jobs retry on next open |

---

## Crash Safety

The SQLite date write happens **after** both jobs complete:

```typescript
await autoFailOverdueTasks();
await autoScheduleRecurringTasks();

setAppSetting(MIDNIGHT_JOB_DATE_KEY, today);  // ← written last
```

If the app crashes mid-job, the date is never written. On the next cold start,
the gate sees no stored date for today and reruns the jobs. Both jobs are
idempotent:

- `autoFailOverdueTasks`: pushes tasks that are already overdue — running twice
  on the same tasks just pushes them one more day (acceptable edge case).
- `autoScheduleRecurringTasks`: checks "pending instance exists" before creating —
  safe to call as many times as needed, will never create duplicates.

---

## Future Upgrade Path

The once-per-calendar-day gate is now correct. If stricter timing is ever needed
(e.g. "only run after midnight in the user's timezone"), the gate logic in
`runMidnightJob` is the only place to change — the storage and schema layers are
already in place and don't need modification.
