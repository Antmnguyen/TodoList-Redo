// app/components/stats/detail/overall/CategoryBreakdownCard.tsx
// =============================================================================
// CATEGORY BREAKDOWN CARD
// =============================================================================
//
// Horizontal bar list showing the top 5 categories by total completions.
// Each row: colored dot · name · proportional fill bar · raw count · rate %
//
// Bar width scales relative to the top category — peak category always
// fills the full bar track; others are proportional to their count.
//
// Visual:
//
//   BY CATEGORY
//   ● Work       ████████░░  64   85%
//   ● Health     █████░░░░░  38   70%
//   ● Lifestyle  ████░░░░░░  31   65%
//
// Props:
//   categories  - up to 5 CategoryBreakdownItem entries, sorted desc by count
//   color       - accent for the section label (screen's accent color)
//
// Used by:
//   OverallDetailScreen only
//
// =============================================================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../../theme/ThemeContext';
import type { AppTheme } from '../../../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface CategoryBreakdownItem {
  name:    string;
  color:   string;
  count:   number;
  percent: number;  // completion rate 0–100 for this category
}

interface CategoryBreakdownCardProps {
  categories: CategoryBreakdownItem[];
  /** Screen accent color — used for the section label */
  color:      string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CategoryBreakdownCard: React.FC<CategoryBreakdownCardProps> = ({
  categories,
  color,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const peak = Math.max(...categories.map(c => c.count), 1);

  return (
    <View style={styles.card}>

      {/* Section label */}
      <Text style={[styles.sectionLabel, { color }]}>BY CATEGORY</Text>

      {/* One row per category */}
      {categories.map((item, i) => {
        const fillPct = Math.round((item.count / peak) * 100);

        return (
          <View key={i} style={styles.row}>

            {/* Colored category dot */}
            <View style={[styles.dot, { backgroundColor: item.color }]} />

            {/* Category name — fixed width so bars stay aligned */}
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>

            {/* Proportional fill bar */}
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width:           `${fillPct}%`,
                    backgroundColor: item.color,
                  },
                ]}
              />
            </View>

            {/* Raw completion count */}
            <Text style={styles.count}>{item.count}</Text>

            {/* Completion rate % */}
            <Text style={[styles.pct, { color: item.color }]}>{item.percent}%</Text>

          </View>
        );
      })}

    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

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
    },

    sectionLabel: {
      fontSize:      11,
      fontWeight:    '800',
      letterSpacing: 1.1,
      marginBottom:  16,
    },

    row: {
      flexDirection: 'row',
      alignItems:    'center',
      marginBottom:  10,
      gap:           8,
    },

    // Colored category indicator dot
    dot: {
      width:        8,
      height:       8,
      borderRadius: 4,
      flexShrink:   0,
    },

    // Fixed-width name so bars stay aligned across rows
    name: {
      width:      80,
      fontSize:   13,
      fontWeight: '600',
      color:      theme.textSecondary,
      flexShrink: 0,
    },

    // Bar track fills remaining horizontal space
    barTrack: {
      flex:            1,
      height:          8,
      borderRadius:    4,
      backgroundColor: theme.separator,
      overflow:        'hidden',
    },

    barFill: {
      height:       8,
      borderRadius: 4,
    },

    // Raw count — right of the bar
    count: {
      width:      32,
      fontSize:   12,
      fontWeight: '600',
      color:      theme.textTertiary,
      textAlign:  'right',
      flexShrink: 0,
    },

    // Completion rate — rightmost column
    pct: {
      width:      36,
      fontSize:   12,
      fontWeight: '700',
      textAlign:  'right',
      flexShrink: 0,
    },
  });
}
