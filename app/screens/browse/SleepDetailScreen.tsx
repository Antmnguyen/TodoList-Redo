// app/screens/browse/SleepDetailScreen.tsx
// =============================================================================
// SLEEP DETAIL SCREEN
// =============================================================================
//
// Full-screen breakdown of the user's sleep history from Health Connect.
// Mirrors StepsDetailScreen in structure but adapted for sleep-specific data.
//
// ── Screen sections (top to bottom) ─────────────────────────────────────────
//
//   1. Header — back button + title
//   2. Last-night ring — CircularProgress with hours/goal, editable goal, colour toggle
//   3. Time range tab — Week | Month
//   4. Chart — WeekBarGraph (week) or MonthCalendarGraph (month)
//   5. Stats row — week avg, month avg, best night
//   6. Streak card
//   7. Day-of-week pattern — HealthDayOfWeekCard (avg sleep hours / % of goal by weekday)
//   8. Task mappings section + "Add Task Mapping" button
//
// ── Sleep record semantics ────────────────────────────────────────────────────
//
//   Sleep rows are indexed by the MORNING the session ended.
//   A session from 11 PM on Apr 5 → 7 AM on Apr 6 is stored with date = '2026-04-06'.
//   Therefore:
//     getSleepInRange(today, today) → last night's session
//     getSleepInRange(weekStart, today) → sleep for each morning this week
//
//   sleepHours is a float (e.g. 7.5 = 7h 30m). The formatHours() helper
//   converts this to the "Xh Ym" string shown in the ring and stats row.
//
// ── Stage mini-bar ────────────────────────────────────────────────────────────
//
//   TODO: Sleep stage breakdown (light/deep/REM) is intentionally absent.
//   The health_sleep_log schema stores only total sleepHours per night — no stage
//   columns. Stage support would require extending the schema and parsing
//   SleepSession.stages[] during sync. Left for a future sprint.
//
// ── Chart data encoding ──────────────────────────────────────────────────────
//
//   WeekBarGraph: count = sleepHours (float), total = sleepGoal.
//     Float values work fine for proportional bar heights.
//
//   MonthCalendarGraph: completed = sleepHours × 10, total = sleepGoal × 10.
//     Multiplying by 10 prevents sub-1.0 floats from collapsing to 0 in integer
//     arithmetic while preserving the ratio: 7.5/8 × 10 = 75/80 (same thresholds).
//
// ── Hooks ordering ────────────────────────────────────────────────────────────
//
//   All useState and useCallback hooks are declared before any conditional return
//   (the HealthMappingEditor sub-screen guard). This is required by the Rules of
//   Hooks — hooks must be called unconditionally and in the same order every render.
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
  TextInput,
} from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// ── Components ────────────────────────────────────────────────────────────────
import { CircularProgress } from '../../components/stats/CircularProgress';
import { WeekBarGraph } from '../../components/stats/detail/shared/WeekBarGraph';
import { MonthCalendarGraph, CalendarDayData } from '../../components/stats/detail/shared/MonthCalendarGraph';
import { StreakCard } from '../../components/stats/detail/shared/StreakCard';
import { HealthDayOfWeekCard, HealthDayOfWeekData } from '../../components/stats/detail/shared/HealthDayOfWeekCard';
import { DayData } from '../../components/stats/WeeklyMiniChart';

// ── Storage ───────────────────────────────────────────────────────────────────
import {
  getSleepInRange,
  getSleepPersonalBest,
  getSleepGoal,
  setSleepGoal,
  getSleepColorEnabled,
  setSleepColorEnabled,
  getAllMappings,
  saveMapping,
  SleepDayRecord,
} from '../../core/services/storage/healthConnectStorage';

// ── Stats helpers ─────────────────────────────────────────────────────────────
import { computeSleepStats } from '../../features/googleFit/utils/healthConnectUtils';

// ── Date helpers ──────────────────────────────────────────────────────────────
import {
  toLocalDateString,
  startOfCurrentWeek,
  startOfCurrentMonth,
} from '../../core/utils/statsCalculations';

// ── Types ─────────────────────────────────────────────────────────────────────
import { HealthConnectMapping } from '../../features/googleFit/types/healthConnect';

// ── Mapping editor sub-screen ─────────────────────────────────────────────────
import { HealthMappingEditor } from './HealthMappingEditor';

// =============================================================================
// CONSTANTS
// =============================================================================

const HC_COLOR = '#33ace5';
const GOAL_MET_COLOR = '#34C759';

// =============================================================================
// TYPES
// =============================================================================

export interface SleepDetailScreenProps {
  onBack: () => void;
}

type SleepTimeRange = 'week' | 'month';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert a 'YYYY-MM-DD' string to a Mon=0 … Sun=6 bar-graph index.
 * See StepsDetailScreen for the full formula explanation.
 * Avoids new Date(str) which would interpret the ISO date as UTC.
 */
function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return (jsDay + 6) % 7;
}

/**
 * Format decimal hours as "Xh Ym" for human-readable display.
 *
 * Health Connect reports sleep durations with sub-minute precision; Math.round
 * on the minute component gives a clean "Xh Ym" without fractional minutes.
 *
 * Examples: 7.5 → "7h 30m"   |   8.0 → "8h 0m"   |   6.25 → "6h 15m"
 */
function formatHours(h: number): string {
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h ${mins}m`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const SleepDetailScreen: React.FC<SleepDetailScreenProps> = ({ onBack }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // ==========================================================================
  // ALL HOOKS — must be declared before any conditional return
  // ==========================================================================
  //
  // The HealthMappingEditor early return is placed after all hook declarations
  // to comply with the Rules of Hooks (hooks must be called unconditionally).

  // ── Editor sub-screen ──────────────────────────────────────────────────────
  const [showEditor, setShowEditor] = useState(false);
  const [editingMapping, setEditingMapping] = useState<HealthConnectMapping | undefined>(undefined);

  // ── Chart mode ─────────────────────────────────────────────────────────────
  const [timeRange, setTimeRange] = useState<SleepTimeRange>('week');

  // ── Data state ─────────────────────────────────────────────────────────────
  // Sleep rows are indexed by morning date; lastNightHours = today's row's sleepHours.
  const [weekRows, setWeekRows] = useState<SleepDayRecord[]>([]);
  const [monthRows, setMonthRows] = useState<SleepDayRecord[]>([]);
  // allRows covers the full stored sleep history — used for DayOfWeekPatternCard.
  const [allRows, setAllRows] = useState<SleepDayRecord[]>([]);
  const [lastNightHours, setLastNightHours] = useState(0);
  const [personalBest, setPersonalBest] = useState<SleepDayRecord | null>(null);

  // ── Settings state ─────────────────────────────────────────────────────────
  const [sleepGoal, setSleepGoalState] = useState(() => getSleepGoal());
  const [colorEnabled, setColorEnabledState] = useState(() => getSleepColorEnabled());

  // Inline goal editing — float hours, so decimal-pad keyboard is used
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  // ── Mapping rows ───────────────────────────────────────────────────────────
  const [mappings, setMappings] = useState<HealthConnectMapping[]>([]);

  // ── Data loading ───────────────────────────────────────────────────────────

  /**
   * Reload only the mapping rows. Separated from loadData() so the editor's
   * onSave doesn't trigger a full history re-read.
   */
  const loadMappings = useCallback(() => {
    setMappings(getAllMappings().filter(m => m.dataType === 'sleep'));
  }, []);

  /**
   * Load all sleep data and settings for the screen.
   *
   * All calls are synchronous SQLite reads. Sleep rows are indexed by morning
   * date, so getSleepInRange(weekStart, today) returns one row per morning
   * this week — the row for Monday morning represents Sunday-night sleep.
   */
  const loadData = useCallback(() => {
    const today      = toLocalDateString(new Date());
    const weekStart  = startOfCurrentWeek();
    const monthStart = startOfCurrentMonth();

    // Last night = today's row (session ended this morning)
    const todayRows = getSleepInRange(today, today);
    setLastNightHours(todayRows[0]?.sleepHours ?? 0);

    setWeekRows(getSleepInRange(weekStart, today));
    setMonthRows(getSleepInRange(monthStart, today));

    // Full history query for DayOfWeekPatternCard
    setAllRows(getSleepInRange('2000-01-01', today));

    setPersonalBest(getSleepPersonalBest());

    setSleepGoalState(getSleepGoal());
    setColorEnabledState(getSleepColorEnabled());

    loadMappings();
  }, [loadMappings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derived data (useMemo) ─────────────────────────────────────────────────

  /** Stats computed from row data — recompute when rows or goal change. */
  const weekStats  = useMemo(() => computeSleepStats(weekRows,  sleepGoal), [weekRows,  sleepGoal]);
  const monthStats = useMemo(() => computeSleepStats(monthRows, sleepGoal), [monthRows, sleepGoal]);

  /**
   * DayData for WeekBarGraph.
   * count = sleepHours (float). WeekBarGraph renders proportional heights,
   * so floats work naturally — 7.5h renders 93.75% of the goal-height bar.
   */
  const barData: DayData[] = useMemo(
    () =>
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => ({
        day,
        count: weekRows.find(r => getDayOfWeek(r.date) === i)?.sleepHours ?? 0,
        total: sleepGoal,
      })),
    [weekRows, sleepGoal],
  );

  /**
   * CalendarDayData for MonthCalendarGraph.
   * Multiply by 10 to convert float hours to pseudo-integers while preserving
   * the ratio: 7.5/8.0 × 10 = 75/80 → same colour threshold result.
   * Without the ×10, a sleepHours of 0.5 would collapse to completed=0 (wrong).
   */
  const calData: CalendarDayData[] = useMemo(
    () =>
      monthRows.map(r => ({
        date:      parseInt(r.date.split('-')[2], 10),
        completed: Math.round(r.sleepHours * 10),
        total:     Math.round(sleepGoal * 10),
      })),
    [monthRows, sleepGoal],
  );

  // Ring fill — capped so the arc doesn't over-rotate past 100%
  const ringPercent = useMemo(
    () => Math.min((lastNightHours / sleepGoal) * 100, 100),
    [lastNightHours, sleepGoal],
  );

  // Green when goal met + toggle on; brand colour otherwise
  const ringColor = colorEnabled && lastNightHours >= sleepGoal ? GOAL_MET_COLOR : HC_COLOR;

  /**
   * Average sleep hours by weekday (Mon–Sun) across all stored history.
   *
   * avgValue = mean sleep hours for that weekday across every recorded night.
   * count    = number of recorded nights for that weekday.
   *
   * HealthDayOfWeekCard uses these to:
   *   Avg mode → bar height and label show the average hours for that weekday
   *   % mode   → bar height and label show avgValue ÷ sleepGoal as a percentage
   *
   * Uses allRows (full history) so the average improves as sync data accumulates.
   */
  const dayOfWeekData: HealthDayOfWeekData[] = useMemo(() => {
    const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const sums   = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const row of allRows) {
      const dow = getDayOfWeek(row.date);
      sums[dow]   += row.sleepHours;
      counts[dow] += 1;
    }
    return DAY_LABELS.map((day, i) => ({
      day,
      avgValue: counts[i] > 0 ? sums[i] / counts[i] : 0,
      count: counts[i],
    }));
  }, [allRows]);

  // ── Goal edit handlers ─────────────────────────────────────────────────────

  const handleGoalPress = () => {
    setGoalInput(String(sleepGoal));
    setEditingGoal(true);
  };

  const handleGoalSubmit = () => {
    // parseFloat to support fractional hours (e.g. 7.5 for 7h 30m)
    const parsed = parseFloat(goalInput);
    if (!isNaN(parsed) && parsed > 0) {
      setSleepGoal(parsed);
      setSleepGoalState(parsed);
    }
    setEditingGoal(false);
  };

  // ==========================================================================
  // CONDITIONAL RENDER — mapping editor sub-screen (after all hooks)
  // ==========================================================================

  if (showEditor) {
    return (
      <HealthMappingEditor
        dataType="sleep"
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
  // MAIN RENDER
  // ==========================================================================

  const now = new Date();

  return (
    <Screen edges={['top']} topColor={HC_COLOR} style={styles.container}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sleep</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Last-night ring ──────────────────────────────────────────────────
            Shows last night's sleep vs the goal.
            Goal is shown as "Xh 0m" and is tappable to edit inline.
            The colour toggle controls whether green highlights goal-met nights.

            NOTE: The sleep stage mini-bar (light/deep/REM breakdown) is absent
            because health_sleep_log stores only total sleepHours. Stage data
            would require schema changes and is deferred to a future sprint.
        */}
        <View style={[styles.ringCard, { backgroundColor: theme.bgCard }]}>
          <View style={styles.ringRow}>
            <CircularProgress
              percent={ringPercent}
              size={120}
              color={ringColor}
              trackWidth={10}
            />
            <View style={styles.ringInfo}>
              <Text style={[styles.ringHours, { color: theme.textPrimary }]}>
                {formatHours(lastNightHours)} last night
              </Text>

              {/* Goal row — tappable text or inline TextInput in edit mode */}
              <View style={styles.goalRow}>
                <Text style={[styles.goalLabel, { color: theme.textSecondary }]}>
                  Goal:{' '}
                </Text>
                {editingGoal ? (
                  // decimal-pad keyboard allows "7.5" entry on Android
                  <TextInput
                    style={[styles.goalInput, {
                      color: theme.textPrimary,
                      borderColor: HC_COLOR,
                      backgroundColor: theme.bgInput,
                    }]}
                    value={goalInput}
                    onChangeText={setGoalInput}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleGoalSubmit}
                    onBlur={handleGoalSubmit}
                    autoFocus
                    selectTextOnFocus
                  />
                ) : (
                  <TouchableOpacity onPress={handleGoalPress} activeOpacity={0.7}>
                    <Text style={[styles.goalValue, { color: HC_COLOR }]}>
                      {formatHours(sleepGoal)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Colour toggle */}
              <View style={styles.colorRow}>
                <Text style={[styles.colorLabel, { color: theme.textSecondary }]}>
                  Goal colour
                </Text>
                <Switch
                  value={colorEnabled}
                  onValueChange={(val) => {
                    setSleepColorEnabled(val);
                    setColorEnabledState(val);
                  }}
                  trackColor={{ false: theme.separator, true: HC_COLOR }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>
        </View>

        {/* ── Time range picker ────────────────────────────────────────────────
            Custom 2-tab strip (Week / Month only — same reasoning as Steps).
        */}
        <View style={[styles.tabStrip, { backgroundColor: theme.separator }]}>
          {(['week', 'month'] as SleepTimeRange[]).map(range => (
            <TouchableOpacity
              key={range}
              style={[styles.tab, timeRange === range && { backgroundColor: HC_COLOR }]}
              onPress={() => setTimeRange(range)}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.tabLabel,
                { color: timeRange === range ? '#fff' : theme.textTertiary },
              ]}>
                {range === 'week' ? 'Week' : 'Month'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Chart ────────────────────────────────────────────────────────────
            WeekBarGraph shows proportional bar heights for each morning this week.
            MonthCalendarGraph uses ×10 encoded values (see calData comment above).
        */}
        {timeRange === 'week' ? (
          <WeekBarGraph data={barData} color={HC_COLOR} />
        ) : (
          <MonthCalendarGraph
            year={now.getFullYear()}
            month={now.getMonth()}
            data={calData}
            color={HC_COLOR}
          />
        )}

        {/* ── Stats row ────────────────────────────────────────────────────────
            Sleep averages are formatted as "Xh Ym" because they are float hours.
            personalBest is the single best night from the all-time MAX query.
        */}
        <View style={[styles.statsCard, { backgroundColor: theme.bgCard }]}>
          <StatItem
            label="Week avg"
            value={weekStats.weekAvg !== null ? formatHours(weekStats.weekAvg) : '—'}
            theme={theme}
          />
          <View style={[styles.statDivider, { backgroundColor: theme.separator }]} />
          <StatItem
            label="Month avg"
            value={monthStats.monthAvg !== null ? formatHours(monthStats.monthAvg) : '—'}
            theme={theme}
          />
          <View style={[styles.statDivider, { backgroundColor: theme.separator }]} />
          <StatItem
            label="Best night"
            value={personalBest ? formatHours(personalBest.sleepHours) : '—'}
            theme={theme}
          />
        </View>

        {/* ── Streak card ──────────────────────────────────────────────────────
            monthStats used for larger history window → more accurate best streak.
            A "sleep streak" = consecutive mornings with enough recorded sleep.
        */}
        <StreakCard
          currentStreak={monthStats.currentStreak}
          bestStreak={monthStats.bestStreak}
          color={HC_COLOR}
        />

        {/* ── Day-of-week pattern ───────────────────────────────────────────────
            Reveals which nights of the week the user most consistently meets
            their sleep goal. Particularly useful for spotting weeknight vs
            weekend patterns (e.g. "I always hit my goal on Fridays/Saturdays
            but consistently fall short on Sunday nights").

            Shows average sleep hours for each weekday (Avg mode) or as a
            percentage of the sleep goal (% mode). Uses all stored history
            so the pattern improves as more sync data accumulates.
        */}
        <HealthDayOfWeekCard
          data={dayOfWeekData}
          goal={sleepGoal}
          unit="hours"
          color={HC_COLOR}
        />

        {/* ── Task mappings ─────────────────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { color: theme.textTertiary }]}>
          TASK MAPPINGS
        </Text>

        <View style={[styles.mappingCard, { backgroundColor: theme.bgCard }]}>
          {mappings.length === 0 && (
            <Text style={[styles.emptyMappings, { color: theme.textTertiary }]}>
              No mappings yet. Add one to auto-complete tasks when you hit your sleep goal.
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
// STAT ITEM
// =============================================================================

/**
 * One cell in the three-column stats row. Sleep stats show hours as "Xh Ym"
 * so no separate unit string is needed — the value itself is already formatted.
 */
interface StatItemProps {
  label: string;
  value: string;
  theme: AppTheme;
}

const StatItem: React.FC<StatItemProps> = ({ label, value, theme }) => (
  <View style={statStyles.cell}>
    <Text style={[statStyles.value, { color: theme.textPrimary }]}>{value}</Text>
    <Text style={[statStyles.label, { color: theme.textTertiary }]}>{label}</Text>
  </View>
);

const statStyles = StyleSheet.create({
  cell:  { flex: 1, alignItems: 'center', paddingVertical: 14 },
  value: { fontSize: 17, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '600', marginTop: 4, letterSpacing: 0.3 },
});

// =============================================================================
// MAPPING ROW
// =============================================================================

/**
 * One row in the sleep task-mappings section.
 * Shows sleep threshold as "≥ Xh Ym" using the same formatHours() helper.
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
}) => (
  <>
    <TouchableOpacity style={mappingRowStyles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={[mappingRowStyles.title, { color: theme.textPrimary }]}>
          {mapping.permanentId}
        </Text>
        <Text style={[mappingRowStyles.sub, { color: theme.textSecondary }]}>
          {mapping.sleepHours !== undefined ? `≥ ${formatHours(mapping.sleepHours)}` : ''}
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

const mappingRowStyles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
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

    // Header — identical structure to StepsDetailScreen and HealthManagementScreen.
    // HC_COLOR header bar is the consistent brand element across all health screens.
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

    scroll: { paddingBottom: 40 },

    // Ring card — same dimensions as the steps ring card for visual consistency.
    // backgroundColor must be theme.bgCard so CircularProgress inner disc blends in.
    ringCard: {
      marginHorizontal: 16,
      marginTop:        16,
      marginBottom:     12,
      borderRadius:     18,
      padding:          20,
    },
    ringRow:  { flexDirection: 'row', alignItems: 'center', gap: 20 },
    ringInfo: { flex: 1, gap: 8 },
    ringHours: { fontSize: 17, fontWeight: '700' },

    // Goal editing — underlined tappable text switches to an inline TextInput.
    // decimal-pad keyboard used (not 'numeric') to allow fractional hour entry.
    goalRow:   { flexDirection: 'row', alignItems: 'center' },
    goalLabel: { fontSize: 14 },
    goalValue: {
      fontSize:           14,
      fontWeight:         '600',
      textDecorationLine: 'underline',
    },
    goalInput: {
      fontSize:          14,
      fontWeight:        '600',
      borderWidth:       1,
      borderRadius:      6,
      paddingHorizontal: 8,
      paddingVertical:   2,
      minWidth:          60,
    },

    colorRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    colorLabel: { fontSize: 13 },

    // Custom 2-tab strip — Week / Month only (Year and All Time not applicable)
    tabStrip: {
      flexDirection:    'row',
      marginHorizontal: 16,
      marginBottom:     14,
      borderRadius:     12,
      padding:          3,
      gap:              2,
    },
    tab: {
      flex:            1,
      alignItems:      'center',
      paddingVertical: 8,
      borderRadius:    10,
    },
    tabLabel: { fontSize: 13, fontWeight: '600' },

    // Three-cell horizontal stats row — overflow hidden clips to border radius
    statsCard: {
      flexDirection:    'row',
      marginHorizontal: 16,
      marginBottom:     12,
      borderRadius:     18,
      overflow:         'hidden',
    },
    statDivider: { width: StyleSheet.hairlineWidth },

    sectionHeader: {
      fontSize:         11,
      fontWeight:       '700',
      letterSpacing:    1.1,
      marginHorizontal: 16,
      marginBottom:     6,
      marginTop:        8,
    },
    mappingCard: {
      marginHorizontal: 16,
      marginBottom:     12,
      borderRadius:     14,
      overflow:         'hidden',
    },
    emptyMappings: {
      fontSize:   14,
      padding:    16,
      textAlign:  'center',
      lineHeight: 20,
    },
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
