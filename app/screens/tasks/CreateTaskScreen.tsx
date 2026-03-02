// app/screens/tasks/CreateTaskScreen.tsx
// =============================================================================
// CREATE TASK SCREEN
// =============================================================================
//
// WHAT YOU SEE ON SCREEN:
//   A white navigation bar at the top with "Cancel" on the left and "Save"
//   on the right. Below that, a scrollable form with three sections:
//     1. TASK NAME   — a text box where you type what needs to be done
//     2. DUE DATE    — three quick-pick buttons (Today / Tomorrow / Pick Date)
//                      plus a small readout showing the currently selected date
//     3. CATEGORY    — a row of colour-coded category pills to group the task
//
// =============================================================================

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Screen } from '../../components/layout/Screen';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCategories, Category } from '../../features/categories';
import { CategorySelector } from '../../components/categories/CategorySelector';
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

export interface CreateTaskFormData {
  title: string;
  dueDate: Date;
  categoryId?: string;
}

export interface CreateTaskScreenProps {
  onSave?: (data: CreateTaskFormData) => void;
  onCancel?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CreateTaskScreen: React.FC<CreateTaskScreenProps> = ({
  onSave,
  onCancel,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { categories, loading: categoriesLoading } = useCategories();

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<Date>(getQuickDate('today'));
  const [selectedQuickOption, setSelectedQuickOption] = useState<QuickDateOption>('today');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

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

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a task name.');
      return;
    }

    onSave?.({
      title: title.trim(),
      dueDate,
      categoryId: selectedCategory?.id,
    });
  };

  const handleCancel = () => {
    onCancel?.();
  };

  return (
    <Screen edges={['top', 'bottom']} style={styles.container}>

      {/* HEADER BAR */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Task</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, styles.saveButtonText]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">

        {/* SECTION 1: TASK NAME */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TASK NAME *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="What needs to be done?"
            placeholderTextColor={theme.textDisabled}
            value={title}
            onChangeText={setTitle}
            autoFocus
          />
        </View>

        {/* SECTION 2: DUE DATE */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DUE DATE</Text>

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
        </View>

        {/* SECTION 3: CATEGORY SELECTOR */}
        <CategorySelector
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categories={categories}
          loading={categoriesLoading}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </Screen>
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
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    headerButtonText: {
      fontSize: 17,
      color: theme.accent,
    },
    saveButtonText: {
      fontWeight: '600',
    },

    content: {
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
      marginTop: 8,
    },

    bottomSpacer: {
      height: 40,
    },
  });
}
