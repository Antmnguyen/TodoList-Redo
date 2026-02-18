// app/screens/tasks/UsePermanentTaskScreen.tsx
// =============================================================================
// USE PERMANENT TASK SCREEN
// =============================================================================
//
// Screen for selecting a permanent task template and creating an instance.
// Displays all available templates, user selects one, then fills in due date
// to create a task instance that appears in their current tasks.
//
// FLOW:
// 1. Load all templates from storage on mount
// 2. Display templates in a selectable list
// 3. User taps a template -> show instance creation modal
// 4. User sets due date (required) and confirms
// 5. Instance is created and saved to current tasks
//
// TODO:
// - Add organization/grouping by taskType (when taskType is added to storage)
// - Add search/filter functionality
// - Add template preview with stats
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
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
import { getAllPermanentTemplates } from '../../features/permanentTask/utils/permanentTaskActions';
import { Task } from '../../core/types/task';

// =============================================================================
// DATE HELPERS
// =============================================================================

type QuickDateOption = 'today' | 'tomorrow' | 'custom';

const getQuickDate = (option: 'today' | 'tomorrow'): Date => {
  const date = new Date();
  date.setHours(23, 59, 59, 999); // End of day
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
  // Called when an instance is successfully created
  onInstanceCreated?: (task: Task) => void;
  // Called when user cancels/goes back
  onCancel?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const UsePermanentTaskScreen: React.FC<UsePermanentTaskScreenProps> = ({
  onInstanceCreated,
  onCancel,
}) => {
  // =========================================================================
  // STATE
  // =========================================================================

  // Templates loaded from storage
  const [templates, setTemplates] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected template for instance creation
  const [selectedTemplate, setSelectedTemplate] = useState<SelectedTemplate | null>(null);
  const [showInstanceModal, setShowInstanceModal] = useState(false);

  // Instance creation form state
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [selectedQuickOption, setSelectedQuickOption] = useState<QuickDateOption>('today');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // =========================================================================
  // LOAD TEMPLATES
  // =========================================================================

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

  // =========================================================================
  // HANDLERS
  // =========================================================================

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
    // Reset date selection to today
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
    // On Android, picker dismisses automatically after selection
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
      // Create instance from template
      // Note: location is inherited from template via templateId lookup in permanentTaskActions
      // templateId is not in Task type but is expected by createPermanentTask internally
      const newInstance = await createTask(
        selectedTemplate.title,
        'permanent',
        {
          templateId: selectedTemplate.permanentId,
          dueDate: dueDate,
        } as any
      );

      console.log('Instance created:', newInstance);

      // Close modal
      setShowInstanceModal(false);
      setSelectedTemplate(null);

      // Notify parent
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

  // =========================================================================
  // RENDER HELPERS
  // =========================================================================

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

          {/* Show location if present */}
          {item.location && (
            <Text style={styles.templateLocation}>
              📍 {typeof item.location === 'object' ? (item.location as any).name : item.location}
            </Text>
          )}

          {/* Show instance count */}
          {metadata?.instanceCount !== undefined && (
            <Text style={styles.templateMeta}>
              Used {metadata.instanceCount} time{metadata.instanceCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

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

  // TODO: Group templates by taskType when available
  // const groupedTemplates = useMemo(() => {
  //   return templates.reduce((groups, template) => {
  //     const type = template.metadata?.taskType || 'Uncategorized';
  //     if (!groups[type]) groups[type] = [];
  //     groups[type].push(template);
  //     return groups;
  //   }, {} as Record<string, Task[]>);
  // }, [templates]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Use Template</Text>
        <View style={styles.headerButton}>
          {/* Placeholder for symmetry */}
          <Text style={styles.headerButtonText}> </Text>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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

      {/* Instance Creation Modal */}
      <Modal
        visible={showInstanceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancelModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
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

          {/* Modal Content */}
          <View style={styles.modalContent}>
            {/* Template Info */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TEMPLATE</Text>
              <Text style={styles.selectedTemplateTitle}>{selectedTemplate?.title}</Text>
              {selectedTemplate?.location && (
                <Text style={styles.selectedTemplateLocation}>
                  📍 {selectedTemplate.location}
                </Text>
              )}
            </View>

            {/* Due Date Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DUE DATE *</Text>

              {/* Quick Select Buttons */}
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

              {/* Selected Date Display */}
              <View style={styles.selectedDateDisplay}>
                <Text style={styles.selectedDateLabel}>Selected:</Text>
                <Text style={styles.selectedDateValue}>{formatDateDisplay(dueDate)}</Text>
              </View>

              {/* Date Picker - iOS inline, Android modal */}
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

            {/* TODO: Add more instance-specific fields here */}
            {/* - Custom title override */}
            {/* - Priority selection */}
            {/* - Notes/description */}
          </View>
        </SafeAreaView>
      </Modal>
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  headerButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: 70,
    backgroundColor: 'rgba(0,122,255,0.1)', // DEBUG: remove after testing
  },
  headerButtonText: {
    fontSize: 17,
    color: '#007AFF',
  },
  saveButton: {
    fontWeight: '600',
  },

  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },

  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },

  // Empty state
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
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // Template list item
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  templateContent: {
    flex: 1,
  },
  templateTitle: {
    fontSize: 17,
    color: '#000',
    fontWeight: '500',
  },
  templateLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  templateMeta: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  templateArrow: {
    fontSize: 22,
    color: '#c7c7cc',
    marginLeft: 8,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ddd',
    marginLeft: 16,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  modalContent: {
    flex: 1,
  },

  // Sections
  section: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  // Selected template display
  selectedTemplateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  selectedTemplateLocation: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
  },

  // Quick date selection
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
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  quickDateButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  quickDateButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  quickDateButtonTextSelected: {
    color: '#fff',
  },

  // Selected date display
  selectedDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  selectedDateLabel: {
    fontSize: 15,
    color: '#666',
    marginRight: 8,
  },
  selectedDateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },

  // Date picker
  iosDatePicker: {
    height: 150,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
  },
});
