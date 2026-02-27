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

import React, { useState, useEffect } from 'react';
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

  // =========================================================================
  // HOOKS
  // =========================================================================

  const { categories, loading: categoriesLoading } = useCategories();

  // =========================================================================
  // FORM STATE — pre-populated from the template
  // =========================================================================

  const [templateTitle, setTemplateTitle] = useState(template.title);

  // Category selector expects a full Category object; we find it once categories load
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

  // Once categories load, find and set the one matching the template's categoryId
  useEffect(() => {
    if (!categoriesLoading && categories.length > 0 && template.categoryId) {
      const match = categories.find(c => c.id === template.categoryId) ?? null;
      setSelectedCategory(match);
    }
  }, [categoriesLoading, categories, template.categoryId]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

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

      // 1. Update the template row (INSERT OR REPLACE on same permanentId)
      await savePermanentTemplate(updated);

      // 2. If category changed, cascade to all existing instances.
      //    Updates template_instances and tasks so pending instances
      //    appear under the correct category.
      //    completion_log is NOT touched — historical completions stay
      //    under the category they were completed in.
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

  // =========================================================================
  // RENDER
  // =========================================================================

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
            placeholderTextColor="#999"
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
              placeholderTextColor="#999"
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
                trackColor={{ false: '#ddd', true: '#007AFF' }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
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
  content: {
    flex: 1,
  },
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
  bottomSpacer: {
    height: 40,
  },
});
