// app/components/stats/WeeklyMiniChart.tsx
// =============================================================================
// WEEKLY MINI BAR CHART
// =============================================================================
//
// 7 bars representing Mon–Sun completion percentages.
// Bar height scales with percent (0 = tiny grey stub, 100 = full height).
// Day labels sit below each bar.
//
// Props:
//   data      - exactly 7 items [ { day: 'M', percent: 0–100 }, ... ]
//   color     - accent color for filled bars
//   maxHeight - maximum bar height in px (default 28)
//   barWidth  - individual bar width in px (default 13)
//
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// =============================================================================
// TYPES
// =============================================================================

export interface DayData {
  day: string;    // single character label: 'M', 'T', 'W', 'T', 'F', 'S', 'S'
  count: number;  // raw number of completions that day
  total?: number; // tasks scheduled that day — optional; used by WeekBarGraph for
                  // true per-day completion rate in % mode. WeeklyMiniChart ignores it.
}

interface WeeklyMiniChartProps {
  data: DayData[];
  color?: string;
  maxHeight?: number;
  barWidth?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const WeeklyMiniChart: React.FC<WeeklyMiniChartProps> = ({
  data,
  color = '#FF9500',
  maxHeight = 28,
  barWidth = 13,
}) => {
  const maxCount = Math.max(...data.map(d => d.count), 1); // avoid divide-by-zero

  return (
    <View style={styles.container}>
      {/* Bars */}
      <View style={[styles.barsRow, { height: maxHeight }]}>
        {data.map((item, i) => {
          const hasActivity = item.count > 0;
          const barHeight = hasActivity
            ? Math.max((item.count / maxCount) * maxHeight, 4)
            : 3;

          return (
            <View
              key={i}
              style={[styles.barWrapper, { width: barWidth, height: maxHeight }]}
            >
              <View
                style={{
                  width: barWidth,
                  height: barHeight,
                  borderRadius: 3,
                  backgroundColor: hasActivity ? color : '#e0e0e0',
                }}
              />
            </View>
          );
        })}
      </View>

      {/* Day labels */}
      <View style={styles.labelsRow}>
        {data.map((item, i) => (
          <Text
            key={i}
            style={[styles.dayLabel, { width: barWidth }]}
          >
            {item.day}
          </Text>
        ))}
      </View>
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barWrapper: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dayLabel: {
    fontSize: 9,
    color: '#aaa',
    textAlign: 'center',
    fontWeight: '500',
  },
});
