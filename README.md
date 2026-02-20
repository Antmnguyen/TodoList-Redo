# TaskTrackerApp

A full-featured task management mobile application built with **React Native (Expo)**, **TypeScript**, and **SQLite**. Supports one-off tasks, reusable permanent task templates, category organization, and a comprehensive statistics system with animated data visualizations — all backed by a local relational database with no external backend required.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81 (Expo SDK 54) |
| Language | TypeScript 5.9 (strict) |
| Database | SQLite via `expo-sqlite` v16 (synchronous API) |
| Navigation | Custom overlay navigator (no React Navigation) |
| State | Custom hooks — no Redux or Context API |
| Date Picker | `@react-native-community/datetimepicker` |
| Architecture | Enabled React Native New Architecture |
| Platform | iOS + Android |

---

## Features

### Task Management
- Create, edit, delete, and complete one-off tasks
- Assign due dates, categories, and optional metadata
- Smart filtering: Today, Tomorrow, Overdue, No Date
- Dual sort modes: by completion state, or completion state + due date
- Optimistic UI updates — zero loading spinners on mutations

### Permanent Task Templates
- Define reusable task templates (e.g. "Morning Workout", "Weekly Review")
- Instantiate templates into concrete tasks with per-instance due dates
- Per-template statistics: completion count, rate, current/best streak, day-of-week pattern
- Template instances cascade-delete when their template is removed

### Categories
- Three default seeded categories (Work, Health, Lifestyle) created on first launch
- Full CRUD for user-defined categories with custom color and icon
- Per-category task count badge on browse screen
- Category stats: total tasks, completion rate, weekly/monthly/yearly counts

### Statistics (Sprint 4 — In Progress)
- **Today Card** — live snapshot of current day: overall ring, permanent vs one-off breakdown, category progress bars, streak pill
- **Collapsible Stat Sections** — Overall (4 time ranges), Categories, Permanent Tasks; animated expand/collapse with cubic easing
- **StatPreviewCard** — per-entity card combining a circular progress ring and 7-bar weekly chart; tappable to navigate to full detail
- **Detail Screens** (in development) — full scrollable stats per entity including week/month/year graphs, streaks, day-of-week pattern, and category/type breakdowns

---

## Architecture

### Layered Separation

```
Screens  (container logic, lifecycle)
   │
Components  (pure UI, no business logic, props-only)
   │
Hooks  (useTasks, useCategories — local state management)
   │
Domain Actions  (taskActions.ts — routes by task.kind)
   │
Feature Actions  (permanentTaskActions, categoryActions)
   │
Storage Layer  (taskStorage, categoryStorage, permanentTaskStorage)
   │
SQLite Database  (expo-sqlite, synchronous API)
```

Each layer has a single responsibility and no layer skips another. UI components never import `expo-sqlite`. Storage functions never import React.

### File Structure

```
app/
├── components/
│   ├── stats/              # Stats visualizations
│   │   ├── CircularProgress.tsx       # Pure-RN ring indicator (no SVG)
│   │   ├── WeeklyMiniChart.tsx        # 7-bar Mon–Sun chart
│   │   ├── StatPreviewCard.tsx        # Tappable preview combining ring + chart
│   │   ├── TodayCard.tsx              # Today's snapshot card
│   │   └── detail/
│   │       ├── shared/                # All 3 detail screens use these
│   │       │   ├── DetailHeader.tsx
│   │       │   ├── CompletionSummaryCard.tsx
│   │       │   ├── StreakCard.tsx
│   │       │   ├── TimeRangeCountsCard.tsx
│   │       │   ├── TimeRangePicker.tsx
│   │       │   ├── WeekNavigator.tsx
│   │       │   ├── WeekBarGraph.tsx
│   │       │   ├── MonthCalendarGraph.tsx
│   │       │   ├── YearOverviewGraph.tsx
│   │       │   ├── DayOfWeekPatternCard.tsx
│   │       │   └── TaskTypeBreakdownCard.tsx
│   │       ├── overall/               # Overall-specific
│   │       │   └── CategoryBreakdownCard.tsx
│   │       └── category/              # Category-specific
│   │           └── PermanentTaskListCard.tsx
│   ├── tasks/              # Task UI (TaskItem, TaskList, modals, FAB)
│   ├── categories/         # Category UI (selector, list item, add modal)
│   ├── layout/             # Screen wrapper, Header
│   ├── feedback/           # EmptyState, ErrorState
│   └── ui/                 # Badge, Button, Icon
│
├── core/
│   ├── domain/
│   │   └── taskActions.ts             # Universal dispatcher — routes by task.kind
│   ├── hooks/
│   │   └── useTasks.ts                # Task state + operations
│   ├── services/storage/
│   │   ├── database.ts                # Single SQLite connection
│   │   ├── taskStorage.ts             # Task CRUD
│   │   ├── categoryStorage.ts         # Category CRUD + stats queries
│   │   ├── permanentTaskStorage.ts    # Template + instance operations
│   │   └── schema/
│   │       ├── index.ts               # Schema init orchestrator
│   │       ├── core.ts                # tasks table
│   │       ├── categories.ts          # categories table + default seeding
│   │       └── permanentTask.ts       # templates, instances, stats tables
│   ├── types/
│   │   └── task.ts                    # Task interface, TaskKind, TaskFactory
│   └── utils/
│       ├── taskSorting.ts             # Pure sort functions
│       └── taskFilters.ts             # Pure filter functions
│
├── features/
│   ├── categories/
│   │   ├── hooks/useCategories.ts     # Category state + operations
│   │   ├── types/category.ts          # Category, CategoryStats, CategoryFactory
│   │   └── utils/categoryActions.ts   # Category business logic
│   └── permanentTask/
│       ├── types/permanentTask.ts     # PermanentTask, TemplateStats interfaces
│       └── utils/
│           ├── permanentTaskActions.ts
│           └── permanentTaskFactory.ts
│
├── navigation/
│   └── MainNavigator.tsx              # Tab bar + FAB + overlay screen system
│
└── screens/
    ├── tasks/       # AllTasksScreen, CreateTaskScreen, CreatePermanentTaskScreen,
    │                  UsePermanentTaskScreen, TaskDetailsScreen
    ├── today/       # TodayScreen
    ├── stats/       # StatsScreen
    │   └── detail/  # OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen
    └── browse/      # BrowseScreen, CategoryManagementScreen
```

---

## Database Schema

Five SQLite tables with cascade deletes and safe `ALTER TABLE` migrations.

```sql
-- Core tasks (one-off and permanent instances)
CREATE TABLE tasks (
  id           TEXT    PRIMARY KEY,
  title        TEXT    NOT NULL,
  completed    INTEGER DEFAULT 0,
  created_at   INTEGER NOT NULL,
  due_date     INTEGER,
  category_id  TEXT,
  completed_at INTEGER                  -- for streak + stats calculations
);

-- User-defined categories
CREATE TABLE categories (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  color       TEXT,                     -- hex e.g. '#007AFF'
  icon        TEXT,                     -- emoji or icon name
  is_default  INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- Permanent task templates (reusable blueprints)
CREATE TABLE templates (
  permanentId    TEXT PRIMARY KEY,
  templateTitle  TEXT    NOT NULL,
  isTemplate     INTEGER NOT NULL DEFAULT 1,
  instanceCount  INTEGER NOT NULL DEFAULT 0,
  autoRepeat     TEXT,                  -- JSON
  location       TEXT,
  createdAt      INTEGER NOT NULL,
  category_id    TEXT
);

-- Junction: which instances belong to which template
CREATE TABLE template_instances (
  instanceId  TEXT NOT NULL,
  templateId  TEXT NOT NULL,
  createdAt   INTEGER NOT NULL,
  dueDate     INTEGER,
  category_id TEXT,
  PRIMARY KEY (instanceId, templateId),
  FOREIGN KEY (instanceId) REFERENCES tasks(id)            ON DELETE CASCADE,
  FOREIGN KEY (templateId) REFERENCES templates(permanentId) ON DELETE CASCADE
);

-- Per-template completion stats
CREATE TABLE template_stats (
  templateId       TEXT PRIMARY KEY,
  completionCount  INTEGER NOT NULL DEFAULT 0,
  completionRate   REAL    NOT NULL DEFAULT 0,
  currentStreak    INTEGER NOT NULL DEFAULT 0,
  maxStreak        INTEGER NOT NULL DEFAULT 0,
  completionMon    INTEGER NOT NULL DEFAULT 0,  -- completions that fell on a Monday
  completionTue    INTEGER NOT NULL DEFAULT 0,
  completionWed    INTEGER NOT NULL DEFAULT 0,
  completionThu    INTEGER NOT NULL DEFAULT 0,
  completionFri    INTEGER NOT NULL DEFAULT 0,
  completionSat    INTEGER NOT NULL DEFAULT 0,
  completionSun    INTEGER NOT NULL DEFAULT 0,
  lastUpdatedAt    INTEGER NOT NULL
);
```

---

## Key Technical Decisions

### 1. Task Kind Discriminator
All task types share the `Task` interface. A `kind` field (`'one_off' | 'permanent' | 'preset'`) routes mutations through a central dispatcher in `taskActions.ts`:

```typescript
export async function completeTask(task: Task): Promise<Task> {
  switch (task.kind) {
    case 'permanent': return handlePermanentCompletion(task);
    case 'one_off':
    default:          return TaskFactory.complete(task);
  }
}
```

Adding a new task type (e.g. recurring) requires only a new case here — no UI or hook changes.

### 2. No State Management Library
`useTasks` and `useCategories` hooks manage local component state. Each screen fetches its own data on mount. Screens are force-re-rendered via `key={refreshKey}` when mutations occur. This keeps the dependency tree flat and avoids premature abstraction for the current app scale.

### 3. Optimistic Updates
All mutations (create, toggle, delete) update React state immediately and persist to SQLite asynchronously. This eliminates loading spinners entirely on fast local writes.

```typescript
async function toggleTask(taskId: string) {
  setTasks(prev => prev.map(t =>              // 1. instant UI
    t.id === taskId ? { ...t, completed: !t.completed } : t
  ));
  await saveTask(updated);                    // 2. async persist
}
```

### 4. Factory Pattern for Object Creation
`TaskFactory`, `CategoryFactory`, and `PermanentTaskFactory` centralize ID generation and provide immutable update methods. This prevents scattered `Date.now()` calls and `{ ...obj, field: value }` patterns.

```typescript
class TaskFactory {
  static generateId(): string { return `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
  static create(title: string): Task { ... }
  static complete(task: Task): Task { return { ...task, completed: true, completedAt: new Date() }; }
}
```

### 5. Custom Navigation without React Navigation
The entire navigation stack is a single `MainNavigator` component with two state variables: `activeTab` (which tab is visible) and `overlayScreen` (which full-screen overlay is open). This avoids React Navigation's boilerplate for a relatively flat screen hierarchy.

```typescript
type TabKey        = 'tasks' | 'today' | 'stats' | 'browse';
type OverlayScreen = 'none' | 'CreateTask' | 'CreatePermanentTask' | 'UsePermanentTask';
```

Tab bar and FAB hide automatically when an overlay is active.

### 6. Pure-RN Circular Progress (No SVG Library)
The `CircularProgress` component renders a ring using only React Native `View` with border styling — no `react-native-svg` dependency. Two half-ring clip boxes each contain a full bordered circle with two colored border sides. Clipping restricts each to its half; rotation sweeps the arc into view.

Rotation formula derived analytically from how CSS borders map to circle arcs:
```typescript
const angle         = (percent / 100) * 360;
const rightRotation = -135 + Math.min(angle, 180);
const leftRotation  = -135 + Math.max(0, angle - 180);
```

### 7. Safe Schema Migrations
New columns are added using `ALTER TABLE ADD COLUMN` wrapped in try/catch. SQLite throws if the column already exists, which is silently ignored. This allows schema evolution without migration version tracking.

### 8. Synchronous SQLite with Async Wrappers
`expo-sqlite` v16 exposes a synchronous API (`runSync`, `getAllSync`). Storage functions are wrapped in `async` functions anyway, providing a consistent `Promise<T>` interface that allows dropping in a network-backed layer later without touching hooks or components.

---

## Navigation Flow

```
MainNavigator
│
├── Tab: All Tasks   → AllTasksScreen
├── Tab: Today       → TodayScreen
├── Tab: Stats       → StatsScreen (collapsible sections)
│                         └── [tap card] → StatDetailScreen (Phase 5)
└── Tab: Browse      → BrowseScreen
                          └── CategoryManagementScreen

FAB (tasks + today tabs only)
├── → CreateTaskScreen (overlay, hides tab bar)
├── → CreatePermanentTaskScreen (overlay)
└── → UsePermanentTaskScreen (overlay)
```

---

## Statistics System Design

The stats system is built on three entity types, each using identical storage query patterns with a `StatFilter` parameter:

| Entity Type | Filter Applied | Data Scope |
|-------------|---------------|------------|
| `'all'` | none | All tasks ever |
| `'category'` | `WHERE category_id = ?` | Tasks in one category |
| `'template'` | `WHERE template_id = ?` | Instances of one template |

All three types share the same universal stat set (completion rate, streaks, weekly/monthly/yearly charts, day-of-week pattern) — only two additional components are type-specific:

- **Overall only**: `CategoryBreakdownCard` — which categories contribute the most completions
- **Category only**: `PermanentTaskListCard` — permanent tasks within that category, each tappable to their own detail

---

## Core Type Definitions

```typescript
interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  kind?: 'one_off' | 'permanent' | 'preset';
  categoryId?: string;
  dueDate?: Date;
  completedAt?: Date;
  // Extensible: priority, description, subtasks, recurring, location, etc.
}

interface Category {
  id: string;
  name: string;
  color?: string;     // hex
  icon?: string;      // emoji or icon name
  isDefault: boolean;
  createdAt: Date;
}

interface StatPreviewData {
  type: 'all' | 'template' | 'category';
  id: string;
  name: string;
  totalCompleted: number;
  completionPercent: number;   // 0–100
  currentStreak: number;
  weeklyData: DayData[];       // Mon–Sun
  color: string;
}
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator or Android Emulator (or Expo Go)

### Install & Run

```bash
git clone <repo-url>
cd TaskTrackerApp
npm install
npx expo start
```

The database is created automatically on first launch. Default categories (Lifestyle, Work, Health) are seeded once.

---

## Project Status

| Sprint | Focus | Status |
|--------|-------|--------|
| Sprint 1 | One-off tasks, CRUD, due dates | ✅ Complete |
| Sprint 2 | Sorting, filtering, Today screen, FAB | ✅ Complete |
| Sprint 3 | Categories, permanent task templates, Browse screen | ✅ Complete |
| Sprint 4 | Statistics UI (preview cards + detail screens) | 🔨 In Progress |
| Sprint 5 | Stats data layer, real data integration | 📋 Planned |

### Sprint 4 Progress
- ✅ `CircularProgress` — animated ring indicator
- ✅ `WeeklyMiniChart` — 7-bar Mon–Sun chart
- ✅ `StatPreviewCard` — tappable preview card
- ✅ `TodayCard` — today's full snapshot
- ✅ `StatsScreen` — 3 animated collapsible sections
- 🔨 Detail screen components (`WeekBarGraph`, `MonthCalendarGraph`, `YearOverviewGraph`, etc.)
- 📋 Navigation from preview cards to detail screens
- 📋 Real data integration (storage layer → hooks → screens)

---

## Planned Features (Future Sprints)

- **Recurring Tasks** — daily/weekly/monthly recurrence with `RecurringConfig`
- **Subtasks** — nested task items within a parent
- **Auto-fail System** — overdue tasks auto-increment failure count and roll forward
- **Priority Levels** — low/medium/high with priority-based sort
- **Geofencing** — location-aware task reminders
- **Cloud Sync** — remote backup with conflict resolution
- **Google Calendar Integration** — bidirectional event sync

The architecture is designed for all of these: new task types add a `case` to `taskActions.ts`, new screens add a case to `MainNavigator`, and new stat dimensions extend the storage query layer without touching existing code.
