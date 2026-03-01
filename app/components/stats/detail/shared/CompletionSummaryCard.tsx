// app/components/stats/detail/shared/CompletionSummaryCard.tsx
// =============================================================================
// COMPLETION SUMMARY CARD
// =============================================================================
//
// Displays the overall completion rate for a stat detail screen.
// Sits directly below the DetailHeader on all three detail screen types.
//
// Visual layout:
//
//   ┌──────────────────────────────────────────┐
//   │                                          │
//   │   [ (78%) ]    156 completed             │
//   │                156 / 200 total           │
//   │                                          │
//   └──────────────────────────────────────────┘
//
// The ring is a CircularProgress (size 90) using the stat's accent color.
// The % is centered inside the ring to reduce textual redundancy.
//
// Props:
//   completed  - number of completions (numerator)
//   total      - number of total possible completions (denominator)
//   color      - accent color (hex) — drives ring fill and % text
//
// Calculation:
//   rate = safePct(completed, total) — rounds to nearest integer, 0 if total = 0
//
// Used by:
//   OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen
//
// =============================================================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CircularProgress } from '../../CircularProgress';
import { safePct } from '../../../../core/utils/statUtils';
import { useTheme } from '../../../../theme/ThemeContext';
import type { AppTheme } from '../../../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

interface CompletionSummaryCardProps {
  /** Number of tasks / occurrences actually completed */
  completed: number;
  /** Total tasks / occurrences that could have been completed */
  total: number;
  /** Accent hex color — used for the ring arc and main count number */
  color: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CompletionSummaryCard: React.FC<CompletionSummaryCardProps> = ({
  completed,
  total,
  color,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const rate = safePct(completed, total);

  return (
    <View style={styles.card}>
      {/* ── Circular ring showing completion % (Centered overlay) ────────── */}
      <View style={styles.ringWrapper}>
        <CircularProgress
          percent={rate}
          size={90}
          color={color}
          trackWidth={6}
        />
        <View style={styles.percentageOverlay}>
          <Text style={styles.innerPercentText}>{rate}%</Text>
        </View>
      </View>

      {/* ── Right-side text block ────────────────────────────────────────── */}
      <View style={styles.textBlock}>
        {/* Raw completion count — primary stat */}
        <View style={styles.countRow}>
          <Text style={[styles.countNum, { color }]}>{completed}</Text>
          <Text style={styles.countLabel}> completed</Text>
        </View>

        {/* Show denominator only when meaningful (total > 0) */}
        {total > 0 && (
          <Text style={styles.totalText}>{completed} / {total} total</Text>
        )}
      </View>
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.bgCard,
      borderRadius: 20,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 24,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },

    ringWrapper: {
      width: 90,
      height: 90,
      justifyContent: 'center',
      alignItems: 'center',
    },

    percentageOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },

    innerPercentText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
    },

    textBlock: {
      flex: 1,
      marginLeft: 20,
      justifyContent: 'center',
    },

    countRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },

    // Large number — most prominent piece of information
    countNum: {
      fontSize: 36,
      fontWeight: '800',
      letterSpacing: -1,
    },

    countLabel: {
      fontSize: 16,
      color: theme.textSecondary,
      fontWeight: '500',
    },

    // "156 / 200 total" — de-emphasised helper text
    totalText: {
      fontSize: 13,
      color: theme.textTertiary,
      fontWeight: '400',
      marginTop: 2,
    },
  });
}
