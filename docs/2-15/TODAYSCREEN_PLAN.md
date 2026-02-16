# TodayScreen Implementation Plan

**Date:** February 15, 2026

## Overview
Create a TodayScreen that displays only tasks due today. Nearly identical to AllTasksScreen, with filtered data and different header text.

---

## Requirements

1. Header says "Today" instead of "All Tasks"
2. Only shows tasks where `dueDate` matches today's date
3. Same sorting behavior (uncompleted first, completed last)
4. Same task interactions (toggle, delete)

---

## Implementation Plan

### Step 1: Create TodayScreen Component
**File:** `app/screens/tasks/TodayScreen.tsx` (NEW)

Copy AllTasksScreen structure with these changes:
- Title: "Today" instead of "All Tasks"
- Filter tasks to only those due today before sorting

```typescript
// Filter tasks due today
const todayTasks = useMemo(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return tasks.filter(task => {
    if (!task.dueDate) return false;
    const due = task.dueDate.getTime();
    return due >= today.getTime() && due < tomorrow.getTime();
  });
}, [tasks]);

// Then sort
const sortedTasks = useMemo(() => sortTasksByCompletion(todayTasks), [todayTasks]);
```

### Step 2: Add Reusable Filter Utility (Optional)
**File:** `app/core/utils/taskFilters.ts` (NEW)

```typescript
export function filterTasksDueToday(tasks: Task[]): Task[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return tasks.filter(task => {
    if (!task.dueDate) return false;
    const due = task.dueDate.getTime();
    return due >= today.getTime() && due < tomorrow.getTime();
  });
}
```

### Step 3: Add to Navigation
**File:** `app/navigation/stacks/TasksStack.tsx`

- Add 'Today' to TasksScreen type
- Add case in renderScreen() switch
- Decide how to navigate to it (tab? button in header? separate stack?)

---

## File Structure After Implementation

```
app/
├── screens/tasks/
│   ├── AllTasksScreen.tsx      (existing)
│   └── TodayScreen.tsx         (NEW)
├── core/utils/
│   ├── taskSorting.ts          (existing)
│   └── taskFilters.ts          (NEW - optional)
└── navigation/stacks/
    └── TasksStack.tsx          (add Today screen)
```

---

## Data Flow

```
TodayScreen
  │
  ├── useTasks() hook → getAllTasks() from storage
  │
  ├── filterTasksDueToday(tasks) → tasks where dueDate is today
  │
  ├── sortTasksByCompletion(todayTasks) → uncompleted first
  │
  └── TaskList component → renders sorted/filtered tasks
```

---

## Questions to Resolve

1. **Navigation**: How does user get to TodayScreen?
   - Option A: Tab bar (Today | All Tasks)
   - Option B: Button/toggle in header
   - Option C: Separate entry point

2. **Empty state**: What message when no tasks due today?
   - Suggestion: "No tasks due today. Enjoy your free time!"

---

## Estimated Changes

| File | Change |
|------|--------|
| `app/screens/tasks/TodayScreen.tsx` | NEW - Today screen component |
| `app/core/utils/taskFilters.ts` | NEW - Reusable date filtering (optional) |
| `app/navigation/stacks/TasksStack.tsx` | Add Today to navigation |

---

## Dependencies

- `useTasks` hook (existing)
- `sortTasksByCompletion` utility (existing)
- `TaskList` component (existing)

No new packages required.
