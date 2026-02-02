// app/screens/tasks/CreatePermanentTaskScreen.tsx
// =============================================================================
// CREATE PERMANENT TASK SCREEN
// =============================================================================
//
// Screen for creating a new permanent task template.
// Follows the architecture: screens use hooks for data, render components for UI.
//
// PERMANENT TASK TEMPLATE FIELDS (from permanentTask.ts):
// - templateTitle (required): Name of the template
// - location (optional): Location associated with the task
// - autoRepeat (optional): Auto-repeat configuration (expandable later)
//
// Auto-generated fields (handled by backend/factory):
// - id, permanentId, isTemplate, createdAt, instanceCount
//
// DESIGN DECISIONS:
// 1. Form state is local to this screen (not in a hook) since it's UI state
// 2. onSave callback will eventually pass data to permanentTaskActions
// 3. Each input section is separated for easy expansion
// 4. Optional fields are in collapsible/expandable sections
//
// NEXT STEPS:
// - Connect onSave to permanentTaskActions.createTemplate()
// - Add navigation back to previous screen after save
// - Add validation feedback
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';

// =============================================================================
// TYPES
// =============================================================================

// Form data structure - mirrors PermanentTask template fields
// This will be passed to the backend when saving
export interface PermanentTaskFormData {
  templateTitle: string;
  location?: string;
  autoRepeat?: {
    enabled: boolean;
    frequency?: 'daily' | 'weekly' | 'monthly';
    // Expandable: add more auto-repeat options here later
  };
}

export interface CreatePermanentTaskScreenProps {
  // Called when user saves the form - will connect to backend later
  onSave?: (data: PermanentTaskFormData) => void;
  // Called when user cancels/goes back
  onCancel?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CreatePermanentTaskScreen: React.FC<CreatePermanentTaskScreenProps> = ({
  onSave,
  onCancel,
}) => {
  // =========================================================================
  // FORM STATE
  // =========================================================================

  // Required fields
  const [templateTitle, setTemplateTitle] = useState('');
  const [taskType, setTaskType] = useState('');

  // Optional fields
  const [location, setLocation] = useState('');

  // Auto-repeat configuration (optional, expandable)
  const [autoRepeatEnabled, setAutoRepeatEnabled] = useState(false);
  const [autoRepeatFrequency, setAutoRepeatFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // UI state for showing/hiding optional sections
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [showAutoRepeatOptions, setShowAutoRepeatOptions] = useState(false);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  // Validate and collect form data
  const handleSave = () => {
    // Validate required fields
    if (!templateTitle.trim()) {
      Alert.alert('Required Field', 'Please enter a template title');
      return;
    }

    if (!taskType.trim()) {
      Alert.alert('Required Field', 'Please enter a task type');
      return;
    }

    // Build form data object
    // Note: taskType is captured here for frontend, will be added to type definition later
    const formData: PermanentTaskFormData & { taskType?: string } = {
      templateTitle: templateTitle.trim(),
      taskType: taskType.trim(),
    };

    // Add optional fields if provided
    if (location.trim()) {
      formData.location = location.trim();
    }

    if (autoRepeatEnabled) {
      formData.autoRepeat = {
        enabled: true,
        frequency: autoRepeatFrequency,
      };
    }

    // TODO: Connect to backend via permanentTaskActions
    // For now, just log and show alert
    console.log('Permanent Task Form Data:', formData);
    Alert.alert(
      'Template Created',
      `Template "${formData.templateTitle}" ready to save.\n\nThis will connect to backend in next sprint.`,
      [{ text: 'OK', onPress: onSave ? () => onSave(formData) : undefined }]
    );
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      Alert.alert('Cancelled', 'Create permanent task cancelled');
    }
  };

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
        <Text style={styles.headerTitle}>New Permanent Task</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, styles.saveButton]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* =============================================================== */}
        {/* REQUIRED: Template Title */}
        {/* =============================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Template Title *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Morning Workout, Weekly Review"
            placeholderTextColor="#999"
            value={templateTitle}
            onChangeText={setTemplateTitle}
            autoFocus
          />
          <Text style={styles.helperText}>
            This is the name you'll see when selecting this template
          </Text>
        </View>

        {/* =============================================================== */}
        {/* REQUIRED: Task Type */}
        {/* =============================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Task Type *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Exercise, Work, Personal, Health"
            placeholderTextColor="#999"
            value={taskType}
            onChangeText={setTaskType}
          />
          <Text style={styles.helperText}>
            Category of this task (will be used for organizing and stats)
          </Text>
        </View>

        {/* =============================================================== */}
        {/* OPTIONAL: Location */}
        {/* =============================================================== */}
        <TouchableOpacity
          style={styles.optionalHeader}
          onPress={() => setShowLocationInput(!showLocationInput)}
        >
          <Text style={styles.optionalHeaderText}>Location (Optional)</Text>
          <Text style={styles.expandIcon}>{showLocationInput ? '−' : '+'}</Text>
        </TouchableOpacity>

        {showLocationInput && (
          <View style={styles.section}>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Home, Gym, Office"
              placeholderTextColor="#999"
              value={location}
              onChangeText={setLocation}
            />
            <Text style={styles.helperText}>
              Associate this task with a specific location
            </Text>
          </View>
        )}

        {/* =============================================================== */}
        {/* OPTIONAL: Auto-Repeat Configuration */}
        {/* =============================================================== */}
        <TouchableOpacity
          style={styles.optionalHeader}
          onPress={() => setShowAutoRepeatOptions(!showAutoRepeatOptions)}
        >
          <Text style={styles.optionalHeaderText}>Auto-Repeat (Optional)</Text>
          <Text style={styles.expandIcon}>{showAutoRepeatOptions ? '−' : '+'}</Text>
        </TouchableOpacity>

        {showAutoRepeatOptions && (
          <View style={styles.section}>
            {/* Enable/Disable Toggle */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Enable Auto-Repeat</Text>
              <Switch
                value={autoRepeatEnabled}
                onValueChange={setAutoRepeatEnabled}
                trackColor={{ false: '#ddd', true: '#007AFF' }}
                thumbColor="#fff"
              />
            </View>

            {/* Frequency Selection (only shown if enabled) */}
            {autoRepeatEnabled && (
              <View style={styles.frequencyContainer}>
                <Text style={styles.frequencyLabel}>Repeat Frequency:</Text>
                <View style={styles.frequencyOptions}>
                  {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.frequencyOption,
                        autoRepeatFrequency === freq && styles.frequencyOptionSelected,
                      ]}
                      onPress={() => setAutoRepeatFrequency(freq)}
                    >
                      <Text
                        style={[
                          styles.frequencyOptionText,
                          autoRepeatFrequency === freq && styles.frequencyOptionTextSelected,
                        ]}
                      >
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.helperText}>
              Auto-repeat will automatically create new instances of this task
            </Text>
          </View>
        )}

        {/* =============================================================== */}
        {/* FUTURE EXPANSION SECTIONS */}
        {/* Add more optional sections here as features are added */}
        {/* Examples: Priority, Category, Subtasks, Reminders, etc. */}
        {/* =============================================================== */}

        {/* Spacer at bottom for scroll */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
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

  // Header styles
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
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerButtonText: {
    fontSize: 17,
    color: '#007AFF',
  },
  saveButton: {
    fontWeight: '600',
  },

  // Content area
  content: {
    flex: 1,
  },

  // Section styles (for each input group)
  section: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Text input styles
  textInput: {
    fontSize: 16,
    color: '#000',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  helperText: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
  },

  // Optional section header (expandable)
  optionalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  optionalHeaderText: {
    fontSize: 16,
    color: '#333',
  },
  expandIcon: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '300',
  },

  // Switch row (for toggles)
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },

  // Frequency selection
  frequencyContainer: {
    marginTop: 16,
  },
  frequencyLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  frequencyOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  frequencyOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  frequencyOptionSelected: {
    backgroundColor: '#007AFF',
  },
  frequencyOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  frequencyOptionTextSelected: {
    color: '#fff',
  },

  // Bottom spacer for scroll padding
  bottomSpacer: {
    height: 40,
  },
});
