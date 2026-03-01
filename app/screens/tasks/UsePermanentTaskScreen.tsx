// app/screens/tasks/UsePermanentTaskScreen.tsx
// =============================================================================
// USE PERMANENT TASK SCREEN
// =============================================================================
//
// WHAT IS THIS SCREEN FOR?
//   This is step 2 of using a permanent task template. You already created a
//   template (in CreatePermanentTaskScreen) — now this screen lets you "stamp
//   out" a new task from that template for a specific due date.
//
// WHAT YOU SEE ON SCREEN:
//   A white navigation bar at the top with a "Cancel" button on the left and
//   the title "Use Template" in the centre. Below that, one of three states:
//     - LOADING: spinner + "Loading templates..."
//     - ERROR: red error message + Retry button
//     - TEMPLATE LIST: scrollable list of saved templates
//
//   Tapping a template opens an "Add Task" modal to pick a due date and confirm.
//
// =============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { createTask } from '../../core/domain/taskActions';
import {
  getAllPermanentTemplates,
  deletePermanentTask,
} from '../../features/permanentTask/utils/permanentTaskActions';
import { Task } from '../../core/types/task';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// =============================================================================
// DATE HELPERS
// =============================================================================

type QuickDateOption = 'today' | 'tomorrow' | 'custom';

const getQuickDate = (option: 'today' | 'tomorrow'): Date => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  if (option === 'tomorrow') {
    date.setDate(date.getDate() + 1);
  }
  return date;
};

const formatDateDisplay = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

// =============================================================================
// TYPES
// =============================================================================

interface SelectedTemplate {
  id: string;
  permanentId: string;
  title: string;
  location?: string;
}

export interface UsePermanentTaskScreenProps {
  onInstanceCreated?: (task: Task) => void;
  onCancel?: () => void;
  onEditTemplate?: (template: Task) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const UsePermanentTaskScreen: React.FC<UsePermanentTaskScreenProps> = ({
  onInstanceCreated,
  onCancel,
  onEditTemplate,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [templates, setTemplates] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<SelectedTemplate | null>(null);
  const [showInstanceModal, setShowInstanceModal] = useState(false);
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [selectedQuickOption, setSelectedQuickOption] = useState<QuickDateOption>('today');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedTemplates = await getAllPermanentTemplates();
      setTemplates(loadedTemplates);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleTemplateSelect = (template: Task) => {
    const metadata = template.metadata as any;
    setSelectedTemplate({
      id: template.id,
      permanentId: metadata?.permanentId || template.id,
      title: template.title,
      location: typeof template.location === 'object'
        ? (template.location as any).name
        : template.location,
    });
    setDueDate(getQuickDate('today'));
    setSelectedQuickOption('today');
    setShowDatePicker(false);
    setShowInstanceModal(true);
  };

  const handleQuickDateSelect = (option: 'today' | 'tomorrow') => {
    setSelectedQuickOption(option);
    setDueDate(getQuickDate(option));
    setShowDatePicker(false);
  };

  const handleCustomDatePress = () => {
    setSelectedQuickOption('custom');
    setShowDatePicker(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      setDueDate(selectedDate);
      setSelectedQuickOption('custom');
    }
  };

  const handleCreateInstance = async () => {
    if (!selectedTemplate) return;

    setIsCreating(true);

    try {
      const newInstance = await createTask(
        selectedTemplate.title,
        'permanent',
        {
          templateId: selectedTemplate.permanentId,
          dueDate: dueDate,
        } as any
      );

      console.log('Instance created:', newInstance);

      setShowInstanceModal(false);
      setSelectedTemplate(null);

      if (onInstanceCreated) {
        onInstanceCreated(newInstance);
      } else {
        Alert.alert('Success', `Task "${selectedTemplate.title}" added to your tasks!`);
      }
    } catch (err) {
      console.error('Failed to create instance:', err);
      Alert.alert(
        'Error',
        `Failed to create task: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelModal = () => {
    setShowInstanceModal(false);
    setSelectedTemplate(null);
  };

  const handleCancel = () => {
    console.log('UsePermanentTaskScreen: Cancel pressed, onCancel:', !!onCancel);
    onCancel?.();
  };

  const handleDeleteTemplate = (template: Task) => {
    Alert.alert(
      'Delete Template',
      `Delete "${template.title}"? This will also delete all instances created from it. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePermanentTask(template);
              setTemplates(prev => prev.filter(t => t.id !== template.id));
            } catch (err) {
              Alert.alert('Error', 'Failed to delete template.');
            }
          },
        },
      ]
    );
  };

  const renderTemplateItem = ({ item }: { item: Task }) => {
    const metadata = item.metadata as any;

    return (
      <TouchableOpacity
        style={styles.templateItem}
        onPress={() => handleTemplateSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.templateContent}>
          <Text style={styles.templateTitle}>{item.title}</Text>

          {item.location && (
            <Text style={styles.templateLocation}>
              📍 {typeof item.location === 'object' ? (item.location as any).name : item.location}
            </Text>
          )}

          {metadata?.instanceCount !== undefined && (
            <Text style={styles.templateMeta}>
              Used {metadata.instanceCount} time{metadata.instanceCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() =>
            Alert.alert(item.title, 'Choose an action', [
              { text: 'Edit Template', onPress: () => onEditTemplate?.(item) },
              { text: 'Delete Template', style: 'destructive', onPress: () => handleDeleteTemplate(item) },
              { text: 'Cancel', style: 'cancel' },
            ])
          }
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.menuButton}
        >
          <Text style={styles.menuButtonText}>⋮</Text>
        </TouchableOpacity>

        <Text style={styles.templateArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No Templates Yet</Text>
      <Text style={styles.emptySubtitle}>
        Create a permanent task template first, then you can use it here.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>

      {/* MAIN HEADER BAR */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Use Template</Text>
        <View style={styles.headerButton}>
          <Text style={styles.headerButtonText}> </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTemplates}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          renderItem={renderTemplateItem}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={templates.length === 0 ? styles.emptyListContainer : undefined}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* "ADD TASK" MODAL */}
      <Modal
        visible={showInstanceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancelModal}
      >
        <SafeAreaView style={styles.modalContainer}>

          {/* MODAL HEADER BAR */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCancelModal} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Task</Text>
            <TouchableOpacity
              onPress={handleCreateInstance}
              style={styles.headerButton}
              disabled={isCreating}
            >
              <Text style={[styles.headerButtonText, styles.saveButton]}>
                {isCreating ? 'Adding...' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* MODAL CONTENT */}
          <View style={styles.modalContent}>

            {/* TEMPLATE section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TEMPLATE</Text>
              <Text style={styles.selectedTemplateTitle}>{selectedTemplate?.title}</Text>
              {selectedTemplate?.location && (
                <Text style={styles.selectedTemplateLocation}>
                  📍 {selectedTemplate.location}
                </Text>
              )}
            </View>

            {/* DUE DATE section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DUE DATE *</Text>

              <View style={styles.quickDateContainer}>
                <TouchableOpacity
                  style={[
                    styles.quickDateButton,
                    selectedQuickOption === 'today' && styles.quickDateButtonSelected,
                  ]}
                  onPress={() => handleQuickDateSelect('today')}
                >
                  <Text
                    style={[
                      styles.quickDateButtonText,
                      selectedQuickOption === 'today' && styles.quickDateButtonTextSelected,
                    ]}
                  >
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickDateButton,
                    selectedQuickOption === 'tomorrow' && styles.quickDateButtonSelected,
                  ]}
                  onPress={() => handleQuickDateSelect('tomorrow')}
                >
                  <Text
                    style={[
                      styles.quickDateButtonText,
                      selectedQuickOption === 'tomorrow' && styles.quickDateButtonTextSelected,
                    ]}
                  >
                    Tomorrow
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.quickDateButton,
                    selectedQuickOption === 'custom' && styles.quickDateButtonSelected,
                  ]}
                  onPress={handleCustomDatePress}
                >
                  <Text
                    style={[
                      styles.quickDateButtonText,
                      selectedQuickOption === 'custom' && styles.quickDateButtonTextSelected,
                    ]}
                  >
                    Pick Date
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.selectedDateDisplay}>
                <Text style={styles.selectedDateLabel}>Selected:</Text>
                <Text style={styles.selectedDateValue}>{formatDateDisplay(dueDate)}</Text>
              </View>

              {Platform.OS === 'ios' && showDatePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                  style={styles.iosDatePicker}
                />
              )}

              {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                />
              )}

              <Text style={styles.helperText}>
                When should this task be completed?
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bgScreen,
    },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.bgCard,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    headerButton: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      minWidth: 70,
    },
    headerButtonText: {
      fontSize: 17,
      color: theme.accent,
    },
    saveButton: {
      fontWeight: '600',
    },

    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
      color: theme.textSecondary,
    },

    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    errorText: {
      fontSize: 16,
      color: theme.danger,
      textAlign: 'center',
      marginBottom: 16,
    },
    retryButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      backgroundColor: theme.accent,
      borderRadius: 8,
    },
    retryButtonText: {
      fontSize: 16,
      color: '#fff',
      fontWeight: '600',
    },

    emptyListContainer: {
      flex: 1,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: 'center',
    },

    templateItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.bgCard,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    templateContent: {
      flex: 1,
    },
    templateTitle: {
      fontSize: 17,
      color: theme.textPrimary,
      fontWeight: '500',
    },
    templateLocation: {
      fontSize: 14,
      color: theme.textSecondary,
      marginTop: 4,
    },
    templateMeta: {
      fontSize: 13,
      color: theme.textTertiary,
      marginTop: 4,
    },
    menuButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    menuButtonText: {
      fontSize: 20,
      color: theme.textSecondary,
    },
    templateArrow: {
      fontSize: 22,
      color: theme.hairline,
      marginLeft: 8,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginLeft: 16,
    },

    modalContainer: {
      flex: 1,
      backgroundColor: theme.bgScreen,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.bgCard,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    modalContent: {
      flex: 1,
    },

    section: {
      backgroundColor: theme.bgSection,
      paddingHorizontal: 16,
      paddingVertical: 16,
      marginTop: 16,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 8,
      letterSpacing: 0.5,
    },

    selectedTemplateTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    selectedTemplateLocation: {
      fontSize: 15,
      color: theme.textSecondary,
      marginTop: 4,
    },

    quickDateContainer: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    quickDateButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: theme.bgInput,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    quickDateButtonSelected: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    quickDateButtonText: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.textPrimary,
    },
    quickDateButtonTextSelected: {
      color: '#fff',
    },

    selectedDateDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.bgInput,
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    selectedDateLabel: {
      fontSize: 15,
      color: theme.textSecondary,
      marginRight: 8,
    },
    selectedDateValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.textPrimary,
    },

    iosDatePicker: {
      height: 150,
      marginBottom: 8,
    },
    helperText: {
      fontSize: 13,
      color: theme.textTertiary,
      marginTop: 8,
    },
  });
}
