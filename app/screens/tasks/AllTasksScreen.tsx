// app/screens/tasks/AllTasksScreen.tsx
// =============================================================================
// ALL TASKS SCREEN
// =============================================================================
//
// WHAT YOU SEE ON SCREEN:
//   A blue header at the top that says "All Tasks" and shows how many active
//   (not yet completed) tasks you have. Below that is a scrollable list of
//   every task you've ever created, sorted so incomplete tasks appear first
//   and completed tasks sink to the bottom.
//
// WHAT YOU CAN DO ON THIS SCREEN:
//   - Check off a task (tap the checkbox) to mark it complete — or tap again
//     to uncheck it
//   - Swipe or tap the delete button on a task to permanently remove it
//   - Tap on the task title/body (not the checkbox) to open an edit popup
//     where you can rename the task or change its due date
//
// WHAT THIS SCREEN DOES NOT HANDLE:
//   - The "+" floating button to create a new task — that is placed on top of
//     this screen by the navigation layer (MainNavigator)
//   - Navigating to other tabs — also handled by MainNavigator
//
// WHERE DATA COMES FROM:
//   All task data is read from the useTasks hook, which talks to local storage.
//   When you toggle, delete, or edit a task, the change goes through the same
//   hook, gets saved to storage, and the list updates automatically.
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTasks } from '../../core/hooks/useTasks';
import { TaskList } from '../../components/tasks/TaskList';
import { EditTaskModal, EditTaskData } from '../../components/tasks/EditTaskModal';
import { sortTasksByCompletion } from '../../core/utils/taskSorting';
import { Task } from '../../core/types/task';
import { useTheme } from '../../theme/ThemeContext';
import { Screen } from '../../components/layout/Screen';

// =============================================================================
// COMPONENT
// =============================================================================

export const AllTasksScreen: React.FC = () => {
  // ---------------------------------------------------------------------------
  // useTasks gives us the full list of tasks from storage and four actions:
  //   tasks      — the array of every task object
  //   toggleTask — marks a task complete or incomplete by its ID
  //   removeTask — permanently deletes a task by its ID
  //   editTask   — updates a task's title or due date by its ID
  // Location: app/core/hooks/useTasks.ts
  // ---------------------------------------------------------------------------
  const { theme } = useTheme();
  const { tasks, toggleTask, removeTask, editTask } = useTasks();

  // ---------------------------------------------------------------------------
  // Edit modal state
  // editingTask    — which task the user tapped on (or null if none)
  // editModalVisible — whether the edit popup is currently visible
  // Both are null/false by default; they get set when the user taps a task.
  // ---------------------------------------------------------------------------
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // ---------------------------------------------------------------------------
  // Sort tasks so incomplete tasks appear first and completed tasks last.
  // useMemo means this re-sorts only when the tasks array actually changes,
  // not on every render — keeps the screen fast.
  // Uses sortTasksByCompletion from app/core/utils/taskSorting.ts
  // ---------------------------------------------------------------------------
  const sortedTasks = useMemo(() => sortTasksByCompletion(tasks), [tasks]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // These are the functions that run when the user does something.
  // ---------------------------------------------------------------------------

  // Called when the user taps on a task row (but NOT on its checkbox).
  // Stores which task was tapped and opens the edit popup.
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditModalVisible(true);
  };

  // Called when the user taps "Save" inside the edit popup.
  // Takes the new title and/or new due date and passes them through the chain:
  //   EditTaskModal → handleSaveEdit → useTasks.editTask → taskActions.reassignTask → storage
  const handleSaveEdit = (taskId: string, updates: EditTaskData) => {
    editTask(taskId, {
      title: updates.title,
      dueDate: updates.dueDate,
    });
    setEditModalVisible(false);
    setEditingTask(null);
  };

  // Called when the user taps "Cancel" inside the edit popup, or taps outside
  // it to dismiss it. Closes the popup without saving any changes.
  const handleCloseEdit = () => {
    setEditModalVisible(false);
    setEditingTask(null);
  };

  // ---------------------------------------------------------------------------
  // RENDER — what gets drawn on screen
  // ---------------------------------------------------------------------------
  return (
    // SafeAreaView ensures content doesn't overlap the phone's notch or home bar
    <Screen edges={['top']} topColor="#007AFF" style={[styles.container, { backgroundColor: theme.bgScreen }]}>

      {/* ===================================================================
          HEADER BANNER
          A solid blue rectangle at the top of the screen containing:
            - "All Tasks" in large white bold text (the screen title)
            - A smaller line below it like "3 active" showing how many tasks
              are not yet completed. This count updates live as you check off
              tasks.
          =================================================================== */}
      <View style={styles.header}>
        <Text style={styles.title}>All Tasks</Text>
        <Text style={styles.subtitle}>
          {tasks.filter(t => !t.completed).length} active
        </Text>
      </View>

      {/* ===================================================================
          TASK LIST
          A scrollable list of every task. Each row shows:
            - A checkbox on the left (tap to complete/uncomplete)
            - The task title and due date
            - A delete button (swipe or tap) on the right
          Tapping the task body (not the checkbox) fires handleEditTask and
          opens the edit modal below.
          If there are no tasks at all, shows the message "No tasks yet. Tap
          + to add one." in the centre of the screen.
          The list receives the sorted tasks so completed ones are always at
          the bottom.
          =================================================================== */}
      <TaskList
        tasks={sortedTasks}
        onToggle={toggleTask}
        onDelete={removeTask}
        onEdit={handleEditTask}
        emptyMessage="No tasks yet. Tap + to add one."
      />

      {/* ===================================================================
          EDIT TASK MODAL (popup sheet)
          This popup slides up from the bottom when the user taps a task.
          It is invisible (visible=false) until handleEditTask sets
          editModalVisible to true.
          Inside the popup the user can:
            - Edit the task title (text input pre-filled with current title)
            - Change the due date
            - Tap "Save" to confirm changes (fires handleSaveEdit)
            - Tap "Cancel" or dismiss to close without saving (fires handleCloseEdit)
          =================================================================== */}
      <EditTaskModal
        visible={editModalVisible}
        task={editingTask}
        onSave={handleSaveEdit}
        onClose={handleCloseEdit}
      />
    </Screen>
  );
};

// =============================================================================
// STYLES
// Visual appearance definitions — matched to their elements above.
// =============================================================================

const styles = StyleSheet.create({
  // The root wrapper that fills the whole screen.
  // Light grey background (#f5f5f5) is visible in the gaps around white cards.
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // The blue banner at the top. Extra paddingTop (60) pushes content below
  // the status bar on devices that don't use SafeAreaView padding automatically.
  header: {
    padding: 20,
    backgroundColor: '#007AFF', // Apple blue
  },
  // "All Tasks" — large, bold, white, intended to look like a nav bar title
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  // "3 active" — smaller, white, slightly transparent to feel like a subtitle
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
  },
});
