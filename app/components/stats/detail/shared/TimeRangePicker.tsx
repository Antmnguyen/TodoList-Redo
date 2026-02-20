// app/components/stats/detail/shared/TimeRangePicker.tsx
// =============================================================================
// TIME RANGE PICKER
// =============================================================================
//
// A horizontal pill-tab strip that lets the user scope all stats on the
// OverallDetailScreen to a specific time window.
//
// Visual layout:
//
//   ┌───────────────────────────────────────────────────────┐
//   │  [ Week ]   [ Month ]   [ Year ]   [ All Time ]      │
//   │    ─────  ← active tab gets filled pill background   │
//   └───────────────────────────────────────────────────────┘
//
// Behaviour:
//   - Fully controlled component — parent owns and updates `selected`.
//   - Tapping any tab fires `onChange(tab.value)` immediately.
//   - Active tab gets a solid colored pill; inactive tabs are transparent.
//   - All four tabs share equal width inside the strip.
//
// Props:
//   selected  - currently active TimeRange (controlled by parent screen)
//   onChange  - called with the new TimeRange when the user taps a tab
//   color     - hex accent color used for the active pill background
//
// Export:
//   TimeRange type is also exported so screens and callers can use it
//   without importing from multiple places.
//
// Used by:
//   OverallDetailScreen
//
// =============================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// =============================================================================
// TYPES
// =============================================================================

/**
 * The four time windows available across all detail screens.
 * 'week'  → current Mon–Sun week
 * 'month' → current calendar month
 * 'year'  → current calendar year
 * 'all'   → no date filter (all time)
 */
export type TimeRange = 'week' | 'month' | 'year' | 'all';

interface TimeRangePickerProps {
  /** Currently active tab (controlled — parent manages state) */
  selected: TimeRange;
  /** Fired immediately when the user taps a different tab */
  onChange: (range: TimeRange) => void;
  /** Hex accent color for the active pill background */
  color: string;
}

// =============================================================================
// DATA
// =============================================================================

/**
 * Static tab definitions ordered left-to-right as they appear in the strip.
 * `value` is the TimeRange key forwarded to `onChange`.
 * `label` is the human-readable text rendered on screen.
 */
const TABS: { value: TimeRange; label: string }[] = [
  { value: 'week',  label: 'Week'     },
  { value: 'month', label: 'Month'    },
  { value: 'year',  label: 'Year'     },
  { value: 'all',   label: 'All Time' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  selected,
  onChange,
  color,
}) => (
  <View style={styles.container}>
    <View style={styles.strip}>
      {TABS.map((tab) => {
        const isActive = tab.value === selected;
        return (
          <TouchableOpacity
            key={tab.value}
            style={[styles.tab, isActive && { backgroundColor: color }]}
            onPress={() => onChange(tab.value)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.tabLabel,
                isActive ? styles.labelActive : styles.labelInactive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom:     14,
  },

  // Outer track — grey pill that contains all tabs
  strip: {
    flexDirection:   'row',
    backgroundColor: '#f2f2f2',
    borderRadius:    12,
    padding:         3,
    gap:             2,
  },

  // Individual tab button — equal flex so all four share the strip width
  tab: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: 8,
    borderRadius:    10,
  },

  tabLabel: {
    fontSize:   13,
    fontWeight: '600',
  },

  // Active tab: white text for legibility on colored pill
  labelActive: {
    color: '#fff',
  },

  // Inactive tab: muted grey
  labelInactive: {
    color: '#999',
  },
});
