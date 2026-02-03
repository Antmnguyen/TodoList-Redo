// app/screens/tasks/CreateTaskScreen.tsx
// =============================================================================
// CREATE TASK SCREEN
// =============================================================================
//
// Bare bones task creation screen with three sections:
// 1. Task name (text input)
// 2. Due date (Today / Tomorrow / Pick Date + native DateTimePicker)
// 3. Task type (selectable button list — expandable later with dynamic types)
//
// UI only — no backend calls here. The parent screen receives form data
// through the onSave callback and decides what to do with it.
//
// PATTERNS:
// - Date picker reuses the same approach as UsePermanentTaskScreen
// - Style conventions match CreatePermanentTaskScreen and UsePermanentTaskScreen
// - TASK_TYPE_OPTIONS array is a placeholder; replace with dynamic list later
//
// TODO:
// - Replace hardcoded TASK_TYPE_OPTIONS with user-created task types from storage
// - Wire onSave to taskActions.createTask() in TasksStack
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
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

// =============================================================================
// DATE HELPERS
// =============================================================================

// Tracks which quick-select button the user tapped, or 'custom' if they
// opened the full date picker
type QuickDateOption = 'today' | 'tomorrow' | 'custom';

/**
 * Returns a Date set to end-of-day (23:59:59.999) for the given quick option.
 * 'today' = today's end-of-day, 'tomorrow' = tomorrow's end-of-day.
 */
const getQuickDate = (option: 'today' | 'tomorrow'): Date => {
  const date = new Date();
  date.setHours(23, 59, 59, 999); // Snap to end of day
  if (option === 'tomorrow') {
    date.setDate(date.getDate() + 1); // Advance by one day
  }
  return date;
};

/**
 * Formats a Date into a human-readable label for the "Selected:" display.
 * Shows "Today" / "Tomorrow" for those cases, otherwise a short date string.
 */
const formatDateDisplay = (date: Date): string => {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if the date matches today or tomorrow by comparing date strings
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  // Fallback: short formatted date (e.g. "Mon, Feb 3")
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data shape emitted by onSave.
 * The parent (TasksStack) receives this and can pass it to taskActions.
 */
export interface CreateTaskFormData {
  title: string;       // Task name entered by user
  dueDate: Date;       // Selected due date
  category?: string;   // Selected task category (e.g. "Workout", "School")
}

/**
 * This array will be replaced by user-created categories from storage.
 * The component works fine with an empty array — the section just shows
 * the "no categories" message. These two entries are ONLY here for UI
 * testing and can be safely deleted with no code changes needed.
 */
const PLACEHOLDER_CATEGORIES: string[] = [
  'Workout',    // DELETE — UI preview only
  'School',     // DELETE — UI preview only
];

/**
 * Props for CreateTaskScreen.
 * - onSave: called with form data when user taps Save
 * - onCancel: called when user taps Cancel (parent navigates back)
 */
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
  // =========================================================================
  // STATE
  // =========================================================================

  // Task name typed by user
  const [title, setTitle] = useState('');

  // Currently selected due date — defaults to today (end of day)
  const [dueDate, setDueDate] = useState<Date>(getQuickDate('today'));

  // Which quick-date button is highlighted (today/tomorrow/custom)
  const [selectedQuickOption, setSelectedQuickOption] = useState<QuickDateOption>('today');

  // Controls whether the native DateTimePicker is visible
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Currently selected category — null means none selected
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Whether the category list is expanded (visible)
  const [showCategories, setShowCategories] = useState(false);

  // Category list — sourced from placeholder for now.
  // TODO: Replace with categories loaded from storage via props or hook.
  const categories = PLACEHOLDER_CATEGORIES;

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /**
   * Called when user taps "Today" or "Tomorrow" quick-select button.
   * Sets the due date, highlights that button, and hides the custom picker.
   */
  const handleQuickDateSelect = (option: 'today' | 'tomorrow') => {
    setSelectedQuickOption(option);
    setDueDate(getQuickDate(option));
    setShowDatePicker(false); // Close custom picker if it was open
  };

  /**
   * Called when user taps "Pick Date" button.
   * Highlights the custom option and opens the native DateTimePicker.
   */
  const handleCustomDatePress = () => {
    setSelectedQuickOption('custom');
    setShowDatePicker(true);
  };

  /**
   * Callback from the native DateTimePicker.
   * On Android the picker auto-dismisses after selection.
   * On iOS it stays open (inline spinner) until user navigates away.
   */
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // Android: picker closes itself after user picks or cancels
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    // 'set' means user confirmed a date (not cancelled)
    if (event.type === 'set' && selectedDate) {
      setDueDate(selectedDate);
      setSelectedQuickOption('custom'); // Deselect Today/Tomorrow buttons
    }
  };

  /**
   * Called when user taps "Save" in the header.
   * Validates required fields and passes form data up to parent via onSave.
   */
  const handleSave = () => {
    // Title is the only required field
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a task name.');
      return;
    }

    // Pass collected form data to parent — parent decides what to do with it
    onSave?.({
      title: title.trim(),
      dueDate,
      category: selectedCategory || undefined,
    });
  };

  /**
   * Called when user taps "Cancel" in the header.
   * Parent handles navigation (typically goBack).
   */
  const handleCancel = () => {
    onCancel?.();
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <SafeAreaView style={styles.container}>

      {/* ================================================================= */}
      {/* HEADER — Cancel (left), title (center), Save (right)              */}
      {/* Matches the header pattern used in CreatePermanentTaskScreen and   */}
      {/* UsePermanentTaskScreen for visual consistency.                     */}
      {/* ================================================================= */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Task</Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, styles.saveButtonText]}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* ScrollView wraps all form sections so the screen scrolls if       */}
      {/* content overflows (e.g. when the iOS date spinner is visible).    */}
      {/* keyboardShouldPersistTaps="handled" prevents keyboard dismissal   */}
      {/* when tapping buttons inside the scroll area.                      */}
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">

        {/* =============================================================== */}
        {/* SECTION 1: TASK NAME                                            */}
        {/* Simple text input. Required field — validated on Save.          */}
        {/* =============================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TASK NAME *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="What needs to be done?"
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            autoFocus // Opens keyboard immediately when screen mounts
          />
        </View>

        {/* =============================================================== */}
        {/* SECTION 2: DUE DATE                                             */}
        {/* Three quick-select buttons + optional native date picker.       */}
        {/* Same pattern as UsePermanentTaskScreen for consistency.          */}
        {/* =============================================================== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DUE DATE</Text>

          {/* Row of three quick-select buttons: Today | Tomorrow | Pick Date */}
          {/* The currently active option gets the "selected" highlight style */}
          <View style={styles.quickDateContainer}>

            {/* TODAY button */}
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

            {/* TOMORROW button */}
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

            {/* PICK DATE button — opens the native DateTimePicker */}
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

          {/* Shows the currently selected date in a readable format */}
          <View style={styles.selectedDateDisplay}>
            <Text style={styles.selectedDateLabel}>Selected:</Text>
            <Text style={styles.selectedDateValue}>{formatDateDisplay(dueDate)}</Text>
          </View>

          {/* iOS: inline spinner date picker (stays visible until dismissed) */}
          {Platform.OS === 'ios' && showDatePicker && (
            <DateTimePicker
              value={dueDate}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
              minimumDate={new Date()} // Can't pick dates in the past
              style={styles.iosDatePicker}
            />
          )}

          {/* Android: modal date picker (auto-dismisses after selection) */}
          {Platform.OS === 'android' && showDatePicker && (
            <DateTimePicker
              value={dueDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
              minimumDate={new Date()} // Can't pick dates in the past
            />
          )}
        </View>

        {/* =============================================================== */}
        {/* SECTION 3: TASK TYPE (expandable category list)                 */}
        {/* Tapping the header toggles the list open/closed.               */}
        {/* Categories come from the `categories` array — currently a      */}
        {/* placeholder, will be replaced with user-created categories      */}
        {/* from storage. Works correctly with an empty array.              */}
        {/* =============================================================== */}

        {/* Expandable header — shows selected category if one is picked */}
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => setShowCategories(!showCategories)}
        >
          <View>
            <Text style={styles.sectionLabel}>TASK TYPE</Text>
            {/* Show the selected category name, or "None" if nothing picked */}
            <Text style={styles.categoryHeaderValue}>
              {selectedCategory || 'None'}
            </Text>
          </View>
          {/* Arrow indicator: points down when collapsed, up when expanded */}
          <Text style={styles.expandIcon}>{showCategories ? '−' : '+'}</Text>
        </TouchableOpacity>

        {/* Expandable category list — only rendered when showCategories is true */}
        {showCategories && (
          <View style={styles.categoryListContainer}>
            {categories.length === 0 ? (
              /* Empty state — shown when user has no categories yet */
              <Text style={styles.categoryEmptyText}>
                No categories yet. Add categories to organize your tasks.
              </Text>
            ) : (
              /* Render each category as a tappable row */
              categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryItem,
                    selectedCategory === cat && styles.categoryItemSelected,
                  ]}
                  onPress={() => {
                    // Toggle: tap again to deselect
                    setSelectedCategory(selectedCategory === cat ? null : cat);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryItemText,
                      selectedCategory === cat && styles.categoryItemTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Extra space at bottom so content isn't hidden behind keyboard */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================
// Matches the style conventions from CreatePermanentTaskScreen and
// UsePermanentTaskScreen: white section cards on grey background,
// blue (#007AFF) accent for selected states and header buttons.
// =============================================================================

const styles = StyleSheet.create({
  // Root container — grey background visible between white section cards
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // ----- Header -----
  // Horizontal bar: [Cancel]  Create Task  [Save]
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
  // "Save" button is bold to stand out from "Cancel"
  saveButtonText: {
    fontWeight: '600',
  },

  // ----- Scrollable content area -----
  content: {
    flex: 1,
  },

  // ----- White section card -----
  // Each form section (name, date, type) is a white card with top margin
  section: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 16,
  },
  // Uppercase grey label at top of each section
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  // ----- Text input -----
  // Used for the task name field
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

  // ----- Quick date buttons -----
  // Horizontal row of Today | Tomorrow | Pick Date
  quickDateContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  // Individual date button — grey by default
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
  // Selected state — blue background and border
  quickDateButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  // Button text — dark by default
  quickDateButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  // Selected button text — white on blue
  quickDateButtonTextSelected: {
    color: '#fff',
  },

  // ----- Selected date readout -----
  // Grey pill showing "Selected: Today" or "Selected: Mon, Feb 3"
  selectedDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
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

  // ----- iOS date picker spinner -----
  iosDatePicker: {
    height: 150,
    marginTop: 8,
  },

  // ----- Expandable category header -----
  // Tappable bar that toggles the category list open/closed
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  // Shows the currently selected category (or "None")
  categoryHeaderValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginTop: 2,
  },
  // +/− icon on the right side of the header
  expandIcon: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '300',
  },

  // ----- Category list (shown when expanded) -----
  // White container holding the list of category rows
  categoryListContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  // Individual category row — grey pill, tappable
  categoryItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
  },
  // Selected category — blue background
  categoryItemSelected: {
    backgroundColor: '#007AFF',
  },
  // Category label text — dark by default
  categoryItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  // Selected category text — white on blue
  categoryItemTextSelected: {
    color: '#fff',
  },
  // Shown when the categories array is empty
  categoryEmptyText: {
    fontSize: 14,
    color: '#888',
    paddingVertical: 12,
  },

  // ----- Bottom spacer -----
  // Prevents content from being cut off behind keyboard or safe area
  bottomSpacer: {
    height: 40,
  },
});
