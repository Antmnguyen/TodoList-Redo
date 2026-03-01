// app/components/stats/detail/shared/MonthCalendarGraph.tsx
// =============================================================================
// MONTH CALENDAR GRAPH
// =============================================================================
//
// A full calendar grid for a given month. Each day cell with scheduled tasks
// shows a square progress indicator: a light-grey perimeter track with a
// clockwise-sweeping colored fill that reflects how much was completed.
//
// Navigation is built into the header row — ‹ and › arrows let the user
// browse to any past month. The › arrow is disabled on the current month.
// Navigating to a different month generates stable mock data from a seed
// so the same past month always looks identical across re-renders.
//
// ── Header ────────────────────────────────────────────────────────────────────
//
//   ‹   January 2026   ›               [Count | %]
//
// ── Toggle modes ─────────────────────────────────────────────────────────────
//
//   Count mode  — fill is relative to the busiest day in the month.
//   % mode      — fill = completed ÷ total (true completion rate per day).
//
// ── Color thresholds (applied to fill proportion in both modes) ───────────────
//
//     < 30%  → red    #FF3B30
//     30–59% → yellow #FF9500
//     ≥ 60%  → green  #34C759
//
// ── Props ─────────────────────────────────────────────────────────────────────
//
//   year           - initial full calendar year (e.g. 2026)
//   month          - initial 0-indexed month (0 = Jan … 11 = Dec)
//   data           - CalendarDayData[] for the initial month
//   color          - accent color for the active toggle button background
//   onMonthChange  - optional callback fired when the user navigates months
//
// ── Used by ──────────────────────────────────────────────────────────────────
//
//   OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, TouchableOpacity } from 'react-native';
import { useTheme } from '../../../../theme/ThemeContext';
import type { AppTheme } from '../../../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Activity data for a single calendar day.
 * Only days with scheduled tasks need an entry in the data array.
 */
export interface CalendarDayData {
  /** 1-based day of the month (1–31) */
  date: number;
  /** Number of tasks completed on this day */
  completed: number;
  /** Number of tasks scheduled on this day */
  total: number;
}

interface MonthCalendarGraphProps {
  /** Initial full calendar year, e.g. 2026 */
  year: number;
  /** Initial 0-indexed month (0 = January, 11 = December) */
  month: number;
  /** Activity data for the initial month — days absent = no tasks scheduled */
  data: CalendarDayData[];
  /** Accent color for the active toggle button */
  color: string;
  /** Fired when the user navigates to a different month */
  onMonthChange?: (year: number, month: number) => void;
}

/** The two display modes for the progress fill */
type DisplayMode = 'count' | 'percent';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Monday-first column headers */
const DOW_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Green fill — ≥60% completion / proportion */
const COLOR_HIGH  = '#34C759';

/** Yellow/orange fill — 30–59% completion / proportion */
const COLOR_MID   = '#FF9500';

/** Red fill — <30% completion / proportion */
const COLOR_LOW   = '#FF3B30';

/** Thickness of both the grey track and the colored fill, in pixels */
const BORDER_T = 4;

// =============================================================================
// HELPERS — calendar layout
// =============================================================================

/** Returns the number of days in a given month, correctly handling leap years. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns the Monday-first column index (0 = Monday … 6 = Sunday) for the
 * first day of the given month.
 */
function firstDayOffset(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

/**
 * Derives the fill progress (0–1) and fill color for a single day cell.
 */
function getProgressInfo(
  dayData:  CalendarDayData | undefined,
  mode:     DisplayMode,
  maxCount: number,
): { hasData: boolean; fillProgress: number; fillColor: string } {
  if (!dayData || dayData.total === 0) {
    return { hasData: false, fillProgress: 0, fillColor: '' };
  }

  const fillProgress = mode === 'count'
    ? Math.min(dayData.completed / maxCount, 1.0)
    : Math.min(dayData.completed / dayData.total, 1.0);

  const fillColor =
    fillProgress >= 0.6 ? COLOR_HIGH :
    fillProgress >= 0.3 ? COLOR_MID  :
                          COLOR_LOW;

  return { hasData: true, fillProgress, fillColor };
}


// =============================================================================
// SUB-COMPONENT — clockwise colored progress fill
// =============================================================================

interface SquareProgressBorderProps {
  size: number;
  progress: number;
  color: string;
}

/**
 * Renders the colored clockwise-sweeping progress arc.
 * Uses a single View with borderWidth to ensure perfectly rounded inner corners.
 */
const SquareProgressBorder: React.FC<SquareProgressBorderProps> = ({
  progress,
  color,
}) => {
  if (progress <= 0) return null;

  const R = 8; // Parent border radius
  const B = BORDER_T;

  // Split progress into 4 segments to simulate the clockwise reveal
  const showTop = progress > 0;
  const showRight = progress > 0.25;
  const showBottom = progress > 0.5;
  const showLeft = progress > 0.75;

  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: R, overflow: 'hidden' }]} pointerEvents="none">
      <View style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: R,
        borderWidth: B,
        borderColor: 'transparent',
        borderTopColor: showTop ? color : 'transparent',
        borderRightColor: showRight ? color : 'transparent',
        borderBottomColor: showBottom ? color : 'transparent',
        borderLeftColor: showLeft ? color : 'transparent',
      }} />
    </View>
  );
};

// =============================================================================
// SUB-COMPONENT — single day cell
// =============================================================================

interface DayCellProps {
  dayNumber:    number;
  isToday:      boolean;
  hasData:      boolean;
  fillProgress: number;
  fillColor:    string;
  /** The grey ring track color — derived from theme.border in parent */
  trackColor:   string;
}

const DayCell: React.FC<DayCellProps> = ({
  dayNumber,
  isToday,
  hasData,
  fillProgress,
  fillColor,
  trackColor,
}) => {
  const [cellSize, setCellSize] = useState(0);
  const { theme } = useTheme();
  const styles = useMemo(() => makeCellStyles(theme), [theme]);

  if (dayNumber === 0) return <View style={styles.box} />;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== cellSize) setCellSize(w);
  };

  const textColor = hasData ? theme.textPrimary : theme.textDisabled;

  return (
    <View style={styles.box} onLayout={handleLayout}>

      {hasData && (
        <View
          pointerEvents="none"
          style={{
            position:     'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: 8,
            borderWidth:  BORDER_T,
            borderColor:  trackColor,
          }}
        />
      )}

      {hasData && fillProgress > 0 && (
        <SquareProgressBorder
          size={cellSize}
          progress={fillProgress}
          color={fillColor}
        />
      )}

      <Text style={[styles.label, { color: textColor }, isToday && styles.todayLabel]}>
        {dayNumber}
      </Text>

      {isToday && (
        <View style={[styles.todayDot, { backgroundColor: hasData ? fillColor : theme.textTertiary }]} />
      )}

    </View>
  );
};

function makeCellStyles(theme: AppTheme) {
  return StyleSheet.create({
    box: {
      flex:            1,
      aspectRatio:     1,
      margin:          2,
      borderRadius:    8,
      backgroundColor: theme.bgInput,
      alignItems:      'center',
      justifyContent:  'center',
      overflow:        'hidden',
    },
    label:      { fontSize: 13, fontWeight: '600' },
    todayLabel: { fontSize: 14, fontWeight: '800', color: theme.textPrimary },
    todayDot:   { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

export const MonthCalendarGraph: React.FC<MonthCalendarGraphProps> = ({
  year,
  month,
  data,
  color,
  onMonthChange,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // The grey ring track derives from theme.border — matches DEDEDE in light,
  // becomes #3a3a3c (visible dark-mode grey) in dark.
  const trackColor = theme.border;

  const [mode, setMode] = useState<DisplayMode>('percent');
  const [displayMonth, setDisplayMonth] = useState(month);
  const [displayYear,  setDisplayYear]  = useState(year);

  const now           = new Date();
  const isCurrentMonth =
    displayYear === now.getFullYear() && displayMonth === now.getMonth();

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(y => y - 1);
      onMonthChange?.(displayYear - 1, 11);
    } else {
      setDisplayMonth(m => m - 1);
      onMonthChange?.(displayYear, displayMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (isCurrentMonth) return;
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(y => y + 1);
      onMonthChange?.(displayYear + 1, 0);
    } else {
      setDisplayMonth(m => m + 1);
      onMonthChange?.(displayYear, displayMonth + 1);
    }
  };

  const displayData = data;

  const dataMap  = new Map<number, CalendarDayData>(displayData.map(d => [d.date, d]));
  const maxCount = Math.max(...displayData.map(d => d.completed), 1);
  const todayDay = isCurrentMonth ? now.getDate() : -1;

  const totalDays = daysInMonth(displayYear, displayMonth);
  const offset    = firstDayOffset(displayYear, displayMonth);
  const cells: number[] = [
    ...Array(offset).fill(0),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(0);

  const rows: number[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <View style={styles.card}>

      <View style={styles.headerRow}>
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={handlePrevMonth}
            style={styles.navArrow}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.6}
          >
            <Text style={styles.navArrowText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.monthTitle}>
            {MONTHS_FULL[displayMonth]} {displayYear}
          </Text>

          <TouchableOpacity
            onPress={handleNextMonth}
            style={[styles.navArrow, isCurrentMonth && styles.navArrowDisabled]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={isCurrentMonth ? 1 : 0.6}
            disabled={isCurrentMonth}
          >
            <Text style={[styles.navArrowText, isCurrentMonth && styles.navArrowTextDisabled]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'count' && { backgroundColor: color }]}
            onPress={() => setMode('count')}
            activeOpacity={0.75}
          >
            <Text style={[styles.toggleLabel, mode === 'count' && styles.toggleLabelActive]}>
              Count
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, mode === 'percent' && { backgroundColor: color }]}
            onPress={() => setMode('percent')}
            activeOpacity={0.75}
          >
            <Text style={[styles.toggleLabel, mode === 'percent' && styles.toggleLabelActive]}>
              %
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.dowRow}>
        {DOW_LABELS.map(lbl => (
          <Text key={lbl} style={styles.dowLabel}>{lbl}</Text>
        ))}
      </View>

      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.weekRow}>
          {row.map((dayNum, colIdx) => {
            const info = getProgressInfo(dataMap.get(dayNum), mode, maxCount);
            return (
              <DayCell
                key={colIdx}
                dayNumber={dayNum}
                isToday={dayNum === todayDay}
                hasData={info.hasData}
                fillProgress={info.fillProgress}
                fillColor={info.fillColor}
                trackColor={trackColor}
              />
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <LegendDot color={COLOR_HIGH}  label="≥60%"   />
        <LegendDot color={COLOR_MID}   label="30-60%" />
        <LegendDot color={COLOR_LOW}   label="<30%"   />
        <LegendDot color={trackColor}  label="None"   isBorderOnly={false} />
      </View>

    </View>
  );
};

// =============================================================================
// SUB-COMPONENT — legend item
// =============================================================================

interface LegendDotProps {
  color: string;
  label: string;
  isBorderOnly?: boolean;
}

const LegendDot = ({ color, label, isBorderOnly = true }: LegendDotProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeLegendStyles(theme), [theme]);
  return (
    <View style={styles.item}>
      <View
        style={[
          styles.dot,
          isBorderOnly
            ? { borderWidth: 2, borderColor: color, backgroundColor: color + '1A' }
            : { backgroundColor: color },
        ]}
      />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

function makeLegendStyles(theme: AppTheme) {
  return StyleSheet.create({
    item:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dot:   { width: 12, height: 12, borderRadius: 4 },
    label: { fontSize: 11, color: theme.textTertiary, fontWeight: '500' },
  });
}

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
      padding:          16,
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
      marginBottom:   12,
    },
    monthNav: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           4,
    },
    navArrow: {
      padding: 2,
    },
    navArrowDisabled: {
      opacity: 0.25,
    },
    navArrowText: {
      fontSize:   22,
      color:      theme.textSecondary,
      fontWeight: '400',
      lineHeight: 26,
    },
    navArrowTextDisabled: {
      color: theme.textDisabled,
    },
    monthTitle: {
      fontSize:   15,
      fontWeight: '700',
      color:      theme.textPrimary,
      minWidth:   130,       // widest label is "September 2026" — arrows stay fixed
      textAlign:  'center',
    },
    toggle: {
      flexDirection:   'row',
      backgroundColor: theme.bgInput,
      borderRadius:    8,
      padding:         2,
      gap:             2,
    },
    toggleBtn: {
      paddingHorizontal: 10,
      paddingVertical:   5,
      borderRadius:      7,
    },
    toggleLabel: {
      fontSize:   12,
      fontWeight: '600',
      color:      theme.textTertiary,
    },
    toggleLabelActive: {
      color: '#fff',
    },
    dowRow: {
      flexDirection:     'row',
      marginBottom:      4,
      paddingHorizontal: 2,
    },
    dowLabel: {
      flex:       1,
      textAlign:  'center',
      fontSize:   11,
      fontWeight: '700',
      color:      theme.textDisabled,
    },
    weekRow: {
      flexDirection: 'row',
    },
    legend: {
      flexDirection:  'row',
      justifyContent: 'center',
      gap:            16,
      marginTop:      12,
    },
  });
}
