// app/components/stats/detail/category/PermanentTaskListCard.tsx
// =============================================================================
// PERMANENT TASK LIST CARD
// =============================================================================
//
// Compact list of permanent task templates that belong to the current category.
// Each row shows the task name, an inline completion bar, and the completion %.
// Rows are tappable — pressing one navigates to PermanentDetailScreen for that
// task via onTaskPress.
//
// Visual:
//
//   Permanent Tasks in Work
//   ┌───────────────────────────────────┐
//   │ Morning Standup    ████████░░ 80% │  ← tappable
//   │ Weekly Review      ██████░░░░ 60% │  ← tappable
//   │ Code Review        █████░░░░░ 50% │  ← tappable
//   └───────────────────────────────────┘
//
// Props:
//   tasks       - array of permanent task stats for this category
//   color       - category accent color (used for bar fill and % label)
//   onTaskPress - called with (id, name, color) when a row is tapped;
//                 should fire handleStatCardPress({ type: 'template', ... })
//
// Used by:
//   CategoryDetailScreen only
//
// =============================================================================

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../../../theme/ThemeContext';
import type { AppTheme } from '../../../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface PermanentTaskStat {
  id:             string;
  name:           string;
  completed:      number;
  total:          number;
  completionRate: number;  // 0–100
}

interface PermanentTaskListCardProps {
  tasks:       PermanentTaskStat[];
  /** Category accent color — used for bar fills and % labels */
  color:       string;
  /**
   * Called when the user taps a task row.
   * Third arg is the permanent task color ('#007AFF') for the detail screen.
   * CategoryDetailScreen maps this to handleStatCardPress({ type: 'template', id, name, color }).
   */
  onTaskPress: (id: string, name: string, color: string) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Standard accent color for permanent task detail screens */
const PERM_COLOR = '#007AFF';

// =============================================================================
// COMPONENT
// =============================================================================

export const PermanentTaskListCard: React.FC<PermanentTaskListCardProps> = ({
  tasks,
  color,
  onTaskPress,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (tasks.length === 0) return null;

  return (
    <View style={styles.card}>

      {/* Section label */}
      <Text style={[styles.sectionLabel, { color }]}>PERMANENT TASKS</Text>

      {/* Task rows */}
      {tasks.map((task, i) => (
        <TouchableOpacity
          key={task.id}
          style={[styles.row, i < tasks.length - 1 && styles.rowBorder]}
          onPress={() => onTaskPress(task.id, task.name, PERM_COLOR)}
          activeOpacity={0.7}
        >
          {/* Task name */}
          <Text style={styles.taskName} numberOfLines={1}>{task.name}</Text>

          {/* Inline completion bar */}
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width:           `${task.completionRate}%`,
                  backgroundColor: color,
                },
              ]}
            />
          </View>

          {/* Completion rate % */}
          <Text style={[styles.rate, { color }]}>{task.completionRate}%</Text>

          {/* Tap hint chevron */}
          <Text style={styles.chevron}>›</Text>

        </TouchableOpacity>
      ))}

    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor:  theme.bgCard,
      borderRadius:     18,
      marginHorizontal: 16,
      marginBottom:     12,
      padding:          20,
      shadowColor:      '#000',
      shadowOffset:     { width: 0, height: 2 },
      shadowOpacity:    0.07,
      shadowRadius:     8,
      elevation:        3,
    },

    sectionLabel: {
      fontSize:      11,
      fontWeight:    '800',
      letterSpacing: 1.1,
      marginBottom:  14,
    },

    row: {
      flexDirection:  'row',
      alignItems:     'center',
      paddingVertical: 10,
      gap:            10,
    },

    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.separator,
    },

    // Task name — takes a fixed chunk then the bar fills remaining space
    taskName: {
      width:      130,
      fontSize:   14,
      fontWeight: '600',
      color:      theme.textPrimary,
      flexShrink: 0,
    },

    barTrack: {
      flex:            1,
      height:          6,
      borderRadius:    3,
      backgroundColor: theme.separator,
      overflow:        'hidden',
    },

    barFill: {
      height:       6,
      borderRadius: 3,
    },

    rate: {
      width:      38,
      fontSize:   13,
      fontWeight: '700',
      textAlign:  'right',
      flexShrink: 0,
    },

    chevron: {
      fontSize:   18,
      color:      theme.textDisabled,
      fontWeight: '400',
      lineHeight: 22,
      flexShrink: 0,
    },
  });
}
