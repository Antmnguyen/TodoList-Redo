// app/components/stats/detail/overall/CategoryYearOverviewGraph.tsx
// =============================================================================
// CATEGORY YEAR OVERVIEW GRAPH
// =============================================================================
//
// 12 vertical bars (Jan–Dec) where each bar is stacked and coloured by category.
// No % toggle — bars always show raw completion counts.
//
// Visual layout:
//
//   ‹  2026  ›
//   YEAR BY CATEGORY
//
//   ██  █  ▄  ██  ▄  ██  ██  _  _  _  _  _
//    J  F  M   A  M   J   J  A  S  O  N  D    ← future months dimmed
//   40  30 22  38 25  41  38  –  –  –  –  –   ← total count
//
//   ● Work  ● Health  ● Lifestyle  ...         ← colour legend
//
// Navigation: same ‹ / › year nav as YearOverviewGraph.
//   - Past years show seeded solid bars (no category breakdown available).
//   - Current year shows full stacked category segments.
//   - Future months within the current year are rendered at 30% opacity.
//
// Used by:
//   OverallDetailScreen
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CategorySegment } from './CategoryWeekBarGraph';
import { useTheme } from '../../../../theme/ThemeContext';
import type { AppTheme } from '../../../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface CategoryMonthData {
  /** 0-indexed month number (January = 0, December = 11) */
  month:    number;
  /** Category breakdown — empty array for future months */
  segments: CategorySegment[];
}

interface CategoryYearOverviewGraphProps {
  /**
   * Exactly 12 CategoryMonthData items in Jan → Dec order for the current year.
   * Future months should have an empty segments array.
   */
  data:          CategoryMonthData[];
  /** Hex accent color — used for section label, nav arrows, and past-year bars */
  color:         string;
  /** Optional year to open on (defaults to current calendar year) */
  initialYear?:  number;
  /** Fired when the user navigates to a different year */
  onYearChange?: (year: number) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BAR_MAX_HEIGHT = 72;
const BAR_MIN_HEIGHT = 4;
const BAR_WIDTH      = 14;

const MONTH_INITIALS = ['J','F','M','A','M','J','J','A','S','O','N','D'];

// =============================================================================
// SUB-COMPONENT — single month bar column
// =============================================================================

interface MonthBarProps {
  item:     CategoryMonthData;
  total:    number;
  maxTotal: number;
  color:    string;
  isFuture: boolean;
  segments: CategorySegment[];
}

const MonthBar: React.FC<MonthBarProps> = ({
  item, total, maxTotal, color, isFuture, segments,
}) => {
  const { theme } = useTheme();
  const colStyles = useMemo(() => makeColStyles(theme), [theme]);
  const hasActivity = total > 0;

  return (
    <View style={[colStyles.container, isFuture && colStyles.future]}>
      <View style={[colStyles.barArea, { height: BAR_MAX_HEIGHT }]}>
        {hasActivity ? (
          <View style={{ width: BAR_WIDTH, overflow: 'hidden', borderRadius: 4 }}>
            {[...segments].reverse().map((seg, i) => {
              const h = Math.max((seg.count / maxTotal) * BAR_MAX_HEIGHT, 0);
              return <View key={i} style={{ height: h, backgroundColor: seg.color }} />;
            })}
          </View>
        ) : (
          <View
            style={{
              width:           BAR_WIDTH,
              height:          BAR_MIN_HEIGHT,
              borderRadius:    4,
              backgroundColor: theme.separator,
            }}
          />
        )}
      </View>
      <Text style={colStyles.monthLabel}>{MONTH_INITIALS[item.month]}</Text>
      <Text style={[colStyles.valueLabel, hasActivity && { color }]}>
        {hasActivity ? String(total) : '–'}
      </Text>
    </View>
  );
};

// =============================================================================
// COMPONENT
// =============================================================================

export const CategoryYearOverviewGraph: React.FC<CategoryYearOverviewGraphProps> = ({
  data,
  color,
  initialYear,
  onYearChange,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const currentYear  = new Date().getFullYear();
  const [displayYear, setDisplayYear] = useState(initialYear ?? currentYear);
  const isCurrentYear = displayYear === currentYear;

  const handlePrevYear = () => {
    const prev = displayYear - 1;
    setDisplayYear(prev);
    onYearChange?.(prev);
  };

  const handleNextYear = () => {
    if (isCurrentYear) return;
    const next = displayYear + 1;
    setDisplayYear(next);
    onYearChange?.(next);
  };

  const displayItems = useMemo(() => {
    return data.map(d => ({
      month:    d.month,
      segments: d.segments,
      total:    d.segments.reduce((s, seg) => s + seg.count, 0),
    }));
  }, [data]);

  const maxTotal   = Math.max(...displayItems.map(d => d.total), 1);
  const nowMonth   = new Date().getMonth();
  const isFutureYear = displayYear > currentYear;

  // Legend from prop data (stable)
  const legend = data.find(d => d.segments.length > 0)?.segments ?? [];

  return (
    <View style={styles.card}>

      {/* ── Header: ‹ year nav › ──────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={styles.yearNav}>
          <TouchableOpacity
            onPress={handlePrevYear}
            style={styles.navArrow}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.6}
          >
            <Text style={styles.navArrowText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.yearLabel}>{displayYear}</Text>

          <TouchableOpacity
            onPress={handleNextYear}
            style={[styles.navArrow, isCurrentYear && styles.navArrowDisabled]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={isCurrentYear ? 1 : 0.6}
            disabled={isCurrentYear}
          >
            <Text style={[styles.navArrowText, isCurrentYear && styles.navArrowTextDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Section label ─────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>YEAR BY CATEGORY</Text>

      {/* ── 12 month bar columns ─────────────────────────────────────────── */}
      <View style={styles.barsRow}>
        {displayItems.map(item => {
          const isFuture = isFutureYear || (isCurrentYear && item.month > nowMonth);
          return (
            <MonthBar
              key={item.month}
              item={item}
              total={item.total}
              maxTotal={maxTotal}
              color={color}
              isFuture={isFuture}
              segments={item.segments}
            />
          );
        })}
      </View>

      {/* ── Category legend ───────────────────────────────────────────────── */}
      {legend.length > 0 && (
        <View style={styles.legend}>
          {legend.map(seg => (
            <View key={seg.name} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <Text style={styles.legendLabel}>{seg.name}</Text>
            </View>
          ))}
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
    container:  { flex: 1, alignItems: 'center' },
    future:     { opacity: 0.3 },
    barArea:    { justifyContent: 'flex-end', alignItems: 'center' },
    monthLabel: { fontSize: 11, color: theme.textDisabled, fontWeight: '600', marginTop: 5 },
    valueLabel: { fontSize: 9,  color: theme.textDisabled, fontWeight: '500', marginTop: 1 },
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
    },

    headerRow: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      marginBottom:   6,
    },

    yearNav: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           6,
    },

    navArrow:            { padding: 2 },
    navArrowDisabled:    { opacity: 0.25 },
    navArrowText: {
      fontSize:   22,
      color:      theme.textSecondary,
      fontWeight: '400',
      lineHeight: 26,
    },
    navArrowTextDisabled: { color: theme.textDisabled },

    yearLabel: {
      fontSize:   16,
      fontWeight: '700',
      color:      theme.textPrimary,
    },

    sectionLabel: {
      fontSize:      11,
      fontWeight:    '800',
      color:         theme.textDisabled,
      letterSpacing: 1.1,
      marginBottom:  14,
    },

    barsRow: {
      flexDirection: 'row',
      alignItems:    'flex-end',
    },

    legend: {
      flexDirection:  'row',
      flexWrap:       'wrap',
      gap:            10,
      marginTop:      14,
      paddingTop:     12,
      borderTopWidth: 1,
      borderTopColor: theme.separator,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           5,
    },
    legendDot: {
      width:        8,
      height:       8,
      borderRadius: 4,
    },
    legendLabel: {
      fontSize:   12,
      color:      theme.textSecondary,
      fontWeight: '500',
    },
  });
}
