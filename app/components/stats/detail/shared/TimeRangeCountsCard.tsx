// app/components/stats/detail/shared/TimeRangeCountsCard.tsx
// =============================================================================
// TIME RANGE COUNTS CARD
// =============================================================================
//
// Displays four completion counts stacked vertically, one row per time range.
// Each row has the label on the left and the count on the right.
//
// Visual layout:
//
//   ┌──────────────────────────────────────────┐
//   │  TIMES COMPLETED                         │
//   ├──────────────────────────────────────────┤
//   │  This Week                           12  │
//   ├──────────────────────────────────────────┤
//   │  This Month                          48  │
//   ├──────────────────────────────────────────┤
//   │  This Year                          156  │
//   ├──────────────────────────────────────────┤
//   │  All Time                           620  │
//   └──────────────────────────────────────────┘
//
// The accent color is applied to each count number so each detail screen
// uses its own color consistently (orange for Overall, category color for
// Category, blue for Permanent).
//
// Props:
//   weekCount     - completions in the current Mon–Sun week
//   monthCount    - completions in the current calendar month
//   yearCount     - completions in the current calendar year
//   allTimeCount  - all-time total completions (no date filter)
//   color         - hex accent color for the count numbers
//
// Used by:
//   OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen
//
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// =============================================================================
// TYPES
// =============================================================================

interface TimeRangeCountsCardProps {
  /** Completions this Mon–Sun week */
  weekCount: number;
  /** Completions this calendar month */
  monthCount: number;
  /** Completions this calendar year */
  yearCount: number;
  /** All-time total completions */
  allTimeCount: number;
  /** Hex accent color — applied to count numbers */
  color: string;
}

// =============================================================================
// DATA
// =============================================================================

// Row definitions in display order.
// `label` is the left-side text; counts are mapped by index at render time.
const ROWS = ['This Week', 'This Month', 'This Year', 'All Time'] as const;

// =============================================================================
// SUB-COMPONENT — single count row
// =============================================================================

interface CountRowProps {
  label: string;
  count: number;
  color: string;
  /** Draw a top hairline divider — applied to every row except the first */
  showDivider: boolean;
}

/**
 * One row of the card: label flush-left, count flush-right.
 * A hairline top border separates consecutive rows.
 */
const CountRow: React.FC<CountRowProps> = ({ label, count, color, showDivider }) => (
  <View style={[row.container, showDivider && row.withDivider]}>
    <Text style={row.label}>{label}</Text>
    <Text style={[row.count, { color }]}>{count}</Text>
  </View>
);

const row = StyleSheet.create({
  container: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: 16,
    paddingVertical:   13,
  },
  withDivider: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  label: {
    fontSize:   15,
    color:      '#555',
    fontWeight: '500',
  },
  count: {
    fontSize:   22,
    fontWeight: '800',
    lineHeight: 26,
  },
});

// =============================================================================
// COMPONENT
// =============================================================================

export const TimeRangeCountsCard: React.FC<TimeRangeCountsCardProps> = ({
  weekCount,
  monthCount,
  yearCount,
  allTimeCount,
  color,
}) => {
  const counts = [weekCount, monthCount, yearCount, allTimeCount];

  return (
    <View style={styles.card}>

      {/* ── Section header ────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>TIMES COMPLETED</Text>

      {/* ── Hairline below the header ──────────────────────────────────── */}
      <View style={styles.headerDivider} />

      {/* ── Stacked count rows ────────────────────────────────────────── */}
      {ROWS.map((label, i) => (
        <CountRow
          key={label}
          label={label}
          count={counts[i]}
          color={color}
          showDivider={i > 0}
        />
      ))}

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
    paddingTop:       14,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.07,
    shadowRadius:     8,
    elevation:        3,
    overflow:         'hidden',
  },

  // "TIMES COMPLETED" small-caps section label
  sectionLabel: {
    fontSize:          11,
    fontWeight:        '800',
    color:             '#ccc',
    letterSpacing:     1.1,
    paddingHorizontal: 16,
    marginBottom:      12,
  },

  // Full-width rule between the header and the first row
  headerDivider: {
    height:          1,
    backgroundColor: '#f0f0f0',
  },
});
