// app/components/stats/detail/shared/WeekNavigator.tsx
// =============================================================================
// WEEK NAVIGATOR
// =============================================================================
//
// A prev/next control that lets the user browse through past weeks on the
// OverallDetailScreen's Week tab. Shows the currently viewed week's date
// range in the center.
//
// Visual layout:
//
//   ┌──────────────────────────────────────────────┐
//   │   ‹     Feb 10 – Feb 16, 2026     ›         │
//   │  (prev)      (date label)        (next)      │
//   └──────────────────────────────────────────────┘
//
// Arrow behaviour:
//   - ‹ (prev) is always enabled. The parent is responsible for capping
//     navigation at the earliest date that has any recorded data.
//   - › (next) is DISABLED when `isCurrentWeek` is true (can't browse
//     into the future). It renders at reduced opacity to signal this.
//
// Date label format:
//   "Feb 10 – Feb 16, 2026" for non-same-month weeks.
//   If start and end fall in the same month the year only appears once at
//   the end: "Feb 3 – Feb 9, 2026".
//   The label is computed from `weekStart` — the caller provides a Monday
//   Date and this component derives the Sunday by adding 6 days.
//
// Props:
//   weekStart     - Date object representing Monday of the displayed week
//   onPrev        - callback to move one week back (parent updates weekStart)
//   onNext        - callback to move one week forward
//   isCurrentWeek - true when weekStart is this week's Monday; disables ›
//
// Used by:
//   OverallDetailScreen (Week tab only — hidden on Month / Year / All tabs)
//
// =============================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// =============================================================================
// TYPES
// =============================================================================

interface WeekNavigatorProps {
  /** Monday Date of the currently displayed week */
  weekStart: Date;
  /** Move one week earlier — parent decrements weekStart by 7 days */
  onPrev: () => void;
  /** Move one week later — parent increments weekStart by 7 days */
  onNext: () => void;
  /** Set to true when weekStart is the current real week; disables the › arrow */
  isCurrentWeek: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Builds the human-readable week range label from a Monday start date.
 *
 * Examples:
 *   Feb 10 – Feb 16, 2026   (typical week)
 *   Jan 27 – Feb 2, 2026    (month-crossing week)
 */
function formatWeekRange(monday: Date): string {
  // Derive Sunday by cloning and adding 6 days (avoids mutating the prop)
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const startMonth = MONTHS_SHORT[monday.getMonth()];
  const endMonth   = MONTHS_SHORT[sunday.getMonth()];
  const endYear    = sunday.getFullYear();

  return `${startMonth} ${monday.getDate()} – ${endMonth} ${sunday.getDate()}, ${endYear}`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const WeekNavigator: React.FC<WeekNavigatorProps> = ({
  weekStart,
  onPrev,
  onNext,
  isCurrentWeek,
}) => {
  const label = formatWeekRange(weekStart);

  return (
    <View style={styles.container}>
      {/* ‹ Previous week button — always enabled */}
      <TouchableOpacity
        onPress={onPrev}
        style={styles.arrow}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.6}
      >
        <Text style={styles.arrowText}>‹</Text>
      </TouchableOpacity>

      {/* Week range label */}
      <Text style={styles.label}>{label}</Text>

      {/* › Next week button — disabled on current week */}
      <TouchableOpacity
        onPress={onNext}
        style={[styles.arrow, isCurrentWeek && styles.arrowDisabled]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={isCurrentWeek ? 1 : 0.6}
        disabled={isCurrentWeek}
      >
        <Text style={[styles.arrowText, isCurrentWeek && styles.arrowTextDisabled]}>›</Text>
      </TouchableOpacity>
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    marginHorizontal: 16,
    marginBottom:     12,
    paddingVertical:  10,
    paddingHorizontal: 14,
    backgroundColor:  '#fafafa',
    borderRadius:     14,
    borderWidth:      1,
    borderColor:      '#f0f0f0',
  },

  arrow: {
    padding: 4,
  },

  // Visually dim the next arrow when browsing the current week
  arrowDisabled: {
    opacity: 0.25,
  },

  arrowText: {
    fontSize:   26,
    color:      '#555',
    fontWeight: '400',
    lineHeight: 30,
  },

  arrowTextDisabled: {
    color: '#bbb',
  },

  label: {
    flex:       1,
    textAlign:  'center',
    fontSize:   14,
    fontWeight: '600',
    color:      '#333',
  },
});
