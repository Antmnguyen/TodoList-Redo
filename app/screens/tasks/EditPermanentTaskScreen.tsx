// app/screens/tasks/EditPermanentTaskScreen.tsx
// =============================================================================
// EDIT PERMANENT TASK SCREEN
// =============================================================================
//
// Lets the user edit an existing permanent task template. Pre-populates all
// fields from the template passed in via props.
//
// CATEGORY CHANGE SAFETY:
//   If the user changes the category, we must cascade the update to all
//   existing instances (template_instances + tasks tables). This is handled
//   by calling updateTemplateCategoryInInstances() after saving the template
//   row. completion_log is NEVER touched — historical completions are
//   immutable and stay under the category they were completed in.
//
// See docs/sprint-5/permanant_tasks_editing/plan.md for full design.
// =============================================================================

import React, { useMemo, useState, useEffect } from 'react';
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
import {
  savePermanentTemplate,
  updateTemplateCategoryInInstances,
} from '../../core/services/storage/permanentTaskStorage';
import { PermanentTask } from '../../features/permanentTask/types/permanentTask';
import { useCategories, Category } from '../../features/categories';
import { CategorySelector } from '../../components/categories/CategorySelector';
import { Task } from '../../core/types/task';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface EditPermanentTaskScreenProps {
  template: Task;
  onSave: () => void;
  onCancel: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const EditPermanentTaskScreen: React.FC<EditPermanentTaskScreenProps> = ({
  template,
  onSave,
  onCancel,
}) => {
  const meta = template.metadata as any;

  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { categories, loading: categoriesLoading } = useCategories();

  const [templateTitle, setTemplateTitle] = useState(template.title);

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const [location, setLocation] = useState(
    typeof template.location === 'object' && template.location !== null
      ? (template.location as any).name ?? ''
      : (template.location as string | undefined) ?? ''
  );

  const [autoRepeatEnabled, setAutoRepeatEnabled] = useState(
    !!(meta?.autoRepeat?.enabled || meta?.recurring?.enabled)
  );

  const [autoRepeatFrequency, setAutoRepeatFrequency] = useState<'daily' | 'weekly' | 'monthly'>(
    meta?.autoRepeat?.frequency ?? meta?.recurring?.frequency ?? 'weekly'
  );

  const [showLocationInput, setShowLocationInput] = useState(!!location);
  const [showAutoRepeatOptions, setShowAutoRepeatOptions] = useState(autoRepeatEnabled);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!categoriesLoading && categories.length > 0 && template.categoryId) {
      const match = categories.find(c => c.id === template.categoryId) ?? null;
      setSelectedCategory(match);
    }
  }, [categoriesLoading, categories, template.categoryId]);

  const handleSave = async () => {
    if (!templateTitle.trim()) {
      Alert.alert('Required', 'Template title cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const permanentId = meta?.permanentId as string;
      const originalCategoryId = template.categoryId ?? null;
      const newCategoryId = selectedCategory?.id ?? null;
      const categoryChanged = newCategoryId !== originalCategoryId;

      const updated: PermanentTask = {
        id: template.id,
        permanentId,
        templateTitle: templateTitle.trim(),
        isTemplate: true,
        createdAt: template.createdAt.getTime(),
        instanceCount: meta?.instanceCount ?? 0,
        location: location.trim() || undefined,
        autoRepeat: autoRepeatEnabled
          ? { enabled: true, frequency: autoRepeatFrequency }
          : undefined,
        categoryId: newCategoryId ?? undefined,
        completed: false,
      };

      await savePermanentTemplate(updated);

      if (categoryChanged) {
        updateTemplateCategoryInInstances(permanentId, newCategoryId);
      }

      onSave();
    } catch (err) {
      Alert.alert('Error', 'Failed to save template.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Template</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={styles.headerButton}
          disabled={isSaving}
        >
          <Text style={[styles.headerButtonText, styles.saveButton]}>
            {isSaving ? 'Updating...' : 'Update'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">

        {/* TEMPLATE TITLE */}
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

        {/* CATEGORY */}
        <CategorySelector
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categories={categories}
          loading={categoriesLoading}
        />

        {/* LOCATION (collapsible) */}
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

        {/* AUTO-REPEAT (collapsible) */}
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
// STYLES — mirrors CreatePermanentTaskScreen
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
