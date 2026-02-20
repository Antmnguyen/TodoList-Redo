// app/components/stats/detail/shared/StreakCard.tsx
// =============================================================================
// STREAK CARD
// =============================================================================
//
// Shows the user's current streak and all-time best streak side by side.
// Used on all three detail screen types (Overall, Category, Permanent).
//
// Visual layout:
//
//   ┌─────────────────┐  ┌─────────────────┐
//   │  🔥 Current     │  │  🏆 Best        │
//   │     12 days     │  │     34 days     │
//   └─────────────────┘  └─────────────────┘
//
// Both pills sit inside a single card row with equal flex width.
// The accent color is applied to the day count for visual consistency
// with the rest of the detail screen.
//
// Edge cases:
//   - currentStreak = 0  →  shows "0 days" (no active streak)
//   - bestStreak    = 0  →  shows "0 days" (never had a streak)
//   These are valid display states — no special treatment needed.
//
// Props:
//   currentStreak  - consecutive days with ≥1 completion ending today
//   bestStreak     - longest-ever consecutive run (all time)
//   color          - accent color (hex) — applied to the day count number
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

interface StreakCardProps {
  /** Consecutive days ending today that have ≥1 completion */
  currentStreak: number;
  /** Longest ever consecutive day run (all time) */
  bestStreak: number;
  /** Hex accent color — applied to the day count numbers */
  color: string;
}

// =============================================================================
// SUB-COMPONENT — single streak pill
// =============================================================================

interface StreakPillProps {
  emoji: string;
  label: string;
  days:  number;
  color: string;
}

/**
 * One half of the streak card — an emoji icon, a label, and the day count.
 * Used twice: once for current streak and once for best streak.
 */
const StreakPill: React.FC<StreakPillProps> = ({ emoji, label, days, color }) => (
  <View style={pill.box}>
    <View style={pill.topRow}>
      <Text style={pill.emoji}>{emoji}</Text>
      <Text style={pill.label}>{label}</Text>
    </View>

    <View style={pill.countRow}>
      <Text style={[pill.count, { color }]}>{days}</Text>
      <Text style={pill.unit}> days</Text>
    </View>
  </View>
);

const pill = StyleSheet.create({
  box: {
    flex:            1,
    backgroundColor: '#fafafa',
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     '#f0f0f0',
    padding:         14,
    gap:             6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  emoji: {
    fontSize: 18,
  },
  label: {
    fontSize:   13,
    color:      '#999',
    fontWeight: '600',
  },
  countRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
  },
  count: {
    fontSize:   28,
    fontWeight: '800',
    lineHeight: 32,
  },
  unit: {
    fontSize:   14,
    color:      '#aaa',
    fontWeight: '500',
  },
});

// =============================================================================
// COMPONENT
// =============================================================================

export const StreakCard: React.FC<StreakCardProps> = ({ currentStreak, bestStreak, color }) => (
  <View style={styles.card}>
    <StreakPill
      emoji="🔥"
      label="Current Streak!"
      days={currentStreak}
      color={color}
    />

    {/* Gap between the two pills */}
    <View style={{ width: 10 }} />

    <StreakPill
      emoji="🏆"
      label="Best"
      days={bestStreak}
      color={color}
    />
  </View>
);

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  card: {
    flexDirection:    'row',
    marginHorizontal: 16,
    marginBottom:     12,
  },
});
