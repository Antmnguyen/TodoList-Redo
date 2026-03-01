// app/components/stats/detail/shared/YearOverviewGraph.tsx
// =============================================================================
// YEAR OVERVIEW GRAPH
// =============================================================================
//
// 12 vertical bars (Jan–Dec) summarising completion activity for a given year.
// Navigation is built into the header row — ‹ and › arrows let the user
// browse to any past year. The › arrow is disabled on the current year.
// Navigating to a different year generates stable mock data from a seed so
// the same past year always looks identical across re-renders.
//
// ── Header ────────────────────────────────────────────────────────────────────
//
//   ‹   2026   ›                               [Count | %]
//   YEAR OVERVIEW (or YEAR COMPLETION RATE in % mode)
//
// ── Toggle modes ─────────────────────────────────────────────────────────────
//
//   Count mode  — bar height proportional to raw completion count relative to
//                 the busiest month. Label = raw number.
//
//   % mode      — bar height = completed ÷ total (true monthly completion rate).
//                 Label = "X%". Full height = 100%.
//
// ── Bar rendering ─────────────────────────────────────────────────────────────
//
//   - Months with 0 completions show a minimal grey stub.
//   - Future months (beyond current month in the current year, or any month
//     in a future year) are rendered at 30% opacity.
//   - In a past year, all 12 months are shown at full opacity.
//
// ── Props ─────────────────────────────────────────────────────────────────────
//
//   data         - exactly 12 MonthData items (current year, Jan = index 0)
//   color        - hex accent color for bars and the active toggle button
//   initialYear  - optional year to open on (defaults to current year)
//   onYearChange - optional callback fired when the user navigates years
//
// ── Used by ──────────────────────────────────────────────────────────────────
//
//   OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { safePct } from '../../../../core/utils/statUtils';
import { DataSegment } from '../../WeeklyMiniChart';
import { useTheme } from '../../../../theme/ThemeContext';
import type { AppTheme } from '../../../../theme/tokens';

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
  /** Optional — absent = solid bar. Present = stacked perm/one-off segments. */
  segments?: DataSegment[];
}

interface YearOverviewGraphProps {
  /**
   * Exactly 12 MonthData items in Jan → Dec order for the current (default) year.
   * Future months should have completed = 0 and total = 0.
   */
  data: MonthData[];
  /** Hex accent color — used for filled bars and the active toggle button */
  color: string;
  /** Optional year to open on (defaults to current calendar year) */
  initialYear?: number;
  /** Fired when the user navigates to a different year */
  onYearChange?: (year: number) => void;
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
// HELPERS — year navigation
// =============================================================================


// =============================================================================
// SUB-COMPONENT — single month bar column
// =============================================================================

interface MonthBarProps {
  item:        MonthData;
  maxCount:    number;
  color:       string;
  isFuture:    boolean;
  mode:        DisplayMode;
  emptyColor:  string;
}

/**
 * Renders one month column: a vertical bar, a single-character month initial,
 * and a value label beneath it.
 */
const MonthBar: React.FC<MonthBarProps> = ({ item, maxCount, color, isFuture, mode, emptyColor }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeColStyles(theme), [theme]);

  const hasActivity = item.completed > 0;
  const hasTotal    = item.total > 0;

  // ── Bar height ────────────────────────────────────────────────────────────
  const barHeight = (() => {
    if (!hasActivity) return BAR_MIN_HEIGHT;
    if (mode === 'percent' && hasTotal) {
      return Math.max((item.completed / item.total) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);
    }
    return Math.max((item.completed / maxCount) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);
  })();

  // ── Value label ───────────────────────────────────────────────────────────
  const valueLabel = (() => {
    if (!hasActivity) return '–';
    if (mode === 'percent') {
      return hasTotal ? `${safePct(item.completed, item.total)}%` : '–';
    }
    return String(item.completed);
  })();

  const barColor = hasActivity ? color : emptyColor;

  // ── Segment heights (stacked bar) ────────────────────────────────────────
  const segHeights = item.segments?.map(seg => {
    if (mode === 'percent' && hasTotal) {
      return Math.max((seg.count / item.total) * BAR_MAX_HEIGHT, 0);
    }
    return Math.max((seg.count / maxCount) * BAR_MAX_HEIGHT, 0);
  });

  return (
    <View style={[styles.container, isFuture && styles.future]}>
      <View style={[styles.barArea, { height: BAR_MAX_HEIGHT }]}>
        {item.segments && segHeights ? (
          <View style={{ width: 14, overflow: 'hidden', borderRadius: 4 }}>
            {[...item.segments].reverse().map((seg, i) => (
              <View
                key={i}
                style={{ height: segHeights[item.segments!.length - 1 - i], backgroundColor: seg.color }}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.bar, { height: barHeight, backgroundColor: barColor }]} />
        )}
      </View>
      <Text style={styles.monthLabel}>{MONTH_INITIALS[item.month]}</Text>
      <Text style={[styles.valueLabel, hasActivity && { color }]}>
        {valueLabel}
      </Text>
    </View>
  );
};

function makeColStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex:       1,
      alignItems: 'center',
    },
    future: {
      opacity: 0.3,
    },
    barArea: {
      justifyContent: 'flex-end',
      alignItems:     'center',
    },
    bar: {
      width:        14,
      borderRadius: 4,
    },
    monthLabel: {
      fontSize:   11,
      color:      theme.textDisabled,
      fontWeight: '600',
      marginTop:  5,
    },
    valueLabel: {
      fontSize:   9,
      color:      theme.textDisabled,
      fontWeight: '500',
      marginTop:  1,
    },
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * YearOverviewGraph
 *
 * Displays 12 monthly bars for a given year with built-in year navigation.
 * The ‹ and › arrows in the header let the user browse any past year;
 * › is disabled on the current year.
 *
 * Navigating to a year other than the initial one generates stable mock data
 * from a date-based seed (same past year always looks identical).
 */
export const YearOverviewGraph: React.FC<YearOverviewGraphProps> = ({
  data,
  color,
  initialYear,
  onYearChange,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const currentYear = new Date().getFullYear();

  // Internal toggle state
  const [mode, setMode] = useState<DisplayMode>('count');

  // Current displayed year — starts at initialYear or current year
  const [displayYear, setDisplayYear] = useState(initialYear ?? currentYear);

  // True when showing the current real year — disables the › arrow
  const isCurrentYear = displayYear === currentYear;

  // ── Navigation handlers ──────────────────────────────────────────────────
  const handlePrevYear = () => {
    const prev = displayYear - 1;
    setDisplayYear(prev);
    onYearChange?.(prev);
  };

  const handleNextYear = () => {
    if (isCurrentYear) return;
    const next = displayYear + 1;
    setDisplayYear(next);
    onYearChange?.(next);
  };

  // ── Data for the displayed year ──────────────────────────────────────────
  const displayData = data;

  const maxCount = Math.max(...displayData.map(d => d.completed), 1);

  // Determine which months appear as "future" (dimmed):
  // - In the current year: months after today's month
  // - In any past year: none (all months are past)
  // - In a future year: all months
  const nowMonth     = new Date().getMonth();
  const isFutureYear = displayYear > currentYear;

  return (
    <View style={styles.card}>

      {/* ── Header: ‹ year nav › + Count/% toggle ─────────────────────── */}
      <View style={styles.headerRow}>

        {/* Year navigator — arrows flank the year label */}
        <View style={styles.yearNav}>
          <TouchableOpacity
            onPress={handlePrevYear}
            style={styles.navArrow}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.6}
          >
            <Text style={styles.navArrowText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.yearLabel}>{displayYear}</Text>

          <TouchableOpacity
            onPress={handleNextYear}
            style={[styles.navArrow, isCurrentYear && styles.navArrowDisabled]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={isCurrentYear ? 1 : 0.6}
            disabled={isCurrentYear}
          >
            <Text style={[styles.navArrowText, isCurrentYear && styles.navArrowTextDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Count / % toggle pill */}
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

      {/* ── Mode subtitle label ──────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>
        {mode === 'count' ? 'YEAR OVERVIEW' : 'YEAR COMPLETION RATE'}
      </Text>

      {/* ── 12 month bar columns ────────────────────────────────────────── */}
      <View style={styles.barsRow}>
        {displayData.map((item) => {
          const isFuture = isFutureYear || (isCurrentYear && item.month > nowMonth);
          return (
            <MonthBar
              key={item.month}
              item={item}
              maxCount={maxCount}
              color={color}
              isFuture={isFuture}
              mode={mode}
              emptyColor={theme.border}
            />
          );
        })}
      </View>

    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor:  theme.bgCard,
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

    /** Row holding the year nav on the left and toggle on the right */
    headerRow: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      marginBottom:   6,
    },

    /** Inline nav: ‹ · year label · › */
    yearNav: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           6,
    },

    navArrow: {
      padding: 2,
    },

    navArrowDisabled: {
      opacity: 0.25,
    },

    navArrowText: {
      fontSize:   22,
      color:      theme.textSecondary,
      fontWeight: '400',
      lineHeight: 26,
    },

    navArrowTextDisabled: {
      color: theme.textDisabled,
    },

    yearLabel: {
      fontSize:   16,
      fontWeight: '700',
      color:      theme.textPrimary,
    },

    /** "YEAR OVERVIEW" / "YEAR COMPLETION RATE" — small caps style subtitle */
    sectionLabel: {
      fontSize:      11,
      fontWeight:    '800',
      color:         theme.textDisabled,
      letterSpacing: 1.1,
      marginBottom:  14,
    },

    // ── Count / % toggle pill ──────────────────────────────────────────────
    toggle: {
      flexDirection:   'row',
      backgroundColor: theme.bgInput,
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
      color:      theme.textTertiary,
    },
    toggleLabelActive: {
      color: '#fff',
    },

    barsRow: {
      flexDirection: 'row',
      alignItems:    'flex-end',
    },
  });
}
