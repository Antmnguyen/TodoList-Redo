// app/components/stats/detail/shared/HealthDayOfWeekCard.tsx
// =============================================================================
// HEALTH DAY-OF-WEEK CARD
// =============================================================================
//
// Shows average steps or sleep hours grouped by day of the week (Mon–Sun)
// across the full stored history.
//
// Unlike DayOfWeekPatternCard (which counts task completions as 0/1 events),
// this card deals with continuous values — the bar height and label reflect
// the average measurement for that weekday, not a tally of successes.
//
// ── Toggle modes ──────────────────────────────────────────────────────────────
//
//   Avg mode  → "AVG STEPS BY DAY OF THE WEEK (ALL TIME)"
//     Bar height proportional to avgValue vs the peak weekday average.
//     Label shows the formatted average (e.g. "8,432" steps or "7.2h" sleep).
//
//   % mode    → "AVG % OF GOAL BY DAY OF THE WEEK (ALL TIME)"
//     Bar height proportional to avgValue / goal.
//     Label shows avgValue ÷ goal as a whole-number percentage.
//
// ── Visual layout ─────────────────────────────────────────────────────────────
//
//   AVG STEPS BY DAY OF THE WEEK (ALL TIME)      [Avg | %]
//
//   ██  ██  █  ▄  █  ▂  ▂
//   M   T  W  T  F  S  S
//  9.2k 8.4k ...              ← formatted avg value
//
//   Best day: Monday
//
// ── Props ─────────────────────────────────────────────────────────────────────
//
//   data   - 7 HealthDayOfWeekData items in Mon–Sun order
//   goal   - the user's current goal (steps or hours) — used for % mode
//   unit   - 'steps' | 'hours' — controls value formatting
//   color  - accent hex for the best day bar + footer label
//
// ── Used by ──────────────────────────────────────────────────────────────────
//
//   StepsDetailScreen, SleepDetailScreen
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../../../theme/ThemeContext';
import type { AppTheme } from '../../../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Average health metric for one day of the week.
 * The array passed to HealthDayOfWeekCard always has exactly 7 items, Mon–Sun.
 */
export interface HealthDayOfWeekData {
  /** Single-char display label: 'M', 'T', 'W', 'T', 'F', 'S', 'S' */
  day: string;
  /**
   * Average value for this weekday across all recorded history.
   * Steps: average step count (e.g. 8432.5)
   * Sleep: average hours (e.g. 7.25)
   * 0 when no data has been recorded for this weekday yet.
   */
  avgValue: number;
  /** Number of recorded days that contribute to avgValue. */
  count: number;
}

type DisplayMode = 'avg' | 'percent';

interface HealthDayOfWeekCardProps {
  /** Exactly 7 items ordered Monday (index 0) through Sunday (index 6). */
  data: HealthDayOfWeekData[];
  /** User's goal — used as the denominator in % mode. */
  goal: number;
  /**
   * Controls value label formatting.
   * 'steps' → locale integer with k-abbreviation for large numbers (e.g. "8,432")
   * 'hours' → one decimal place + 'h' suffix (e.g. "7.2h")
   */
  unit: 'steps' | 'hours';
  /** Hex accent color — best day bar + "Best day" footer */
  color: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BAR_MAX_HEIGHT = 64;
const BAR_MIN_HEIGHT = 4;

const FULL_DAY_NAMES = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format a steps value for compact display under a bar column.
 * ≥10000 → "10.0k", ≥1000 → "9.4k", <1000 → "842"
 */
function formatStepsCompact(n: number): string {
  if (n === 0) return '–';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

/**
 * Format sleep hours as "7.2h".
 */
function formatHoursCompact(h: number): string {
  if (h === 0) return '–';
  return `${h.toFixed(1)}h`;
}

function formatValue(value: number, unit: 'steps' | 'hours'): string {
  if (unit === 'steps') return formatStepsCompact(value);
  return formatHoursCompact(value);
}

function bestDayIndex(data: HealthDayOfWeekData[], mode: DisplayMode, goal: number): number {
  if (mode === 'percent') {
    const pcts = data.map(d => (d.count > 0 && goal > 0 ? d.avgValue / goal : -1));
    const max  = Math.max(...pcts);
    if (max <= 0) return -1;
    return pcts.indexOf(max);
  }
  // avg mode: highest raw average
  const max = Math.max(...data.map(d => d.avgValue));
  if (max === 0) return -1;
  return data.findIndex(d => d.avgValue === max);
}

// =============================================================================
// SUB-COMPONENT — single day bar column
// =============================================================================

interface DayBarProps {
  item:       HealthDayOfWeekData;
  maxAvg:     number;   // peak avgValue across the 7 days — for Avg mode scaling
  goal:       number;
  unit:       'steps' | 'hours';
  color:      string;
  isBest:     boolean;
  mode:       DisplayMode;
}

const DayBar: React.FC<DayBarProps> = ({ item, maxAvg, goal, unit, color, isBest, mode }) => {
  const { theme } = useTheme();
  const colStyles = useMemo(() => makeColStyles(theme), [theme]);

  const hasData = item.count > 0 && item.avgValue > 0;

  // ── Bar height ──────────────────────────────────────────────────────────────
  const barHeight = (() => {
    if (!hasData) return BAR_MIN_HEIGHT;
    if (mode === 'percent' && goal > 0) {
      // Cap at BAR_MAX_HEIGHT when at or above goal
      return Math.min(Math.max((item.avgValue / goal) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT), BAR_MAX_HEIGHT);
    }
    // Avg mode: scale to tallest bar
    return Math.max((item.avgValue / Math.max(maxAvg, 1)) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);
  })();

  // ── Value label ─────────────────────────────────────────────────────────────
  const valueLabel = (() => {
    if (!hasData) return '–';
    if (mode === 'percent' && goal > 0) {
      return `${Math.round((item.avgValue / goal) * 100)}%`;
    }
    return formatValue(item.avgValue, unit);
  })();

  // ── Bar color ───────────────────────────────────────────────────────────────
  const barColor = isBest
    ? color
    : hasData
      ? color + '55'
      : theme.separator;

  const barWidth = isBest ? 20 : 16;

  return (
    <View style={colStyles.container}>
      <View style={[colStyles.barArea, { height: BAR_MAX_HEIGHT }]}>
        <View
          style={[
            colStyles.bar,
            { height: barHeight, backgroundColor: barColor, width: barWidth },
          ]}
        />
      </View>
      <Text style={[colStyles.dayLabel, isBest && { color, fontWeight: '800' }]}>
        {item.day}
      </Text>
      <Text style={[colStyles.valueLabel, isBest && { color }]}>
        {valueLabel}
      </Text>
    </View>
  );
};

// =============================================================================
// COMPONENT
// =============================================================================

export const HealthDayOfWeekCard: React.FC<HealthDayOfWeekCardProps> = ({
  data,
  goal,
  unit,
  color,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [mode, setMode] = useState<DisplayMode>('avg');

  const maxAvg = Math.max(...data.map(d => d.avgValue), 1);
  const best   = bestDayIndex(data, mode, goal);
  const bestName = best >= 0 ? FULL_DAY_NAMES[best] : null;

  const unitLabel = unit === 'steps' ? 'STEPS' : 'SLEEP HOURS';

  return (
    <View style={styles.card}>

      {/* ── Header row: title + Avg/% toggle ──────────────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>
          {mode === 'avg'
            ? `AVG ${unitLabel} BY DAY OF THE WEEK (ALL TIME)`
            : `AVG % OF GOAL BY DAY OF THE WEEK (ALL TIME)`}
        </Text>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'avg' && { backgroundColor: color }]}
            onPress={() => setMode('avg')}
            activeOpacity={0.75}
          >
            <Text style={[styles.toggleLabel, mode === 'avg' && styles.toggleLabelActive]}>
              Avg
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

      {/* ── 7 day bar columns ──────────────────────────────────────────────── */}
      <View style={styles.barsRow}>
        {data.map((item, i) => (
          <DayBar
            key={i}
            item={item}
            maxAvg={maxAvg}
            goal={goal}
            unit={unit}
            color={color}
            isBest={i === best}
            mode={mode}
          />
        ))}
      </View>

      {/* ── Best day footer ────────────────────────────────────────────────── */}
      {bestName && (
        <Text style={styles.bestDayLabel}>
          {mode === 'avg' ? 'Highest avg: ' : 'Closest to goal: '}
          <Text style={{ color, fontWeight: '700' }}>{bestName}</Text>
        </Text>
      )}

    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeColStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex:       1,
      alignItems: 'center',
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
      fontSize:   10,
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
      alignItems:     'flex-start',
      justifyContent: 'space-between',
      marginBottom:   16,
      gap:            10,
    },
    sectionLabel: {
      flex:          1,
      fontSize:      11,
      fontWeight:    '800',
      color:         theme.textDisabled,
      letterSpacing: 1.0,
      lineHeight:    15,
    },
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
      marginBottom:  14,
    },
    bestDayLabel: {
      fontSize:   13,
      color:      theme.textTertiary,
      fontWeight: '500',
      textAlign:  'center',
    },
  });
}
