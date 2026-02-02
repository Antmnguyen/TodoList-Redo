# Sprint 3: Permanent Tasks UI Integration

## Summary
Connected permanent task creation/usage screens to backend storage via TasksStack navigation.

## Files Changed
- `App.tsx` - Loads TasksStack instead of AllTasksScreen
- `app/navigation/stacks/TasksStack.tsx` - Navigation handler + FAB + refreshKey for reloading
- `app/screens/tasks/AllTasksScreen.tsx` - Pure display screen (FAB moved to TasksStack)
- `app/screens/tasks/CreatePermanentTaskScreen.tsx` - Connected to `createTask` backend
- `app/screens/tasks/UsePermanentTaskScreen.tsx` - Template selection + date picker
- `app/features/permanentTask/utils/permanentTaskActions.ts` - Instances now save to `tasks` table
- `package.json` - Added `@react-native-community/datetimepicker`

## Architecture
```
TasksStack (navigation + FAB + refresh logic)
├── AllTasksScreen (task list from tasks table)
├── CreatePermanentTaskScreen (create template → templates table)
└── UsePermanentTaskScreen (use template → instance in both tables)
```

## Data Flow
1. **Create template**: FAB → CreatePermanentTaskScreen → `templates` table + `template_stats`
2. **Use template**: FAB → UsePermanentTaskScreen → pick template + set date → `template_instances` + `tasks` table
3. **View tasks**: AllTasksScreen reads from `tasks` table (includes permanent instances)

## TODO
- [ ] Add taskType to PermanentTask schema (requires storage restructure)
- [ ] Save dueDate to tasks table (schema update needed)
- [ ] Group templates by taskType in UsePermanentTaskScreen
- [ ] Add search/filter to UsePermanentTaskScreen
- [ ] Show template stats preview before selection
- [ ] Custom title override when creating instance
- [ ] Pull-to-refresh on AllTasksScreen
