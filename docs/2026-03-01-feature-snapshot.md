# TaskTrackerApp — Feature Snapshot · 2026-03-01

> **SHIPPED — READY FOR REAL-DEVICE TESTING**
>
> This document captures the complete feature set as it exists on 2026-03-01, at the close of Sprint 5. All features listed here are implemented, integrated, and running in the development build. The app is being sent to physical devices for real-world testing.

TaskTrackerApp is a React Native (Expo) task management app built with SQLite persistence, a recurring-task system, per-category statistics, and full light/dark theme support.

---

## Scope

**In scope (Sprints 1–5):** Everything described in this document is fully functional.

**Not yet functional (UI stubs only):** Location geofencing, Health Connect integration, Google Calendar sync, and cross-device Transfer — these appear as cards in the Browse screen but tap to nothing. They are not shipped features.

---

## Navigation & Tab Structure

Four-tab bottom navigation bar, themed for light/dark mode.

| Tab | Label | Header Color | Screen |
|-----|-------|-------------|--------|
| 1 | All Tasks | Blue `#007AFF` | `AllTasksScreen` |
| 2 | Today | Green `#34C759` | `TodayScreen` |
| 3 | Stats | Orange `#FF9500` | `StatsScreen` |
| 4 | Browse | Purple `#5856D6` | `BrowseScreen` |

The tab bar background, border, and label colors respond to dark mode via theme tokens. Brand header colors are identity colors — they stay the same in both themes.

**File:** `app/navigation/MainNavigator.tsx`, `app/components/navigation/TabBar.tsx`

---

## All Tasks Screen

The primary task list. Shows every task in the database, sorted with incomplete tasks first and completed tasks at the bottom.

- Blue header with "All Tasks" title and a live count of active (incomplete) tasks
- Full task CRUD: toggle completion, delete, open edit modal
- Completed tasks appear dimmed (opacity 0.6) with a strikethrough title
- Floating action button (＋) to create a new task

**File:** `app/screens/tasks/AllTasksScreen.tsx`

---

## Today Screen

A filtered view of the task list, scoped to a user-selected time window.

- Green header with "Today" title and task count for the active filter
- **Filter tab bar** directly below the header with three tabs:

| Tab | Filter Logic |
|-----|-------------|
| Today | Tasks with dueDate on today's calendar date |
| This Week | Tasks due Mon–Sun of the current week |
| This Month | Tasks due within the current calendar month |

- Same task CRUD as All Tasks (toggle, delete, edit modal)
- Empty state message updates to match the active filter (e.g. "No tasks due this week!")

**Files:** `app/screens/today/TodayScreen.tsx`, `app/core/utils/taskFilters.ts`

---

## Task Creation — One-Off Tasks

Accessed via the floating ＋ button from any task list screen.

**Form fields:**

1. **Task Name** — Required free-text input
2. **Due Date** — Three quick-pick buttons (Today / Tomorrow / Pick Date) plus a full date picker modal
3. **Category** — Scrollable pill selector showing all user-defined categories; optional

On confirm, the task is created via `createTask(title, 'one_off', { dueDate, categoryId })` and immediately appears in the task list.

**Files:** `app/screens/tasks/CreateTaskScreen.tsx`, `app/core/domain/taskActions.ts`

---

## Permanent (Recurring) Tasks

A two-part system for tasks the user does repeatedly: a **template** (the blueprint) and **instances** (the actual tasks created from it).

### Creating a Template

`CreatePermanentTaskScreen` — accessible from the Browse or All Tasks flow.

**Form sections:**

1. **Template Title** — Required; the name shared by all instances
2. **Category** — Optional; inherited by every instance stamped from this template
3. **Location** *(collapsible, optional)* — A free-text location label stored on the template
4. **Auto-Repeat** *(collapsible, optional)* — Enables automatic instance scheduling:
   - Toggle: enabled / disabled
   - Frequency: Daily / Weekly / Monthly

**File:** `app/screens/tasks/CreatePermanentTaskScreen.tsx`

### Using a Template (Stamping Instances)

`UsePermanentTaskScreen` — the main interface for working with recurring tasks.

- Scrollable list of all templates, each showing title, location (if set), usage count, and the two left-edge color strips
- Tap a template → modal opens to pick a due date → confirm → a new task instance is created and appears in the task lists
- **⋮ menu** on each template row:
  - **Edit** → `EditPermanentTaskScreen` to update title, category, location, auto-repeat config
  - **Delete** → removes the template and all its instances

**File:** `app/screens/tasks/UsePermanentTaskScreen.tsx`

### Auto-Scheduling (Midnight Job)

When a template has auto-repeat enabled, the midnight job automatically creates the next instance after the previous one is completed. Key behaviours:

- **One pending instance at a time** — if an instance already exists and isn't completed, no new one is created
- **Triggered after first manual completion** — auto-scheduling never fires for a template that has never been completed
- **Frequencies:** daily (+24 h), weekly (+7 days, optional day-of-week snap), monthly (+1 month, optional day-of-month snap)
- **Date gate** — the job runs at most once per calendar day, guarded by both an in-session flag and a SQLite `app_settings` date record

**File:** `app/core/domain/taskActions.ts` → `autoScheduleRecurringTasks()`, `runMidnightJob()`

---

## Task Card Visual Identity

Every task card uses two left-edge color strips to communicate category and task type at a glance.

```
┌──────────────────────────────────────────────────┐
│ ▌▌ [✓] Task title                  [due date] ✕  │
└──────────────────────────────────────────────────┘
  ││
  │└── Permanent strip (4 px) — purple if permanent, transparent if one-off
  └─── Category strip  (5 px) — category color, or grey if uncategorised
```

- **Category strip (5 px, leftmost):** Shows the category's assigned hex color. Falls back to a neutral grey (`theme.categoryStripNone`) when the task has no category. Has rounded left corners matching the card.
- **Permanent strip (4 px, second):** Purple (`theme.accentPermanent`) for permanent/recurring tasks; transparent for one-off tasks so the card layout never shifts.
- **Checkbox color:** Blue for one-off tasks, purple for permanent tasks — a secondary recurring signal visible when interacting with the checkbox.
- **Completed state:** Entire card dims to 60% opacity + title gets a strikethrough.

**File:** `app/components/tasks/TaskItem.tsx`

---

## Edit Task Modal

Available from any task list screen by tapping the task body (anywhere except the checkbox and delete button).

- **Title field** — Editable text input pre-filled with the current title
- **Due date** — Same quick-pick buttons (Today / Tomorrow / Pick Date) as the creation screen, plus a date picker

Changes are saved immediately on confirm via `reassignTask()`. Works for both one-off and permanent tasks.

**File:** `app/components/tasks/EditTaskModal.tsx`

---

## Stats Screen

An overview dashboard with three independently collapsible sections. Smooth cubic ease-in/out animations on expand/collapse.

- Orange header: "Stats" / "Your productivity insights"
- **Today Card** — Snapshot of today: tasks due, completed, completion percentage
- **Overall** *(collapsible)* — Stat cards for All Time / This Year / This Month / This Week
- **Categories** *(collapsible)* — One stat card per user-defined category
- **Permanent Tasks** *(collapsible)* — One stat card per recurring task template, showing usage count and completion rate

Each stat card shows: a circular completion percentage ring, total completed count, and current streak. Tapping a card navigates to the corresponding detail screen.

**File:** `app/screens/stats/StatsScreen.tsx`

---

## Stats Detail Screens

Three detail screens, each reachable from their stat card:

| Screen | Shows data for |
|--------|---------------|
| `OverallDetailScreen` | All tasks combined |
| `CategoryDetailScreen` | A single category |
| `PermanentDetailScreen` | A single recurring template |

All three share the same component set:

- **Time Range Picker** — All / This Week / This Month / This Year
- **CompletionSummaryCard** — Total completed, auto-failed, completion rate
- **MonthCalendarGraph** — Calendar grid with a colored progress ring per day; ring fill represents daily completion rate
- **WeekBarGraph** — Bar chart of daily completion counts; toggleable between absolute count and percentage view
- **YearOverviewGraph** — Monthly bar summary for the current year
- **DayOfWeekPatternCard** — Horizontal bar showing which days of the week you complete the most tasks
- **StreakCard** — Current streak (consecutive days with at least one completion) and all-time best streak with dates
- **TaskTypeBreakdownCard** — Split of one-off vs permanent completions (Overall detail only)
- **TimeRangeCountsCard** — Completion counts for the last 7 days, 30 days, and 365 days

All stats are read from `completion_log` (append-only, never deleted) so data remains accurate even after completed tasks are archived.

**Files:** `app/screens/stats/detail/`, `app/components/stats/detail/shared/`

---

## History Screen

A read-only archive view of all completed tasks that have been moved out of the active `tasks` table.

- Accessible via Browse → History
- Tasks grouped by completion date in a SectionList with sticky date headers
- Each row shows: task title, category badge (colored dot + name), and a 🔁 icon for tasks from recurring templates
- **Filter tabs:** All / Today / This Week / This Month / This Year — scopes the date range shown
- Data source: `task_archive` table, populated by the archival step of the midnight job

**File:** `app/screens/browse/HistoryManagementScreen.tsx`

---

## Browse Screen

The settings and management hub.

- Purple header: "Browse" / "Manage your app features"
- **Dark Mode toggle** at the top — Switch component, preference persisted immediately to SQLite

**Feature cards:**

| Card | Status |
|------|--------|
| 🏷️ Categories | ✅ Functional — opens CategoryManagementScreen |
| 📍 Location | ⬜ UI stub — not yet functional |
| 💓 Health Connect | ⬜ UI stub — not yet functional |
| 📅 Calendar | ⬜ UI stub — not yet functional |
| 🔄 Transfer | ⬜ UI stub — not yet functional |
| 📜 History | ✅ Functional — opens HistoryManagementScreen |

**File:** `app/screens/browse/BrowseScreen.tsx`

---

## Category Management

User-defined categories that can be assigned to tasks for organization and color-coding.

- Create categories with a name and a color (color picker)
- Edit or delete existing categories
- Assigned at task creation via the category pill selector
- Category color appears as the 5 px left strip on every task card
- Category color appears as a color dot in the Browse/Category management list
- Five built-in default categories: General, Work, Personal, Health, Finance
- Per-category stats visible in the Stats screen

**Files:** `app/screens/browse/CategoryManagementScreen.tsx`, `app/features/categories/`, `app/core/services/storage/categoryStorage.ts`

---

## Dark Mode

A manual light/dark theme toggle with full app coverage.

- Toggle is a Switch row at the top of BrowseScreen
- Preference persisted to SQLite `app_settings` table under key `dark_mode` (`'1'` = dark, `'0'` = light)
- First launch with no stored preference falls back to the device's system color scheme
- Theme provided via React context (`ThemeProvider` wraps the root in `App.tsx`)
- Every screen and component reads from `useTheme()` — no hardcoded hex colors anywhere (except the four brand header identity colors which are the same in both themes)

**Two palettes (`lightTheme` / `darkTheme`) cover:**
- Backgrounds: screen, card, modal, input, section
- Text: primary, secondary, tertiary, disabled
- Interactive: accent (blue), accentPermanent (purple), danger (red)
- Borders and separators
- Tab bar: background, border, active/inactive states
- Task-specific: checkbox colors (one-off vs permanent), completed text, category strip fallback

**Files:** `app/theme/tokens.ts`, `app/theme/ThemeContext.tsx`

---

## Midnight Maintenance Job

A single entry point (`runMidnightJob`) that runs the full maintenance pipeline once per calendar day when the app cold-starts.

**Job order:**

1. **Auto-fail overdue tasks** — Any incomplete task whose dueDate is before today's midnight gets an `auto_failed` event logged to `completion_log`, and its dueDate is pushed forward by 1 day. This keeps the task list current and the stats honest about missed days.

2. **Auto-schedule recurring instances** — For every template with auto-repeat enabled that has no pending instance and has been completed at least once, a new instance is created with a computed due date.

3. **Archive completed tasks** — All completed tasks are snapshotted into `task_archive` (with category name and recurring flag denormalized), then deleted from `tasks`. The `completion_log` is never touched.

**Guards (prevents duplicate runs):**
- In-session flag `_midnightJobRanThisSession` — short-circuits on remounts within the same JS process
- SQLite date gate — `app_settings.midnight_job_last_run_date` (YYYY-MM-DD) — prevents re-runs on re-launch within the same calendar day
- Written *after* jobs complete so a crash mid-run causes a safe retry on the next launch

**File:** `app/core/domain/taskActions.ts`

---

## Task Archival

Completed tasks are automatically cleaned up from the live `tasks` table by the midnight job's archive step.

- A snapshot is written to `task_archive` (id, title, category_id, category_name, completed_at, was_recurring, archived_at)
- The original row is deleted from `tasks` and the corresponding row from `template_instances` (for recurring tasks)
- Archival is idempotent — `INSERT OR IGNORE` means re-running never creates duplicates
- `completion_log` is never modified — all stats remain accurate after archival
- Archived tasks are viewable in the History screen

**File:** `app/core/services/archivalService.ts`

---

## Data Model

### Task

```typescript
interface Task {
  id:           string;       // "task_<timestamp>_<random>"
  title:        string;
  completed:    boolean;
  createdAt:    Date;
  kind?:        'one_off' | 'permanent' | 'preset';  // defaults to 'one_off'

  // Optional
  categoryId?:    string;
  categoryColor?: string;     // denormalized from categories at load time
  dueDate?:       Date;
  completedAt?:   Date;
  metadata?:      Record<string, any>;  // e.g. { permanentId } for instances
}
```

`TaskFactory` handles immutable creation (`create`), completion (`complete`), and uncompletion (`uncomplete`).

### PermanentTask (Template / Instance)

```typescript
interface PermanentTask {
  id:             string;   // row id
  permanentId:    string;   // shared template identifier
  templateTitle:  string;
  isTemplate:     boolean;  // true = template, false = instance
  autoRepeat?:    { enabled: boolean; frequency?: 'daily' | 'weekly' | 'monthly'; dayOfWeek?: number; dayOfMonth?: number; };
  location?:      string;
  instanceCount?: number;   // templates only
  categoryId?:    string;
  categoryColor?: string;
}
```

**File:** `app/core/types/task.ts`, `app/features/permanentTask/types/permanentTask.ts`

---

## Storage Architecture

SQLite database via `expo-sqlite`, synchronous API. Initialized on first launch; schema migrations handled by version checks.

| Table | Purpose |
|-------|---------|
| `tasks` | Active (incomplete + recently completed) tasks |
| `categories` | User-defined categories with name and color |
| `templates` | Permanent task templates (`isTemplate = true`) |
| `template_instances` | Links template → task instance (templateId, instanceId) |
| `completion_log` | Append-only event log; never deleted; source of truth for all stats |
| `task_archive` | Completed tasks moved out of `tasks`; source for History screen |
| `app_settings` | Key-value store: dark_mode preference, midnight job last-run date |

**Files:** `app/core/services/storage/`

---

## Known Stubs

The following features have UI placeholders in BrowseScreen but no backend implementation. They are **not** being tested on device and are expected to do nothing when tapped.

- **Location** — Planned geofencing auto-complete for tasks associated with a place
- **Health Connect** — Planned fitness/activity tracker integration
- **Calendar** — Planned Google Calendar two-way sync
- **Transfer** — Planned cross-device data export/import

---

*Snapshot generated 2026-03-01 · TaskTrackerApp Sprint 5*
