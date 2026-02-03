# Sprint 3: Due Date Storage

## Summary
Due dates are now persisted for all task types. Both regular and permanent task instances save, read, and edit due dates through the storage layer. The UsePermanentTaskScreen date picker flows end-to-end into both database tables.

## Files Changed

### Schema
- `app/core/services/storage/schema/core.ts` - `due_date` column on `tasks` table
- `app/core/services/storage/schema/permanentTask.ts` - `dueDate` column on `template_instances` table

### Storage
- `app/core/services/storage/taskStorage.ts`
  - `getAllTasks()` returns `dueDate` per task
  - `saveTask()` writes `dueDate` to storage
  - `updateTaskDueDate(taskId, dueDate)` - set or clear a task's due date
  - `getTaskDueDate(taskId)` - read a single task's due date
- `app/core/services/storage/permanentTaskStorage.ts`
  - `savePermanentInstance()` writes `dueDate`
  - `getInstancesByTemplateId()` and `getInstanceById()` return `dueDate`
  - `updateInstanceDueDate(instanceId, dueDate)` - updates both `template_instances` and `tasks` tables
  - `getInstanceDueDate(instanceId)` - read an instance's due date

### Feature
- `app/features/permanentTask/utils/permanentTaskActions.ts`
  - `pushPermanentTaskForward()` syncs due date to both tables
  - `reassignPermanentTask()` syncs due date to both tables when changed

## Data Flow

```
UsePermanentTaskScreen (date picker)
  → taskActions.createTask('permanent', { templateId, dueDate })
    → createPermanentTask()
      → savePermanentInstance()   → template_instances.dueDate
      → saveTask()                → tasks.due_date

reassignTask(task, { dueDate })
  ├── one_off:    saveTask()                → tasks.due_date
  └── permanent:  savePermanentInstance()    → template_instances.dueDate
                  updateInstanceDueDate()    → tasks.due_date
```
