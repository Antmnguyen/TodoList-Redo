// app/components/stats/detail/shared/YearOverviewGraph.tsx
// =============================================================================
// YEAR OVERVIEW GRAPH
// =============================================================================
//
// 12 vertical bars (Jan–Dec) summarising completion activity for the full year.
// Provides a bird's-eye view of which months were busiest or most consistent.
//
// ── Toggle modes ─────────────────────────────────────────────────────────────
//
//   Count mode  — bar height is proportional to the raw completion count for
//                 that month relative to the busiest month (peak = full height).
//                 Label below shows the raw number (or "–" for 0).
//                 Good for seeing overall volume trends across the year.
//
//   % mode      — bar height = completed ÷ total (true monthly completion rate).
//                 Full height = 100% of scheduled tasks completed that month.
//                 Label below shows the rate as "X%" (or "–" for no tasks).
//                 Good for seeing consistency regardless of how many tasks were
//                 scheduled each month.
//
// ── Bar rendering ────────────────────────────────────────────────────────────
//
//   - Months with 0 completions (or no data) show a minimal grey stub.
//   - Future months (index > current month in the current year) are rendered
//     at 30% opacity so they are visually de-emphasised.
//   - Value labels sit below the single-character month initial (J F M … D).
//     In Count mode the raw number is shown; in % mode the rate is shown.
//
// ── Props ─────────────────────────────────────────────────────────────────────
//
//   data  - exactly 12 MonthData items in calendar order (Jan = index 0)
//   color - hex accent color for bars that have activity and for the active
//           toggle button background
//
// ── Used by ──────────────────────────────────────────────────────────────────
//
//   OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen
//
// =============================================================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { safePct } from '../../../../core/utils/statUtils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Completion summary for one calendar month.
 * Index in the array corresponds to the month number (0 = January, 11 = December).
 */
export interface MonthData {
  /** 0-indexed month number (January = 0, December = 11) */
  month: number;
  /** Number of tasks completed during this month */
  completed: number;
  /** Total tasks scheduled during this month — used as the denominator in % mode */
  total: number;
}

interface YearOverviewGraphProps {
  /**
   * Exactly 12 MonthData items in Jan → Dec order.
   * Future months should have completed = 0 and total = 0.
   */
  data: MonthData[];
  /** Hex accent color — used for filled bars and the active toggle button */
  color: string;
}

/** The two display modes for bar height and value labels */
type DisplayMode = 'count' | 'percent';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum rendered bar height in px — the tallest bar always reaches this */
const BAR_MAX_HEIGHT = 72;

/** Minimum rendered bar height in px — keeps zero-count months visible as stubs */
const BAR_MIN_HEIGHT = 4;

/** Single-character month labels in calendar order (January–December) */
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Returns the 0-indexed month number of today's date.
 * Used to determine which months are in the future and should be dimmed.
 */
function currentMonthIndex(): number {
  return new Date().getMonth();
}

// =============================================================================
// SUB-COMPONENT — single month bar column
// =============================================================================

interface MonthBarProps {
  /** Activity data for this month */
  item:     MonthData;
  /** Peak completed count across all 12 months — used for Count mode scaling */
  maxCount: number;
  /** Accent color for active bars */
  color:    string;
  /** True if this month is still in the future — rendered at reduced opacity */
  isFuture: boolean;
  /** Active display mode — determines bar height formula and label content */
  mode:     DisplayMode;
}

/**
 * Renders one month column: a vertical bar, a single-character month initial,
 * and a value label beneath it.
 *
 * Count mode:
 *   Bar height proportional to completed / maxCount (relative to busiest month).
 *   Label = raw completion count, or "–" for 0.
 *
 * Percent mode:
 *   Bar height = completed / total (true monthly completion rate).
 *   Full height represents 100% completion for that month.
 *   Label = "X%" completion rate, or "–" if no tasks were scheduled.
 *
 * Future months are fully rendered but at 30% opacity.
 * Months with zero activity show a minimal grey stub at BAR_MIN_HEIGHT.
 */
const MonthBar: React.FC<MonthBarProps> = ({ item, maxCount, color, isFuture, mode }) => {
  // A month "has activity" if at least one task was completed
  const hasActivity = item.completed > 0;

  // Whether this month has any tasks scheduled (needed for % mode denominator)
  const hasTotal = item.total > 0;

  // ── Bar height ────────────────────────────────────────────────────────────
  // Count mode: scale relative to the busiest month (maxCount → full height)
  // % mode:     scale to actual completion rate (100% → full height)
  // Zero-activity months always fall back to the grey stub height
  const barHeight = (() => {
    if (!hasActivity) return BAR_MIN_HEIGHT;
    if (mode === 'percent' && hasTotal) {
      return Math.max((item.completed / item.total) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);
    }
    // Count mode (or % mode with missing total): relative to peak month
    return Math.max((item.completed / maxCount) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);
  })();

  // ── Value label ───────────────────────────────────────────────────────────
  // Count mode: raw number ("42") or "–" for 0
  // % mode:     completion rate ("85%") or "–" if no total provided
  const valueLabel = (() => {
    if (!hasActivity) return '–';
    if (mode === 'percent') {
      return hasTotal ? `${safePct(item.completed, item.total)}%` : '–';
    }
    return String(item.completed);
  })();

  // Active bars use the accent color; zero-activity bars use grey
  const barColor = hasActivity ? color : '#e8e8e8';

  return (
    // Dim the whole column for future months — the opacity applies to bar + labels
    <View style={[col.container, isFuture && col.future]}>

      {/* Vertical bar — anchored to the bottom of the fixed-height bar area */}
      <View style={[col.barArea, { height: BAR_MAX_HEIGHT }]}>
        <View style={[col.bar, { height: barHeight, backgroundColor: barColor }]} />
      </View>

      {/* Single-character month initial (J, F, M, A, M, J, J, A, S, O, N, D) */}
      <Text style={col.monthLabel}>{MONTH_INITIALS[item.month]}</Text>

      {/* Count or % value below the month initial */}
      <Text style={[col.valueLabel, hasActivity && { color }]}>
        {valueLabel}
      </Text>

    </View>
  );
};

/** Styles for a single month bar column */
const col = StyleSheet.create({
  container: {
    flex:       1,
    alignItems: 'center',
  },
  /** Future months rendered at ~30% opacity to visually indicate no data yet */
  future: {
    opacity: 0.3,
  },
  /** Fixed-height area that the bar grows up from the bottom of */
  barArea: {
    justifyContent: 'flex-end',
    alignItems:     'center',
  },
  bar: {
    width:        14,
    borderRadius: 4,
  },
  /** J F M A M J J A S O N D */
  monthLabel: {
    fontSize:   11,
    color:      '#bbb',
    fontWeight: '600',
    marginTop:  5,
  },
  /** Completion count or rate — colored when the month has activity */
  valueLabel: {
    fontSize:   9,
    color:      '#ccc',
    fontWeight: '500',
    marginTop:  1,
  },
});

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * YearOverviewGraph
 *
 * Displays 12 monthly bars for the current year. A Count/% toggle switches
 * between volume view (relative bar heights) and consistency view (true
 * monthly completion rates). Toggle state is managed internally.
 */
export const YearOverviewGraph: React.FC<YearOverviewGraphProps> = ({ data, color }) => {
  // Internal toggle state — parent does not need to control this
  const [mode, setMode] = useState<DisplayMode>('count');

  // Peak completed count across all 12 months.
  // Used for Count mode bar scaling. Floor of 1 prevents divide-by-zero.
  const maxCount = Math.max(...data.map(d => d.completed), 1);

  // Current month index — months beyond this are dimmed as "future"
  const nowMonth = currentMonthIndex();

  return (
    <View style={styles.card}>

      {/* ── Header: section label + Count/% toggle ─────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>
          {mode === 'count' ? 'YEAR OVERVIEW' : 'YEAR COMPLETION RATE'}
        </Text>

        {/* Toggle pill — same visual pattern as WeekBarGraph / DayOfWeekPatternCard */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'count' && { backgroundColor: color }]}
            onPress={() => setMode('count')}
            activeOpacity={0.75}
          >
            <Text style={[styles.toggleLabel, mode === 'count' && styles.toggleLabelActive]}>
              Count
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'percent' && { backgroundColor: color }]}
            onPress={() => setMode('percent')}
            activeOpacity={0.75}
          >
            <Text style={[styles.toggleLabel, mode === 'percent' && styles.toggleLabelActive]}>
              %
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 12 month bar columns ────────────────────────────────────────── */}
      <View style={styles.barsRow}>
        {data.map((item) => (
          <MonthBar
            key={item.month}
            item={item}
            maxCount={maxCount}
            color={color}
            isFuture={item.month > nowMonth}
            mode={mode}
          />
        ))}
      </View>

    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  /** Outer card — white background with a soft shadow */
  card: {
    backgroundColor:  '#fff',
    borderRadius:     18,
    marginHorizontal: 16,
    marginBottom:     12,
    padding:          20,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.07,
    shadowRadius:     8,
    elevation:        3,
  },

  /** Row holding the section label on the left and the toggle on the right */
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   16,
  },

  /** "YEAR OVERVIEW" / "YEAR COMPLETION RATE" — small caps style */
  sectionLabel: {
    fontSize:      11,
    fontWeight:    '800',
    color:         '#ccc',
    letterSpacing: 1.1,
  },

  // ── Count / % toggle pill ── (mirrors MonthCalendarGraph / WeekBarGraph)
  toggle: {
    flexDirection:   'row',
    backgroundColor: '#f2f2f2',
    borderRadius:    8,
    padding:         2,
    gap:             2,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      7,
  },
  toggleLabel: {
    fontSize:   12,
    fontWeight: '600',
    color:      '#999',
  },
  /** Applied to the label text of the currently active toggle button */
  toggleLabelActive: {
    color: '#fff',
  },

  /** Flex row containing all 12 MonthBar columns */
  barsRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
  },
});
