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

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTasks } from '../../core/hooks/useTasks';
import { TaskList } from '../../components/tasks/TaskList';
import { filterTasksDueToday } from '../../core/utils/taskFilters';
import { sortTasksByCompletion } from '../../core/utils/taskSorting';

// =============================================================================
// COMPONENT
// =============================================================================

export const TodayScreen: React.FC = () => {
  // ---------------------------------------------------------------------------
  // Hook providing task data and operations
  // Location: app/core/hooks/useTasks.ts
  // ---------------------------------------------------------------------------
  const { tasks, toggleTask, removeTask } = useTasks();

  // ---------------------------------------------------------------------------
  // Filter: Only tasks due today
  // ---------------------------------------------------------------------------
  // Uses filterTasksDueToday from app/core/utils/taskFilters.ts
  // Returns tasks where dueDate >= start of today AND dueDate < start of tomorrow
  // ---------------------------------------------------------------------------
  const todayTasks = useMemo(() => filterTasksDueToday(tasks), [tasks]);

  // ---------------------------------------------------------------------------
  // Sort: Uncompleted first, completed last
  // ---------------------------------------------------------------------------
  // Uses sortTasksByCompletion from app/core/utils/taskSorting.ts
  // Memoized to avoid re-sorting on every render
  // ---------------------------------------------------------------------------
  const sortedTasks = useMemo(() => sortTasksByCompletion(todayTasks), [todayTasks]);

  // ---------------------------------------------------------------------------
  // Calculate active (uncompleted) count for subtitle
  // ---------------------------------------------------------------------------
  const activeCount = todayTasks.filter(t => !t.completed).length;

  return (
    <SafeAreaView style={styles.container}>
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
        emptyMessage="No tasks due today!"
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
