// app/screens/tasks/UsePermanentTaskScreen.tsx
// =============================================================================
// USE PERMANENT TASK SCREEN
// =============================================================================
//
// WHAT IS THIS SCREEN FOR?
//   This is step 2 of using a permanent task template. You already created a
//   template (in CreatePermanentTaskScreen) — now this screen lets you "stamp
//   out" a new task from that template for a specific due date. Think of it
//   like selecting a recipe and setting the day you'll cook it.
//
// WHAT YOU SEE ON SCREEN:
//   A white navigation bar at the top with a "Cancel" button on the left and
//   the title "Use Template" in the centre. Below that, one of three states:
//
//   LOADING STATE:
//     A spinning blue activity indicator centred on the screen with the text
//     "Loading templates..." shown underneath. Appears while the app is
//     fetching your saved templates from local storage.
//
//   ERROR STATE:
//     A red error message centred on screen explaining what went wrong, plus a
//     blue "Retry" button that attempts to load the templates again.
//
//   TEMPLATE LIST (normal state):
//     A scrollable list of your permanent task templates. Each row shows:
//       - The template name (e.g. "Morning Workout") in large text
//       - A pin icon and location name if one was set (e.g. "Gym")
//       - A usage count ("Used 5 times") if that data is available
//       - A "›" arrow on the right indicating it is tappable
//     Thin grey dividers separate each row.
//     If you have no templates yet, a centred message appears:
//       "No Templates Yet — Create a permanent task template first..."
//
// WHAT HAPPENS WHEN YOU TAP A TEMPLATE ROW:
//   A sheet slides up from the bottom of the screen (a "modal"). This modal is
//   the "Add Task" confirmation step. It shows:
//     - A header bar with "Cancel" on the left and "Add" on the right
//     - The selected template name and location (read-only, so you know which
//       template you chose)
//     - A DUE DATE section with three quick-pick buttons:
//         [Today]  [Tomorrow]  [Pick Date]
//       The active selection turns blue. Below the buttons, a grey pill readout
//       shows "Selected: Today" (or whatever date is selected).
//     - If "Pick Date" was tapped:
//         iOS     — an inline scroll-wheel spinner appears to choose a date
//         Android — a native calendar dialog opens
//
//   Tapping "Add" in the modal header saves the task and closes the modal.
//   Tapping "Cancel" closes the modal without saving.
//
// WHAT HAPPENS WHEN YOU TAP "ADD":
//   1. Looks up the template by its permanentId.
//   2. Calls createTask() with type='permanent' and the chosen due date.
//   3. This creates a task instance in your task list — it will now appear in
//      AllTasksScreen and TodayScreen just like any other task.
//   4. Calls onInstanceCreated callback (parent navigates away).
//      If no callback, shows a success alert: "Task 'X' added to your tasks!"
//   5. If anything fails, shows an error alert. The "Add" button changes to
//      "Adding..." while the save is in progress.
//
// FLOW SUMMARY:
//   1. Screen mounts → loads all templates from storage
//   2. User sees the template list and taps one
//   3. "Add Task" modal slides up with that template pre-selected
//   4. User sets due date and taps "Add"
//   5. Instance is created and saved → user is navigated back
//
// TODO:
//   - Add organisation/grouping by taskType (when taskType is added to storage)
//   - Add search/filter functionality at the top of the list
//   - Add template preview with stats (completion rate, last used date, etc.)
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
import {
  getAllPermanentTemplates,
  deletePermanentTask,
} from '../../features/permanentTask/utils/permanentTaskActions';
import { Task } from '../../core/types/task';

// =============================================================================
// DATE HELPERS
// These are identical to the helpers in CreateTaskScreen — kept here as a copy
// so each file is self-contained. If this logic grows, consider moving it to a
// shared utility file.
// =============================================================================

// Tracks which quick-select button the user tapped, or 'custom' for any other date
type QuickDateOption = 'today' | 'tomorrow' | 'custom';

// Returns a Date set to 23:59:59.999 for today or tomorrow.
// End-of-day means tasks don't become overdue in the middle of the day.
const getQuickDate = (option: 'today' | 'tomorrow'): Date => {
  const date = new Date();
  date.setHours(23, 59, 59, 999); // End of day
  if (option === 'tomorrow') {
    date.setDate(date.getDate() + 1);
  }
  return date;
};

// Converts a Date to a human-readable string for the "Selected:" readout.
// Returns "Today" or "Tomorrow" for those special cases, or "Mon, Feb 3" otherwise.
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

// A lightweight snapshot of the template the user tapped on.
// Used to populate the "Add Task" modal without having to re-query storage.
interface SelectedTemplate {
  id: string;
  permanentId: string;
  title: string;
  location?: string;
}

// Props this screen accepts from its parent navigator.
export interface UsePermanentTaskScreenProps {
  // Called when an instance is successfully created — parent uses this to navigate back
  onInstanceCreated?: (task: Task) => void;
  // Called when user taps Cancel in the main header — parent navigates back
  onCancel?: () => void;
  // Called when user chooses "Edit Template" from the ⋮ menu
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
  // =========================================================================
  // STATE
  // =========================================================================

  // The list of permanent task templates loaded from storage.
  // Starts empty; populated by loadTemplates() on mount.
  const [templates, setTemplates] = useState<Task[]>([]);

  // True while templates are being fetched from storage (shows the spinner)
  const [isLoading, setIsLoading] = useState(true);

  // If loading fails, this holds the error message to display to the user
  const [error, setError] = useState<string | null>(null);

  // The template the user tapped on (null = no template selected, modal is hidden)
  const [selectedTemplate, setSelectedTemplate] = useState<SelectedTemplate | null>(null);

  // Controls whether the "Add Task" bottom sheet modal is visible
  const [showInstanceModal, setShowInstanceModal] = useState(false);

  // The due date chosen inside the modal — starts as today
  const [dueDate, setDueDate] = useState<Date>(new Date());

  // Which quick-date button is highlighted inside the modal
  const [selectedQuickOption, setSelectedQuickOption] = useState<QuickDateOption>('today');

  // Whether the native date picker is open inside the modal
  const [showDatePicker, setShowDatePicker] = useState(false);

  // True while the "Add" button is processing — disables it and shows "Adding..."
  const [isCreating, setIsCreating] = useState(false);

  // =========================================================================
  // LOAD TEMPLATES
  // =========================================================================

  // Fetches all saved permanent task templates from local storage.
  // useCallback memoises this function so it can safely be listed in useEffect's
  // dependency array without causing an infinite loop.
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

  // Load templates automatically the first time this screen appears.
  // Also re-runs if loadTemplates function identity changes (it won't unless
  // the component remounts).
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  // Called when the user taps a row in the template list.
  // Extracts the relevant fields from the full Task object into the lightweight
  // SelectedTemplate shape, resets the date picker to "today", and opens the modal.
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
    // Reset date selection to today every time a new template is opened
    setDueDate(getQuickDate('today'));
    setSelectedQuickOption('today');
    setShowDatePicker(false);
    setShowInstanceModal(true);
  };

  // Called when the user taps "Today" or "Tomorrow" inside the modal.
  // Sets the due date and highlights that button.
  const handleQuickDateSelect = (option: 'today' | 'tomorrow') => {
    setSelectedQuickOption(option);
    setDueDate(getQuickDate(option));
    setShowDatePicker(false);
  };

  // Called when the user taps "Pick Date" inside the modal.
  // Opens the phone's native date picker.
  const handleCustomDatePress = () => {
    setSelectedQuickOption('custom');
    setShowDatePicker(true);
  };

  // Callback from the native DateTimePicker when the user picks or cancels.
  // On Android the picker dismisses itself; on iOS it stays open (inline spinner).
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // On Android, picker dismisses automatically after selection
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    // Only update the date if the user confirmed (type === 'set'), not cancelled
    if (event.type === 'set' && selectedDate) {
      setDueDate(selectedDate);
      setSelectedQuickOption('custom');
    }
  };

  // Called when the user taps "Add" in the modal header.
  // Creates a task instance from the selected template with the chosen due date,
  // then closes the modal and notifies the parent.
  const handleCreateInstance = async () => {
    if (!selectedTemplate) return;

    setIsCreating(true);  // Disables the "Add" button and shows "Adding..." text

    try {
      // Create instance from template.
      // The location is inherited from the template automatically inside
      // permanentTaskActions via the templateId lookup — we don't need to pass it.
      const newInstance = await createTask(
        selectedTemplate.title,
        'permanent',
        {
          templateId: selectedTemplate.permanentId,
          dueDate: dueDate,
        } as any
      );

      console.log('Instance created:', newInstance);

      // Close the modal and clear the selected template
      setShowInstanceModal(false);
      setSelectedTemplate(null);

      // Tell the parent navigator that an instance was created, so it can
      // navigate back to the task list. If no callback, show a success message.
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
      setIsCreating(false);  // Re-enable the "Add" button either way
    }
  };

  // Called when the user taps "Cancel" inside the "Add Task" modal.
  // Closes the modal and clears the selection without creating a task.
  const handleCancelModal = () => {
    setShowInstanceModal(false);
    setSelectedTemplate(null);
  };

  // Called when the user taps "Cancel" in the main screen header.
  // Tells the parent navigator to go back.
  const handleCancel = () => {
    console.log('UsePermanentTaskScreen: Cancel pressed, onCancel:', !!onCancel);
    onCancel?.();
  };

  // Called when the user confirms deletion from the ⋮ menu.
  // Cascades delete to template, instances, and stats via deletePermanentTask.
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

  // =========================================================================
  // RENDER HELPERS
  // Helper functions that return JSX for complex repeated elements.
  // =========================================================================

  // Renders a single row in the template list.
  // Each row is a tappable card showing the template name, optional location,
  // and usage count, with a "›" arrow on the right indicating it's tappable.
  const renderTemplateItem = ({ item }: { item: Task }) => {
    const metadata = item.metadata as any;

    return (
      <TouchableOpacity
        style={styles.templateItem}
        onPress={() => handleTemplateSelect(item)}
        activeOpacity={0.7}  // slight dim on press so user sees visual feedback
      >
        <View style={styles.templateContent}>
          {/* Template name — large, dark, prominent */}
          <Text style={styles.templateTitle}>{item.title}</Text>

          {/* Show location line only if this template has a location saved.
              Displayed as a pin emoji followed by the location name. */}
          {item.location && (
            <Text style={styles.templateLocation}>
              📍 {typeof item.location === 'object' ? (item.location as any).name : item.location}
            </Text>
          )}

          {/* Show how many times this template has been used, e.g. "Used 3 times".
              Only rendered if instanceCount data exists in the template's metadata. */}
          {metadata?.instanceCount !== undefined && (
            <Text style={styles.templateMeta}>
              Used {metadata.instanceCount} time{metadata.instanceCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* ⋮ options menu — Edit or Delete this template */}
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

        {/* Right-pointing chevron arrow — signals to the user the row is tappable */}
        <Text style={styles.templateArrow}>›</Text>
      </TouchableOpacity>
    );
  };

  // Renders the empty state when there are no templates yet.
  // Shows a title and a short explanation centred on screen.
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
  // RENDER — what gets drawn on screen
  // =========================================================================

  return (
    // SafeAreaView keeps content within the safe zone (avoids notch/home bar)
    <SafeAreaView style={styles.container}>

      {/* =================================================================
          MAIN HEADER BAR
          White bar at the top with:
            - "Cancel" button on the far left (blue text)
            - "Use Template" title in the centre
            - An empty View on the far right (invisible placeholder that keeps
              the title visually centred — without it the title would drift left)
          ================================================================= */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Use Template</Text>
        <View style={styles.headerButton}>
          {/* Placeholder for symmetry — balances the Cancel button on the left */}
          <Text style={styles.headerButtonText}> </Text>
        </View>
      </View>

      {/* =================================================================
          MAIN CONTENT AREA
          Shows one of three states depending on load status:
            - Spinner (isLoading = true)
            - Error message + Retry button (error is set)
            - Template list (normal state)
          ================================================================= */}
      {isLoading ? (
        // LOADING STATE: spinning indicator + "Loading templates..." text
        // Centred on screen, appears as soon as this screen mounts
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      ) : error ? (
        // ERROR STATE: red error message centred on screen with a Retry button.
        // The error message comes from the catch block in loadTemplates().
        // Tapping "Retry" calls loadTemplates() again to try fetching from storage.
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTemplates}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // NORMAL STATE: scrollable list of template rows.
        // FlatList is the performant list component — only renders rows that are
        // visible on screen, which keeps things fast even with many templates.
        // Each row is separated by a thin grey hairline divider.
        // If there are no templates, renderEmptyList() is shown in the centre.
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          renderItem={renderTemplateItem}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={templates.length === 0 ? styles.emptyListContainer : undefined}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* =================================================================
          "ADD TASK" MODAL (bottom sheet)
          Slides up from the bottom when the user taps a template row.
          Covers most of the screen (pageSheet style on iOS).
          The modal has its own SafeAreaView so its content is within the
          safe zone even on top of the list.

          MODAL LAYOUT:
            1. Modal header bar — [Cancel]  Add Task  [Add / Adding...]
            2. TEMPLATE section — shows the selected template name and location
               (read-only, just confirming which template was chosen)
            3. DUE DATE section — Today / Tomorrow / Pick Date buttons,
               plus a "Selected: X" readout and optional date picker
          ================================================================= */}
      <Modal
        visible={showInstanceModal}
        animationType="slide"        // slides up from the bottom
        presentationStyle="pageSheet" // tall bottom sheet on iOS
        onRequestClose={handleCancelModal}  // Android back-button closes the modal
      >
        <SafeAreaView style={styles.modalContainer}>

          {/* ---------------------------------------------------------------
              MODAL HEADER BAR
              White bar with:
                - "Cancel" on the left (dismisses modal, no task created)
                - "Add Task" title in the centre
                - "Add" button on the right (bold blue; saves the task)
                  While saving, the button text changes to "Adding..." and the
                  button is disabled to prevent double-tapping.
              --------------------------------------------------------------- */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCancelModal} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Task</Text>
            <TouchableOpacity
              onPress={handleCreateInstance}
              style={styles.headerButton}
              disabled={isCreating}  // grey out while the save is in progress
            >
              <Text style={[styles.headerButtonText, styles.saveButton]}>
                {isCreating ? 'Adding...' : 'Add'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ---------------------------------------------------------------
              MODAL CONTENT — scrollable form inside the modal
              --------------------------------------------------------------- */}
          <View style={styles.modalContent}>

            {/* TEMPLATE section — read-only display of the chosen template.
                Shows the template title in large text and the location below it
                (if the template had a location set). This is purely informational
                so the user can confirm they tapped the right template. */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TEMPLATE</Text>
              <Text style={styles.selectedTemplateTitle}>{selectedTemplate?.title}</Text>
              {selectedTemplate?.location && (
                <Text style={styles.selectedTemplateLocation}>
                  📍 {selectedTemplate.location}
                </Text>
              )}
            </View>

            {/* DUE DATE section — identical in layout and behaviour to the
                due date section in CreateTaskScreen.
                Three quick-pick buttons, a date readout, and an optional
                native date picker (iOS spinner inline, Android modal). */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DUE DATE *</Text>

              {/* Quick date buttons row: [Today]  [Tomorrow]  [Pick Date]
                  The active button turns blue; the others remain grey. */}
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

                {/* PICK DATE button — opens the native date picker */}
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

              {/* Readout bar showing the currently selected date, e.g. "Selected: Today" */}
              <View style={styles.selectedDateDisplay}>
                <Text style={styles.selectedDateLabel}>Selected:</Text>
                <Text style={styles.selectedDateValue}>{formatDateDisplay(dueDate)}</Text>
              </View>

              {/* iOS inline date spinner — only visible after tapping "Pick Date"
                  on an iPhone/iPad. Stays visible until user taps Today/Tomorrow
                  or scrolls away. minimumDate prevents choosing past dates. */}
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

              {/* Android native calendar dialog — only rendered after tapping
                  "Pick Date" on Android. Appears as a popup over the modal and
                  auto-dismisses once the user confirms or cancels. */}
              {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  minimumDate={new Date()}
                />
              )}

              {/* Small helper note below the date selection reminding the user
                  what this field is for */}
              <Text style={styles.helperText}>
                When should this task be completed?
              </Text>
            </View>

            {/* TODO: Add more instance-specific fields here as the feature grows */}
            {/* - Custom title override (change the name just for this instance) */}
            {/* - Priority selection (low / medium / high) */}
            {/* - Notes/description text area */}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// Visual appearance definitions for every element in the render above.
// =============================================================================

const styles = StyleSheet.create({
  // Root wrapper — light grey background visible between white cards
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  // Main header bar and modal header bar — both use these styles.
  // White bar, items left-to-right, hairline grey bottom border.
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
  // "Use Template" / "Add Task" centred title text
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  // Tap-target wrapper around header buttons. NOTE: this currently has a light
  // blue background (rgba(0,122,255,0.1)) as a debug visual — intended to be
  // removed once tap areas are confirmed to be correct size.
  headerButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: 70,
    backgroundColor: 'rgba(0,122,255,0.1)', // DEBUG: remove after testing
  },
  // Blue text for "Cancel" and "Add" / "Adding..."
  headerButtonText: {
    fontSize: 17,
    color: '#007AFF',
  },
  // "Add" is bold to stand out from "Cancel"
  saveButton: {
    fontWeight: '600',
  },

  // LOADING STATE: fills remaining screen, centres the spinner and text
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // "Loading templates..." text below the spinner
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },

  // ERROR STATE: fills remaining screen, centres the error message and retry button
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  // Red error message text — centred, describes what went wrong
  errorText: {
    fontSize: 16,
    color: '#ff3b30',  // iOS red
    textAlign: 'center',
    marginBottom: 16,
  },
  // Blue rounded "Retry" button below the error message
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  // White bold text inside the Retry button
  retryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },

  // EMPTY LIST STATE: flex:1 lets renderEmptyList fill the available space so
  // its centred content appears in the middle of the screen, not the top
  emptyListContainer: {
    flex: 1,
  },
  // Inner container for "No Templates Yet" — fills space and centres content
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  // "No Templates Yet" heading
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  // Explanatory text below the heading — centred, soft grey
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // TEMPLATE LIST ROW: white background, horizontal layout, generous padding
  // for easy tapping. flexDirection: 'row' puts the content on the left and
  // the chevron on the right.
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  // Left side of the row — takes all remaining width after the arrow
  templateContent: {
    flex: 1,
  },
  // Template name — large, dark, main visual element of the row
  templateTitle: {
    fontSize: 17,
    color: '#000',
    fontWeight: '500',
  },
  // Location line below the title — smaller grey text with a pin emoji
  templateLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  // "Used X times" usage count — smallest text, lightest grey
  templateMeta: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  // ⋮ options menu button — sits between the content and the arrow
  menuButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  menuButtonText: {
    fontSize: 20,
    color: '#8e8e93',
  },
  // "›" right-pointing arrow — light grey, signals the row is tappable
  templateArrow: {
    fontSize: 22,
    color: '#c7c7cc',
    marginLeft: 8,
  },
  // Thin horizontal line between template rows — hairline = thinnest possible
  // marginLeft: 16 indents the line to align with the text (not the row edge)
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ddd',
    marginLeft: 16,
  },

  // MODAL container — fills the whole sheet, light grey background
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  // Modal header bar — same visual style as the main header bar
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
  // Modal form content — fills the space below the modal header
  modalContent: {
    flex: 1,
  },

  // White card used for each form section inside the modal (Template, Due Date)
  // marginTop: 16 creates visible grey gaps between cards
  section: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 16,
  },
  // Uppercase grey section label above each card's content, e.g. "TEMPLATE"
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    letterSpacing: 0.5,
  },

  // Large bold title in the TEMPLATE section showing the chosen template name
  selectedTemplateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  // Location line below the selected template title — grey, with pin emoji
  selectedTemplateLocation: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
  },

  // Horizontal row holding the three equal-width date buttons
  quickDateContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  // Individual date button — flex:1 gives equal width; grey, rounded, unselected
  quickDateButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent', // reserves border space so layout doesn't shift
  },
  // Selected button — solid blue fill and blue border
  quickDateButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  // Unselected button label text — dark grey
  quickDateButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  // Selected button label text — white (readable on blue background)
  quickDateButtonTextSelected: {
    color: '#fff',
  },

  // Rounded grey pill showing "Selected:  Today" — row layout, padded
  selectedDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  // "Selected:" grey label on the left of the readout pill
  selectedDateLabel: {
    fontSize: 15,
    color: '#666',
    marginRight: 8,
  },
  // The actual date value — black and bold
  selectedDateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },

  // iOS inline date spinner — fixed height prevents layout collapse
  iosDatePicker: {
    height: 150,
    marginBottom: 8,
  },
  // Small grey instructional note below the date section
  helperText: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
  },
});
