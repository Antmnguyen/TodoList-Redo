// app/screens/today/TodayScreen.tsx
// =============================================================================
// TODAY SCREEN
// =============================================================================
//
// Displays only tasks that are due today.
// Nearly identical to AllTasksScreen, but with date filtering.
//
// FILTER LOGIC:
//   Uses filterTasksDueToday() from app/core/utils/taskFilters.ts
//   Only shows tasks where dueDate falls within today (midnight to midnight)
//
// SORT LOGIC:
//   Uses sortTasksByCompletion() from app/core/utils/taskSorting.ts
//   Uncompleted tasks appear first, completed tasks at the bottom
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTasks } from '../../core/hooks/useTasks';
import { TaskList } from '../../components/tasks/TaskList';
import { EditTaskModal, EditTaskData } from '../../components/tasks/EditTaskModal';
import { filterTasksDueToday } from '../../core/utils/taskFilters';
import { sortTasksByCompletion } from '../../core/utils/taskSorting';
import { Task } from '../../core/types/task';
import { useTheme } from '../../theme/ThemeContext';

// =============================================================================
// COMPONENT
// =============================================================================

export const TodayScreen: React.FC = () => {
  // ---------------------------------------------------------------------------
  // Hook providing task data and operations
  // Location: app/core/hooks/useTasks.ts
  // ---------------------------------------------------------------------------
  const { theme } = useTheme();
  const { tasks, toggleTask, removeTask, editTask } = useTasks();

  // ---------------------------------------------------------------------------
  // Edit modal state
  // ---------------------------------------------------------------------------
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // ---------------------------------------------------------------------------
  // Filter: Only tasks due today
  // Uses filterTasksDueToday from app/core/utils/taskFilters.ts
  // ---------------------------------------------------------------------------
  const todayTasks = useMemo(() => filterTasksDueToday(tasks), [tasks]);

  // ---------------------------------------------------------------------------
  // Sort: Uncompleted first, completed last
  // Uses sortTasksByCompletion from app/core/utils/taskSorting.ts
  // ---------------------------------------------------------------------------
  const sortedTasks = useMemo(() => sortTasksByCompletion(todayTasks), [todayTasks]);

  // ---------------------------------------------------------------------------
  // Calculate active (uncompleted) count for subtitle
  // ---------------------------------------------------------------------------
  const activeCount = todayTasks.filter(t => !t.completed).length;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  // Called when user taps on a task (not the checkbox)
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditModalVisible(true);
  };

  // Called when user saves changes in edit modal
  // Data flow: EditTaskModal → this handler → useTasks.editTask → taskActions.reassignTask
  const handleSaveEdit = (taskId: string, updates: EditTaskData) => {
    editTask(taskId, {
      title: updates.title,
      dueDate: updates.dueDate,
    });
    setEditModalVisible(false);
    setEditingTask(null);
  };

  const handleCloseEdit = () => {
    setEditModalVisible(false);
    setEditingTask(null);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bgScreen }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.subtitle}>
          {activeCount} {activeCount === 1 ? 'task' : 'tasks'} remaining
        </Text>
      </View>

      {/* Task List */}
      <TaskList
        tasks={sortedTasks}
        onToggle={toggleTask}
        onDelete={removeTask}
        onEdit={handleEditTask}
        emptyMessage="No tasks due today!"
      />

      {/* Edit Task Modal */}
      <EditTaskModal
        visible={editModalVisible}
        task={editingTask}
        onSave={handleSaveEdit}
        onClose={handleCloseEdit}
      />
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#34C759', // Green - distinct from All Tasks (blue)
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
  },
});
