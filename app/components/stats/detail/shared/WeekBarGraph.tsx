// app/components/stats/detail/shared/WeekBarGraph.tsx
// =============================================================================
// WEEK BAR GRAPH
// =============================================================================
//
// Full-width 7-bar chart showing completion activity for each day of the
// week (Mon–Sun). This is the expanded detail-screen version of WeeklyMiniChart.
//
// Visual layout:
//
//   CURRENT WEEK COMPLETIONS  ──────────────── [Count | %] toggle
//   (title changes to "CURRENT WEEK COMPLETION RATE" in % mode)
//
//   ██  █  ▄  ██  ▄   _   _
//   M   T  W   T  F   S   S
//   8   6  4   8  2   0   0        ← shown in Count mode
//   80% 60% 40% 80% 20%  0%  0%   ← shown in % mode
//
// Toggle behaviour:
//   - The "Count | %" pill in the top-right switches the value displayed
//     under each bar between raw completion count and completion percentage.
//   - Internal state — the parent does not need to manage the toggle.
//   - In % mode each bar's height represents: count / max_count * 100.
//     The label below the bar shows the actual % value, not the height %.
//     (Since we don't have a `total` per day, % is relative to peak day.)
//
// Bar rendering:
//   - Bar heights scale relative to the day with the highest count.
//   - A day with 0 completions renders a minimal stub (height 4) in grey.
//   - Today's bar (if data covers the current week) could be highlighted —
//     not implemented here; left for a future enhancement (Phase 6).
//
// Data:
//   Receives `DayData[]` from WeeklyMiniChart — reuses the same type.
//   Array must have exactly 7 items in Mon–Sun order.
//
// Props:
//   data   - 7 DayData items [ { day: 'M', count: 8 }, ... ] Mon → Sun
//   color  - hex accent color for active bars and toggle highlight
//
// Used by:
//   OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen
//
// =============================================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DayData } from '../../WeeklyMiniChart';
import { safePct } from '../../../../core/utils/statUtils';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Height in px of the tallest possible bar */
const BAR_MAX_HEIGHT = 80;

/** Minimum height of a bar — ensures zero days are still visible */
const BAR_MIN_HEIGHT = 4;

/** Width of each bar column (bar itself is narrower, gap is around it) */
const BAR_WIDTH = 28;

// =============================================================================
// TYPES
// =============================================================================

/** Toggle mode: show raw counts or relative percentages under each bar */
type DisplayMode = 'count' | 'percent';

interface WeekBarGraphProps {
  /** Exactly 7 DayData items ordered Mon → Sun */
  data: DayData[];
  /** Hex accent color for filled bars and the active toggle label */
  color: string;
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
  const hasActivity = item.count > 0;

  // Whether this day has a known denominator (tasks scheduled) for a true rate
  const hasTotal = item.total != null && item.total > 0;

  // ── Bar height ──────────────────────────────────────────────────────────
  // Count mode : height relative to the busiest day in the week (volume view)
  // Percent mode: height = completion rate for that day (count ÷ total)
  //               Falls back to count/maxCount if no total is provided.
  const barHeight = (() => {
    if (!hasActivity) return BAR_MIN_HEIGHT;
    if (mode === 'percent' && hasTotal) {
      // True completion rate — full BAR_MAX_HEIGHT = 100% completion that day
      return Math.max((item.count / item.total!) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);
    }
    // Count mode (or missing total): proportional to the week's peak day
    return Math.max((item.count / maxCount) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);
  })();

  // ── Label beneath the day letter ───────────────────────────────────────
  // Count mode : raw number ("5")
  // Percent mode: true rate if total available ("100%"), else relative to max
  const displayValue = mode === 'count'
    ? String(item.count)
    : hasTotal
      ? `${safePct(item.count, item.total!)}%`
      : `${safePct(item.count, maxCount)}%`;

  return (
    <View style={col.container}>
      {/* Vertical bar — anchored to the bottom of the bar area */}
      <View style={[col.barArea, { height: BAR_MAX_HEIGHT }]}>
        <View
          style={[
            col.bar,
            {
              height:          barHeight,
              width:           BAR_WIDTH,
              backgroundColor: hasActivity ? color : '#e8e8e8',
            },
          ]}
        />
      </View>

      {/* Day letter label (M, T, W, T, F, S, S) */}
      <Text style={col.dayLabel}>{item.day}</Text>

      {/* Count or % value below the day letter */}
      <Text style={[col.valueLabel, hasActivity && { color }]}>
        {displayValue}
      </Text>
    </View>
  );
};

const col = StyleSheet.create({
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
    color:      '#aaa',
    fontWeight: '600',
    marginTop:  6,
  },
  valueLabel: {
    fontSize:   11,
    color:      '#ccc',
    fontWeight: '500',
    marginTop:  2,
  },
});

// =============================================================================
// COMPONENT
// =============================================================================

export const WeekBarGraph: React.FC<WeekBarGraphProps> = ({ data, color }) => {
  // Toggle state is internal — the parent doesn't need to know which mode is active
  const [mode, setMode] = useState<DisplayMode>('count');

  // Highest count across all 7 days — used to scale bar heights and % values
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <View style={styles.card}>
      {/* ── Section header + Count/% toggle ───────────────────────────────── */}
      {/*
        Title reflects the active display mode:
          Count mode  → "WEEKLY AVERAGE COMPLETIONS"
          Percent mode → "WEEKLY AVERAGE COMPLETION RATE"
      */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>
          {mode === 'count' ? 'CURRENT WEEK COMPLETIONS' : 'CURRENT WEEK COMPLETION RATE'}
        </Text>

        {/* Toggle pill — tapping switches between Count and % display */}
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

      {/* ── 7 bar columns ─────────────────────────────────────────────────── */}
      <View style={styles.barsRow}>
        {data.map((item, i) => (
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

const styles = StyleSheet.create({
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

  headerRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   16,
  },

  sectionLabel: {
    fontSize:      11,
    fontWeight:    '800',
    color:         '#ccc',
    letterSpacing: 1.1,
  },

  // Count / % toggle pill
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
  toggleLabelActive: {
    color: '#fff',
  },

  barsRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
  },
});
