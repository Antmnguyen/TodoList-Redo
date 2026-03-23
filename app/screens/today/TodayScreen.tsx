// app/screens/today/TodayScreen.tsx
// =============================================================================
// TODAY SCREEN
// =============================================================================
//
// Displays tasks filtered by the selected time range: Day, Week, Month, or a
// user-chosen reference date.
//
// REFERENCE DATE MODEL
// --------------------
// All filter tabs share a single referenceDate (defaults to today).  The
// "Select Date" tab opens a date picker so the user can shift that anchor.
// Every other tab immediately re-filters relative to the new date:
//
//   day    → tasks due on referenceDate
//   week   → tasks due in the ISO week containing referenceDate (Mon–Sun)
//   month  → tasks due in the calendar month containing referenceDate
//   select → same window as 'day'; its purpose is to open the date picker
//
// Example: user picks 2025-03-05.
//   "Today"      → tasks due on March 5, 2025
//   "This Week"  → tasks due Feb 24 – Mar 2, 2025  (Mon–Sun of that week)
//   "This Month" → tasks due in March 2025
//
// SORT LOGIC
// ----------
// Uses sortTasksByCompletionAndCategory() — incomplete first, complete last;
// within each group, same-category tasks are adjacent.
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
// Native date/time picker — same package used by EditTaskModal.
// Android: OS system dialog, auto-dismisses after selection.
// iOS: inline spinner; dismissed via "Done" button.
import DateTimePicker from '@react-native-community/datetimepicker';
import { Screen } from '../../components/layout/Screen';
import { useTasks } from '../../core/hooks/useTasks';
import { TaskList } from '../../components/tasks/TaskList';
import { EditTaskModal, EditTaskData } from '../../components/tasks/EditTaskModal';
import {
  filterTasksDueToday,
  filterTasksDueThisWeek,
  filterTasksDueThisMonth,
} from '../../core/utils/taskFilters';
import { sortTasksByCompletionAndCategory } from '../../core/utils/taskSorting';
import { Task } from '../../core/types/task';
import { useTheme } from '../../theme/ThemeContext';

// =============================================================================
// TYPES / CONSTANTS
// =============================================================================

// 'select' opens the date picker to change the shared reference date.
type FilterTab = 'day' | 'week' | 'month' | 'select';

const FILTER_TABS: FilterTab[] = ['day', 'week', 'month', 'select'];

// Static labels; the 'select' tab label is overridden dynamically by
// getTabLabel() once the user has explicitly chosen a date.
const FILTER_LABELS: Record<FilterTab, string> = {
  day:    'Today',
  week:   'This Week',
  month:  'This Month',
  select: 'Select Date',
};

const ACCENT = '#34C759'; // green — the Today screen brand colour

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Returns the label shown on a filter tab pill.
 *
 * For 'select': once the user has explicitly chosen a date, shows a short
 * date string (e.g. "Mar 5") so it's clear which reference date is active.
 * Falls back to "Select Date" until the picker has been used.
 *
 * All other tabs always show their static label.
 */
function getTabLabel(tab: FilterTab, hasCustomDate: boolean, referenceDate: Date): string {
  if (tab === 'select' && hasCustomDate) {
    return referenceDate.toLocaleDateString('en-US', {
      month: 'short',
      day:   'numeric',
    });
  }
  return FILTER_LABELS[tab];
}

// =============================================================================
// COMPONENT
// =============================================================================

export const TodayScreen: React.FC = () => {
  const { theme } = useTheme();
  const { tasks, toggleTask, removeTask, editTask } = useTasks();

  // ── Filter tab state ────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState<FilterTab>('day');

  // Shared anchor date for all filter calculations.
  // Initialised to today so all tabs behave normally by default.
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());

  // True once the user has explicitly chosen a date via the picker.
  // Only affects the 'select' tab label — not the filter logic itself.
  const [hasCustomDate, setHasCustomDate] = useState(false);

  // Controls the inline DateTimePicker.
  // iOS: renders below the filter bar.
  // Android: OS dialog; showDatePicker is set to false in handleDatePickerChange
  //          to mirror the OS auto-dismiss.
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Edit modal state ────────────────────────────────────────────────────────
  const [editingTask, setEditingTask]       = useState<Task | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // ── Filter + sort ───────────────────────────────────────────────────────────

  // Re-computes whenever tasks, the active tab, or the reference date changes.
  // 'select' uses the same day-window as 'day' — it's just the picker trigger.
  const filteredTasks = useMemo(() => {
    switch (activeFilter) {
      case 'day':
      case 'select': return filterTasksDueToday(tasks, referenceDate);
      case 'week':   return filterTasksDueThisWeek(tasks, referenceDate);
      case 'month':  return filterTasksDueThisMonth(tasks, referenceDate);
    }
  }, [tasks, activeFilter, referenceDate]);

  const sortedTasks  = useMemo(() => sortTasksByCompletionAndCategory(filteredTasks), [filteredTasks]);
  const activeCount  = filteredTasks.filter(t => !t.completed).length;

  // ── Handlers ────────────────────────────────────────────────────────────────

  /**
   * Called when a filter tab pill is tapped.
   * 'select' opens the date picker so the user can update the reference date.
   * All other tabs simply switch the active filter; they auto-recompute using
   * whatever referenceDate is already set.
   */
  const handleTabPress = (tab: FilterTab) => {
    setActiveFilter(tab);
    if (tab === 'select') {
      // Open picker every tap so the user can always adjust their selection.
      setShowDatePicker(true);
    } else {
      // Dismiss the picker if it was left open from a 'select' interaction.
      setShowDatePicker(false);
    }
  };

  /**
   * Called by DateTimePicker on every value change.
   * Updates the shared referenceDate so all tabs instantly re-anchor.
   * On Android mirrors the OS auto-dismiss by setting showDatePicker(false).
   */
  const handleDatePickerChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setReferenceDate(date);
      // Flag that an explicit selection has been made so the tab label updates.
      setHasCustomDate(true);
    }
  };

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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Screen edges={['top']} topColor={ACCENT} style={[styles.container, { backgroundColor: theme.bgScreen }]}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.subtitle}>
          {activeCount} {activeCount === 1 ? 'task' : 'tasks'} remaining
        </Text>
      </View>

      {/* -----------------------------------------------------------------------
          FILTER TAB BAR
          All tabs anchor to referenceDate.  Tapping "Select Date" opens an
          inline date picker below the bar to let the user change that anchor.
         ----------------------------------------------------------------------- */}
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
            onPress={() => handleTabPress(tab)}
          >
            <Text style={[
              styles.filterTabText,
              { color: theme.textSecondary },
              activeFilter === tab && styles.filterTabTextActive,
            ]}>
              {getTabLabel(tab, hasCustomDate, referenceDate)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* -----------------------------------------------------------------------
          INLINE DATE PICKER
          Shown below the filter bar when the 'select' tab is tapped.
          No maximumDate restriction — unlike history, tasks can be due in the
          future so the user should be able to browse any date.
         ----------------------------------------------------------------------- */}
      {showDatePicker && (
        <View style={[styles.datePickerContainer, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}>
          <DateTimePicker
            value={referenceDate}
            mode="date"
            // iOS: spinner style matches EditTaskModal.
            // Android: native system dialog.
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDatePickerChange}
            // No maximumDate — tasks can be due on future dates.
          />

          {/* iOS keeps the spinner open; "Done" dismisses it. */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.datePickerDoneBtn}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={[styles.datePickerDoneBtnText, { color: ACCENT }]}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
    padding:         20,
    backgroundColor: ACCENT,
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
    paddingVertical:   4,
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

  // ── Inline date picker ────────────────────────────────────────────────────
  // Rendered below the filter bar so the task list stays visible underneath.
  datePickerContainer: {
    borderBottomWidth: 1,
    // No extra padding — DateTimePicker owns its internal spacing.
  },
  // "Done" button only shown on iOS to close the persistent spinner picker.
  datePickerDoneBtn: {
    alignSelf:         'flex-end',
    paddingVertical:   8,
    paddingHorizontal: 16,
  },
  datePickerDoneBtnText: {
    fontSize:   16,
    fontWeight: '600',
    // colour applied inline using ACCENT constant
  },
});
