# Sprint 3 Plan: Core Task Features

**Status:** Complete
**Goal:** Complete core task management features (editing, categories, permanent tasks)

---

## Overview

Finish the foundational task management features before moving to statistics and polish.

---

## Tasks

### 3.1 Edit Task (Name + Due Date)
**Priority:** High
**Status:** [x] Complete

Allow users to edit task name and due date via popup modal.

**Requirements:**
- [x] Tap task body to open edit modal
- [x] Edit task name
- [x] Date picker to change due date
- [x] Save changes to database via reassignTask

**Files:**
- [x] Created `EditTaskModal.tsx` - popup modal with title input + date picker
- [x] Updated `TaskItem.tsx` - added onEdit callback, tappable body, due date display
- [x] Updated `TaskList.tsx` - passes onEdit to TaskItem
- [x] Updated `useTasks.ts` - added editTask() calling reassignTask
- [x] Updated `AllTasksScreen.tsx` - wired edit modal
- [x] Updated `TodayScreen.tsx` - wired edit modal

**See:** `SPRINT_3_1_COMPLETE.md` for implementation details

---

### 3.2 Category Persistence
**Priority:** High
**Status:** [x] Complete

Categories have their own table with CRUD operations and stats queries.

**Requirements:**
- [x] Categories table with id, name, color, icon, is_default, created_at
- [x] category_id column in tasks table
- [x] completed_at column in tasks table (for Sprint 4 stats)
- [x] Storage layer with CRUD + stats queries
- [x] Default categories seeded: Lifestyle, Work, Health

**Files:**
- [x] `app/core/services/storage/schema/categories.ts` - table schema + seeding
- [x] `app/core/services/storage/schema/core.ts` - added category_id, completed_at columns
- [x] `app/core/services/storage/categoryStorage.ts` - CRUD + stats queries
- [x] `app/core/services/storage/taskStorage.ts` - reads/writes categoryId, completedAt

**See:** `SPRINT_3_2_3_COMPLETE.md` for implementation details

---

### 3.3 User-Created Categories
**Priority:** Medium
**Status:** [x] Complete

Category feature module with types, actions, and hooks.

**Requirements:**
- [x] Category types with factory
- [x] Business logic in categoryActions.ts
- [x] useCategories hook for UI
- [x] CreateTaskScreen wired to real categories
- [x] Categories display with color indicators

**Files:**
- [x] `app/features/categories/types/category.ts` - Category, CategoryStats, CategoryFactory
- [x] `app/features/categories/utils/categoryActions.ts` - business logic
- [x] `app/features/categories/hooks/useCategories.ts` - React hook
- [x] `app/features/categories/index.ts` - public API
- [x] `app/screens/tasks/CreateTaskScreen.tsx` - wired to useCategories

---

### 3.4 Category Selector Component
**Priority:** Medium
**Status:** [x] Complete

Reusable CategorySelector component for both one-off and permanent tasks.

**Requirements:**
- [x] Extract category UI into reusable component
- [x] CategorySelector used in CreateTaskScreen
- [x] CategorySelector used in CreatePermanentTaskScreen

**Files:**
- [x] `app/components/categories/CategorySelector.tsx` - reusable component
- [x] `app/screens/tasks/CreateTaskScreen.tsx` - uses CategorySelector
- [x] `app/screens/tasks/CreatePermanentTaskScreen.tsx` - uses CategorySelector

---

### 3.5 Permanent Task Category Backend
**Priority:** High
**Status:** [x] Complete

Wire categoryId to permanent task storage and ensure completion updates stats.

**Requirements:**
- [x] Add categoryId to permanent_templates table
- [x] Add categoryId to permanent_instances table
- [x] Update permanentTaskStorage to save/read categoryId
- [x] Update handlePermanentCompletion to set completedAt
- [x] Ensure permanent task completion counts toward category stats

**Files:**
- [x] `app/core/services/storage/schema/permanentTask.ts`
- [x] `app/core/services/storage/permanentTaskStorage.ts`
- [x] `app/features/permanentTask/utils/permanentTaskActions.ts`

---

### 3.6 Manage Categories (Browse Section)
**Priority:** Medium
**Status:** [x] Complete

Add category management UI to Browse screen with full CRUD operations.

**Requirements:**
- [x] Browse screen shows list of feature options (Categories first)
- [x] Tap "Categories" to open category management view
- [x] View all categories with color indicators
- [x] Create new category (name, color picker)
- [x] Edit existing category (name, color)
- [x] Delete category (with confirmation)
- [x] Show task count per category
- [x] Tap category row to view list of task names in that category

**UI Flow:**
```
BrowseScreen
  └── Feature List
        ├── "Categories" → CategoryManagementScreen
        ├── "Templates" → (future)
        └── "Settings" → (future)

CategoryManagementScreen
  ├── Header: "Categories" + "Add" button
  ├── List of categories (color dot + name + task count)
  │     └── Tap row → Task list modal (task names, completed state)
  │     └── Edit button → AddCategoryModal (edit mode)
  │     └── Delete button → Confirm delete
  └── AddCategoryModal (name input + color picker, create & edit)
```

**Files:**
- [x] `app/screens/browse/BrowseScreen.tsx` - feature list, local sub-screen state
- [x] `app/screens/browse/CategoryManagementScreen.tsx` - new screen
- [x] `app/components/categories/CategoryListItem.tsx` - tappable row with edit/delete
- [x] `app/components/categories/AddCategoryModal.tsx` - create/edit modal
- [x] `app/core/services/storage/categoryStorage.ts` - added getTasksForCategory()

---

### 3.7 Fix Category Task Count Rules
**Priority:** Medium
**Status:** [x] Complete

Correct how task counts are calculated per category so they reflect meaningful numbers.

**Rules:**
- **Permanent task templates:** count as **1** per template regardless of how many times the template has been used. Using or completing a permanent task instance does NOT change the count.
- **One-off tasks:** count increases by **+1** when the task is assigned to the category, decreases by **-1** when the task is deleted. Completing the task does NOT change the count.

**Why this matters:**
The current `getTaskCountForCategory` query counts all rows in `tasks WHERE category_id = ?`. This is correct for one-off tasks but does not account for permanent task templates, which generate multiple instance rows per usage. The fix requires querying templates and tasks separately and combining the counts correctly.

**Requirements:**
- [x] `getTaskCountForCategory` returns 1 per permanent template (not per instance) assigned to the category
- [x] `getTaskCountForCategory` returns 1 per one-off task assigned to the category
- [x] Count decreases when a one-off task is deleted (already handled — row is deleted)
- [x] Count does NOT change when a permanent task instance is created or completed
- [x] Category task list modal (3.6) shows template name once, not per instance

**Files updated:**
- [x] `app/core/services/storage/categoryStorage.ts` - fixed getTaskCountForCategory: counts one-off tasks (tasks NOT IN template_instances) + templates (1 per template row)
- [x] `app/core/services/storage/categoryStorage.ts` - fixed getTasksForCategory: returns templates table rows + one-off task rows separately

---

### 3.8 Edit Permanent Task Templates
**Status:** Moved to Sprint 5

### 3.9 Delete Permanent Task Templates
**Status:** Moved to Sprint 5

---

## Task Checklist Summary

### High Priority
- [x] 3.1 Edit task (name + due date)
- [x] 3.2 Category persistence (table + storage)
- [x] 3.5 Permanent task category backend

### Medium Priority
- [x] 3.3 User-created categories (feature module)
- [x] 3.4 CategorySelector component (reusable UI)
- [x] 3.6 Manage Categories (Browse section CRUD)
- [x] 3.7 Fix category task count rules (permanent vs one-off)
- [→] 3.8 Edit permanent task templates (moved to Sprint 5)
- [→] 3.9 Delete permanent task templates (moved to Sprint 5)

---

## Schema Changes

### Completed
```sql
-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  is_default INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Tasks table additions
ALTER TABLE tasks ADD COLUMN category_id TEXT;
ALTER TABLE tasks ADD COLUMN completed_at INTEGER;

-- Permanent templates table
ALTER TABLE permanent_templates ADD COLUMN category_id TEXT;

-- Permanent instances table
ALTER TABLE permanent_instances ADD COLUMN category_id TEXT;
```

---

## Success Criteria

- [x] Users can edit task name and due dates
- [x] Categories persist after app restart
- [x] Users can select categories when creating one-off tasks
- [x] Users can select categories when creating permanent task templates
- [x] Default categories (Lifestyle, Work, Health) seeded on first launch
- [x] CategorySelector is reusable across screens
- [x] Permanent task categoryId saved to database
- [x] Permanent task completion updates category stats
- [x] Users can create new categories from Browse
- [x] Users can edit category name/color from Browse
- [x] Users can delete categories from Browse
- [x] Tapping a category shows its task names
- [x] Category count = 1 per permanent template (not per instance)
- [x] Category count +1 on one-off task assigned, -1 on deleted
- [ ] No data loss or corruption

---

## Dependencies

- None — builds on existing Sprint 2 foundation

---

## Notes

- Keep UI minimal for now (Sprint 5 handles polish)
- Focus on functionality over aesthetics
- Test all database operations thoroughly
