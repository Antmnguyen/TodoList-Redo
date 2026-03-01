// app/screens/tasks/TaskDetailsScreen.tsx
// =============================================================================
// TASK DETAILS SCREEN  (placeholder — not yet implemented)
// =============================================================================
//
// WHAT THIS SCREEN WILL BE:
//   A full-screen view dedicated to a single task. When you tap on a task
//   anywhere in the app and want to see everything about it in one place —
//   rather than just editing a couple of fields in a small popup — this is
//   the screen that will open.
//
// WHAT YOU WILL SEE ON SCREEN (planned):
//   - The task title, large and prominent at the top
//   - Its due date, displayed in a human-readable format ("Due today",
//     "Due Mon, Feb 3", "Overdue by 2 days", etc.)
//   - Its completion status, with a large checkbox or status badge
//   - The category it belongs to (colour-coded pill)
//   - Any location associated with the task
//   - Notes or description field (free-form text the user can add)
//   - If it is an instance of a permanent task template, a link/label
//     identifying which template it came from
//   - Action buttons: Mark Complete, Edit, Delete
//
// HOW YOU WILL GET TO THIS SCREEN (planned):
//   From AllTasksScreen — instead of (or in addition to) the small edit popup,
//   tapping a task row could navigate here for a full-screen view.
//   May also be reachable from TodayScreen or any task list in the app.
//
// DATA IT WILL NEED:
//   - The task ID (passed as a navigation parameter) to look up the full
//     task object from storage
//   - Alternatively, the full task object passed directly as a navigation param
//   - For permanent task instances: the parent template's data
//
// HOW IT WILL FIT INTO NAVIGATION:
//   This screen will live inside the TasksStack navigator.
//   It will receive the task ID (or task object) via React Navigation route params,
//   e.g.:  navigation.navigate('TaskDetails', { taskId: 'abc123' })
//
// WHY IT IS EMPTY NOW:
//   The current edit flow uses a small modal popup (EditTaskModal) that slides
//   up from the bottom. A full details screen is planned for a future sprint
//   once the core task features are more stable.
//
// =============================================================================
