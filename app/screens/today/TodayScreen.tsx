// app/screens/today/TodayScreen.tsx
// =============================================================================
// TODAY SCREEN
// =============================================================================
//
// Displays tasks filtered by the selected time range: Day, Week, or Month.
//
// FILTER LOGIC:
//   Day   → filterTasksDueToday()
//   Week  → filterTasksDueThisWeek()
//   Month → filterTasksDueThisMonth()
//
// SORT LOGIC:
//   Uses sortTasksByCompletion() — uncompleted tasks first, completed last
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { useTasks } from '../../core/hooks/useTasks';
import { TaskList } from '../../components/tasks/TaskList';
import { EditTaskModal, EditTaskData } from '../../components/tasks/EditTaskModal';
import {
  filterTasksDueToday,
  filterTasksDueThisWeek,
  filterTasksDueThisMonth,
} from '../../core/utils/taskFilters';
import { sortTasksByCompletion } from '../../core/utils/taskSorting';
import { Task } from '../../core/types/task';
import { useTheme } from '../../theme/ThemeContext';

// =============================================================================
// TYPES / CONSTANTS
// =============================================================================

type FilterTab = 'day' | 'week' | 'month';

const FILTER_TABS: FilterTab[] = ['day', 'week', 'month'];

const FILTER_LABELS: Record<FilterTab, string> = {
  day:   'Today',
  week:  'This Week',
  month: 'This Month',
};

const ACCENT = '#34C759'; // green — the Today screen brand colour

// =============================================================================
// COMPONENT
// =============================================================================

export const TodayScreen: React.FC = () => {
  const { theme } = useTheme();
  const { tasks, toggleTask, removeTask, editTask } = useTasks();

  // ---------------------------------------------------------------------------
  // Filter tab state
  // ---------------------------------------------------------------------------
  const [activeFilter, setActiveFilter] = useState<FilterTab>('day');

  // ---------------------------------------------------------------------------
  // Edit modal state
  // ---------------------------------------------------------------------------
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // ---------------------------------------------------------------------------
  // Filter + sort
  // ---------------------------------------------------------------------------
  const filteredTasks = useMemo(() => {
    switch (activeFilter) {
      case 'day':   return filterTasksDueToday(tasks);
      case 'week':  return filterTasksDueThisWeek(tasks);
      case 'month': return filterTasksDueThisMonth(tasks);
    }
  }, [tasks, activeFilter]);

  const sortedTasks = useMemo(() => sortTasksByCompletion(filteredTasks), [filteredTasks]);

  const activeCount = filteredTasks.filter(t => !t.completed).length;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditModalVisible(true);
  };

  const handleSaveEdit = (taskId: string, updates: EditTaskData) => {
    editTask(taskId, { title: updates.title, dueDate: updates.dueDate });
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
    <Screen edges={['top']} topColor={ACCENT} style={[styles.container, { backgroundColor: theme.bgScreen }]}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.subtitle}>
          {activeCount} {activeCount === 1 ? 'task' : 'tasks'} remaining
        </Text>
      </View>

      {/* Filter Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}
        contentContainerStyle={styles.filterBarContent}
      >
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.filterTab,
              { backgroundColor: theme.bgInput },
              activeFilter === tab && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(tab)}
          >
            <Text style={[
              styles.filterTabText,
              { color: theme.textSecondary },
              activeFilter === tab && styles.filterTabTextActive,
            ]}>
              {FILTER_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Task List */}
      <TaskList
        tasks={sortedTasks}
        onToggle={toggleTask}
        onDelete={removeTask}
        onEdit={handleEditTask}
        emptyMessage={`No tasks due ${FILTER_LABELS[activeFilter].toLowerCase()}!`}
      />

      {/* Edit Task Modal */}
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
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding:          20,
    backgroundColor:  ACCENT,
  },
  title: {
    fontSize:   32,
    fontWeight: 'bold',
    color:      '#fff',
  },
  subtitle: {
    fontSize: 16,
    color:    '#fff',
    opacity:  0.8,
  },

  // ── Filter tab bar ────────────────────────────────────────────────────────
  filterBar: {
    borderBottomWidth: 1,
    flexShrink:        0,
    flexGrow:          0,
  },
  filterBarContent: {
    paddingHorizontal: 12,
    paddingVertical:   6,
    gap:               8,
    flexDirection:     'row',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:      14,
  },
  filterTabActive: {
    backgroundColor: ACCENT,
  },
  filterTabText: {
    fontSize:   13,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
  },
});
