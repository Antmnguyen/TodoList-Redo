// app/screens/tasks/AllTasksScreen.tsx
// =============================================================================
// ALL TASKS SCREEN
// =============================================================================
//
// Screen that displays all tasks.
// This is a pure display screen - navigation and FAB are handled by TasksStack.
//
// RESPONSIBILITIES:
// - Display task list
// - Handle task toggle (complete/uncomplete)
// - Handle task deletion
//
// NOT RESPONSIBLE FOR (handled by TasksStack):
// - FloatingCreateTaskButton
// - Navigation to other screens
// - CreateTaskModal
// =============================================================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTasks } from '../../core/hooks/useTasks';
import { TaskList } from '../../components/tasks/TaskList';
import { sortTasksByCompletion } from '../../core/utils/taskSorting';

export const AllTasksScreen: React.FC = () => {
  // Hook providing task data and operations
  const { tasks, toggleTask, removeTask } = useTasks();

  // -------------------------------------------------------------------------
  // Sort tasks: uncompleted first, completed last
  // -------------------------------------------------------------------------
  // Uses sortTasksByCompletion from app/core/utils/taskSorting.ts
  // Memoized to avoid re-sorting on every render (only when tasks change)
  // -------------------------------------------------------------------------
  const sortedTasks = useMemo(() => sortTasksByCompletion(tasks), [tasks]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>All Tasks</Text>
        <Text style={styles.subtitle}>
          {tasks.filter(t => !t.completed).length} active
        </Text>
      </View>

      <TaskList
        tasks={sortedTasks}
        onToggle={toggleTask}
        onDelete={removeTask}
        emptyMessage="No tasks yet. Tap + to add one."
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#007AFF',
  },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: '#fff', opacity: 0.8 },
});
