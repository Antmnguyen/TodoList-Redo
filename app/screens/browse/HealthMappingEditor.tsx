// app/screens/browse/HealthMappingEditor.tsx
// =============================================================================
// HEALTH MAPPING EDITOR
// =============================================================================
//
// Full-screen sub-screen for creating or editing a single HealthConnectMapping.
// Opened from within any of the three detail screens (Steps, Sleep, Workouts)
// via "+ Add Task Mapping" or by tapping an existing mapping row.
//
// ── What is a mapping? ───────────────────────────────────────────────────────
//
//   A mapping connects a health threshold to a permanent task template. When
//   sync() runs and the threshold is met, the mapped template's instance for
//   today is auto-completed. If no instance exists today and autoSchedule is
//   true, one is created first.
//
//   The display goal stored in health_connect_meta (shown on the detail screen
//   ring) and the mapping threshold here are INDEPENDENT. A user can set their
//   display goal to 10,000 steps while a mapping fires at 8,000, allowing
//   multiple mappings with different thresholds on the same data type.
//
// ── Navigation model ─────────────────────────────────────────────────────────
//
//   This editor is rendered as a sub-screen (conditional JSX swap, not a React
//   Navigation push). The parent detail screen checks a `showEditor` flag and
//   returns either this component or itself. Same pattern used throughout Browse.
//
//   onSave()   → parent reloads its mapping list and hides the editor
//   onCancel() → parent simply hides the editor, no reload needed
//
// ── Template loading ─────────────────────────────────────────────────────────
//
//   getAllPermanentTemplates() is async (it reads from SQLite). Templates are
//   loaded once in a useEffect and stored locally. In practice this is fast
//   (<1 ms for typical template counts) but must be async per the storage API.
//   The picker is simply empty until they load — no loading spinner needed.
//
// ── dataType is fixed ────────────────────────────────────────────────────────
//
//   The parent passes 'steps', 'sleep', or 'workout'. The user cannot change
//   it here. This prevents ambiguous mappings and simplifies the threshold UI —
//   only the relevant fields are shown for the pre-selected type.
//
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';
import { Task } from '../../core/types/task';
import {
  HealthConnectMapping,
  HealthDataType,
  ExerciseTypeMap,
} from '../../features/googleFit/types/healthConnect';
import {
  saveMapping,
  deleteMapping,
} from '../../core/services/storage/healthConnectStorage';
import { getAllPermanentTemplates } from '../../features/permanentTask/utils/permanentTaskActions';

// =============================================================================
// CONSTANTS
// =============================================================================

// Brand colour for all Health Connect screens — same value used on every HC
// screen so all headers, buttons, and ring arcs are visually consistent.
const HC_COLOR = '#33ace5';

/**
 * All available exercise types built from ExerciseTypeMap at module load time.
 *
 * ExerciseTypeMap maps human-readable labels (e.g. 'Running') to the integer
 * values that Health Connect uses internally (e.g. 56). Building this list
 * once here avoids rebuilding it on every render. The integer values are what
 * get persisted to health_connect_mappings.exerciseType — never the labels.
 */
const EXERCISE_OPTIONS = Object.entries(ExerciseTypeMap).map(([label, value]) => ({
  label,
  value,
}));

// =============================================================================
// TYPES
// =============================================================================

interface HealthMappingEditorProps {
  /**
   * Which health data type this mapping is for.
   * Pre-selected by the parent; the user cannot change it here.
   * Controls which threshold fields are rendered ('steps' → step goal input,
   * 'sleep' → hours input, 'workout' → exercise type + min duration).
   */
  dataType: HealthDataType;

  /**
   * The existing mapping when editing. Undefined when creating a new one.
   * When defined, form fields are pre-populated from mapping values, and the
   * Delete button is shown.
   */
  mapping?: HealthConnectMapping;

  /**
   * Called after a successful save or delete.
   * The parent uses this signal to reload its mapping list and hide the editor.
   */
  onSave: () => void;

  /**
   * Called when the user cancels without making any changes.
   * No reload is needed — the parent just hides the editor.
   */
  onCancel: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a unique ID for new mappings.
 *
 * Format: 'hcm_' + timestamp + '_' + 4-char random suffix.
 * The timestamp component ensures monotonic ordering; the random suffix
 * guards against collisions if two mappings are created in the same millisecond
 * (unlikely in practice, but cheap to defend against).
 */
function generateMappingId(): string {
  return 'hcm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

// =============================================================================
// COMPONENT
// =============================================================================

export const HealthMappingEditor: React.FC<HealthMappingEditorProps> = ({
  dataType,
  mapping,
  onSave,
  onCancel,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // True when we have an existing mapping (editing mode vs create mode).
  // Affects the header title, ID generation, and whether Delete is shown.
  const isEditing = mapping !== undefined;

  // ==========================================================================
  // FORM STATE
  // ==========================================================================
  //
  // Each field is independent state rather than a single form object. This
  // keeps each onChange handler simple (no spread needed) and avoids stale
  // closure issues when the user blurs a TextInput quickly.

  // The permanentId of the linked template — the core relationship.
  // All other fields are threshold config; this one determines which task fires.
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(
    mapping?.permanentId,
  );

  // ── Steps threshold ────────────────────────────────────────────────────────
  // Only rendered when dataType === 'steps'. Stored as a string because it
  // comes from a TextInput; parsed to Number() only on save.
  const [stepsGoalInput, setStepsGoalInput] = useState<string>(
    String(mapping?.stepsGoal ?? 10000),
  );

  // ── Sleep threshold ────────────────────────────────────────────────────────
  // Only rendered when dataType === 'sleep'. Decimal-pad keyboard to allow
  // values like '7.5' (7h 30m). Parsed to float on save.
  const [sleepHoursInput, setSleepHoursInput] = useState<string>(
    String(mapping?.sleepHours ?? 7),
  );

  // ── Workout thresholds ─────────────────────────────────────────────────────
  // Only rendered when dataType === 'workout'.
  //   exerciseType  : integer from ExerciseTypeMap (0 = any workout).
  //   durationInput : minimum session length in minutes, stored as string.
  const [selectedExerciseType, setSelectedExerciseType] = useState<number>(
    mapping?.exerciseType ?? 0,
  );
  const [durationInput, setDurationInput] = useState<string>(
    String(mapping?.minDurationMinutes ?? 30),
  );

  // ── Auto-schedule ──────────────────────────────────────────────────────────
  // When true, sync will CREATE an instance today (then complete it) if no
  // pending instance is found. When false, sync only completes pre-existing
  // instances and is a no-op if none exist.
  const [autoSchedule, setAutoSchedule] = useState<boolean>(
    mapping?.autoSchedule ?? false,
  );

  // ==========================================================================
  // TEMPLATE LIST (async)
  // ==========================================================================
  //
  // Loaded once on mount. The list is only used for the picker modal — we don't
  // need it during the main render. The picker stays empty until the async load
  // completes, which is imperceptible in practice.

  const [templates, setTemplates] = useState<Task[]>([]);

  // Picker visibility flags — Modal visibility is local UI state, not domain state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  useEffect(() => {
    // Load all permanent task templates so the user can pick one.
    // getAllPermanentTemplates() is async because the underlying storage layer
    // uses db.getAllAsync. We don't show a loading indicator because this is
    // fast (<1 ms typically) and the user sees the picker only on a tap.
    getAllPermanentTemplates().then(setTemplates);
  }, []);

  // Resolved display name for the currently selected template.
  // We match by metadata.permanentId (the stable UUID) not by id (the row PK),
  // because permanentId is the field stored in health_connect_mappings.
  const selectedTemplateName = useMemo(() => {
    if (!selectedTemplateId) return null;
    const match = templates.find(t => t.metadata?.permanentId === selectedTemplateId);
    return match?.title ?? null;
  }, [selectedTemplateId, templates]);

  // Resolved display label for the currently selected exercise type.
  // Falls back to 'Any Workout' if the stored value isn't found in the map
  // (shouldn't happen, but guards against future ExerciseTypeMap changes).
  const selectedExerciseLabel = useMemo(
    () => EXERCISE_OPTIONS.find(o => o.value === selectedExerciseType)?.label ?? 'Any Workout',
    [selectedExerciseType],
  );

  // ==========================================================================
  // SAVE HANDLER
  // ==========================================================================
  //
  // Validates that a template is selected (the only required field), then
  // writes the mapping to SQLite via saveMapping() (INSERT OR REPLACE).
  // Fields not relevant to the current dataType are passed as undefined —
  // saveMapping() converts undefined to SQL NULL.

  const handleSave = useCallback(() => {
    // Guard: a mapping without a template would be an orphan — useless and
    // invisible in getAllEnabledMappings() (INNER JOIN filters it anyway, but
    // it's cleaner to reject it here with a user-facing message).
    if (!selectedTemplateId) {
      Alert.alert('Missing Task', 'Please select a permanent task to link.');
      return;
    }

    saveMapping({
      // Preserve the existing ID when editing; generate a fresh one for creates.
      id:          mapping?.id ?? generateMappingId(),
      permanentId: selectedTemplateId,
      dataType,

      // Only the fields for this dataType are populated. The others are
      // explicitly undefined so saveMapping() writes NULL to the other columns,
      // keeping the row clean and avoiding phantom threshold values.
      stepsGoal:          dataType === 'steps'   ? Number(stepsGoalInput)  : undefined,
      sleepHours:         dataType === 'sleep'   ? Number(sleepHoursInput) : undefined,
      exerciseType:       dataType === 'workout' ? selectedExerciseType    : undefined,
      minDurationMinutes: dataType === 'workout' ? Number(durationInput)   : undefined,

      autoSchedule,
      // Always save as enabled = true. The enabled toggle on the mapping row
      // in the detail screen is the only way to disable — not done here.
      enabled: true,
    });

    onSave();
  }, [
    selectedTemplateId, mapping, dataType,
    stepsGoalInput, sleepHoursInput,
    selectedExerciseType, durationInput,
    autoSchedule, onSave,
  ]);

  // ==========================================================================
  // DELETE HANDLER
  // ==========================================================================
  //
  // Shows a destructive confirmation before calling deleteMapping(). The
  // template itself is NOT touched — we only remove the threshold link.

  const handleDelete = useCallback(() => {
    if (!mapping) return; // should not be reachable (Delete is hidden in create mode)
    Alert.alert(
      'Delete Mapping',
      'Remove this task mapping? The task template will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMapping(mapping.id);
            // Reuse onSave because the parent needs to reload its list either way
            onSave();
          },
        },
      ],
    );
  }, [mapping, onSave]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Screen edges={['top']} topColor={HC_COLOR} style={{ flex: 1, backgroundColor: theme.bgScreen }}>

      {/* ── Header ────────────────────────────────────────────────────────────
          Cancel on the left, Save on the right — standard iOS/Android pattern.
          Title changes between 'Add Mapping' and 'Edit Mapping' to make the
          mode obvious without reading the button states.
      */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Edit Mapping' : 'Add Mapping'}
        </Text>
        <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
          <Text style={[styles.headerBtnText, styles.saveBtnText]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        // Prevent the keyboard from hiding inputs — tapping outside a TextInput
        // still dismisses the keyboard (default behaviour) but tapping a button
        // (like Save) fires the handler rather than just blurring the input first.
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Task selector ────────────────────────────────────────────────────
            Tapping opens the template picker Modal. The chevron and placeholder
            text make it clear this is tappable even before interaction.
        */}
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>TASK</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard }]}>
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setShowTemplatePicker(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.pickerValue,
                { color: selectedTemplateName ? theme.textPrimary : theme.textTertiary },
              ]}
            >
              {selectedTemplateName ?? 'Pick a permanent task…'}
            </Text>
            <Text style={[styles.chevron, { color: theme.textTertiary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* ── Threshold section ─────────────────────────────────────────────────
            Only the fields relevant to the current dataType are rendered.
            This is a conditional render (not hidden with opacity/display:none)
            so irrelevant fields don't exist in the React tree at all, which
            prevents stale keyboard state and avoids layout issues.
        */}
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>THRESHOLD</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard }]}>

          {/* Steps: single integer input — the step count target */}
          {dataType === 'steps' && (
            <View style={styles.thresholdRow}>
              <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Step goal:</Text>
              <TextInput
                style={[styles.numericInput, {
                  color: theme.textPrimary,
                  backgroundColor: theme.bgInput,
                  borderColor: theme.border,
                }]}
                value={stepsGoalInput}
                onChangeText={setStepsGoalInput}
                keyboardType="numeric"
                returnKeyType="done"
                // selectTextOnFocus makes it easy to replace the entire value
                // rather than appending digits to an existing number.
                selectTextOnFocus
              />
              <Text style={[styles.fieldUnit, { color: theme.textSecondary }]}>steps</Text>
            </View>
          )}

          {/* Sleep: float input — hours to sleep (e.g. 7.5 = 7h 30m) */}
          {dataType === 'sleep' && (
            <View style={styles.thresholdRow}>
              <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Min hours:</Text>
              <TextInput
                style={[styles.numericInput, {
                  color: theme.textPrimary,
                  backgroundColor: theme.bgInput,
                  borderColor: theme.border,
                }]}
                value={sleepHoursInput}
                onChangeText={setSleepHoursInput}
                // decimal-pad allows entry of fractional hours on Android.
                // 'numeric' only allows integers on some keyboards.
                keyboardType="decimal-pad"
                returnKeyType="done"
                selectTextOnFocus
              />
              <Text style={[styles.fieldUnit, { color: theme.textSecondary }]}>hours</Text>
            </View>
          )}

          {/* Workout: exercise type picker + minimum duration input.
              These are two separate controls stacked in one card.
              Exercise type 0 = 'Any Workout' (wildcard — matches every session). */}
          {dataType === 'workout' && (
            <>
              {/* Exercise type — opens a picker Modal */}
              <TouchableOpacity
                style={[styles.thresholdRow, styles.pickerRow]}
                onPress={() => setShowExercisePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Exercise:</Text>
                <Text style={[styles.pickerValue, { color: theme.textPrimary, flex: 1 }]}>
                  {selectedExerciseLabel}
                </Text>
                <Text style={[styles.chevron, { color: theme.textTertiary }]}>›</Text>
              </TouchableOpacity>

              {/* Visual separator between the two workout fields */}
              <View style={[styles.divider, { backgroundColor: theme.separator }]} />

              {/* Minimum session duration — numeric, whole minutes */}
              <View style={styles.thresholdRow}>
                <Text style={[styles.fieldLabel, { color: theme.textPrimary }]}>Min duration:</Text>
                <TextInput
                  style={[styles.numericInput, {
                    color: theme.textPrimary,
                    backgroundColor: theme.bgInput,
                    borderColor: theme.border,
                  }]}
                  value={durationInput}
                  onChangeText={setDurationInput}
                  keyboardType="numeric"
                  returnKeyType="done"
                  selectTextOnFocus
                />
                <Text style={[styles.fieldUnit, { color: theme.textSecondary }]}>min</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Auto-schedule toggle ──────────────────────────────────────────────
            This is the "create + complete" vs "complete only" switch.

            OFF (default): sync only completes an existing pending instance for
                           today. If the user hasn't scheduled the task today,
                           nothing happens even if the threshold is met.

            ON:  sync will call createTask() + completeTask() if no pending
                 instance is found. Useful for habits the user wants to track
                 automatically regardless of whether they pre-scheduled the task.

            The subtitle makes this distinction explicit so users understand why
            the task might appear in their list unexpectedly.
        */}
        <View style={[styles.card, { backgroundColor: theme.bgCard }]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { color: theme.textPrimary }]}>
                Auto-schedule if no task today
              </Text>
              <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
                Creates an instance when goal is met, even if none was scheduled
              </Text>
            </View>
            <Switch
              value={autoSchedule}
              onValueChange={setAutoSchedule}
              trackColor={{ false: theme.separator, true: HC_COLOR }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── Delete button ─────────────────────────────────────────────────────
            Only shown in edit mode (when mapping prop is defined). Shown at the
            bottom so it doesn't draw attention away from the Save flow. Uses a
            ghost button style (outline, no fill) for the destructive action —
            same as the standard iOS destructive pattern but less alarming than
            a solid red button.
        */}
        {isEditing && (
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: theme.danger }]}
            onPress={handleDelete}
            activeOpacity={0.75}
          >
            <Text style={[styles.deleteBtnText, { color: theme.danger }]}>
              Delete Mapping
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* ── Template picker Modal ─────────────────────────────────────────────
          A full-height page-sheet Modal with a FlatList of permanent templates.
          The currently selected template shows a checkmark and a tinted row
          background so it's immediately identifiable when re-opening the picker.

          We match on metadata.permanentId (not task.id) because permanentId is
          the UUID stored in health_connect_mappings — it's the stable identifier
          for a template across renames and re-installs.
      */}
      <Modal
        visible={showTemplatePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTemplatePicker(false)}
      >
        <View style={[styles.pickerModal, { backgroundColor: theme.bgModal }]}>

          {/* Modal header with Done button to dismiss without selecting */}
          <View style={[styles.pickerModalHeader, { borderBottomColor: theme.separator }]}>
            <Text style={[styles.pickerModalTitle, { color: theme.textPrimary }]}>
              Select Task
            </Text>
            <TouchableOpacity onPress={() => setShowTemplatePicker(false)}>
              <Text style={[styles.pickerDoneBtn, { color: HC_COLOR }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={templates}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const isSelected = item.metadata?.permanentId === selectedTemplateId;
              return (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: theme.separator },
                    // Subtle tint on selected row — visible but not distracting
                    isSelected && { backgroundColor: `${HC_COLOR}18` },
                  ]}
                  onPress={() => {
                    setSelectedTemplateId(item.metadata?.permanentId);
                    // Auto-dismiss after selection — saves an extra tap
                    setShowTemplatePicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      { color: isSelected ? HC_COLOR : theme.textPrimary },
                    ]}
                  >
                    {item.title}
                  </Text>
                  {/* Checkmark only on the selected item */}
                  {isSelected && (
                    <Text style={{ color: HC_COLOR, fontSize: 18 }}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      </Modal>

      {/* ── Exercise type picker Modal ────────────────────────────────────────
          Same visual pattern as the template picker — checkmark on selection,
          auto-dismiss after tap. ExerciseTypeMap values are integers (the HC
          SDK constants). 'Any Workout' (value 0) is a wildcard that matches
          any ExerciseSession regardless of type.
      */}
      <Modal
        visible={showExercisePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExercisePicker(false)}
      >
        <View style={[styles.pickerModal, { backgroundColor: theme.bgModal }]}>

          <View style={[styles.pickerModalHeader, { borderBottomColor: theme.separator }]}>
            <Text style={[styles.pickerModalTitle, { color: theme.textPrimary }]}>
              Exercise Type
            </Text>
            <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
              <Text style={[styles.pickerDoneBtn, { color: HC_COLOR }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={EXERCISE_OPTIONS}
            keyExtractor={item => String(item.value)}
            renderItem={({ item }) => {
              const isSelected = item.value === selectedExerciseType;
              return (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: theme.separator },
                    isSelected && { backgroundColor: `${HC_COLOR}18` },
                  ]}
                  onPress={() => {
                    setSelectedExerciseType(item.value);
                    setShowExercisePicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      { color: isSelected ? HC_COLOR : theme.textPrimary },
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isSelected && (
                    <Text style={{ color: HC_COLOR, fontSize: 18 }}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </View>
      </Modal>

    </Screen>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({

    // ── Header ─────────────────────────────────────────────────────────────────
    // Three-column layout: Cancel | Title | Save. The outer header row uses
    // justifyContent: 'space-between' so Cancel hugs the left edge and Save
    // hugs the right, with the title centred in the remaining space.
    header: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 16,
      paddingVertical:   12,
      backgroundColor:   HC_COLOR,
    },
    // Minimum width on buttons prevents the title from shifting as text changes
    headerBtn:     { padding: 4, minWidth: 60 },
    headerBtnText: { fontSize: 16, color: '#fff', fontWeight: '500' },
    // Save button is bolder to draw the eye to the primary action
    saveBtnText:   { fontWeight: '700', textAlign: 'right' },
    headerTitle:   { fontSize: 18, fontWeight: '700', color: '#fff' },

    scroll: {
      paddingHorizontal: 16,
      paddingTop:        24,
      paddingBottom:     60,
    },

    // SECTION LABEL — small caps above each card group
    sectionLabel: {
      fontSize:      11,
      fontWeight:    '700',
      letterSpacing: 1.1,
      marginBottom:  6,
      marginLeft:    4,
    },

    // Card container — rounded rect, overflow hidden so children clip to border radius
    card: {
      borderRadius: 14,
      marginBottom: 20,
      overflow:     'hidden',
    },

    // ── Picker row ─────────────────────────────────────────────────────────────
    // Used for both the template selector and the exercise type selector inside
    // the workout card. Flex-row with the value taking remaining space and the
    // chevron sitting flush right.
    pickerRow: {
      flexDirection:     'row',
      alignItems:        'center',
      paddingVertical:   14,
      paddingHorizontal: 16,
    },
    pickerValue: {
      flex:     1,
      fontSize: 16,
    },
    chevron: { fontSize: 22 },

    // ── Threshold input row ─────────────────────────────────────────────────────
    // Label + input + unit all on one row. The label has a fixed width so the
    // inputs align even when the label text differs between types.
    thresholdRow: {
      flexDirection:     'row',
      alignItems:        'center',
      paddingVertical:   14,
      paddingHorizontal: 16,
      gap:               12,
    },
    fieldLabel: {
      fontSize:   15,
      fontWeight: '500',
      width:      110,
    },
    // Centred numeric input — looks like a spinner control without being one
    numericInput: {
      fontSize:          16,
      fontWeight:        '600',
      borderWidth:       1,
      borderRadius:      8,
      paddingHorizontal: 12,
      paddingVertical:   6,
      minWidth:          80,
      textAlign:         'center',
    },
    fieldUnit: { fontSize: 14 },

    // Hair-line divider between the two workout threshold rows inside one card
    divider: {
      height:     StyleSheet.hairlineWidth,
      marginLeft: 16,
    },

    // ── Auto-schedule toggle row ────────────────────────────────────────────────
    // The two-line label and sub-label sit in a flex:1 column so the Switch
    // always stays flush right regardless of label line count.
    toggleRow: {
      flexDirection:     'row',
      alignItems:        'center',
      paddingVertical:   14,
      paddingHorizontal: 16,
      gap:               12,
    },
    toggleLabel: {
      fontSize:   15,
      fontWeight: '500',
    },
    toggleSub: {
      fontSize:  12,
      marginTop: 2,
    },

    // ── Delete button ───────────────────────────────────────────────────────────
    // Ghost style (outline only) so it's visually de-emphasised compared to the
    // header Save action, but still unambiguously destructive via the red colour.
    deleteBtn: {
      borderWidth:     1,
      borderRadius:    14,
      paddingVertical: 14,
      alignItems:      'center',
      marginTop:       4,
    },
    deleteBtnText: {
      fontSize:   16,
      fontWeight: '600',
    },

    // ── Modal (pickers) ─────────────────────────────────────────────────────────
    // Both pickers (templates + exercise types) use the same Modal shell.
    // pageSheet presentation gives the native bottom-sheet appearance on Android
    // and a card-style slide on iOS.
    pickerModal: { flex: 1 },
    pickerModalHeader: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 20,
      paddingVertical:   16,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pickerModalTitle: { fontSize: 18, fontWeight: '700' },
    pickerDoneBtn:    { fontSize: 16, fontWeight: '600' },

    // Individual picker list item — hairline bottom border, selectable row
    pickerItem: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingVertical:   16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pickerItemText: {
      fontSize:   16,
      fontWeight: '500',
      flex:       1,
    },
  });
}
