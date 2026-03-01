// app/components/stats/detail/shared/TimeRangeCountsCard.tsx
// =============================================================================
// TIME RANGE COUNTS CARD
// =============================================================================
//
// Displays four completion counts, one row per time range (Week/Month/Year/All).
//
// ── Simple mode (PermanentDetailScreen — no breakdown) ────────────────────────
//
//   TIMES COMPLETED
//   ─────────────────────────────────────────
//   This Week                             12
//   This Month                            48
//   This Year                            156
//   All Time                             620
//
// ── Breakdown mode (Overall + Category — breakdown prop present) ───────────────
//
//   TIMES COMPLETED
//                        Perm    One-off   Total
//   ─────────────────────────────────────────────
//   This Week              8         4      12
//   This Month            30        18      48
//   This Year             94        62     156
//   All Time             380       240     620
//
// Props:
//   weekCount / monthCount / yearCount / allTimeCount — total per range
//   color      — accent for total column (and section label)
//   breakdown  — optional; when present switches to 4-column layout
//
// Used by:
//   OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen
//
// =============================================================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../../theme/ThemeContext';
import type { AppTheme } from '../../../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface CountBreakdown {
  perm:  number;
  oneOff: number;
}

export interface TimeRangeBreakdown {
  week:    CountBreakdown;
  month:   CountBreakdown;
  year:    CountBreakdown;
  allTime: CountBreakdown;
}

interface TimeRangeCountsCardProps {
  weekCount:    number;
  monthCount:   number;
  yearCount:    number;
  allTimeCount: number;
  /** Hex accent color — applied to total column and section label */
  color:        string;
  /**
   * Optional perm / one-off breakdown per time range.
   * When present the card switches to the 4-column table layout.
   * Omit for PermanentDetailScreen — keeps the existing 2-column layout.
   */
  breakdown?:   TimeRangeBreakdown;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COLOR_PERM   = '#34C759';
const COLOR_ONEOFF = '#007AFF';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// ── Simple row (no breakdown) ─────────────────────────────────────────────────

interface SimpleRowProps {
  label:       string;
  count:       number;
  color:       string;
  showDivider: boolean;
  rowStyles:   ReturnType<typeof makeRowStyles>;
}

const SimpleRow: React.FC<SimpleRowProps> = ({ label, count, color, showDivider, rowStyles }) => (
  <View style={[rowStyles.container, showDivider && rowStyles.withDivider]}>
    <Text style={rowStyles.label}>{label}</Text>
    <Text style={[rowStyles.simpleCount, { color }]}>{count}</Text>
  </View>
);

// ── Breakdown row (4 columns) ─────────────────────────────────────────────────

interface BreakdownRowProps {
  label:       string;
  perm:        number;
  oneOff:      number;
  total:       number;
  color:       string;
  showDivider: boolean;
  rowStyles:   ReturnType<typeof makeRowStyles>;
}

const BreakdownRow: React.FC<BreakdownRowProps> = ({
  label, perm, oneOff, total, color, showDivider, rowStyles,
}) => (
  <View style={[rowStyles.container, showDivider && rowStyles.withDivider]}>
    <Text style={rowStyles.label}>{label}</Text>
    <Text style={[rowStyles.bdCount, { color: COLOR_PERM }]}>{perm}</Text>
    <Text style={[rowStyles.bdCount, { color: COLOR_ONEOFF }]}>{oneOff}</Text>
    <Text style={[rowStyles.bdCount, { color }]}>{total}</Text>
  </View>
);

// ── Column header row (breakdown mode only) ───────────────────────────────────

interface ColHeaderProps {
  color:     string;
  rowStyles: ReturnType<typeof makeRowStyles>;
}

const ColHeader: React.FC<ColHeaderProps> = ({ color, rowStyles }) => (
  <View style={rowStyles.container}>
    <View style={{ flex: 1 }} />
    <Text style={[rowStyles.colHeader, { color: COLOR_PERM }]}>Perm</Text>
    <Text style={[rowStyles.colHeader, { color: COLOR_ONEOFF }]}>One-off</Text>
    <Text style={[rowStyles.colHeader, { color }]}>Total</Text>
  </View>
);

// =============================================================================
// COMPONENT
// =============================================================================

export const TimeRangeCountsCard: React.FC<TimeRangeCountsCardProps> = ({
  weekCount,
  monthCount,
  yearCount,
  allTimeCount,
  color,
  breakdown,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const rowStyles = useMemo(() => makeRowStyles(theme), [theme]);

  const totals = [weekCount, monthCount, yearCount, allTimeCount];
  const labels = ['This Week', 'This Month', 'This Year', 'All Time'];
  const bds    = breakdown
    ? [breakdown.week, breakdown.month, breakdown.year, breakdown.allTime]
    : null;

  return (
    <View style={styles.card}>

      {/* Section label */}
      <Text style={styles.sectionLabel}>TIMES COMPLETED</Text>

      {/* Column headers — only in breakdown mode */}
      {bds && <ColHeader color={color} rowStyles={rowStyles} />}

      {/* Hairline separating header area from rows */}
      <View style={styles.headerDivider} />

      {/* Data rows */}
      {labels.map((label, i) =>
        bds ? (
          <BreakdownRow
            key={label}
            label={label}
            perm={bds[i].perm}
            oneOff={bds[i].oneOff}
            total={totals[i]}
            color={color}
            showDivider={i > 0}
            rowStyles={rowStyles}
          />
        ) : (
          <SimpleRow
            key={label}
            label={label}
            count={totals[i]}
            color={color}
            showDivider={i > 0}
            rowStyles={rowStyles}
          />
        )
      )}

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
      paddingTop:       14,
      shadowColor:      '#000',
      shadowOffset:     { width: 0, height: 2 },
      shadowOpacity:    0.07,
      shadowRadius:     8,
      elevation:        3,
      overflow:         'hidden',
    },
    sectionLabel: {
      fontSize:          11,
      fontWeight:        '800',
      color:             theme.textDisabled,
      letterSpacing:     1.1,
      paddingHorizontal: 16,
      marginBottom:      4,
    },
    headerDivider: {
      height:          1,
      backgroundColor: theme.separator,
    },
  });
}

function makeRowStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flexDirection:    'row',
      alignItems:       'center',
      paddingHorizontal: 16,
      paddingVertical:   12,
    },
    withDivider: {
      borderTopWidth: 1,
      borderTopColor: theme.separator,
    },
    label: {
      flex:       1,
      fontSize:   14,
      color:      theme.textSecondary,
      fontWeight: '500',
    },
    simpleCount: {
      fontSize:   22,
      fontWeight: '800',
      lineHeight: 26,
    },
    bdCount: {
      width:      52,
      fontSize:   17,
      fontWeight: '700',
      textAlign:  'right',
    },
    colHeader: {
      width:         52,
      fontSize:      10,
      fontWeight:    '700',
      textAlign:     'right',
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
  });
}
