// app/components/tasks/TaskItem.tsx
// =============================================================================
// TASK ITEM COMPONENT
// =============================================================================
//
// Single task card with three interaction zones:
//   1. Checkbox (left)  → Toggle completion
//   2. Task body (center) → Edit task (opens modal)
//   3. Delete button (right) → Delete task
//
// =============================================================================

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Task } from '../../core/types/task';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

type TaskItemProps = {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (task: Task) => void;  // Optional: opens edit modal
};

export const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onDelete, onEdit }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Checkbox colour varies by task kind — purple for permanent, blue for one-off
  const checkboxColor = task.kind === 'permanent'
    ? theme.checkboxBorderPermanent
    : theme.checkboxBorderOneOff;

  return (
    <View style={[styles.container, task.completed && styles.containerCompleted]}>
      {/* Checkbox - tap to toggle completion */}
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => onToggle(task.id)}
      >
        <View style={[
          styles.checkboxInner,
          { borderColor: checkboxColor },
          task.completed && { backgroundColor: checkboxColor },
        ]}>
          {task.completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>

      {/* Task Body - tap to edit */}
      <TouchableOpacity
        style={styles.body}
        onPress={() => onEdit?.(task)}
        activeOpacity={onEdit ? 0.7 : 1}
      >
        <Text style={[
          styles.title,
          task.completed && styles.titleCompleted,
        ]}>
          {task.title}
        </Text>
        {/* Show due date if exists */}
        {task.dueDate && (
          <Text style={[
            styles.dueDate,
            task.completed && styles.dueDateCompleted,
          ]}>
            {formatDueDate(task.dueDate)}
          </Text>
        )}
      </TouchableOpacity>

      {/* Delete Button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(task.id)}
      >
        <Text style={styles.deleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

// =============================================================================
// HELPERS
// =============================================================================

function formatDueDate(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Reset time for comparison
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'Today';
  }
  if (dateOnly.getTime() === tomorrowOnly.getTime()) {
    return 'Tomorrow';
  }

  // Check if overdue
  if (dateOnly < todayOnly) {
    return `Overdue: ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: theme.bgCard,
      borderRadius: 8,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    containerCompleted: {
      opacity: 0.6,
    },
    checkbox: {
      marginRight: 12,
    },
    checkboxInner: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkmark: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    body: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      color: theme.textPrimary,
    },
    titleCompleted: {
      textDecorationLine: 'line-through',
      color: theme.completedText,
    },
    dueDate: {
      fontSize: 12,
      color: theme.textSecondary,
      marginTop: 4,
    },
    dueDateCompleted: {
      color: theme.completedText,
    },
    deleteButton: {
      padding: 4,
      marginLeft: 8,
    },
    deleteText: {
      fontSize: 20,
      color: theme.danger,
    },
  });
}
