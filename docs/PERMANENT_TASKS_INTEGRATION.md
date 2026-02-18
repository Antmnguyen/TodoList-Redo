# Permanent Tasks Integration Guide

## What Was Done (UI Sprint 3)

- **FloatingCreateTaskButton** - Menu with 3 options, customizable color
- **CreatePermanentTaskScreen** - Form for templateTitle, taskType, location, autoRepeat

---

## Integration Plan

### Phase 1: Connect Frontend to Backend
1. Add `taskType` to `PermanentTask` type
2. Update schema + storage to save/retrieve taskType
3. Connect `CreatePermanentTaskScreen.onSave` → `permanentTaskActions.createPermanentTask()`

### Phase 2: Load Data on Startup
1. Create `usePermanentTasks` hook that loads templates from storage on mount
2. Hook calls `getAllPermanentTemplates()` on startup via `useEffect`
3. Screen subscribes to hook → UI re-renders when data loads

### Phase 3: Display Tasks Correctly
1. **AllTasksScreen** - Shows all tasks (one-off + permanent instances)
2. **TodayScreen** - Filter by `dueDate === today`
3. **Use Permanent Task** - List templates from `usePermanentTasks`, create instance on select

```
App Startup
    |
    v
useTasks / usePermanentTasks (hooks)
    |
    useEffect → load from storage
    |
    v
State populated → UI renders
```

---

## Detailed Steps

### Step 1: Add `taskType` to Type Definition
**File:** `app/features/permanentTask/types/permanentTask.ts`

```typescript
export interface PermanentTask {
  // ... existing fields
  taskType?: string;  // Add this field
}
```

### Step 2: Update Database Schema
**File:** `app/core/services/storage/schema/permanentTask.ts`

Add `taskType` column to templates table:
```sql
taskType TEXT,  -- Add to CREATE TABLE templates
```

### Step 3: Update Storage Functions
**File:** `app/core/services/storage/permanentTaskStorage.ts`

Update `savePermanentTemplate()` to include taskType in INSERT.
Update `getTemplateById()` and `getAllTemplates()` to return taskType.

### Step 4: Update Factory
**File:** `app/features/permanentTask/utils/permanentTaskFactory.ts`

Update `createTemplate()` to accept and set taskType.

### Step 5: Connect Screen to Actions
**File:** `app/screens/tasks/AllTasksScreen.tsx`

Replace placeholder with actual call:
```typescript
import { createPermanentTask } from '../../features/permanentTask/utils/permanentTaskActions';

const handlePermanentTaskSave = async (data: PermanentTaskFormData) => {
  await createPermanentTask(data.templateTitle, {
    templateTitle: data.templateTitle,
    taskType: data.taskType,
    location: data.location,
    autoRepeat: data.autoRepeat,
  });
  setShowCreatePermanentTask(false);
};
```

### Step 6: Create Hook for Permanent Tasks (Optional)
**File:** `app/features/permanentTask/hooks/usePermanentTasks.ts`

```typescript
export function usePermanentTasks() {
  const [templates, setTemplates] = useState<Task[]>([]);

  const loadTemplates = async () => {
    const all = await getAllPermanentTemplates();
    setTemplates(all);
  };

  const createTemplate = async (data) => {
    await createPermanentTask(...);
    await loadTemplates();
  };

  return { templates, createTemplate, loadTemplates };
}
```

---

## File Reference

| Layer | File | Purpose |
|-------|------|---------|
| Screen | `screens/tasks/CreatePermanentTaskScreen.tsx` | UI form |
| Screen | `screens/tasks/AllTasksScreen.tsx` | Orchestrates flow |
| Component | `components/tasks/FloatingCreateTaskButton.tsx` | FAB with menu |
| Actions | `features/permanentTask/utils/permanentTaskActions.ts` | Business logic |
| Factory | `features/permanentTask/utils/permanentTaskFactory.ts` | Create objects |
| Storage | `core/services/storage/permanentTaskStorage.ts` | DB operations |
| Schema | `core/services/storage/schema/permanentTask.ts` | Table definitions |
| Types | `features/permanentTask/types/permanentTask.ts` | Type definitions |

---

## Data Flow

```
Screen (CreatePermanentTaskScreen)
    |
    v
AllTasksScreen.handlePermanentTaskSave()
    |
    v
permanentTaskActions.createPermanentTask()
    |
    v
permanentTaskFactory.createTemplate()
    |
    v
permanentTaskStorage.savePermanentTemplate()
    |
    v
SQLite (templates table)
```

---

## Key Architecture Pattern

```
Screen (UI)
    |
    uses
    v
Hook (useTasks, usePermanentTasks)
    |
    calls on mount + actions
    v
Actions (taskActions, permanentTaskActions)
    |
    v
Storage (taskStorage, permanentTaskStorage)
    |
    v
SQLite
```

**Rule:** Screens never call storage directly. Always go through hooks → actions → storage.
