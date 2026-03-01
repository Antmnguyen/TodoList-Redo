// app/screens/tasks/CreatePermanentTaskScreen.tsx
// =============================================================================
// CREATE PERMANENT TASK SCREEN
// =============================================================================
//
// WHAT IS A "PERMANENT TASK TEMPLATE"?
//   A permanent task template is a reusable blueprint for a task you do
//   repeatedly — like "Morning Workout" or "Weekly Review". You create the
//   template once here, and then every time you want to do that task you use
//   UsePermanentTaskScreen to stamp out a new instance from the blueprint,
//   choosing a due date each time. Think of it like a recipe card you can
//   cook from over and over.
//
// =============================================================================

import React, { useMemo, useState } from 'react';
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
import { createTask } from '../../core/domain/taskActions';
import { useCategories, Category } from '../../features/categories';
import { CategorySelector } from '../../components/categories/CategorySelector';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface PermanentTaskFormData {
  templateTitle: string;
  categoryId?: string;
  location?: string;
  autoRepeat?: {
    enabled: boolean;
    frequency?: 'daily' | 'weekly' | 'monthly';
  };
}

export interface CreatePermanentTaskScreenProps {
  onSave?: (data: PermanentTaskFormData) => void;
  onCancel?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CreatePermanentTaskScreen: React.FC<CreatePermanentTaskScreenProps> = ({
  onSave,
  onCancel,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { categories, loading: categoriesLoading } = useCategories();

  const [templateTitle, setTemplateTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [location, setLocation] = useState('');
  const [autoRepeatEnabled, setAutoRepeatEnabled] = useState(false);
  const [autoRepeatFrequency, setAutoRepeatFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [showAutoRepeatOptions, setShowAutoRepeatOptions] = useState(false);

  const handleSave = async () => {
    if (!templateTitle.trim()) {
      Alert.alert('Required Field', 'Please enter a template title');
      return;
    }

    const formData: PermanentTaskFormData = {
      templateTitle: templateTitle.trim(),
      categoryId: selectedCategory?.id,
    };

    if (location.trim()) {
      formData.location = location.trim();
    }

    if (autoRepeatEnabled) {
      formData.autoRepeat = {
        enabled: true,
        frequency: autoRepeatFrequency,
      };
    }

    try {
      const newTemplate = await createTask(
        formData.templateTitle,
        'permanent',
        {
          location: formData.location ? { lat: 0, lng: 0, name: formData.location } : undefined,
          recurring: formData.autoRepeat,
          categoryId: formData.categoryId,
        }
      );

      console.log('Permanent Task Template Created:', newTemplate);

      if (onSave) {
        onSave(formData);
      } else {
        Alert.alert('Success', `Template "${formData.templateTitle}" created!`);
      }
    } catch (error) {
      console.error('Failed to create permanent task template:', error);
      Alert.alert(
        'Error',
        `Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleCancel = () => {
    console.log('CreatePermanentTaskScreen: Cancel pressed, onCancel:', !!onCancel);
    onCancel?.();
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER BAR */}
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

        {/* SECTION 1: TEMPLATE TITLE */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Template Title *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., Morning Workout, Weekly Review"
            placeholderTextColor={theme.textDisabled}
            value={templateTitle}
            onChangeText={setTemplateTitle}
            autoFocus
          />
          <Text style={styles.helperText}>
            This is the name you'll see when selecting this template
          </Text>
        </View>

        {/* SECTION 2: CATEGORY SELECTOR */}
        <CategorySelector
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categories={categories}
          loading={categoriesLoading}
        />

        {/* SECTION 3: LOCATION (collapsible) */}
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
              placeholderTextColor={theme.textDisabled}
              value={location}
              onChangeText={setLocation}
            />
            <Text style={styles.helperText}>
              Associate this task with a specific location
            </Text>
          </View>
        )}

        {/* SECTION 4: AUTO-REPEAT (collapsible) */}
        <TouchableOpacity
          style={styles.optionalHeader}
          onPress={() => setShowAutoRepeatOptions(!showAutoRepeatOptions)}
        >
          <Text style={styles.optionalHeaderText}>Auto-Repeat (Optional)</Text>
          <Text style={styles.expandIcon}>{showAutoRepeatOptions ? '−' : '+'}</Text>
        </TouchableOpacity>

        {showAutoRepeatOptions && (
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Enable Auto-Repeat</Text>
              <Switch
                value={autoRepeatEnabled}
                onValueChange={setAutoRepeatEnabled}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor="#fff"
              />
            </View>

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

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
      paddingTop: 50,
      paddingBottom: 12,
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
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    headerButtonText: {
      fontSize: 17,
      color: theme.accent,
    },
    saveButton: {
      fontWeight: '600',
    },

    content: {
      flex: 1,
    },

    section: {
      backgroundColor: theme.bgSection,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 1,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    textInput: {
      fontSize: 16,
      color: theme.textPrimary,
      backgroundColor: theme.bgInput,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    helperText: {
      fontSize: 13,
      color: theme.textTertiary,
      marginTop: 8,
    },

    optionalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.bgCard,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.hairline,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.hairline,
    },
    optionalHeaderText: {
      fontSize: 16,
      color: theme.textPrimary,
    },
    expandIcon: {
      fontSize: 20,
      color: theme.accent,
      fontWeight: '300',
    },

    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    switchLabel: {
      fontSize: 16,
      color: theme.textPrimary,
    },

    frequencyContainer: {
      marginTop: 16,
    },
    frequencyLabel: {
      fontSize: 14,
      color: theme.textSecondary,
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
      backgroundColor: theme.bgInput,
      alignItems: 'center',
    },
    frequencyOptionSelected: {
      backgroundColor: theme.accent,
    },
    frequencyOptionText: {
      fontSize: 14,
      color: theme.textPrimary,
      fontWeight: '500',
    },
    frequencyOptionTextSelected: {
      color: '#fff',
    },

    bottomSpacer: {
      height: 40,
    },
  });
}
