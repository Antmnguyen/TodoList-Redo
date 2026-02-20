// app/components/stats/detail/shared/MonthCalendarGraph.tsx
// =============================================================================
// MONTH CALENDAR GRAPH
// =============================================================================
//
// A full calendar grid for a given month. Each day cell with scheduled tasks
// shows a square progress indicator: a light-grey perimeter track with a
// clockwise-sweeping colored fill that reflects how much was completed.
//
// ── Toggle modes ─────────────────────────────────────────────────────────────
//
//   Count mode  — fill is relative to the busiest day in the month.
//                 The day with the most completions gets a full ring; all
//                 others are scaled proportionally. Good for seeing which days
//                 had the most activity at a glance.
//
//   % mode      — fill = completed ÷ total (true completion rate per day).
//                 A full ring means every scheduled task was done that day.
//                 Good for seeing how consistently the task was completed.
//
// ── Color thresholds (applied to the fill proportion in both modes) ───────────
//
//     < 30%  → red    #FF3B30
//     30–59% → yellow #FF9500
//     ≥ 60%  → green  #34C759
//
//   0% fill (nothing completed, or 0 relative to max) shows only the grey
//   track — no colored fill is drawn.
//   Days with no scheduled tasks show a plain grey cell with no track at all.
//
// ── Border technique ─────────────────────────────────────────────────────────
//
//   Two layers are stacked inside each active cell:
//
//     1. Grey track  — a standard `borderWidth` View with `borderRadius: 8`.
//                      CSS borders derive inner corner radius automatically
//                      (inner radius = borderRadius − borderWidth = 8 − 4 = 4),
//                      giving naturally rounded inner and outer corners without
//                      any extra masking.
//
//     2. Colored fill — rendered on top via SquareProgressBorder, which uses
//                      five absolute-positioned overflow:'hidden' clip boxes
//                      that trace the perimeter clockwise from 12 o'clock:
//                        A: top-right half  (0   → S/2)
//                        B: right edge      (S/2 → 3S/2)
//                        C: bottom edge     (3S/2→ 5S/2)
//                        D: left edge       (5S/2→ 7S/2)
//                        E: top-left half   (7S/2→ 4S)
//
//   Cell size is measured via `onLayout` — required for the clip calculations.
//   `overflow:'hidden'` on the cell clips the fill at the cell's rounded edge.
//
// ── Today indicator ──────────────────────────────────────────────────────────
//
//   Today's cell has a bold, larger number and a small filled dot below it
//   (in the fill color, or grey if no tasks). Background stays neutral.
//
// ── Props ─────────────────────────────────────────────────────────────────────
//
//   year   - full calendar year (e.g. 2026)
//   month  - 0-indexed month (0 = Jan … 11 = Dec)
//   data   - CalendarDayData[] — only days with tasks need entries
//   color  - accent color used for the active toggle button background
//
// ── Used by ──────────────────────────────────────────────────────────────────
//
//   OverallDetailScreen, CategoryDetailScreen, PermanentDetailScreen
//
// =============================================================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, TouchableOpacity } from 'react-native';

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
  /** Full calendar year, e.g. 2026 */
  year: number;
  /** 0-indexed month (0 = January, 11 = December) */
  month: number;
  /** Activity data — days absent are treated as "no tasks scheduled" */
  data: CalendarDayData[];
  /** Accent color for the active toggle button */
  color: string;
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

/** Grey track color — always shown for days with tasks, behind the colored fill */
const TRACK_COLOR = '#DEDEDE';

/** Thickness of both the grey track and the colored fill, in pixels */
const BORDER_T = 4;

// =============================================================================
// HELPERS
// =============================================================================

/** Returns the number of days in a given month, correctly handling leap years. */
function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month = last day of this month
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Returns the Monday-first column index (0 = Monday … 6 = Sunday) for the
 * first day of the given month. JS getDay() returns 0 for Sunday, so we
 * shift the range by adding 6 and taking mod 7.
 */
function firstDayOffset(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

/**
 * Returns the fraction (0–1) of a perimeter segment that the fill should cover,
 * given how many total perimeter pixels are filled and the segment's pixel bounds.
 *
 * @param filled    - total perimeter pixels filled (progress × 4S)
 * @param segStart  - perimeter pixel where this segment begins
 * @param segEnd    - perimeter pixel where this segment ends
 */
function segmentFill(filled: number, segStart: number, segEnd: number): number {
  if (filled <= segStart) return 0;
  if (filled >= segEnd)   return 1;
  return (filled - segStart) / (segEnd - segStart);
}

/**
 * Derives the fill progress (0–1) and fill color for a single day cell.
 *
 * In Count mode the fill is relative to `maxCount` (the busiest day this month).
 * In % mode the fill is the true completion rate: completed ÷ total.
 *
 * Color thresholds are applied to the fill proportion in both modes:
 *   ≥60% → green, 30–59% → yellow, <30% → red.
 *
 * Returns `hasData: false` for empty days so the caller skips the track entirely.
 *
 * @param dayData  - activity data for this day (undefined = no tasks)
 * @param mode     - 'count' (relative) or 'percent' (absolute rate)
 * @param maxCount - peak completed count across all active days — used in count mode
 */
function getProgressInfo(
  dayData:  CalendarDayData | undefined,
  mode:     DisplayMode,
  maxCount: number,
): { hasData: boolean; fillProgress: number; fillColor: string } {
  // Days with no scheduled tasks get no track and no fill
  if (!dayData || dayData.total === 0) {
    return { hasData: false, fillProgress: 0, fillColor: TRACK_COLOR };
  }

  const fillProgress = mode === 'count'
    // Count mode: proportion relative to the month's busiest day
    ? Math.min(dayData.completed / maxCount, 1.0)
    // Percent mode: true completion rate for the day
    : Math.min(dayData.completed / dayData.total, 1.0);

  // Color threshold based on the fill proportion
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
  /** Side length of the cell in pixels — from onLayout */
  size: number;
  /** Fraction of the perimeter to fill, 0.0–1.0 */
  progress: number;
  /** Color of the filled arc */
  color: string;
}

/**
 * Renders the colored clockwise-sweeping progress arc using five
 * absolute-positioned overflow:'hidden' clip boxes — one per perimeter segment.
 * Starts at 12 o'clock (top-center) and sweeps clockwise:
 *
 *   A: top edge, right half  (0   → S/2)   grows rightward from center
 *   B: right edge            (S/2 → 3S/2)  grows downward
 *   C: bottom edge           (3S/2→ 5S/2)  grows leftward from right
 *   D: left edge             (5S/2→ 7S/2)  grows upward from bottom
 *   E: top edge, left half   (7S/2→ 4S)    grows leftward toward center
 *
 * Each clip box reveals only as much of its colored bar as `segmentFill`
 * says should be visible for the current progress value.
 *
 * The parent cell's overflow:'hidden' + borderRadius clips the outer corners.
 * Inner corners are inherently right-angled, but sit on top of the grey
 * borderWidth track whose inner corners ARE rounded — so the full visual
 * impression is of a smooth progress ring.
 */
const SquareProgressBorder: React.FC<SquareProgressBorderProps> = ({
  size: S,
  progress,
  color,
}) => {
  // Nothing to draw
  if (S <= 0 || progress <= 0) return null;

  const perimeter = 4 * S;
  const filled    = progress * perimeter; // pixels of perimeter that are colored
  const B         = BORDER_T;

  // Compute what fraction of each segment's length is covered by the fill
  const fA = segmentFill(filled, 0,           S / 2);
  const fB = segmentFill(filled, S / 2,       3 * S / 2);
  const fC = segmentFill(filled, 3 * S / 2,  5 * S / 2);
  const fD = segmentFill(filled, 5 * S / 2,  7 * S / 2);
  const fE = segmentFill(filled, 7 * S / 2,  4 * S);

  return (
    // absoluteFill places the drawing surface over the whole cell;
    // pointerEvents="none" ensures the overlay doesn't intercept touches
    <View style={StyleSheet.absoluteFill} pointerEvents="none">

      {/* A: top edge, right half — bar grows rightward from center-top */}
      <View style={{
        position: 'absolute', top: 0, left: S / 2,
        width: S / 2, height: B, overflow: 'hidden',
      }}>
        <View style={{ width: fA * (S / 2), height: B, backgroundColor: color }} />
      </View>

      {/* B: right edge — bar grows downward from the top-right corner */}
      <View style={{
        position: 'absolute', top: 0, right: 0,
        width: B, height: S, overflow: 'hidden',
      }}>
        <View style={{ width: B, height: fB * S, backgroundColor: color }} />
      </View>

      {/* C: bottom edge — bar grows leftward from the bottom-right corner */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0,
        width: S, height: B, overflow: 'hidden',
        alignItems: 'flex-end', // anchor bar to the right so it grows left
      }}>
        <View style={{ width: fC * S, height: B, backgroundColor: color }} />
      </View>

      {/* D: left edge — bar grows upward from the bottom-left corner */}
      <View style={{
        position: 'absolute', top: 0, left: 0,
        width: B, height: S, overflow: 'hidden',
        justifyContent: 'flex-end', // anchor bar to the bottom so it grows up
      }}>
        <View style={{ width: B, height: fD * S, backgroundColor: color }} />
      </View>

      {/* E: top edge, left half — bar grows leftward toward center-top */}
      <View style={{
        position: 'absolute', top: 0, left: 0,
        width: S / 2, height: B, overflow: 'hidden',
        alignItems: 'flex-end', // anchor bar to the right (center) so it grows left
      }}>
        <View style={{ width: fE * (S / 2), height: B, backgroundColor: color }} />
      </View>

    </View>
  );
};

// =============================================================================
// SUB-COMPONENT — single day cell
// =============================================================================

interface DayCellProps {
  /** 1-based day number, or 0 for a padding spacer cell */
  dayNumber:    number;
  /** True if this cell's date is today */
  isToday:      boolean;
  /**
   * Whether this day has any scheduled tasks.
   * Pre-computed by MonthCalendarGraph from the data array and current mode.
   */
  hasData:      boolean;
  /**
   * How much of the perimeter to fill with color, 0.0–1.0.
   * Pre-computed by MonthCalendarGraph according to the active DisplayMode.
   */
  fillProgress: number;
  /** The color for the fill arc — red, yellow, or green based on the threshold */
  fillColor:    string;
}

/**
 * Renders one square day cell in the calendar grid.
 *
 * Active cells (hasData = true) display two stacked border layers:
 *   1. Grey track (borderWidth View) — full perimeter, rounded inner corners
 *   2. Colored fill (SquareProgressBorder) — sweeps clockwise over the track
 *
 * Padding cells (dayNumber 0) are invisible spacers to align the grid.
 * Today's cell has a bold number and a small dot indicator below it.
 *
 * The cell measures its own pixel width via onLayout so SquareProgressBorder
 * receives accurate dimensions for its perimeter calculations.
 */
const DayCell: React.FC<DayCellProps> = ({
  dayNumber,
  isToday,
  hasData,
  fillProgress,
  fillColor,
}) => {
  // Measured side length in pixels — updated after first layout
  const [cellSize, setCellSize] = useState(0);

  // Invisible spacer — keeps the 7-column Monday-first grid aligned
  if (dayNumber === 0) return <View style={cell.box} />;

  /** Update cellSize when layout resolves; guard against sub-pixel noise */
  const handleLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== cellSize) setCellSize(w);
  };

  // Numbers stay neutral — only the border carries the color signal
  const textColor = hasData ? '#444444' : '#BBBBBB';

  return (
    <View style={cell.box} onLayout={handleLayout}>

      {/* ── Layer 1: grey track ────────────────────────────────────────────
           Uses a real borderWidth View so inner corners are naturally rounded
           by the CSS border model (inner radius = borderRadius − borderWidth
           = 8 − 4 = 4 px). Only drawn for days that have scheduled tasks. */}
      {hasData && (
        <View
          pointerEvents="none"
          style={{
            position:     'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: 8,         // matches cell.box borderRadius
            borderWidth:  BORDER_T,
            borderColor:  TRACK_COLOR,
          }}
        />
      )}

      {/* ── Layer 2: colored fill ──────────────────────────────────────────
           Sweeps clockwise from 12 o'clock proportional to fillProgress.
           Not drawn when fillProgress is 0 (nothing done / relative count = 0). */}
      {hasData && fillProgress > 0 && cellSize > 0 && (
        <SquareProgressBorder
          size={cellSize}
          progress={fillProgress}
          color={fillColor}
        />
      )}

      {/* Day number — dark for active days, muted grey for empty days */}
      <Text style={[cell.label, { color: textColor }, isToday && cell.todayLabel]}>
        {dayNumber}
      </Text>

      {/* Small filled dot below today's number — uses fill color or grey */}
      {isToday && (
        <View style={[cell.todayDot, { backgroundColor: hasData ? fillColor : '#AAAAAA' }]} />
      )}

    </View>
  );
};

/** Styles for a single day cell */
const cell = StyleSheet.create({
  box: {
    flex:            1,
    aspectRatio:     1,      // keep cells square regardless of container width
    margin:          2,
    borderRadius:    8,
    backgroundColor: '#F5F5F5',
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden', // clips colored fill at the rounded cell boundary
  },
  label:      { fontSize: 13, fontWeight: '600' },
  todayLabel: { fontSize: 14, fontWeight: '800', color: '#222222' },
  todayDot:   { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
});

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * MonthCalendarGraph
 *
 * Displays a Monday-first calendar grid for one month. Each day with scheduled
 * tasks shows a square progress ring whose fill reflects completion — either
 * relative to the busiest day (Count mode) or as a true completion rate (% mode).
 *
 * The Count/% toggle is managed internally; the parent only needs to supply
 * the activity data and the accent color for the active toggle button.
 */
export const MonthCalendarGraph: React.FC<MonthCalendarGraphProps> = ({
  year,
  month,
  data,
  color,
}) => {
  // Internal toggle — parent does not need to manage this
  const [mode, setMode] = useState<DisplayMode>('percent');

  // O(1) lookup of a day's activity data by its 1-based day number
  const dataMap = new Map<number, CalendarDayData>(data.map(d => [d.date, d]));

  // Peak completed count across all active days — used for Count mode scaling.
  // Math.max with a floor of 1 prevents divide-by-zero when all days have 0 completions.
  const maxCount = Math.max(...data.map(d => d.completed), 1);

  // Today's day number within this month, or -1 if this calendar shows a different month
  const now      = new Date();
  const todayDay = now.getFullYear() === year && now.getMonth() === month
    ? now.getDate()
    : -1;

  // ── Build flat cell array ──────────────────────────────────────────────────
  // Starts with `offset` zero-padding cells (invisible spacers) so day 1 lands
  // in the correct Monday-first column, then day numbers 1…totalDays, then
  // trailing zeros to complete the last row to a multiple of 7.
  const totalDays = daysInMonth(year, month);
  const offset    = firstDayOffset(year, month);
  const cells: number[] = [
    ...Array(offset).fill(0),                              // leading spacers
    ...Array.from({ length: totalDays }, (_, i) => i + 1), // actual days
  ];
  while (cells.length % 7 !== 0) cells.push(0);            // trailing spacers

  // Chunk the flat array into rows of 7 (one row per week)
  const rows: number[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <View style={styles.card}>

      {/* ── Header: month title + Count/% toggle ─────────────────────────── */}
      <View style={styles.headerRow}>
        <Text style={styles.monthTitle}>
          {MONTHS_FULL[month]} {year}
        </Text>

        {/* Toggle pill — switches between relative count and true % fill */}
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

      {/* ── Day-of-week column headers ──────────────────────────────────── */}
      {/* Each label uses flex:1 so it aligns with its column of day cells */}
      <View style={styles.dowRow}>
        {DOW_LABELS.map(lbl => (
          <Text key={lbl} style={styles.dowLabel}>{lbl}</Text>
        ))}
      </View>

      {/* ── Calendar grid — one View per week row ──────────────────────── */}
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.weekRow}>
          {row.map((dayNum, colIdx) => {
            // Pre-compute progress info here so DayCell stays presentation-only
            const info = getProgressInfo(dataMap.get(dayNum), mode, maxCount);
            return (
              <DayCell
                key={colIdx}
                dayNumber={dayNum}
                isToday={dayNum === todayDay}
                hasData={info.hasData}
                fillProgress={info.fillProgress}
                fillColor={info.fillColor}
              />
            );
          })}
        </View>
      ))}

      {/* ── Legend strip — explains the three color thresholds ─────────── */}
      <View style={styles.legend}>
        {/* Green: ≥60% */}
        <LegendDot color={COLOR_HIGH}  label="≥60%"   />
        {/* Yellow: 30–60% */}
        <LegendDot color={COLOR_MID}   label="30-60%" />
        {/* Red: <30% */}
        <LegendDot color={COLOR_LOW}   label="<30%"   />
        {/* No fill: grey track only (no tasks or 0 completions) */}
        <LegendDot color={TRACK_COLOR} label="None"   isBorderOnly={false} />
      </View>

    </View>
  );
};

// =============================================================================
// SUB-COMPONENT — legend item
// =============================================================================

interface LegendDotProps {
  /** Color of the dot indicator */
  color: string;
  /** Text label displayed beside the dot */
  label: string;
  /**
   * When true (default), the dot shows as a colored border with a faint fill —
   * matching the cell's progress ring visual.
   * When false, the dot is a solid fill (used for the "None" / no-tasks entry).
   */
  isBorderOnly?: boolean;
}

/**
 * One item in the legend strip beneath the calendar grid.
 * Renders a small colored square indicator (bordered or solid) + a text label.
 */
const LegendDot = ({ color, label, isBorderOnly = true }: LegendDotProps) => (
  <View style={legend.item}>
    <View
      style={[
        legend.dot,
        isBorderOnly
          // Bordered style mirrors the ring appearance of the cell track/fill
          ? { borderWidth: 2, borderColor: color, backgroundColor: color + '1A' }
          // Solid style for the "None" entry (grey fill, no border)
          : { backgroundColor: color },
      ]}
    />
    <Text style={legend.label}>{label}</Text>
  </View>
);

const legend = StyleSheet.create({
  item:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:   { width: 12, height: 12, borderRadius: 4 },
  label: { fontSize: 11, color: '#aaa', fontWeight: '500' },
});

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  /** Outer card container — white with a soft shadow */
  card: {
    backgroundColor:  '#fff',
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

  /** Row that holds the month title on the left and the toggle on the right */
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   12,
  },

  monthTitle: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#333',
  },

  // ── Count / % toggle pill ── (mirrors DayOfWeekPatternCard toggle styling)
  toggle: {
    flexDirection:   'row',
    backgroundColor: '#f2f2f2',
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
    color:      '#999',
  },
  /** Applied to the label of the active toggle button */
  toggleLabelActive: {
    color: '#fff',
  },

  /** Row of Mon–Sun header labels; each uses flex:1 to match column widths */
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
    color:      '#ccc',
  },

  /** One week's row of 7 day cells */
  weekRow: {
    flexDirection: 'row',
  },

  /** Legend strip centered below the grid */
  legend: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            16,
    marginTop:      12,
  },
});
