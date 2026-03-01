// app/components/stats/detail/shared/TaskTypeBreakdownCard.tsx
// =============================================================================
// TASK TYPE BREAKDOWN CARD
// =============================================================================
//
// Shows the split between Permanent tasks and One-off tasks for a given scope.
// Answers: "Of all the tasks counted here, how many are recurring habits vs
// one-time items?"
//
// Visual layout:
//
//   ┌────────────────────────────────────────────────┐
//   │  🔁 Permanent         📝 One-off               │
//   │     60%  94              40%  62               │
//   │  ████████████░░░░░░░░  (horizontal split bar)   │
//   └────────────────────────────────────────────────┘
//
// The split bar beneath the two columns visualises the ratio graphically.
// The permanent side uses a green accent (`#34C759`) and the one-off side
// uses a blue accent (`#007AFF`) — these are fixed semantic colors, not the
// screen's accent color (which belongs to the filter type, not the task type).
//
// Props:
//   permanentCount   - number of permanent task completions in scope
//   oneOffCount      - number of one-off task completions in scope
//   color            - screen accent color (used for the card border/highlight)
//
// Note on colors:
//   The task-type colors (green / blue) are intentionally hardcoded here
//   because they represent task types globally across the app, not a
//   category or screen-level concept.
//
// Used by:
//   OverallDetailScreen, CategoryDetailScreen
//   (Not used on PermanentDetailScreen — permanent tasks have only one type.)
//
// =============================================================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { safePct } from '../../../../core/utils/statUtils';
import { useTheme } from '../../../../theme/ThemeContext';
import type { AppTheme } from '../../../../theme/tokens';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Accent color for the permanent task column — matches TodayCard */
const COLOR_PERMANENT = '#34C759';

/** Accent color for the one-off task column — matches TodayCard */
const COLOR_ONE_OFF = '#007AFF';

// =============================================================================
// TYPES
// =============================================================================

interface TaskTypeBreakdownCardProps {
  /** Number of permanent task completions within this screen's scope */
  permanentCount: number;
  /** Number of one-off task completions within this screen's scope */
  oneOffCount: number;
  /**
   * Screen-level accent color — used for the card's left border accent
   * to visually tie this card to the rest of the detail screen.
   */
  color: string;
}

// =============================================================================
// SUB-COMPONENT — single type column
// =============================================================================

interface TypeColumnProps {
  emoji:   string;
  label:   string;
  count:   number;
  percent: number;
  color:   string;
}

/**
 * One half of the breakdown — an emoji, label, percentage, and count.
 * Mirrors the visual structure of TypeMiniCard in TodayCard but without
 * the per-type progress bar (the shared bar below replaces that).
 */
const TypeColumn: React.FC<TypeColumnProps> = ({ emoji, label, count, percent, color }) => {
  const { theme } = useTheme();
  const colStyles = useMemo(() => makeColStyles(theme), [theme]);

  return (
    <View style={colStyles.container}>
      {/* Emoji + label row */}
      <View style={colStyles.topRow}>
        <Text style={colStyles.emoji}>{emoji}</Text>
        <Text style={colStyles.label}>{label}</Text>
      </View>

      {/* Large percentage — primary figure */}
      <Text style={[colStyles.percent, { color }]}>{percent}%</Text>

      {/* Raw count — secondary figure */}
      <Text style={colStyles.count}>{count} tasks</Text>
    </View>
  );
};

// =============================================================================
// COMPONENT
// =============================================================================

export const TaskTypeBreakdownCard: React.FC<TaskTypeBreakdownCardProps> = ({
  permanentCount,
  oneOffCount,
  color,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const total = permanentCount + oneOffCount;

  // Compute each type's percentage of the total (not of its own scheduled tasks)
  const permanentPct = safePct(permanentCount, total);
  const oneOffPct    = safePct(oneOffCount, total);

  // The split bar fill width as a fraction 0–1
  const permanentFraction = total > 0 ? permanentCount / total : 0.5;

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      {/* ── Two columns ─────────────────────────────────────────────────── */}
      <View style={styles.columnsRow}>
        <TypeColumn
          emoji="🔁"
          label="Permanent"
          count={permanentCount}
          percent={permanentPct}
          color={COLOR_PERMANENT}
        />

        {/* Vertical divider between the two columns */}
        <View style={styles.divider} />

        <TypeColumn
          emoji="📝"
          label="One-off"
          count={oneOffCount}
          percent={oneOffPct}
          color={COLOR_ONE_OFF}
        />
      </View>

      {/* ── Split bar: green left (permanent) | blue right (one-off) ────── */}
      {total > 0 && (
        <View style={styles.splitBarTrack}>
          {/* Permanent side — grows from left */}
          <View
            style={[
              styles.splitBarSegment,
              {
                flex:            permanentFraction,
                backgroundColor: COLOR_PERMANENT,
                borderTopLeftRadius:    4,
                borderBottomLeftRadius: 4,
              },
            ]}
          />
          {/* One-off side — grows from right */}
          <View
            style={[
              styles.splitBarSegment,
              {
                flex:             1 - permanentFraction,
                backgroundColor:  COLOR_ONE_OFF,
                borderTopRightRadius:    4,
                borderBottomRightRadius: 4,
              },
            ]}
          />
        </View>
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
      gap:        4,
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
      color:      theme.textTertiary,
      fontWeight: '600',
    },
    percent: {
      fontSize:   28,
      fontWeight: '800',
      lineHeight: 32,
    },
    count: {
      fontSize:   12,
      color:      theme.textDisabled,
      fontWeight: '500',
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
      // Left border ties this card to the screen's accent color
      borderLeftWidth:  4,
    },

    columnsRow: {
      flexDirection: 'row',
      alignItems:    'center',
      marginBottom:  16,
    },

    divider: {
      width:           1,
      height:          56,
      backgroundColor: theme.separator,
      marginHorizontal: 8,
    },

    // Track background for the split bar
    splitBarTrack: {
      flexDirection:   'row',
      height:          8,
      borderRadius:    4,
      backgroundColor: theme.separator,
      overflow:        'hidden',
    },

    splitBarSegment: {
      height: 8,
    },
  });
}
