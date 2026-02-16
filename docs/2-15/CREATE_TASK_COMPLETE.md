# Create Task Screen - Backend Connection Complete

**Date:** February 15, 2026

## Summary
Connected the CreateTaskScreen frontend form to the backend storage layer. Tasks created via the "Create task" FAB option now persist to SQLite.

---

## What Was Done

### 1. Wired CreateTaskScreen to Backend
**File:** `app/navigation/stacks/TasksStack.tsx` (lines 93-128)

Changed `handleCreateTaskSave` from logging to actually calling `createTask()`:

```typescript
const handleCreateTaskSave = async (data: CreateTaskFormData) => {
  await createTask(data.title, 'one_off', {
    dueDate: data.dueDate,
    category: data.category,
  });
  setRefreshKey(prev => prev + 1);
  goBack();
};
```

### 2. Added Task Sorting Utility
**File:** `app/core/utils/taskSorting.ts` (NEW)

Created reusable sorting functions:
- `sortTasksByCompletion(tasks)` - Uncompleted first, completed last
- `sortTasksByCompletionAndDate(tasks)` - Same + sorts by due date within groups

### 3. Applied Sorting to AllTasksScreen
**File:** `app/screens/tasks/AllTasksScreen.tsx`

- Imported `sortTasksByCompletion` and `useMemo`
- Tasks now display with uncompleted at top, completed at bottom

---

## Data Flow

```
CreateTaskScreen.handleSave()
  → onSave({ title, dueDate, category })
    → TasksStack.handleCreateTaskSave(data)
      → createTask(title, 'one_off', { dueDate, category })
        → TaskFactory.create(title)
        → saveTask(taskWithData)
          → INSERT INTO tasks (id, title, completed, created_at, due_date)
```

---

## Files Changed

| File | Change |
|------|--------|
| `app/navigation/stacks/TasksStack.tsx` | Wired handleCreateTaskSave to createTask |
| `app/core/utils/taskSorting.ts` | NEW - Reusable sorting utilities |
| `app/screens/tasks/AllTasksScreen.tsx` | Applied sorting to task list |

---

## Remaining TODOs

### High Priority
- [ ] **TodayScreen** - Filter tasks by dueDate === today (next task)
- [ ] **Category persistence** - Add `category TEXT` column to tasks table schema

### Medium Priority
- [ ] Enable due date changing for existing tasks
- [ ] Enable repeatability editing for permanent tasks in UsePermanentTaskScreen

### Low Priority / Future
- [ ] User-created task categories (storage + UI)
- [ ] Replace placeholder categories in CreateTaskScreen with stored categories

---

## Architecture Reference

```
UI Layer                    Domain Layer              Storage Layer
─────────                   ────────────              ─────────────
CreateTaskScreen.tsx        taskActions.ts            taskStorage.ts
  → onSave(formData)          → createTask()            → saveTask()
                                                          → tasks table

AllTasksScreen.tsx          (via useTasks hook)       taskStorage.ts
  → sortTasksByCompletion()                             → getAllTasks()
```
