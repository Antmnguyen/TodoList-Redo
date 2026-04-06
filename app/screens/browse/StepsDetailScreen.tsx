// app/screens/browse/StepsDetailScreen.tsx
// =============================================================================
// STEPS DETAIL SCREEN
// =============================================================================
//
// Full-screen breakdown of the user's step history from Health Connect.
//
// ── Screen sections (top to bottom) ─────────────────────────────────────────
//
//   1. Header — back button + title
//   2. Today ring — CircularProgress showing today/goal, editable goal, colour toggle
//   3. Time range tab — Week | Month
//   4. Chart — WeekBarGraph (week) or MonthCalendarGraph (month)
//   5. Stats row — week avg, month avg, personal best
//   6. Streak card
//   7. Day-of-week pattern — HealthDayOfWeekCard (avg steps / % of goal by weekday)
//   8. Task mappings — existing mapping rows + "Add Task Mapping" button
//
// ── Data flow ────────────────────────────────────────────────────────────────
//
//   All reads are synchronous SQLite calls (db.getAllSync / db.getFirstSync).
//   The screen loads on mount via loadData(), which populates:
//
//     todaySteps   — from health_steps_log for today (single row)
//     weekRows     — from health_steps_log for Mon–today
//     monthRows    — from health_steps_log for 1st–today
//     personalBest — from health_steps_log MAX(steps) row
//     mappings     — from health_connect_mappings WHERE dataType = 'steps'
//
//   Stats (weekStats, monthStats) are computed as derived values via useMemo,
//   so they recompute automatically when stepsGoal changes without re-fetching.
//
// ── Goal editing ─────────────────────────────────────────────────────────────
//
//   The goal is displayed as tappable text. Tapping enters "edit mode"
//   (editingGoal = true), rendering a TextInput in place of the Text.
//   Blur or the Done key persists the value to health_connect_meta and updates
//   local state. No Modal needed for a single numeric value.
//
// ── Chart data format ────────────────────────────────────────────────────────
//
//   WeekBarGraph: DayData[] where count = steps, total = stepsGoal.
//     Setting total enables the graph's "%" mode to show goal% rather than
//     a relative-to-max-day percentage.
//
//   MonthCalendarGraph: CalendarDayData[] where completed = steps, total = stepsGoal.
//     The graph's built-in colour thresholds (≥60% green, 30–59% yellow, <30% red)
//     naturally highlight goal-met days when this ratio mirrors the steps/goal ratio.
//
// ── Bar graph day index ───────────────────────────────────────────────────────
//
//   WeekBarGraph expects Mon=0 … Sun=6.
//   JS Date.getDay() returns Sun=0 … Sat=6.
//   Formula: (jsDay + 6) % 7 — see getDayOfWeek() below.
//
// ── Sub-screen editor ────────────────────────────────────────────────────────
//
//   When showEditor is true, the screen renders HealthMappingEditor instead of
//   itself. All hooks must be declared BEFORE the conditional return to satisfy
//   the Rules of Hooks — React requires hooks to be called in the same order
//   on every render regardless of any early returns.
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
  getStepsInRange,
  getStepsPersonalBest,
  getStepsGoal,
  setStepsGoal,
  getStepsColorEnabled,
  setStepsColorEnabled,
  getAllMappings,
  saveMapping,
  StepsDayRecord,
} from '../../core/services/storage/healthConnectStorage';

// ── Stats helpers ─────────────────────────────────────────────────────────────
import { computeStepsStats } from '../../features/googleFit/utils/healthConnectUtils';

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

// Shared brand colour for all Health Connect UI elements — same hex as
// HealthManagementScreen so all headers and interactive elements are consistent.
const HC_COLOR = '#33ace5';

// When the goal-colour toggle is ON and the goal is met, the ring and calendar
// cells shift to this green to give clear positive feedback.
const GOAL_MET_COLOR = '#34C759';

// =============================================================================
// TYPES
// =============================================================================

export interface StepsDetailScreenProps {
  onBack: () => void;
}

// 'year' and 'all' from TimeRangePicker are not useful here — we only have
// daily history stored from sync, so week and month are the only meaningful ranges.
type StepsTimeRange = 'week' | 'month';

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert a 'YYYY-MM-DD' date string to a Mon=0 … Sun=6 bar-graph index.
 *
 * WeekBarGraph expects its 7 data items ordered Monday → Sunday (index 0–6).
 * JS Date.getDay() returns Sunday=0, Monday=1, …, Saturday=6.
 * The formula (jsDay + 6) % 7 maps: Mon→0, Tue→1, …, Sat→5, Sun→6.
 *
 * We construct the Date from parsed year/month/day parts rather than passing
 * the string directly to `new Date(str)`, because the string-constructor
 * interprets ISO dates as UTC which can shift the day by ±1 in non-UTC timezones.
 */
function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const jsDay = new Date(y, m - 1, d).getDay(); // local time, no timezone shift
  return (jsDay + 6) % 7;
}

/**
 * Format a step count for display using locale-aware thousands separators.
 * e.g. 10500 → "10,500"
 */
function formatSteps(n: number): string {
  return n.toLocaleString();
}

// =============================================================================
// COMPONENT
// =============================================================================

export const StepsDetailScreen: React.FC<StepsDetailScreenProps> = ({ onBack }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // ==========================================================================
  // ALL HOOKS — must be declared before any conditional return
  // ==========================================================================
  //
  // React's Rules of Hooks require that hooks are called unconditionally and
  // in the same order on every render. The showEditor conditional return below
  // must come AFTER all hook declarations.

  // ── Editor sub-screen ──────────────────────────────────────────────────────
  // showEditor gates the sub-screen render. editingMapping is undefined when
  // opening the editor in create mode; set to an existing mapping for edit mode.
  const [showEditor, setShowEditor] = useState(false);
  const [editingMapping, setEditingMapping] = useState<HealthConnectMapping | undefined>(undefined);

  // ── Chart mode ─────────────────────────────────────────────────────────────
  const [timeRange, setTimeRange] = useState<StepsTimeRange>('week');

  // ── Data state ─────────────────────────────────────────────────────────────
  const [weekRows, setWeekRows] = useState<StepsDayRecord[]>([]);
  const [monthRows, setMonthRows] = useState<StepsDayRecord[]>([]);
  // allRows covers the entire stored history (from earliest synced date to today).
  // Used for DayOfWeekPatternCard so the pattern accumulates over time rather than
  // only reflecting the current month window.
  const [allRows, setAllRows] = useState<StepsDayRecord[]>([]);
  const [todaySteps, setTodaySteps] = useState(0);
  const [personalBest, setPersonalBest] = useState<StepsDayRecord | null>(null);

  // ── Settings state ─────────────────────────────────────────────────────────
  // Initialised from SQLite so the screen renders with the correct values
  // immediately, before the useEffect can fire. Both are also persisted on change.
  const [stepsGoal, setStepsGoalState] = useState(() => getStepsGoal());
  const [colorEnabled, setColorEnabledState] = useState(() => getStepsColorEnabled());

  // Inline goal editing — true while the TextInput is active in the ring card
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  // ── Mapping rows ───────────────────────────────────────────────────────────
  const [mappings, setMappings] = useState<HealthConnectMapping[]>([]);

  // ── Data loading ───────────────────────────────────────────────────────────

  /**
   * Reload only the mapping rows. Called separately by the editor's onSave
   * callback so it doesn't trigger a full steps-history reload (which hasn't
   * changed as a result of adding/editing/deleting a mapping).
   */
  const loadMappings = useCallback(() => {
    // getAllMappings() INNER JOINs against templates, filtering orphaned rows.
    // We then filter client-side to keep only 'steps' mappings for this screen.
    setMappings(getAllMappings().filter(m => m.dataType === 'steps'));
  }, []);

  /**
   * Load all screen data (steps history, personal best, settings, mappings).
   *
   * All calls are synchronous SQLite reads — no async/await. We call this on
   * mount and can call it again if the goal changes to refresh stat computations
   * (though stats are also recomputed via useMemo when stepsGoal state changes,
   * so in practice an extra loadData call is rarely needed post-mount).
   */
  const loadData = useCallback(() => {
    const today      = toLocalDateString(new Date());
    const weekStart  = startOfCurrentWeek();
    const monthStart = startOfCurrentMonth();

    // Single-row query for today — used for the ring display only.
    // The week/month queries below would also contain today's row, but we load
    // this separately so the ring logic is explicit about what it's reading.
    const todayRows = getStepsInRange(today, today);
    setTodaySteps(todayRows[0]?.steps ?? 0);

    // Full date-range queries for chart and stat computation
    setWeekRows(getStepsInRange(weekStart, today));
    setMonthRows(getStepsInRange(monthStart, today));

    // Full history query for DayOfWeekPatternCard — '2000-01-01' acts as an
    // "all available data" sentinel; the DB returns only rows that actually exist.
    setAllRows(getStepsInRange('2000-01-01', today));

    // All-time best (MAX query across the whole table, not limited to current range)
    setPersonalBest(getStepsPersonalBest());

    // Re-read settings in case sync updated the goal while the screen was mounted
    setStepsGoalState(getStepsGoal());
    setColorEnabledState(getStepsColorEnabled());

    loadMappings();
  }, [loadMappings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Derived data (useMemo) ─────────────────────────────────────────────────

  /**
   * Week and month stats computed from row data + current goal.
   * useMemo means these recompute automatically whenever rows or goal change
   * without needing a new loadData() call.
   * monthRows are used for streak computation as they provide a larger history
   * window → more accurate best-streak value.
   */
  const weekStats  = useMemo(() => computeStepsStats(weekRows,  stepsGoal), [weekRows,  stepsGoal]);
  const monthStats = useMemo(() => computeStepsStats(monthRows, stepsGoal), [monthRows, stepsGoal]);

  /**
   * DayData for WeekBarGraph (Mon=0 … Sun=6, 7 items).
   * count = actual steps; total = goal (enables % mode to mean "% of goal").
   * Days with no row in the DB default to 0 steps.
   */
  const barData: DayData[] = useMemo(
    () =>
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => ({
        day,
        count: weekRows.find(r => getDayOfWeek(r.date) === i)?.steps ?? 0,
        total: stepsGoal,
      })),
    [weekRows, stepsGoal],
  );

  /**
   * CalendarDayData for MonthCalendarGraph.
   * completed = steps, total = goal.
   * The graph's thresholds (≥60% green, 30–59% yellow, <30% red) align with
   * "met the goal" when steps/goal ≥ 1.0 → completed/total ≥ 100% → green tier.
   */
  const calData: CalendarDayData[] = useMemo(
    () =>
      monthRows.map(r => ({
        date:      parseInt(r.date.split('-')[2], 10), // 1-based day of month
        completed: r.steps,
        total:     stepsGoal,
      })),
    [monthRows, stepsGoal],
  );

  // Ring fill % — capped at 100 to prevent the arc from over-rotating
  const ringPercent = useMemo(
    () => Math.min((todaySteps / stepsGoal) * 100, 100),
    [todaySteps, stepsGoal],
  );

  // Ring accent colour — green when goal met + colour toggle on; brand blue otherwise
  const ringColor = colorEnabled && todaySteps >= stepsGoal ? GOAL_MET_COLOR : HC_COLOR;

  /**
   * Average steps by weekday (Mon–Sun) across all stored history.
   *
   * avgValue = mean step count for that weekday across every recorded occurrence.
   * count    = number of recorded days for that weekday (used to compute the avg
   *            and shown implicitly through bar height).
   *
   * HealthDayOfWeekCard uses these to:
   *   Avg mode → bar height and label show the average steps for that weekday
   *   % mode   → bar height and label show avgValue ÷ stepsGoal as a percentage
   *
   * Uses allRows (full history) so the average improves as sync data accumulates.
   */
  const dayOfWeekData: HealthDayOfWeekData[] = useMemo(() => {
    const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const sums   = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const row of allRows) {
      const dow = getDayOfWeek(row.date);
      sums[dow]   += row.steps;
      counts[dow] += 1;
    }
    return DAY_LABELS.map((day, i) => ({
      day,
      avgValue: counts[i] > 0 ? sums[i] / counts[i] : 0,
      count: counts[i],
    }));
  }, [allRows]);

  // ==========================================================================
  // GOAL EDIT HANDLERS
  // ==========================================================================

  const handleGoalPress = () => {
    setGoalInput(String(stepsGoal));
    setEditingGoal(true);
  };

  const handleGoalSubmit = () => {
    const parsed = parseInt(goalInput, 10);
    if (!isNaN(parsed) && parsed > 0) {
      // Persist to SQLite so the new goal takes effect in the next sync()
      setStepsGoal(parsed);
      // Update local state so ring, stats, charts reflect the change immediately
      setStepsGoalState(parsed);
    }
    setEditingGoal(false);
  };

  const handleColorToggle = (val: boolean) => {
    setStepsColorEnabled(val);
    setColorEnabledState(val);
  };

  // ==========================================================================
  // CONDITIONAL RENDER — mapping editor sub-screen
  // ==========================================================================
  //
  // This return is placed AFTER all hook declarations (required by Rules of Hooks).
  // When showEditor is true, we render HealthMappingEditor instead of this screen.
  // onSave reloads mappings then hides the editor; onCancel just hides it.

  if (showEditor) {
    return (
      <HealthMappingEditor
        dataType="steps"
        mapping={editingMapping}
        onSave={() => {
          setShowEditor(false);
          loadMappings(); // refresh the mapping list without a full data reload
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
        <Text style={styles.headerTitle}>Steps</Text>
        {/* Spacer matches the back button area so the title is optically centred */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Today ring ──────────────────────────────────────────────────────
            Large (120px) CircularProgress ring showing today's progress.
            The inner disc background matches theme.bgCard so it blends with the card.
            Goal value is tappable — switches to an inline TextInput in edit mode.
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
              <Text style={[styles.ringSteps, { color: theme.textPrimary }]}>
                {formatSteps(todaySteps)} steps today
              </Text>

              {/* Goal display / edit row */}
              <View style={styles.goalRow}>
                <Text style={[styles.goalLabel, { color: theme.textSecondary }]}>
                  Goal:{' '}
                </Text>
                {editingGoal ? (
                  // In edit mode, show a compact TextInput in place of the value.
                  // autoFocus ensures the keyboard opens immediately.
                  // selectTextOnFocus highlights existing text so the user can
                  // type a new value without manually deleting the old one.
                  <TextInput
                    style={[styles.goalInput, {
                      color: theme.textPrimary,
                      borderColor: HC_COLOR,
                      backgroundColor: theme.bgInput,
                    }]}
                    value={goalInput}
                    onChangeText={setGoalInput}
                    keyboardType="numeric"
                    returnKeyType="done"
                    onSubmitEditing={handleGoalSubmit}
                    onBlur={handleGoalSubmit}
                    autoFocus
                    selectTextOnFocus
                  />
                ) : (
                  // Underlined tappable value — underline signals editability
                  <TouchableOpacity onPress={handleGoalPress} activeOpacity={0.7}>
                    <Text style={[styles.goalValue, { color: HC_COLOR }]}>
                      {formatSteps(stepsGoal)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Colour toggle — switches green highlighting on/off */}
              <View style={styles.colorRow}>
                <Text style={[styles.colorLabel, { color: theme.textSecondary }]}>
                  Goal colour
                </Text>
                <Switch
                  value={colorEnabled}
                  onValueChange={handleColorToggle}
                  trackColor={{ false: theme.separator, true: HC_COLOR }}
                  thumbColor="#fff"
                />
              </View>
            </View>
          </View>
        </View>

        {/* ── Time range picker ────────────────────────────────────────────────
            Custom 2-tab strip rather than the full TimeRangePicker component
            (which includes Year and All Time — not applicable for steps data).
        */}
        <View style={[styles.tabStrip, { backgroundColor: theme.separator }]}>
          {(['week', 'month'] as StepsTimeRange[]).map(range => (
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
            Both components receive HC_COLOR for their active toggle pill.
            WeekBarGraph shows 7 bars (Mon–Sun). MonthCalendarGraph shows the
            full calendar grid. Navigation (prev/next week or month) is handled
            internally by both components — the screen just provides the current
            data for the initial display.
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
            Three cells: week avg (from weekStats), month avg (from monthStats),
            and personal best (from the MAX query, separate from both stat objects).
        */}
        <View style={[styles.statsCard, { backgroundColor: theme.bgCard }]}>
          <StatItem
            label="Week avg"
            value={weekStats.weekAvg !== null ? formatSteps(weekStats.weekAvg) : '—'}
            unit="steps"
            theme={theme}
          />
          <View style={[styles.statDivider, { backgroundColor: theme.separator }]} />
          <StatItem
            label="Month avg"
            value={monthStats.monthAvg !== null ? formatSteps(monthStats.monthAvg) : '—'}
            unit="steps"
            theme={theme}
          />
          <View style={[styles.statDivider, { backgroundColor: theme.separator }]} />
          <StatItem
            label="Best day"
            value={personalBest ? formatSteps(personalBest.steps) : '—'}
            unit={personalBest ? 'steps' : ''}
            theme={theme}
          />
        </View>

        {/* ── Streak card ──────────────────────────────────────────────────────
            Uses monthStats because monthRows covers more calendar days than
            weekRows, giving a more accurate best-ever streak.
        */}
        <StreakCard
          currentStreak={monthStats.currentStreak}
          bestStreak={monthStats.bestStreak}
          color={HC_COLOR}
        />

        {/* ── Day-of-week pattern ───────────────────────────────────────────────
            Aggregates all stored step history by weekday to reveal when the user
            tends to hit their goal most consistently. Reuses the same
            DayOfWeekPatternCard component used in the task stats screens.

            Count mode → raw "met goal" tally per weekday
            % mode     → goal-met rate per weekday (count ÷ total appearances)

            Data comes from allRows (full history) not just monthRows, so the
            pattern improves in accuracy as more sync data accumulates over time.
        */}
        <HealthDayOfWeekCard
          data={dayOfWeekData}
          goal={stepsGoal}
          unit="steps"
          color={HC_COLOR}
        />

        {/* ── Task mappings ────────────────────────────────────────────────────
            Each mapping row shows its threshold and an enabled/disabled toggle.
            Tapping the row opens the editor in edit mode.
            The enabled toggle fires onToggle directly to avoid opening the
            full editor just to flip the switch.
        */}
        <Text style={[styles.sectionHeader, { color: theme.textTertiary }]}>
          TASK MAPPINGS
        </Text>

        <View style={[styles.mappingCard, { backgroundColor: theme.bgCard }]}>
          {mappings.length === 0 && (
            <Text style={[styles.emptyMappings, { color: theme.textTertiary }]}>
              No mappings yet. Add one to auto-complete tasks when you hit your goal.
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
                // Persist the toggle change immediately without opening the editor
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
            setEditingMapping(undefined); // undefined = create mode in editor
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
// STAT ITEM — single cell in the three-column stats row
// =============================================================================

/**
 * One stat in the inline stats row card.
 * Value is bold and large; unit is smaller beneath it; label is muted smallest.
 * The three cells share equal width via flex: 1.
 */
interface StatItemProps {
  label: string;
  value: string;
  unit:  string;
  theme: AppTheme;
}

const StatItem: React.FC<StatItemProps> = ({ label, value, unit, theme }) => (
  <View style={statStyles.cell}>
    <Text style={[statStyles.value, { color: theme.textPrimary }]}>{value}</Text>
    {unit ? <Text style={[statStyles.unit, { color: theme.textSecondary }]}>{unit}</Text> : null}
    <Text style={[statStyles.label, { color: theme.textTertiary }]}>{label}</Text>
  </View>
);

const statStyles = StyleSheet.create({
  cell:  { flex: 1, alignItems: 'center', paddingVertical: 14 },
  value: { fontSize: 18, fontWeight: '700' },
  unit:  { fontSize: 11, marginTop: 1 },
  label: { fontSize: 11, fontWeight: '600', marginTop: 4, letterSpacing: 0.3 },
});

// =============================================================================
// MAPPING ROW — one entry in the task-mappings list
// =============================================================================

/**
 * A single mapping row showing threshold info and an enabled toggle.
 *
 * The row is tappable to open the HealthMappingEditor in edit mode.
 * The Switch fires onToggle directly so the user can enable/disable a mapping
 * without navigating into the editor (a common, frequent action).
 *
 * Template title is not shown here because getAllMappings() does not JOIN the
 * template title — it returns only the permanentId. The user set up the mapping
 * themselves, so the ID is recognisable to them; the editor shows the full title
 * when they tap through.
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
          {mapping.templateTitle ?? mapping.permanentId}
        </Text>
        <Text style={[mappingRowStyles.sub, { color: theme.textSecondary }]}>
          {mapping.stepsGoal !== undefined
            ? `≥ ${mapping.stepsGoal.toLocaleString()} steps`
            : ''}
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

    // ── Header ────────────────────────────────────────────────────────────────
    // HC_COLOR header bar is consistent across all health screens. The spacer
    // width matches the back button's visible footprint so the title is centred.
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

    // ── Ring card ─────────────────────────────────────────────────────────────
    // The card's backgroundColor must match theme.bgCard so the CircularProgress
    // inner disc (which also uses theme.bgCard as its hole colour) blends in.
    ringCard: {
      marginHorizontal: 16,
      marginTop:        16,
      marginBottom:     12,
      borderRadius:     18,
      padding:          20,
    },
    ringRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    ringInfo: { flex: 1, gap: 8 },
    ringSteps: { fontSize: 17, fontWeight: '700' },

    // ── Inline goal editing ────────────────────────────────────────────────────
    // The goal text is underlined to signal it's tappable / editable.
    // The TextInput replaces it in-place so layout doesn't shift.
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
      minWidth:          70,
    },

    colorRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
    colorLabel: { fontSize: 13 },

    // ── 2-tab strip ───────────────────────────────────────────────────────────
    // Custom because TimeRangePicker has 4 tabs; we only need Week and Month.
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

    // ── Stats card ─────────────────────────────────────────────────────────────
    // Three cells in a single horizontal row. overflow: hidden clips the
    // individual cells to the card's borderRadius.
    statsCard: {
      flexDirection:    'row',
      marginHorizontal: 16,
      marginBottom:     12,
      borderRadius:     18,
      overflow:         'hidden',
    },
    statDivider: { width: StyleSheet.hairlineWidth },

    // ── Mappings section ───────────────────────────────────────────────────────
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

    // Outlined ghost button — de-emphasised compared to the filled sync button
    // on the hub, but clearly tappable via the border and label colour.
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
