// app/components/tasks/EditTaskModal.tsx
// =============================================================================
// EDIT TASK MODAL
// =============================================================================
//
// Popup modal for editing task title and due date.
// Triggered by tapping on a task (not the checkbox).
//
// DATA FLOW:
//   User taps task → TaskItem.onEdit(task) → Screen shows this modal
//   User edits and saves → onSave({ title, dueDate }) → Screen calls editTask
//
// BACKEND CONNECTION:
//   Screen calls useTasks.editTask(taskId, updates)
//   → taskActions.reassignTask(task, updates)
//   → taskStorage.saveTask(updated)
//
// =============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Task } from '../../core/types/task';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface EditTaskData {
  title: string;
  dueDate?: Date;
}

interface EditTaskModalProps {
  visible: boolean;
  task: Task | null;
  onSave: (taskId: string, updates: EditTaskData) => void;
  onClose: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  visible,
  task,
  onSave,
  onClose,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ---------------------------------------------------------------------------
  // Sync state when task changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDueDate(task.dueDate || new Date());
    }
  }, [task]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleSave = () => {
    if (!task) return;
    if (!title.trim()) return; // Don't save empty title

    onSave(task.id, {
      title: title.trim(),
      dueDate,
    });
    onClose();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    // On Android, picker closes automatically
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDueDate(selectedDate);
    }
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if same day
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }

    // Format as "Mon, Jan 15"
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (!task) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop - tap to close */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        {/* Modal content - prevent tap propagation */}
        <TouchableOpacity
          style={styles.content}
          activeOpacity={1}
          onPress={() => {}}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Edit Task</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Title Input */}
          <View style={styles.field}>
            <Text style={styles.label}>Task Name</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter task name"
              placeholderTextColor={theme.textTertiary}
              autoFocus
            />
          </View>

          {/* Due Date Picker */}
          <View style={styles.field}>
            <Text style={styles.label}>Due Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>{formatDate(dueDate)}</Text>
              <Text style={styles.dateButtonIcon}>📅</Text>
            </TouchableOpacity>
          </View>

          {/* Date Picker (shown inline on iOS, modal on Android) */}
          {showDatePicker && (
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={dueDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.datePickerDone}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 24,
    },
    content: {
      backgroundColor: theme.bgCard,
      borderRadius: 16,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    closeButton: {
      fontSize: 22,
      color: theme.textSecondary,
    },
    field: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
      marginBottom: 8,
    },
    input: {
      fontSize: 16,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: theme.bgInput,
    },
    dateButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      padding: 12,
      backgroundColor: theme.bgInput,
    },
    dateButtonText: {
      fontSize: 16,
      color: theme.textPrimary,
    },
    dateButtonIcon: {
      fontSize: 18,
    },
    datePickerContainer: {
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    datePickerDone: {
      alignSelf: 'flex-end',
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    datePickerDoneText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.accent,
    },
    actions: {
      flexDirection: 'row',
      padding: 20,
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      backgroundColor: theme.bgInput,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    saveButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textOnAccent,
    },
  });
}
