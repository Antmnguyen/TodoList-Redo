# Sprint 3 Summary: Core Task Features

**Branch:** `ui-sprint3`
**Status:** Complete

---

## Pull Request Description

Completes all core task management features: task editing, a full category system with persistence and management UI, permanent task category support, and a task archival-ready Browse screen. Also fixes category task count logic to correctly handle permanent templates vs one-off tasks.

---

## What Was Done

### Task Editing (3.1)
Added inline task editing via a popup modal. Tapping the body of any task opens `EditTaskModal` where users can update the title and due date. Due dates display as "Today", "Tomorrow", or a formatted date — overdue tasks show "Overdue: Jan 15". Edit flows through `useTasks.editTask()` → `reassignTask()` → `saveTask()`.

### Category Persistence (3.2)
Introduced a `categories` table with full CRUD and stats queries. Added `category_id` and `completed_at` columns to the `tasks` table. Three default categories (Lifestyle/green, Work/blue, Health/orange) are seeded on first launch. Stats queries (`getCategoryStats`, `getAllCategoryStats`) are in place and ready for Sprint 4 visualizations.

### Category Feature Module (3.3)
Built the categories feature layer: `Category` type + `CategoryFactory`, `categoryActions.ts` business logic (name validation, duplicate prevention), and `useCategories` hook. `CreateTaskScreen` wired to real categories with color indicators.

### Category Selector Component (3.4)
Extracted a reusable `CategorySelector` component used in both `CreateTaskScreen` and `CreatePermanentTaskScreen`. Expandable list with color dots, tap to select/deselect.

### Permanent Task Category Backend (3.5)
Added `category_id` to both `templates` and `template_instances` tables via migrations. `permanentTaskStorage` saves and reads `categoryId`. `handlePermanentCompletion` sets `completedAt` on the tasks row so permanent completions count toward category stats.

### Due Date Persistence
Due dates fully persisted for all task types. `taskStorage` reads/writes `due_date`. `permanentTaskStorage` reads/writes `dueDate` on instances and keeps both `template_instances` and `tasks` tables in sync via `updateInstanceDueDate`. `pushPermanentTaskForward` and `reassignPermanentTask` both sync through both tables.

### Manage Categories — Browse Screen (3.6)
Replaced the Browse placeholder with a feature-list screen. Tapping "Categories" opens `CategoryManagementScreen` (local state navigation, consistent with the rest of the app). Features:
- List of categories with color dot, name, task count
- Tap a category row → bottom sheet showing all task names in that category (active/completed)
- Edit button → `AddCategoryModal` pre-filled with current name and color
- Delete button → confirmation alert → deletes, sets `category_id = NULL` on affected tasks
- Add button → `AddCategoryModal` with 10-color preset picker and live preview
- Navigation handled via local `subScreen` state in `BrowseScreen` — no React Navigation dependency

### Category Task Count Fix (3.7)
Fixed `getTaskCountForCategory` and `getTasksForCategory` to correctly separate one-off tasks from permanent task instances:
- **Before:** counted all `tasks WHERE category_id = ?` — inflated count for permanent tasks since each usage creates a new instance row
- **After:** one-off tasks = `tasks NOT IN (SELECT instanceId FROM template_instances)`, permanent = one count per row in `templates`
- Task list modal shows template name once regardless of how many times it's been used

---

## Files Added

| File | Purpose |
|------|---------|
| `app/components/tasks/EditTaskModal.tsx` | Edit task name + due date modal |
| `app/core/services/storage/schema/categories.ts` | Categories table schema + default seeding |
| `app/core/services/storage/categoryStorage.ts` | Category CRUD + stats + task queries |
| `app/features/categories/types/category.ts` | Category type, CategoryStats, CategoryFactory |
| `app/features/categories/utils/categoryActions.ts` | Business logic (validation, CRUD) |
| `app/features/categories/hooks/useCategories.ts` | React hook for category state |
| `app/features/categories/index.ts` | Public API exports |
| `app/components/categories/CategorySelector.tsx` | Reusable category picker component |
| `app/components/categories/CategoryListItem.tsx` | Row with color dot, count, edit/delete |
| `app/components/categories/AddCategoryModal.tsx` | Create/edit modal with color picker |
| `app/screens/browse/CategoryManagementScreen.tsx` | Full category management screen |

## Files Modified

| File | Changes |
|------|---------|
| `app/core/services/storage/schema/core.ts` | Added `category_id`, `completed_at` to tasks |
| `app/core/services/storage/schema/permanentTask.ts` | Added `category_id` to templates + instances |
| `app/core/services/storage/taskStorage.ts` | Reads/writes `categoryId`, `completedAt` |
| `app/core/services/storage/permanentTaskStorage.ts` | Reads/writes `categoryId`, syncs due dates |
| `app/core/services/storage/categoryStorage.ts` | Fixed count + task list queries (3.7) |
| `app/features/permanentTask/utils/permanentTaskActions.ts` | Sets `completedAt`, saves `categoryId` |
| `app/features/permanentTask/types/permanentTask.ts` | Added `categoryId` field |
| `app/components/tasks/TaskItem.tsx` | Tappable body, due date display, onEdit prop |
| `app/components/tasks/TaskList.tsx` | Passes `onEdit` to TaskItem |
| `app/core/hooks/useTasks.ts` | Added `editTask()` |
| `app/screens/tasks/AllTasksScreen.tsx` | Edit modal wired |
| `app/screens/today/TodayScreen.tsx` | Edit modal wired |
| `app/screens/tasks/CreateTaskScreen.tsx` | Uses real categories via useCategories |
| `app/screens/tasks/CreatePermanentTaskScreen.tsx` | Uses CategorySelector |
| `app/screens/browse/BrowseScreen.tsx` | Replaced placeholder with feature list |
| `app/navigation/MainNavigator.tsx` | Passes `categoryId` through to `createTask` |
