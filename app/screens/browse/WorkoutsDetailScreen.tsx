// app/screens/browse/WorkoutsDetailScreen.tsx
// =============================================================================
// WORKOUTS DETAIL SCREEN
// =============================================================================
//
// Full-screen view of today's workout sessions from Health Connect, plus the
// task mappings that can auto-complete tasks when workout thresholds are met.
//
// ── Why no history chart? ────────────────────────────────────────────────────
//
//   Workout data is not stored in a local history table (unlike steps and sleep
//   which use health_steps_log / health_sleep_log). WorkoutSession records are
//   read fresh from Health Connect via getTodaySummary() each time the screen
//   opens. This is intentional: workout sessions are episodic (not a daily
//   cumulative number) and there's no meaningful "avg workouts per week"
//   stat that would justify the schema complexity.
//
//   A chart could be added in the future by storing workout counts in a new
//   health_workout_log table, but that is out of scope for this sprint.
//
// ── Screen sections (top to bottom) ─────────────────────────────────────────
//
//   1. Header — back button + title
//   2. Today's Sessions — list of WorkoutSession entries with type label + duration
//   3. Task Mappings — mapping rows + "Add Task Mapping" button
//
// ── Workout type labels ───────────────────────────────────────────────────────
//
//   Health Connect stores exercise type as an integer constant (e.g. 56 for
//   Running, 70 for Strength Training). ExerciseTypeMap maps labels to values,
//   so we invert it at lookup time: find the key whose value matches the integer.
//   Falls back to "Type {n}" if the integer isn't in the map (future HC types).
//
// ── Loading pattern ──────────────────────────────────────────────────────────
//
//   getTodaySummary() is async (it calls Health Connect read APIs). Workouts are
//   loaded in a useEffect and the screen shows a loading indicator until done.
//   The mapping list is synchronous (SQLite) and can be loaded independently.
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
  ActivityIndicator,
} from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// ── Health Connect actions ─────────────────────────────────────────────────────
import { getTodaySummary } from '../../features/googleFit/utils/healthConnectActions';

// ── Storage ───────────────────────────────────────────────────────────────────
import {
  getAllMappings,
  saveMapping,
} from '../../core/services/storage/healthConnectStorage';

// ── Types ─────────────────────────────────────────────────────────────────────
import {
  WorkoutSession,
  HealthConnectMapping,
  ExerciseTypeMap,
} from '../../features/googleFit/types/healthConnect';

// ── Mapping editor sub-screen ─────────────────────────────────────────────────
import { HealthMappingEditor } from './HealthMappingEditor';

// =============================================================================
// CONSTANTS
// =============================================================================

const HC_COLOR = '#33ace5';

// =============================================================================
// TYPES
// =============================================================================

export interface WorkoutsDetailScreenProps {
  onBack: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Resolve a Health Connect exercise type integer to a human-readable label.
 *
 * ExerciseTypeMap is keyed by label and valued by integer, so we invert the
 * lookup at call time. This is O(n) but n is small (<15 entries) and this is
 * called only per workout session, not in a tight loop.
 *
 * Falls back to "Type {n}" for integers not in the map — future Health Connect
 * SDK versions may add exercise types that aren't in our map yet.
 *
 * @param type  Exercise type integer from a WorkoutSession record
 */
function exerciseLabel(type: number): string {
  const entry = Object.entries(ExerciseTypeMap).find(([, v]) => v === type);
  return entry ? entry[0] : `Type ${type}`;
}

/**
 * Format a duration in fractional minutes as a rounded whole number + unit.
 *
 * Health Connect reports duration in milliseconds which we convert to minutes
 * in getTodaySummary(). The raw value may have a fractional component from
 * sub-minute precision (e.g. 45.833…). Math.round gives the nearest minute.
 *
 * @param minutes  Fractional minutes (e.g. 45.833)
 */
function formatDuration(minutes: number): string {
  return `${Math.round(minutes)} min`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const WorkoutsDetailScreen: React.FC<WorkoutsDetailScreenProps> = ({ onBack }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // ==========================================================================
  // ALL HOOKS — must be declared before any conditional return
  // ==========================================================================
  //
  // The HealthMappingEditor early return is placed after all hook declarations
  // to comply with the Rules of Hooks (hooks must be called unconditionally and
  // in the same order on every render, regardless of any early returns).

  // ── Editor sub-screen ──────────────────────────────────────────────────────
  const [showEditor, setShowEditor] = useState(false);
  const [editingMapping, setEditingMapping] = useState<HealthConnectMapping | undefined>(undefined);

  // ── Workout session state ──────────────────────────────────────────────────
  // Loaded asynchronously from Health Connect on mount.
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Mapping rows ───────────────────────────────────────────────────────────
  const [mappings, setMappings] = useState<HealthConnectMapping[]>([]);

  // ==========================================================================
  // DATA LOADING
  // ==========================================================================

  const loadMappings = useCallback(() => {
    setMappings(getAllMappings().filter(m => m.dataType === 'workout'));
  }, []);

  useEffect(() => {
    // Load today's workout sessions from Health Connect.
    // getTodaySummary() reads all ExerciseSession records since midnight, so
    // this returns the same workout list that sync() used for threshold evaluation.
    // On error (e.g. HC not installed), default to empty list rather than crashing.
    getTodaySummary()
      .then(s => setWorkouts(s.workouts))
      .catch(() => setWorkouts([]))
      .finally(() => setLoading(false));

    // Mappings are synchronous — load independently of the async workout fetch
    loadMappings();
  }, [loadMappings]);

  // ==========================================================================
  // CONDITIONAL RENDER — mapping editor sub-screen (after all hooks)
  // ==========================================================================

  if (showEditor) {
    return (
      <HealthMappingEditor
        dataType="workout"
        mapping={editingMapping}
        onSave={() => {
          setShowEditor(false);
          loadMappings();
        }}
        onCancel={() => setShowEditor(false)}
      />
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Screen edges={['top']} topColor={HC_COLOR} style={styles.container}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workouts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Today's sessions ────────────────────────────────────────────────
            Displayed as a card with one row per session.
            While the async getTodaySummary() call is pending we show an
            ActivityIndicator so the user knows data is loading rather than
            seeing a misleading "No workouts" message.
        */}
        <Text style={[styles.sectionHeader, { color: theme.textTertiary }]}>
          TODAY'S SESSIONS
        </Text>

        <View style={[styles.sessionsCard, { backgroundColor: theme.bgCard }]}>
          {loading ? (
            // Loading state — HC read is in progress
            <View style={styles.loadingRow}>
              <ActivityIndicator color={HC_COLOR} size="small" />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading workouts…
              </Text>
            </View>
          ) : workouts.length === 0 ? (
            // Empty state — no sessions recorded since midnight
            <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
              No workouts recorded today
            </Text>
          ) : (
            // Session list — one row per WorkoutSession
            workouts.map((w, idx) => (
              <React.Fragment key={w.id || idx}>
                <View style={styles.sessionRow}>
                  {/* Exercise type label (human-readable) */}
                  <Text style={[styles.sessionType, { color: theme.textPrimary }]}>
                    {exerciseLabel(w.exerciseType)}
                  </Text>
                  {/* Duration — rounded to whole minutes */}
                  <Text style={[styles.sessionDuration, { color: theme.textSecondary }]}>
                    {formatDuration(w.durationMinutes)}
                  </Text>
                </View>
                {/* Separator between sessions — not after the last one */}
                {idx < workouts.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: theme.separator }]} />
                )}
              </React.Fragment>
            ))
          )}
        </View>

        {/* ── Task mappings ─────────────────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: theme.textTertiary }]}>
          TASK MAPPINGS
        </Text>

        <View style={[styles.mappingCard, { backgroundColor: theme.bgCard }]}>
          {mappings.length === 0 && (
            <Text style={[styles.emptyMappings, { color: theme.textTertiary }]}>
              No mappings yet. Add one to auto-complete tasks when you log a workout.
            </Text>
          )}
          {mappings.map((m, idx) => (
            <MappingRow
              key={m.id}
              mapping={m}
              showDivider={idx < mappings.length - 1}
              onPress={() => {
                setEditingMapping(m);
                setShowEditor(true);
              }}
              onToggle={(enabled) => {
                saveMapping({ ...m, enabled });
                loadMappings();
              }}
              theme={theme}
            />
          ))}
        </View>

        {/* Add mapping button */}
        <TouchableOpacity
          style={[styles.addMappingBtn, { borderColor: HC_COLOR }]}
          onPress={() => {
            setEditingMapping(undefined);
            setShowEditor(true);
          }}
          activeOpacity={0.75}
        >
          <Text style={[styles.addMappingText, { color: HC_COLOR }]}>
            + Add Task Mapping
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </Screen>
  );
};

// =============================================================================
// MAPPING ROW
// =============================================================================

/**
 * One mapping row in the workouts section.
 * Shows the threshold as "Any Workout ≥ 30 min" or "Running ≥ 45 min" based
 * on the stored exerciseType and minDurationMinutes values.
 */
interface MappingRowProps {
  mapping:     HealthConnectMapping;
  showDivider: boolean;
  onPress:     () => void;
  onToggle:    (enabled: boolean) => void;
  theme:       AppTheme;
}

const MappingRow: React.FC<MappingRowProps> = ({
  mapping,
  showDivider,
  onPress,
  onToggle,
  theme,
}) => {
  // Build a human-readable threshold description from the stored integers
  const typeLabel  = mapping.exerciseType !== undefined
    ? exerciseLabel(mapping.exerciseType)
    : 'Any Workout';
  const durationStr = mapping.minDurationMinutes !== undefined
    ? `≥ ${mapping.minDurationMinutes} min`
    : '';

  return (
    <>
      <TouchableOpacity style={mappingRowStyles.row} onPress={onPress} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={[mappingRowStyles.title, { color: theme.textPrimary }]}>
            {mapping.templateTitle ?? mapping.permanentId}
          </Text>
          <Text style={[mappingRowStyles.sub, { color: theme.textSecondary }]}>
            {typeLabel}{durationStr ? `  ·  ${durationStr}` : ''}
            {mapping.autoSchedule ? '  ·  auto-schedule' : ''}
          </Text>
        </View>
        <Switch
          value={mapping.enabled}
          onValueChange={onToggle}
          trackColor={{ false: theme.separator, true: HC_COLOR }}
          thumbColor="#fff"
        />
      </TouchableOpacity>
      {showDivider && (
        <View style={[mappingRowStyles.divider, { backgroundColor: theme.separator }]} />
      )}
    </>
  );
};

const mappingRowStyles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   12,
    paddingHorizontal: 16,
    gap:               12,
  },
  title:   { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  sub:     { fontSize: 12, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({

    container: { flex: 1, backgroundColor: theme.bgScreen },

    // Header — consistent with Steps/Sleep/Hub screens
    header: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 16,
      paddingVertical:   12,
      backgroundColor:   HC_COLOR,
    },
    backBtn:      { padding: 4 },
    backText:     { fontSize: 16, color: '#fff', fontWeight: '500' },
    headerTitle:  { fontSize: 20, fontWeight: '700', color: '#fff' },
    headerSpacer: { width: 60 },

    scroll: { paddingBottom: 40, paddingTop: 8 },

    // Section headers — small-caps style above each card group
    sectionHeader: {
      fontSize:         11,
      fontWeight:       '700',
      letterSpacing:    1.1,
      marginHorizontal: 16,
      marginBottom:     6,
      marginTop:        16,
    },

    // ── Sessions card ──────────────────────────────────────────────────────────
    sessionsCard: {
      marginHorizontal: 16,
      marginBottom:     8,
      borderRadius:     14,
      overflow:         'hidden',
    },

    // Loading state row — centred spinner + label
    loadingRow: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'center',
      paddingVertical: 20,
      gap:            10,
    },
    loadingText: { fontSize: 14 },

    // Empty state text — centred, padded
    emptyText: {
      fontSize:  14,
      padding:   20,
      textAlign: 'center',
    },

    // One session row — type left, duration right
    sessionRow: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingVertical:   14,
      paddingHorizontal: 16,
    },
    sessionType: {
      fontSize:   16,
      fontWeight: '600',
      flex:       1,
    },
    sessionDuration: {
      fontSize:   14,
      fontWeight: '500',
    },

    // Hair-line separator between sessions
    divider: {
      height:     StyleSheet.hairlineWidth,
      marginLeft: 16,
    },

    // ── Mapping card ───────────────────────────────────────────────────────────
    mappingCard: {
      marginHorizontal: 16,
      marginBottom:     12,
      borderRadius:     14,
      overflow:         'hidden',
    },
    emptyMappings: {
      fontSize:  14,
      padding:   16,
      textAlign: 'center',
      lineHeight: 20,
    },

    // Add mapping ghost button — outlined, matches Steps/Sleep pattern
    addMappingBtn: {
      marginHorizontal: 16,
      marginBottom:     20,
      paddingVertical:  13,
      borderRadius:     14,
      borderWidth:      1,
      alignItems:       'center',
    },
    addMappingText: { fontSize: 15, fontWeight: '600' },
  });
}
