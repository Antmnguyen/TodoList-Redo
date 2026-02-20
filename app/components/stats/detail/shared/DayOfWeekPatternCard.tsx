// app/components/stats/detail/shared/DayOfWeekPatternCard.tsx
// =============================================================================
// DAY OF WEEK PATTERN CARD
// =============================================================================
//
// Aggregates ALL historical completions grouped by day of week (Mon–Sun) to
// reveal behavioural patterns across the entire history of a stat.
//
// Answers questions like:
//   "I always complete this on Mondays"
//   "I tend to skip Wednesdays for this task"
//   "My completion rate is lowest on Sundays"
//
// This is different from WeekBarGraph (a specific 7-day window).
// DayOfWeekPatternCard accumulates totals across ALL recorded history.
//
// ── Toggle modes ─────────────────────────────────────────────────────────────
//
//   Count mode  → "COMPLETIONS BY DAY OF THE WEEK (ALL TIME)"
//     Bar height proportional to total completions on that weekday vs peak.
//     Answers: "Which day do I complete this most often overall?"
//
//   % mode      → "COMPLETION RATE BY DAY OF THE WEEK (ALL TIME)"
//     Bar height = count ÷ total (true rate — how often done vs how often scheduled).
//     Answers: "On the days it's scheduled, which day do I actually do it?"
//     Requires `total` on each DayOfWeekData entry.
//     Falls back to count/maxCount if total is not provided.
//
// ── Visual layout ─────────────────────────────────────────────────────────────
//
//   COMPLETIONS BY DAY OF THE WEEK (ALL TIME)     [Count | %]
//
//   ██  ██  █  ▄  █  ▂  ▂
//   M   T  W  T  F  S  S
//   24  22 18 12 16  6  –
//
//   Best day: Monday
//
// ── Props ─────────────────────────────────────────────────────────────────────
//
//   data   - 7 DayOfWeekData items in Mon–Sun order
//   color  - accent hex color for the best day's bar and "Best day" label
//
// ── Used by ──────────────────────────────────────────────────────────────────
//
//   OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen
//
// =============================================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { safePct } from '../../../../core/utils/statUtils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * All-time completion aggregate for one day of the week.
 * The array always has exactly 7 items in Mon–Sun order (index 0 = Monday).
 */
export interface DayOfWeekData {
  /** Single-char display label: 'M', 'T', 'W', 'T', 'F', 'S', 'S' */
  day: string;
  /**
   * Total completions ever recorded on this weekday.
   * Used as the bar height in Count mode.
   */
  count: number;
  /**
   * Total times the task was scheduled on this weekday (all time), excluding
   * overdue/irrelevant occurrences. Used as the denominator in % mode to
   * compute true per-day completion rate (count ÷ total).
   * Optional — falls back to relative-to-max if not provided.
   */
  total?: number;
}

/** Toggle mode — Count shows raw totals, Percent shows completion rate */
type DisplayMode = 'count' | 'percent';

interface DayOfWeekPatternCardProps {
  /**
   * Exactly 7 items ordered Monday (index 0) through Sunday (index 6).
   * Include `total` per entry to enable true % mode bar heights.
   */
  data: DayOfWeekData[];
  /** Hex accent color — best day bar + "Best day" label */
  color: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum bar height in px — the busiest / highest-rate day always reaches this */
const BAR_MAX_HEIGHT = 64;

/** Minimum bar height in px — ensures zero days remain visible as stubs */
const BAR_MIN_HEIGHT = 4;

/**
 * Full day names in Mon–Sun order.
 * Index matches the DayOfWeekData array position.
 */
const FULL_DAY_NAMES = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Returns the index of the "best" day depending on the current display mode.
 *
 * Count mode : day with the highest raw `count` (most completions ever)
 * Percent mode: day with the highest completion rate (count ÷ total),
 *               only considering days where total > 0
 *
 * Returns -1 if all values are 0 or no valid days exist.
 */
function bestDayIndex(data: DayOfWeekData[], mode: DisplayMode): number {
  if (mode === 'percent') {
    // Build rates for days that have a known total, find the highest
    const rates = data.map(d =>
      d.total != null && d.total > 0 ? d.count / d.total : -1
    );
    const maxRate = Math.max(...rates);
    if (maxRate <= 0) return -1;
    return rates.indexOf(maxRate);
  }

  // Count mode: highest raw count
  const max = Math.max(...data.map(d => d.count));
  if (max === 0) return -1;
  return data.findIndex(d => d.count === max);
}

// =============================================================================
// SUB-COMPONENT — single day bar column
// =============================================================================

interface DayBarProps {
  item:      DayOfWeekData;
  maxCount:  number;  // peak raw count across all 7 days — for Count mode scaling
  color:     string;
  isBest:    boolean; // true for the day with the highest value in the current mode
  mode:      DisplayMode;
}

/**
 * One weekday column: vertical bar + single-char day label + value label.
 *
 * Count mode:
 *   Bar height proportional to count / maxCount.
 *   Label shows raw count number.
 *
 * Percent mode (with total):
 *   Bar height = count / total (true completion rate, full height = 100%).
 *   Label shows "X%" completion rate.
 *
 * Percent mode (no total):
 *   Falls back to count / maxCount for height; label shows relative %.
 *
 * Best day gets full accent color and a slightly wider bar.
 * Active non-best days get the accent at ~33% opacity.
 * Zero-completion days show a grey stub.
 */
const DayBar: React.FC<DayBarProps> = ({ item, maxCount, color, isBest, mode }) => {
  const hasActivity = item.count > 0;
  const hasTotal    = item.total != null && item.total > 0;

  // ── Bar height ────────────────────────────────────────────────────────────
  const barHeight = (() => {
    if (!hasActivity) return BAR_MIN_HEIGHT;
    if (mode === 'percent' && hasTotal) {
      // True completion rate: full height = completed every scheduled occurrence
      return Math.max((item.count / item.total!) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);
    }
    // Count mode (or no total): relative to the busiest weekday
    return Math.max((item.count / maxCount) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT);
  })();

  // ── Value label ───────────────────────────────────────────────────────────
  const valueLabel = (() => {
    if (mode === 'percent') {
      return hasTotal
        ? `${safePct(item.count, item.total!)}%`  // true rate
        : `${safePct(item.count, maxCount)}%`;    // fallback relative %
    }
    return item.count > 0 ? String(item.count) : '–';
  })();

  // ── Bar color ─────────────────────────────────────────────────────────────
  const barColor = isBest
    ? color
    : hasActivity
      ? color + '55'  // accent at ~33% opacity for non-best active days
      : '#e8e8e8';    // grey stub for zero days

  return (
    <View style={col.container}>
      {/* Vertical bar — grows upward from the bottom of the bar area */}
      <View style={[col.barArea, { height: BAR_MAX_HEIGHT }]}>
        <View
          style={[
            col.bar,
            {
              height:          barHeight,
              backgroundColor: barColor,
              // Best day bar is slightly wider to draw the eye
              width:           isBest ? 20 : 16,
            },
          ]}
        />
      </View>

      {/* Single-char day label (M T W T F S S) */}
      <Text style={[col.dayLabel, isBest && { color, fontWeight: '800' }]}>
        {item.day}
      </Text>

      {/* Count or % value beneath the day label */}
      <Text style={[col.valueLabel, isBest && { color }]}>
        {valueLabel}
      </Text>
    </View>
  );
};

const col = StyleSheet.create({
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
    color:      '#aaa',
    fontWeight: '600',
    marginTop:  6,
  },
  valueLabel: {
    fontSize:   10,
    color:      '#ccc',
    fontWeight: '500',
    marginTop:  2,
  },
});

// =============================================================================
// COMPONENT
// =============================================================================

export const DayOfWeekPatternCard: React.FC<DayOfWeekPatternCardProps> = ({
  data,
  color,
}) => {
  // Toggle state is internal — parent does not need to manage it
  const [mode, setMode] = useState<DisplayMode>('count');

  // Peak raw count across all 7 days — used for Count mode bar scaling
  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Best day index changes depending on mode (most completions vs highest rate)
  const best     = bestDayIndex(data, mode);
  const bestName = best >= 0 ? FULL_DAY_NAMES[best] : null;

  return (
    <View style={styles.card}>

      {/* ── Header row: title + Count/% toggle ─────────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>
          {mode === 'count'
            ? 'COMPLETIONS BY DAY OF THE WEEK (ALL TIME)'
            : 'COMPLETION RATE BY DAY OF THE WEEK (ALL TIME)'}
        </Text>

        {/* Count / % toggle pill — same pattern as WeekBarGraph */}
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

      {/* ── 7 day bar columns ───────────────────────────────────────────── */}
      <View style={styles.barsRow}>
        {data.map((item, i) => (
          <DayBar
            key={i}
            item={item}
            maxCount={maxCount}
            color={color}
            isBest={i === best}
            mode={mode}
          />
        ))}
      </View>

      {/* ── Best day footer — label adapts to mode ──────────────────────── */}
      {bestName && (
        <Text style={styles.bestDayLabel}>
          {mode === 'count' ? 'Most completions: ' : 'Highest rate: '}
          <Text style={{ color, fontWeight: '700' }}>{bestName}</Text>
        </Text>
      )}

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

  // Header row holds the title on the left and the toggle on the right
  headerRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   16,
    gap:            10,
  },

  sectionLabel: {
    // flex: 1 so the title wraps naturally and the toggle stays right-aligned
    flex:          1,
    fontSize:      11,
    fontWeight:    '800',
    color:         '#ccc',
    letterSpacing: 1.0,
    lineHeight:    15,
  },

  // Count / % toggle pill — identical styling to WeekBarGraph toggle
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
    marginBottom:  14,
  },

  // Footer label beneath the bars — wording changes with mode
  bestDayLabel: {
    fontSize:   13,
    color:      '#999',
    fontWeight: '500',
    textAlign:  'center',
  },
});
