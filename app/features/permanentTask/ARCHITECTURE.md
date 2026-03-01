# Permanent Task Architecture

A permanent task is a **reusable task template** that produces independent
**instances** each time it is used. Think of it like a recipe card (template)
and the meals you cook from it (instances).

---

## Concepts at a Glance

| Concept | What it is | Stored in |
|---------|-----------|-----------|
| **Template** | Reusable blueprint — title, location, auto-repeat config, category | `templates` table |
| **Instance** | A single "use" of a template with its own due date and completion state | `tasks` + `template_instances` tables |
| **Completion log** | Append-only event record — every completion ever, permanent | `completion_log` table |
| **Archive** | Compressed snapshot of completed instances, written by midnight job | `task_archive` table |

---

## Database Schema

### `templates`
Stores template definitions. One row per template. Never archived.

```sql
permanentId  TEXT PRIMARY KEY   -- perm_<ts>_<rand>
templateTitle TEXT NOT NULL
isTemplate   INTEGER NOT NULL DEFAULT 1  -- always 1
instanceCount INTEGER NOT NULL DEFAULT 0 -- total instances ever created (denominator for stats)
autoRepeat   TEXT               -- JSON: { enabled, frequency, dayOfWeek?, dayOfMonth? }
location     TEXT
createdAt    INTEGER NOT NULL   -- Unix ms
category_id  TEXT               -- FK → categories (migration-added column)
```

### `template_instances`
Junction table linking every instance back to its template.

```sql
instanceId   TEXT NOT NULL      -- inst_<ts>_<rand> — also the PK in tasks
templateId   TEXT NOT NULL      -- FK → templates.permanentId ON DELETE CASCADE
createdAt    INTEGER NOT NULL
dueDate      INTEGER            -- Unix ms (migration-added)
category_id  TEXT               -- mirrors tasks.category_id (migration-added)
PRIMARY KEY (instanceId, templateId)
FOREIGN KEY (instanceId) REFERENCES tasks(id) ON DELETE CASCADE
FOREIGN KEY (templateId) REFERENCES templates(permanentId) ON DELETE CASCADE
```

> **Note:** SQLite FK enforcement is OFF by default. The `ON DELETE CASCADE`
> clauses exist but are not guaranteed to fire unless `PRAGMA foreign_keys = ON`
> is set. The archival service handles cleanup explicitly.

### `tasks` (shared with one-off tasks)
Every instance also lives here so `getAllTasks()` can return everything in one
query. Permanent instances are indistinguishable from one-off tasks at the SQL
level — they are enriched by joining `template_instances` at read time.

```sql
id           TEXT PRIMARY KEY   -- matches template_instances.instanceId
title        TEXT NOT NULL
completed    INTEGER DEFAULT 0
created_at   INTEGER NOT NULL
due_date     INTEGER
category_id  TEXT
completed_at INTEGER            -- set at completion time, required for archival
```

### `template_stats`
Legacy per-template stats table — written on completion but not used by the
active stats system (which reads `completion_log` instead).

```sql
templateId       TEXT PRIMARY KEY
completionCount  INTEGER
completionRate   REAL
currentStreak    INTEGER
maxStreak        INTEGER
completionMon–Sun REAL          -- day-of-week breakdown
lastUpdatedAt    INTEGER
```

### `completion_log` (append-only, never deleted)
The authoritative source for all stats. Records every real completion and every
auto-fail event. Permanent instances are recorded with both `task_id` and
`template_id` so you can query by either.

```sql
id            TEXT PRIMARY KEY
task_id       TEXT        -- snapshot, not FK — survives archival
template_id   TEXT        -- null for one-off tasks
category_id   TEXT        -- snapshot at completion time
outcome       TEXT        -- 'completed' | 'auto_failed'
task_kind     TEXT        -- 'one_off' | 'permanent'
completed_at  INTEGER
scheduled_date TEXT        -- 'YYYY-MM-DD' local date
```

### `task_archive` (written by midnight job)
Compressed snapshot of completed tasks after the midnight job sweeps them.
Shown on Browse → History.

```sql
id            TEXT PRIMARY KEY  -- same as tasks.id / template_instances.instanceId
title         TEXT NOT NULL
category_id   TEXT
category_name TEXT              -- denormalized at archive time
completed_at  INTEGER NOT NULL
archived_at   INTEGER NOT NULL
was_recurring INTEGER NOT NULL DEFAULT 0  -- 1 if this was a permanent instance
```

---

## ID Scheme

```
Template:   perm_<timestamp>_<random7>   e.g. perm_1738000000000_a3f7x2k
Instance:   inst_<timestamp>_<random7>   e.g. inst_1738086400000_b9c2m1z
```

For templates, `id === permanentId` (both fields hold the same `perm_*` value).
For instances, `id` is the `inst_*` value and `permanentId` points to the
parent template.

---

## TypeScript Types

### `PermanentTask` (`types/permanentTask.ts`)
One interface represents both templates and instances. The `isTemplate` flag
differentiates them.

```ts
interface PermanentTask {
  id: string;             // inst_* for instances, perm_* for templates
  permanentId: string;    // always the perm_* template ID
  title?: string;         // optional instance-specific title override
  templateTitle: string;  // inherited from template
  isTemplate: boolean;
  createdAt: number;      // Unix ms
  dueDate?: number;       // Unix ms, instances only
  location?: string;
  autoRepeat?: Record<string, any>;
  instanceCount?: number; // templates only
  completed?: boolean;    // instances only
  categoryId?: string;
}
```

### `Task` (core type, `core/types/task.ts`)
The universal task type used by the UI. Permanent instances are surfaced as
`Task` objects with `kind: 'permanent'` and a `metadata` block reconstructed
from the DB join. Templates are NOT surfaced as `Task` objects in the task list
— they only appear in the template picker.

```ts
// When kind === 'permanent', metadata contains:
metadata: {
  permanentId: string;     // perm_* template ID
  templateTitle: string;
  isTemplate: boolean;     // false for instances
  autoRepeat?: any;
}
```

---

## Lifecycle

```
[User] CreatePermanentTaskScreen
        │
        ▼
  createTask(title, 'permanent', { ... })   ← taskActions.ts
        │
        ▼
  createPermanentTask()                      ← permanentTaskActions.ts
        │
        ├── CASE: no templateId → create new template
        │     createTemplate()  → savePermanentTemplate()
        │     Writes: templates, template_stats (INSERT OR IGNORE)
        │
        └── CASE: templateId provided → create instance
              createInstance() → savePermanentInstance()
              Writes: template_instances, tasks
              incrementTemplateInstanceCount()
              Writes: templates.instanceCount += 1  (exactly once, here only)

[User] Taps ✓ on an instance in the task list
        │
        ▼
  completeTask(task)                         ← taskActions.ts
        │
        ▼
  handlePermanentCompletion()                ← permanentTaskActions.ts
        │
        ├── updateTemplateStats()
        │     Writes: template_stats
        └── saveTask({ completed: true, completedAt })
              Writes: tasks
        │
        ▼
  logCompletion()                            ← taskActions.ts (after completeTask)
        Writes: completion_log

[Midnight job] runMidnightJob()              ← useTasks useEffect, once per day
        │
        ├── 1. autoFailOverdueTasks()
        │       Reads:  tasks (via getAllTasks)
        │       Writes: completion_log (auto_failed events)
        │               tasks (pushes due date +1 day)
        │
        ├── 2. autoScheduleRecurringTasks()
        │       Reads:  templates (autoRepeat config)
        │               tasks (checks for pending instance)
        │               completion_log (last completion time)
        │       Writes: template_instances + tasks (new instance)
        │
        └── 3. archiveCompletedTasks()
                Reads:  tasks WHERE completed=1 AND completed_at IS NOT NULL
                        + LEFT JOIN categories, template_instances
                Writes: task_archive (INSERT OR IGNORE)
                Delete: tasks WHERE id IN (archived ids)
                Delete: template_instances WHERE instanceId IN (recurring ids)
```

---

## File Map

### Storage Layer
| File | Purpose |
|------|---------|
| `schema/permanentTask.ts` | DDL for `templates`, `template_instances`, `template_stats`. Inline migrations add `dueDate`, `category_id` columns. |
| `schema/archive.ts` | DDL for `task_archive`. |
| `storage/permanentTaskStorage.ts` | All SQL for templates and instances. CRUD for both, `getAllInstanceMetaSync()` (batched read for `getAllTasks()`), `updateTemplateCategoryInInstances()`. |
| `storage/taskStorage.ts` | `getAllTasks()` joins `template_instances` via `getAllInstanceMetaSync()` to reconstruct `kind: 'permanent'` on task objects. `saveTask()` writes the `tasks` table. |
| `storage/statsStorage.ts` | All stats reads/writes via `completion_log`. Never touches `template_instances`. `getLastCompletionTimestamp(templateId)` used by midnight scheduler. |
| `services/archivalService.ts` | `archiveCompletedTasks()` — sweeps completed tasks from `tasks` into `task_archive`. |

### Business Logic Layer
| File | Purpose |
|------|---------|
| `features/permanentTask/utils/permanentTaskFactory.ts` | Pure factory functions: `createTemplate()`, `createInstance()`, ID generators, validators. No DB calls. |
| `features/permanentTask/utils/permanentTaskActions.ts` | Business logic: `createPermanentTask()`, `handlePermanentCompletion()`, `deletePermanentTask()`, `reassignPermanentTask()`, `pushPermanentTaskForward()`. Coordinates factory + storage. |
| `core/domain/taskActions.ts` | Universal router. `completeTask()` delegates to `handlePermanentCompletion()` for `kind === 'permanent'`. Also owns `runMidnightJob()` and `autoScheduleRecurringTasks()`. |

### Hook
| File | Purpose |
|------|---------|
| `core/hooks/useTasks.ts` | `useEffect` calls `runMidnightJob().then(loadTasks)` on mount. `loadTasks` calls `getAllTasks()` which enriches tasks with permanent metadata via the JOIN. |

### UI Screens
| Screen | Purpose |
|--------|---------|
| `CreatePermanentTaskScreen` | Create a new template. Fields: title (required), category, location, auto-repeat (enabled + frequency). Calls `createTask(title, 'permanent', { templateTitle, location, autoRepeat, categoryId })`. |
| `UsePermanentTaskScreen` | Pick a template and stamp out an instance with a due date. Calls `createTask(title, 'permanent', { templateId, dueDate })`. Also has ⋮ menu for Edit/Delete template. |
| `EditPermanentTaskScreen` | Edit an existing template's title, location, auto-repeat, category. On category change, calls `updateTemplateCategoryInInstances()` to cascade to all instances. Calls `savePermanentTemplate()` directly. |
| `AllTasksScreen` | Shows all tasks including permanent instances (via `useTasks`). Instances display with a repeat badge if `kind === 'permanent'`. |
| `TodayScreen` | Same task list filtered to today's due date. Permanent instances appear when `dueDate` is today. |
| `StatsScreen` | Lists permanent task templates with stats (completion count, rate). Tapping a card opens `PermanentDetailScreen`. |
| `PermanentDetailScreen` | Full stats for one template: completion ring, streak pills, bar graphs, calendar, day-of-week breakdown. Reads from `completion_log` via `useStats().getPermanentDetail(id)`. |
| `HistoryManagementScreen` | Browse → History. Shows archived tasks from `task_archive`, filtered by date range. Permanent instances show 🔁 badge. |

---

## How an Instance Appears in the UI

`getAllTasks()` runs two queries:

1. `SELECT * FROM tasks ORDER BY created_at DESC` — gets all rows (one-off + permanent instances).
2. `getAllInstanceMetaSync()` — single `JOIN templates ON template_instances` query, returns a `Map<instanceId, { templateId, templateTitle, autoRepeat }>`.

For each task row, it checks if the instance's ID is in the map. If it is, the
row gets `kind: 'permanent'` and a `metadata` block. One-off tasks get no
`kind` field.

The UI components (`AllTasksScreen`, `TodayScreen`) use `task.kind === 'permanent'`
to decide which badge or visual treatment to show.

---

## Auto-Repeat Scheduling

`autoRepeat` is stored as JSON on the template:

```json
{ "enabled": true, "frequency": "daily" }
{ "enabled": true, "frequency": "weekly", "dayOfWeek": 1 }
{ "enabled": true, "frequency": "monthly", "dayOfMonth": 15 }
```

`autoScheduleRecurringTasks()` (midnight job step 2) reads all templates,
filters to those with `autoRepeat.enabled === true` and a frequency, then:

1. Skips if a pending (incomplete) instance already exists for this template.
2. Skips if the template has never been completed (`completion_log` has no entry).
3. Computes next due date from `computeNextDueDate(autoRepeat, lastCompletedAt)`.
4. Calls `createTask(title, 'permanent', { templateId, dueDate, categoryId })`.

> Both `computeNextDueDate` (midnight scheduler) and `createNextRecurringInstance`
> (factory) read `autoRepeat.frequency ?? autoRepeat.interval`, making them
> consistent with templates from all app versions.

---

## Category Cascade

When a template's category changes (`EditPermanentTaskScreen`), two extra
updates must happen:

```sql
UPDATE template_instances SET category_id = ? WHERE templateId = ?
UPDATE tasks SET category_id = ?
  WHERE id IN (SELECT instanceId FROM template_instances WHERE templateId = ?)
```

This is done by `updateTemplateCategoryInInstances()` in `permanentTaskStorage.ts`.

`completion_log` is **never updated** — historical completions are immutable
and remain under the category they were completed in.

---

## Stats

### Active stats system (`completion_log`)
All stats shown to the user come from `completion_log`, which is written once
per completion and never modified. Key functions in `statsStorage.ts`:

- `getLastCompletionTimestamp(templateId)` — used by scheduler
- `getPermanentTaskSummariesForCategory(categoryId)` — completion counts per template within a category, uses `GROUP BY cl.template_id` directly (archival-safe)
- `getPermanentDetail(templateId)` — full detail stats for `PermanentDetailScreen`

### Legacy stats (`template_stats`)
Written by `updateTemplateStats()` on every completion. Fields: `completionCount`,
`completionRate`, `currentStreak`, `maxStreak`, day-of-week tallies. This table
is **not read** by any active UI component and exists as a residual from Sprint 3.

---

## Archival Behaviour

The midnight job's final step (`archiveCompletedTasks`) moves completed instances
out of `tasks` and into `task_archive`. Key points:

- **What gets archived:** rows in `tasks` WHERE `completed = 1 AND completed_at IS NOT NULL`.
- **`was_recurring` flag:** set to `1` if a matching row exists in `template_instances`.
- **`instanceCount` is not decremented:** it is a historical count used as the stats denominator. Decrementing on archival would corrupt completion rates.
- **`template_instances` rows are deleted** for archived instances (step 5 of archival).
- **`completion_log` is never touched** — append-only, archival-safe source of truth.
- After archival, `getAllInstanceMetaSync()` returns no entry for the archived instance, so `getAllTasks()` reconstructs those rows as `kind: undefined` (one-off) if they somehow remain in `tasks` — they should be gone after step 4.

---

## Design Invariants

### `instanceCount` is incremented exactly once per instance
`savePermanentInstance` only writes the `template_instances` row — it does not
touch `instanceCount`. `incrementTemplateInstanceCount` is a separate function
called explicitly in `createPermanentTask` immediately after `savePermanentInstance`,
so the counter ticks once at creation and never again on update or completion.

### Completion state lives in `tasks`, not `template_instances`
`template_instances` has no `completed` column. `handlePermanentCompletion`
writes only `tasks` (via `saveTask`) and `template_stats` (via `updateTemplateStats`).
It does **not** call `savePermanentInstance`.

### `deletePermanentTemplate` deletes from `tasks` first
The delete order is: `tasks` → `template_instances` → `templates` → `template_stats`.
`tasks` is cleaned via a subquery against `template_instances` while that table
still exists. With `PRAGMA foreign_keys = ON` the cascade handles this
automatically; the explicit delete is a safe no-op in that case.

### FK enforcement is enabled
`database.ts` runs `PRAGMA foreign_keys = ON` immediately after opening the
connection, so `ON DELETE CASCADE` on `template_instances` fires correctly.

### Both schedulers read `frequency ?? interval`
`computeNextDueDate` (midnight scheduler in `taskActions.ts`) and
`createNextRecurringInstance` (factory) both use `autoRepeat.frequency ?? autoRepeat.interval`,
making them consistent with templates from all app versions.
