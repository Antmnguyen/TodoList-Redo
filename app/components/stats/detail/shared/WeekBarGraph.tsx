// app/components/stats/detail/shared/WeekBarGraph.tsx
// =============================================================================
// WEEK BAR GRAPH
// =============================================================================
//
// Full-width 7-bar chart showing completion activity for each day of the
// week (Mon–Sun). Includes a week navigator so the user can browse past weeks.
//
// Visual layout:
//
//   WEEK COMPLETIONS  ─────────────────────── [Count | %] toggle
//   ┌──────────────────────────────────────────────────────┐
//   │   ‹     Feb 10 – Feb 16, 2026     ›                 │
//   └──────────────────────────────────────────────────────┘
//
//   ██  █  ▄  ██  ▄   _   _
//   M   T  W   T  F   S   S
//   8   6  4   8  2   0   0        ← Count mode
//   80% 60% 40% 80% 20%  0%  0%   ← % mode
//
// Navigation behaviour:
//   - ‹ (prev) navigates one week earlier — always enabled.
//   - › (next) is DISABLED when displaying the current week.
//   - Week range label updates to reflect the selected week.
//   - When navigating away from the current week, mock data is generated
//     from a stable seed so the same past week always shows the same values.
//
// Toggle behaviour:
//   - The "Count | %" pill switches between raw count and completion %.
//   - Internal state — the parent does not need to manage the toggle.
//
// Props:
//   data              - 7 DayData items (Mon–Sun) for the current week
//   color             - hex accent color for bars and the active toggle
//   initialWeekStart  - optional Monday Date to open on (defaults to this week)
//   onWeekChange      - optional callback fired when the user navigates weeks
//
// Used by:
//   OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DayData } from '../../WeeklyMiniChart';
import { safePct } from '../../../../core/utils/statUtils';
import { useTheme } from '../../../../theme/ThemeContext';
import type { AppTheme } from '../../../../theme/tokens';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Height in px of the tallest possible bar */
const BAR_MAX_HEIGHT = 80;

/** Minimum height of a bar — ensures zero days are still visible */
const BAR_MIN_HEIGHT = 4;

/** Width of each bar column (bar itself is narrower, gap is around it) */
const BAR_WIDTH = 28;

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// =============================================================================
// TYPES
// =============================================================================

/** Toggle mode: show raw counts or relative percentages under each bar */
type DisplayMode = 'count' | 'percent';

interface WeekBarGraphProps {
  /** Exactly 7 DayData items ordered Mon → Sun (data for the "current" week) */
  data: DayData[];
  /** Hex accent color for filled bars and the active toggle label */
  color: string;
  /** Optional Monday Date to open on; defaults to this week's Monday */
  initialWeekStart?: Date;
  /** Fired when the user navigates to a different week */
  onWeekChange?: (weekStart: Date) => void;
}

// =============================================================================
// HELPERS — week navigation
// =============================================================================

/**
 * Returns the Monday of the week that contains `date`, normalised to midnight.
 * JS getDay() returns 0 for Sunday; Monday-first offset: +6 mod 7.
 */
function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day; // shift so Monday = day 0
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Formats a Monday Date into a human-readable week range label.
 * Example: "Feb 10 – Feb 16, 2026"
 */
function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const sm = MONTHS_SHORT[monday.getMonth()];
  const em = MONTHS_SHORT[sunday.getMonth()];
  return `${sm} ${monday.getDate()} – ${em} ${sunday.getDate()}, ${sunday.getFullYear()}`;
}


// =============================================================================
// SUB-COMPONENT — single bar column
// =============================================================================

interface BarColumnProps {
  item: DayData;
  maxCount: number;
  color: string;
  mode: DisplayMode;
}

/**
 * Renders one day column: a vertical bar + day letter + value label.
 * Bar height is proportional to count / maxCount, clamped to BAR_MIN_HEIGHT.
 */
const BarColumn: React.FC<BarColumnProps> = ({ item, maxCount, color, mode }) => {
  const { theme } = useTheme();
  const colStyles = useMemo(() => makeColStyles(theme), [theme]);

  const hasActivity = item.count > 0;

  // Whether this day has a known denominator (tasks scheduled) for a true rate
  const hasTotal = item.total != null && item.total > 0;

  // ── Bar height ──────────────────────────────────────────────────────────
  const barHeight = (() => {
    if (!hasActivity) return BAR_MIN_HEIGHT;
    if (mode === 'percent' && hasTotal) {
      return Math.max((item.count / item.total!) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);
    }
    return Math.max((item.count / maxCount) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);
  })();

  // ── Label beneath the day letter ───────────────────────────────────────
  const displayValue = mode === 'count'
    ? String(item.count)
    : hasTotal
      ? `${safePct(item.count, item.total!)}%`
      : `${safePct(item.count, maxCount)}%`;

  // ── Segment heights (stacked bar) ──────────────────────────────────────
  const segHeights = item.segments?.map(seg => {
    if (mode === 'percent' && hasTotal) {
      return Math.max((seg.count / item.total!) * BAR_MAX_HEIGHT, 0);
    }
    return Math.max((seg.count / maxCount) * BAR_MAX_HEIGHT, 0);
  });

  return (
    <View style={colStyles.container}>
      <View style={[colStyles.barArea, { height: BAR_MAX_HEIGHT }]}>
        {item.segments && segHeights ? (
          <View style={{ width: BAR_WIDTH, overflow: 'hidden', borderRadius: 5 }}>
            {[...item.segments].reverse().map((seg, i) => (
              <View
                key={i}
                style={{ height: segHeights[item.segments!.length - 1 - i], backgroundColor: seg.color }}
              />
            ))}
          </View>
        ) : (
          <View
            style={[
              colStyles.bar,
              {
                height:          barHeight,
                width:           BAR_WIDTH,
                backgroundColor: hasActivity ? color : theme.separator,
              },
            ]}
          />
        )}
      </View>
      <Text style={colStyles.dayLabel}>{item.day}</Text>
      <Text style={[colStyles.valueLabel, hasActivity && { color }]}>
        {displayValue}
      </Text>
    </View>
  );
};

// =============================================================================
// COMPONENT
// =============================================================================

export const WeekBarGraph: React.FC<WeekBarGraphProps> = ({
  data,
  color,
  initialWeekStart,
  onWeekChange,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Toggle state — parent doesn't need to know which mode is active
  const [mode, setMode] = useState<DisplayMode>('count');

  // Current displayed week — starts on the provided Monday or this week's Monday
  const [weekStart, setWeekStart] = useState<Date>(
    () => initialWeekStart ? getMondayOf(initialWeekStart) : getMondayOf(new Date())
  );

  // True when showing the current real week — disables the › arrow
  const isCurrentWeek = weekStart.getTime() === getMondayOf(new Date()).getTime();

  const displayData = data;

  const maxCount = Math.max(...displayData.map(d => d.count), 1);

  // ── Navigation handlers ────────────────────────────────────────────────────
  const handlePrev = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
    onWeekChange?.(prev);
  };

  const handleNext = () => {
    if (isCurrentWeek) return;
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
    onWeekChange?.(next);
  };

  return (
    <View style={styles.card}>

      {/* ── Section header + Count/% toggle ──────────────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>
          {mode === 'count' ? 'WEEK COMPLETIONS' : 'WEEK COMPLETION RATE'}
        </Text>

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

      {/* ── Week navigator — same visual as WeekNavigator component ─────── */}
      <View style={styles.navRow}>
        {/* ‹ Previous week */}
        <TouchableOpacity
          onPress={handlePrev}
          style={styles.navArrow}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Text style={styles.navArrowText}>‹</Text>
        </TouchableOpacity>

        {/* Week range label: "Feb 10 – Feb 16, 2026" */}
        <Text style={styles.navLabel}>{formatWeekLabel(weekStart)}</Text>

        {/* › Next week — disabled on current week */}
        <TouchableOpacity
          onPress={handleNext}
          style={[styles.navArrow, isCurrentWeek && styles.navArrowDisabled]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={isCurrentWeek ? 1 : 0.6}
          disabled={isCurrentWeek}
        >
          <Text style={[styles.navArrowText, isCurrentWeek && styles.navArrowTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── 7 bar columns ─────────────────────────────────────────────────── */}
      <View style={styles.barsRow}>
        {displayData.map((item, i) => (
          <BarColumn
            key={i}
            item={item}
            maxCount={maxCount}
            color={color}
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

function makeColStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      flex:       1,
    },
    barArea: {
      justifyContent: 'flex-end',
      alignItems:     'center',
    },
    bar: {
      borderRadius: 5,
    },
    dayLabel: {
      fontSize:   12,
      color:      theme.textTertiary,
      fontWeight: '600',
      marginTop:  6,
    },
    valueLabel: {
      fontSize:   11,
      color:      theme.textDisabled,
      fontWeight: '500',
      marginTop:  2,
    },
  });
}

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

    headerRow: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      alignItems:     'center',
      marginBottom:   10,
    },

    sectionLabel: {
      fontSize:      11,
      fontWeight:    '800',
      color:         theme.textDisabled,
      letterSpacing: 1.1,
      flexShrink:    1,
    },

    // ── Week navigator row ─────────────────────────────────────────────────────
    navRow: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      backgroundColor:   theme.bgInput,
      borderRadius:      12,
      borderWidth:       1,
      borderColor:       theme.border,
      paddingVertical:   8,
      paddingHorizontal: 12,
      marginBottom:      14,
    },

    navArrow: {
      padding: 2,
    },

    navArrowDisabled: {
      opacity: 0.25,
    },

    navArrowText: {
      fontSize:   24,
      color:      theme.textSecondary,
      fontWeight: '400',
      lineHeight: 28,
    },

    navArrowTextDisabled: {
      color: theme.textDisabled,
    },

    navLabel: {
      flex:       1,
      textAlign:  'center',
      fontSize:   13,
      fontWeight: '600',
      color:      theme.textPrimary,
    },

    // Count / % toggle pill
    toggle: {
      flexDirection:   'row',
      backgroundColor: theme.separator,
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
