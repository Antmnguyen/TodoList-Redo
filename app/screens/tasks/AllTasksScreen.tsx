// app/screens/tasks/AllTasksScreen.tsx
// =============================================================================
// ALL TASKS SCREEN
// =============================================================================
//
// Screen that displays all tasks.
//
// RESPONSIBILITIES:
// - Display task list
// - Handle task toggle (complete/uncomplete)
// - Handle task deletion
// - Handle task editing (via EditTaskModal popup)
//
// NOT RESPONSIBLE FOR (handled by MainNavigator):
// - FloatingCreateTaskButton
// - Navigation to other screens
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTasks } from '../../core/hooks/useTasks';
import { TaskList } from '../../components/tasks/TaskList';
import { EditTaskModal, EditTaskData } from '../../components/tasks/EditTaskModal';
import { sortTasksByCompletion } from '../../core/utils/taskSorting';
import { Task } from '../../core/types/task';

// =============================================================================
// COMPONENT
// =============================================================================

export const AllTasksScreen: React.FC = () => {
  // ---------------------------------------------------------------------------
  // Hook providing task data and operations
  // Location: app/core/hooks/useTasks.ts
  // ---------------------------------------------------------------------------
  const { tasks, toggleTask, removeTask, editTask } = useTasks();

  // ---------------------------------------------------------------------------
  // Edit modal state
  // ---------------------------------------------------------------------------
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // ---------------------------------------------------------------------------
  // Sort tasks: uncompleted first, completed last
  // Uses sortTasksByCompletion from app/core/utils/taskSorting.ts
  // ---------------------------------------------------------------------------
  const sortedTasks = useMemo(() => sortTasksByCompletion(tasks), [tasks]);

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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>All Tasks</Text>
        <Text style={styles.subtitle}>
          {tasks.filter(t => !t.completed).length} active
        </Text>
      </View>

      {/* Task List */}
      <TaskList
        tasks={sortedTasks}
        onToggle={toggleTask}
        onDelete={removeTask}
        onEdit={handleEditTask}
        emptyMessage="No tasks yet. Tap + to add one."
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
    backgroundColor: '#007AFF',
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
