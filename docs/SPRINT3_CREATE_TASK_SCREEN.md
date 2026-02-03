# Sprint 3: Create Task Screen — Feb 2, 2026

## What Was Done
Added a full Create Task screen accessible from the FAB "Create task" button. Replaces the old title-only modal with a proper screen containing:
- Task name input
- Due date picker (Today / Tomorrow / Pick Date)
- Expandable task type category list (placeholder data, ready for storage)

## Files Changed
- `app/screens/tasks/CreateTaskScreen.tsx` — New screen (UI only, no backend)
- `app/navigation/stacks/TasksStack.tsx` — Added `CreateTask` to screen stack, FAB navigates here

## Files NOT Changed
- `app/core/domain/taskActions.ts` — Already has `createTask(title, kind, additionalData)`
- `app/core/services/storage/taskStorage.ts` — Already persists `due_date`
- `app/core/types/task.ts` — Already has `dueDate?: Date` and `category?: string`

---

## Next Steps Checklist

### 1. Connect CreateTaskScreen to Backend
The screen emits `CreateTaskFormData` via `onSave` — wire it to `taskActions.createTask()`.

**Where to wire:**
- `app/navigation/stacks/TasksStack.tsx` → `handleCreateTaskSave(data)`
- Currently just logs. Change to call `createTask()` from `app/core/domain/taskActions.ts`

**What the call looks like:**
```ts
import { createTask } from '../../core/domain/taskActions';

const handleCreateTaskSave = async (data: CreateTaskFormData) => {
  await createTask(data.title, 'one_off', {
    dueDate: data.dueDate,
    category: data.category,
  });
  setRefreshKey(prev => prev + 1);
  goBack();
};
```

**Storage path:**
```
createTask() → taskActions.ts
  → TaskFactory.create(title) → spreads additionalData (dueDate, category)
  → saveTask(task) → taskStorage.ts → INSERT into tasks table (due_date column)
```

**Files involved:**
- `app/core/domain/taskActions.ts:36` — `createTask()` switch, `one_off` case
- `app/core/services/storage/taskStorage.ts:67` — `saveTask()` writes `due_date`
- `app/core/services/storage/schema/core.ts` — `tasks` table has `due_date INTEGER`

**Note:** `category` is on the `Task` type but not in the `tasks` table schema yet. Either add a `category TEXT` column to `schema/core.ts` or store it in metadata for now.

### 2. User-Created Task Categories
Replace `PLACEHOLDER_CATEGORIES` in `CreateTaskScreen.tsx` with categories from storage.

**What's needed:**
- Storage: new `task_categories` table (just `id TEXT, name TEXT, createdAt INTEGER`)
- Schema file: `app/core/services/storage/schema/categories.ts` (already exists, check contents)
- Storage functions: `saveCategory()`, `getAllCategories()`, `deleteCategory()`
- Pass categories into CreateTaskScreen as a prop or load via hook
- Add UI for creating new categories (button in the expandable list)

### 3. "Today" Page
A screen that only shows tasks with `dueDate` matching today.

**What's needed:**
- New screen: `app/screens/tasks/TodayScreen.tsx`
- Query function in `app/core/services/storage/taskStorage.ts`:
  ```ts
  export async function getTasksDueToday(): Promise<Task[]> {
    const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);
    const rows = db.getAllSync(
      'SELECT * FROM tasks WHERE due_date BETWEEN ? AND ? ORDER BY created_at DESC',
      [startOfDay.getTime(), endOfDay.getTime()]
    );
    // map rows to Task objects same as getAllTasks()
  }
  ```
- Add to navigation — either a tab or a screen in TasksStack
- Reuse the same task list rendering pattern from `AllTasksScreen.tsx`

---

## Architecture Reference
```
UI Layer                          Domain Layer              Storage Layer
─────────                         ────────────              ─────────────
CreateTaskScreen.tsx               taskActions.ts            taskStorage.ts
  onSave(CreateTaskFormData) →       createTask() →            saveTask() → tasks table
                                                               (due_date, category)
TodayScreen.tsx (TODO)             taskActions.ts (optional)  taskStorage.ts
  loads tasks →                                                getTasksDueToday() → tasks table
                                                               WHERE due_date BETWEEN today

AllTasksScreen.tsx                 (via hook)                taskStorage.ts
  loads tasks →                                                getAllTasks() → tasks table
```
