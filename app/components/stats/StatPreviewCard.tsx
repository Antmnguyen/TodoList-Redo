// app/components/stats/StatPreviewCard.tsx
// =============================================================================
// STAT PREVIEW CARD
// =============================================================================
//
// Tappable card showing a summary of stats for one entity:
//   - All Tasks, a permanent task template, or a category
//
// Layout:
//   ┌───────────────────────────────────────┐
//   │  [Circle]  Name              🔥 streak │
//   │   78%      156 completed               │
//   │                                        │
//   │  [M][T][W][T][F][S][S]  ← mini chart  │
//   └───────────────────────────────────────┘
//
// Exports StatPreviewData so StatsScreen can import the type.
//
// =============================================================================

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { CircularProgress } from './CircularProgress';
import { WeeklyMiniChart, DayData } from './WeeklyMiniChart';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// =============================================================================
// TYPES  (exported — StatsScreen imports these)
// =============================================================================

export type StatType = 'all' | 'template' | 'category';

export interface StatPreviewData {
  type: StatType;
  id: string;            // 'all' | templateId | categoryId
  name: string;          // display label
  totalCompleted: number;
  completionPercent: number; // 0–100
  currentStreak: number;
  weeklyData: DayData[];     // exactly 7 items, Mon–Sun
  color: string;             // accent color for ring + bars
  blank?: boolean;           // if true, renders an empty placeholder card
}

interface StatPreviewCardProps {
  data: StatPreviewData;
  onPress: (data: StatPreviewData) => void;
  style?: StyleProp<ViewStyle>;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const StatPreviewCard: React.FC<StatPreviewCardProps> = ({
  data,
  onPress,
  style,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={() => onPress(data)}
      activeOpacity={0.75}
    >
      {/* ── Top row ──────────────────────────────────────────────────── */}
      <View style={styles.topRow}>

        {/* Left: circular progress ring */}
        <CircularProgress
          percent={data.completionPercent}
          size={64}
          color={data.color}
          trackWidth={7}
        />

        {/* Center: name + completion count */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{data.name}</Text>
          <Text style={styles.count}>
            {data.totalCompleted} completed
          </Text>
        </View>

        {/* Right: streak badge */}
        <View style={styles.streakBadge}>
          <Text style={styles.streakFire}>🔥</Text>
          <Text style={[styles.streakNumber, { color: data.color }]}>
            {data.currentStreak}
          </Text>
        </View>

      </View>

      {/* ── Divider ──────────────────────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── Bottom: weekly mini chart ─────────────────────────────────── */}
      <WeeklyMiniChart
        data={data.weeklyData}
        color={data.color}
        maxHeight={28}
      />

    </TouchableOpacity>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.bgCard,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 14,
      // Shadow
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      elevation: 3,
    },

    // Top row
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    info: {
      flex: 1,
      marginLeft: 14,
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 3,
    },
    count: {
      fontSize: 13,
      color: theme.textTertiary,
      fontWeight: '400',
    },

    // Streak badge
    streakBadge: {
      alignItems: 'center',
      marginLeft: 12,
    },
    streakFire: {
      fontSize: 18,
    },
    streakNumber: {
      fontSize: 16,
      fontWeight: '800',
      marginTop: 1,
    },

    // Divider
    divider: {
      height: 1,
      backgroundColor: theme.separator,
      marginBottom: 12,
    },
  });
}
