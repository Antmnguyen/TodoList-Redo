# Storage Architecture — Current State

**Last updated:** 2026-02-19
**Branch:** Sprint4
**Database:** SQLite via `expo-sqlite` (sync API, v16+)
**File:** `tasks.db`

---

## Overview

The app uses a single local SQLite database opened once at startup and shared via a module-level singleton in `database.ts`. All SQL is synchronous (expo-sqlite's sync API). Storage is split across three service files; each owns exactly the tables it touches. UI and hooks never import SQLite directly.

```
UI / Hooks
    │
    ▼
domain/taskActions.ts        ← universal dispatcher (routes by task.kind)
    │
    ├── core/services/storage/taskStorage.ts          → tasks table
    ├── core/services/storage/categoryStorage.ts      → categories table
    └── core/services/storage/permanentTaskStorage.ts → templates / template_instances / template_stats
                                                           │
                                                           └─ all via database.ts (single SQLite connection)
```

---

## Database Connection

**File:** `app/core/services/storage/database.ts`

```typescript
const db = SQLite.openDatabaseSync('tasks.db');
export { db };
```

One connection, opened synchronously at module load. All queries use `db.getAllSync` (SELECT) or `db.runSync` (INSERT / UPDATE / DELETE). No connection pooling — SQLite in-process does not need it.

---

## Schema Initialization

**File:** `app/core/services/storage/schema/index.ts`

Called once at app startup (in `App.tsx`). Runs all `CREATE TABLE IF NOT EXISTS` statements and any pending column-addition migrations (via `try { ALTER TABLE … } catch {}`).

**Initialization order:**
1. `initializeCoreSchema()` — creates `tasks`
2. `createPermanentTasksSchema()` — creates `templates`, `template_instances`, `template_stats`
3. `initializeCategoriesSchema()` — creates `categories`, seeds defaults

Migrations are inline `try/catch ALTER TABLE` blocks — not numbered migration files. This is adequate for a single-device local database.

---

## Tables

### `tasks`

**Schema file:** `schema/core.ts`
**Service:** `taskStorage.ts`

The central task table. Holds **both** one-off tasks and permanent task instances (instances are linked via the `template_instances` junction table).

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | `task_<timestamp>_<random>` |
| `title` | TEXT NOT NULL | |
| `completed` | INTEGER | 0 = false, 1 = true |
| `created_at` | INTEGER | Unix timestamp ms |
| `due_date` | INTEGER \| NULL | Unix timestamp ms |
| `category_id` | TEXT \| NULL | FK → categories.id (not enforced) |
| `completed_at` | INTEGER \| NULL | Set when task is marked complete; drives Sprint 4 time-range stats |

**Indexes:** None defined yet. `completed_at` and `category_id` will need indexes when stats queries are added.

**Gotcha:** Permanent task instances live in this table (they're real task rows) AND have a corresponding row in `template_instances`. To identify permanent instances: `id IN (SELECT instanceId FROM template_instances)`.

---

### `categories`

**Schema file:** `schema/categories.ts`
**Service:** `categoryStorage.ts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | `cat_<timestamp>_<random>` |
| `name` | TEXT NOT NULL | |
| `color` | TEXT \| NULL | Hex string e.g. `#FF9500` |
| `icon` | TEXT \| NULL | Emoji or icon name |
| `is_default` | INTEGER | 1 = seeded default (Lifestyle, Work, Health) |
| `created_at` | INTEGER | Unix timestamp ms |

**Seeded defaults:** Lifestyle, Work, Health — inserted once on first launch if the table is empty.

**Cascade behaviour:** `deleteCategory` manually NULLs `category_id` in `tasks`, `templates`, and `template_instances` before deleting the row (no foreign key constraint enforcement in SQLite by default).

---

### `templates`

**Schema file:** `schema/permanentTask.ts`
**Service:** `permanentTaskStorage.ts`

One row per permanent task **template** (the re-usable definition).

| Column | Type | Notes |
|--------|------|-------|
| `permanentId` | TEXT PK | |
| `templateTitle` | TEXT NOT NULL | |
| `isTemplate` | INTEGER | Always 1 for template rows |
| `instanceCount` | INTEGER | Denormalized count, incremented on each instance creation |
| `autoRepeat` | TEXT \| NULL | JSON-serialised repeat config |
| `location` | TEXT \| NULL | |
| `createdAt` | INTEGER | Unix timestamp ms |
| `category_id` | TEXT \| NULL | Added via migration |

---

### `template_instances`

**Schema file:** `schema/permanentTask.ts`
**Service:** `permanentTaskStorage.ts`

Junction table: links a task row (in `tasks`) to its parent template.

| Column | Type | Notes |
|--------|------|-------|
| `instanceId` | TEXT | FK → tasks.id (CASCADE DELETE) |
| `templateId` | TEXT | FK → templates.permanentId (CASCADE DELETE) |
| `createdAt` | INTEGER | Unix timestamp ms — when instance was created |
| `dueDate` | INTEGER \| NULL | Added via migration; kept in sync with tasks.due_date |
| `category_id` | TEXT \| NULL | Added via migration; usually mirrors the template's category |

**Primary key:** `(instanceId, templateId)`

---

### `template_stats`

**Schema file:** `schema/permanentTask.ts`
**Service:** `permanentTaskStorage.ts`

Pre-aggregated statistics for each template, updated incrementally when an instance is completed.

| Column | Type | Notes |
|--------|------|-------|
| `templateId` | TEXT PK | FK → templates.permanentId |
| `completionCount` | INTEGER | Total completions ever |
| `completionRate` | REAL | completionCount / instanceCount |
| `currentStreak` | INTEGER | ⚠️ Naive increment — not correct (see Issues) |
| `maxStreak` | INTEGER | ⚠️ Naive increment — not correct (see Issues) |
| `completionMon` – `completionSun` | REAL | All-time completions by weekday |
| `lastUpdatedAt` | INTEGER | Unix timestamp ms |

---

## Service Layer

### `taskStorage.ts`

Pure CRUD for the `tasks` table. No business logic.

| Function | SQL | Notes |
|----------|-----|-------|
| `getAllTasks()` | `SELECT * FROM tasks ORDER BY created_at DESC` | Returns full Task array |
| `saveTask(task)` | `INSERT OR REPLACE INTO tasks …` | Upsert — handles both create and update |
| `deleteTask(id)` | `DELETE FROM tasks WHERE id = ?` | |
| `updateTaskDueDate(id, date)` | `UPDATE tasks SET due_date = ? WHERE id = ?` | |
| `getTaskDueDate(id)` | `SELECT due_date FROM tasks WHERE id = ?` | |

---

### `categoryStorage.ts`

CRUD + basic stats for the `categories` table.

| Function | What it does |
|----------|-------------|
| `getAllCategories()` | Ordered by `is_default DESC, name ASC` |
| `getCategoryById(id)` | Single lookup |
| `getCategoryByName(name)` | Case-insensitive name match |
| `createCategory(name, color, icon)` | Uses `CategoryFactory.create()` |
| `updateCategory(id, updates)` | Dynamic SET clause |
| `deleteCategory(id)` | NULLs references, then deletes |
| `getCategoryStats(id)` | Queries `tasks` + `template_stats` for completion counts |
| `getAllCategoryStats()` | Maps `getCategoryStats` over all categories |
| `getTaskCountForCategory(id)` | One-off count + template count (not instance count) |
| `getTasksForCategory(id)` | Templates + one-off tasks for the category |

**Stats queries in `categoryStorage`** use `tasks.completed_at` for time-range filtering. This works for one-off tasks. For permanent instances it also works because instances are rows in `tasks` with `completed_at` set.

---

### `permanentTaskStorage.ts`

Template CRUD, instance CRUD, and stats updates.

| Function | What it does |
|----------|-------------|
| `savePermanentTemplate(t)` | Upserts template + initializes `template_stats` row |
| `getTemplateById(id)` | Single template lookup |
| `getAllTemplates()` | All `isTemplate = 1` rows |
| `getTemplateWithStats(id)` | Template + its stats row joined |
| `deletePermanentTemplate(id)` | Deletes instances, template, stats |
| `savePermanentInstance(inst)` | Inserts into `template_instances`, increments `instanceCount` |
| `getInstancesByTemplateId(id)` | All instances for a template |
| `getInstanceById(id)` | Single instance lookup |
| `updateInstanceDueDate(id, date)` | Updates `template_instances.dueDate` + `tasks.due_date` |
| `deletePermanentInstance(id, tplId)` | Removes instance, decrements `instanceCount` |
| `updateTemplateStats(tplId, completedAt)` | Increments counts, updates weekday tallies ⚠️ naive streak |
| `getTemplateStats(tplId)` | Raw `template_stats` row |

---

## Data Flow — Task Completion

```
User taps "Done" on a task
        │
        ▼
useTasks.toggleTask(taskId)
        │
        ▼
taskActions.completeTask(task)
        │
        ├─ kind = 'one_off'
        │       └─ TaskFactory.complete(task) → sets completed = true, completedAt = now
        │          saveTask(task) → INSERT OR REPLACE INTO tasks
        │
        └─ kind = 'permanent'
                └─ handlePermanentCompletion(task)  [in permanentTaskActions.ts]
                   ├─ saveTask(completedInstance)   → tasks row updated
                   ├─ updateTemplateStats(templateId, completedAt)
                   └─ (creates new instance for next occurrence)
```

---

## Domain Layer

**File:** `app/core/domain/taskActions.ts`

Central dispatcher. All task mutations flow through here; it routes based on `task.kind` ('one_off' | 'permanent' | 'preset'). This is the correct place to add cross-cutting concerns like writing to a completion log (see Stats Storage Plan).

---

## Empty Schema Placeholders

The following schema files exist but are empty (`.gitkeep`-style placeholders for future features):

`calendar.ts`, `completions.ts`, `dependencies.ts`, `geofencing.ts`, `googleCalendar.ts`, `googleFit.ts`, `metadata.ts`, `priority.ts`, `recurrence.ts`, `reminders.ts`, `screenTime.ts`, `sharing.ts`, `subtasks.ts`, `tags.ts`, `timeTracking.ts`, `widgets.ts`

> **Note:** `completions.ts` is the most relevant placeholder — the stats completion log schema should go there.

---

## Known Issues & Limitations

### 1. Streak calculation is incorrect
`updateTemplateStats` simply increments `currentStreak` on every completion. It never resets on a missed day. The result is a monotonically increasing number that is meaningless after the first skipped day.

**Fix needed:** Calculate streaks by querying the `completion_log` (see Stats Plan) for consecutive calendar days, not by incrementing a counter.

### 2. No completion event log
There is no append-only record of what completed when. Stats are derived from live `tasks.completed` and `tasks.completed_at`. This means:
- Deleting a task erases its completion history
- There is no way to reconstruct daily completion counts efficiently for a range of dates
- WeekBarGraph, MonthCalendarGraph, YearOverviewGraph data cannot be queried without full table scans

### 3. No "scheduled" tracking per day
The MonthCalendarGraph needs `completed / total` per day. `total` (tasks scheduled that day) is currently not tracked anywhere in a queryable form. `dueDate` exists on tasks, but tasks without a `dueDate` that are completed "today" have no scheduled-on record.

### 4. Stats queries scan the full `tasks` table
`getCategoryStats` does `SELECT COUNT(*) FROM tasks WHERE completed_at >= ?` — this works for small datasets but will degrade without an index on `completed_at`. No indexes are currently defined.

### 5. `template_stats.completionRate` uses `instanceCount` as denominator
`instanceCount` is incremented on creation and decremented on deletion. If instances are ever deleted without decrement (e.g., bulk deletion), the rate becomes stale. There is no self-healing recalculation.

### 6. `category_id` is duplicated across three tables
`tasks.category_id`, `templates.category_id`, and `template_instances.category_id` can drift out of sync. There is no foreign key enforcement (SQLite FK enforcement is off by default).

---

## File Map

```
app/core/
├── services/storage/
│   ├── database.ts                    SQLite singleton
│   ├── taskStorage.ts                 tasks table CRUD
│   ├── categoryStorage.ts             categories table CRUD + basic stats
│   ├── permanentTaskStorage.ts        templates / instances / stats CRUD
│   └── schema/
│       ├── index.ts                   initializeAllSchemas() entry point
│       ├── core.ts                    tasks table DDL
│       ├── categories.ts              categories table DDL + seed
│       ├── permanentTask.ts           templates / instances / stats DDL
│       └── [16 empty placeholders]    future feature schemas
├── domain/
│   └── taskActions.ts                 universal task action dispatcher
├── hooks/
│   └── useTasks.ts                    React hook (load / add / toggle / remove / edit)
├── types/
│   ├── task.ts                        Task interface + TaskFactory + TaskKind
│   └── statDetailTypes.ts             StatDetailParams (navigation types)
└── utils/
    ├── statUtils.ts                   safePct()
    ├── taskFilters.ts                 filterTasksDueToday / Tomorrow / Overdue etc.
    └── taskSorting.ts                 sortTasksByCompletion / CompletionAndDate
```
