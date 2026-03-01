/**
 * @file useStats.ts
 * @description React hook that assembles UI-ready stat bundles for the three
 *   detail screens and the StatsScreen preview card lists.
 *
 * ── Synchronous by design ────────────────────────────────────────────────────
 *   All public functions are synchronous. expo-sqlite's sync API means every
 *   storage call completes immediately without a Promise. The hook therefore
 *   has no useState / useEffect and returns plain objects — no loading state,
 *   no async waterfall. This keeps the call sites in screens simple:
 *
 *     const data = useStats().getOverallDetail(params.id);
 *
 * ── Coupling rules ───────────────────────────────────────────────────────────
 *   - All completion_log reads must go through statsStorage.ts.
 *     This file never writes raw SQL against completion_log.
 *   - Direct db queries are permitted ONLY for supplementary joins against the
 *     categories and templates tables (tiny lookup tables, not the event log).
 *   - This file never imports from taskActions.ts or any write-side module.
 *     It is read-only from the UI's perspective.
 *
 * ── Function naming (matches StatsScreen comment block) ──────────────────────
 *   useStats().getOverallStatsList()   ← replaces getMockOverallStats()
 *   useStats().getTemplateStatsList()  ← replaces getMockTemplateStats()
 *   useStats().getCategoryStatsList()  ← replaces getMockCategoryStats()
 *   useStats().getOverallDetail(id)    ← replaces getMockOverallDetail(id)
 *   useStats().getCategoryDetail(id)   ← replaces getMockCategoryDetail(id)
 *   useStats().getPermanentDetail(id)  ← replaces getMockPermanentDetail(id)
 */

import { db } from '../services/storage/database';
import {
  type StatFilter,
  getCompletionsByDay,
  getCompletionsByDayWithKind,
  getCompletionsByMonth,
  getCompletionsByMonthWithKind,
  getCompletionsByWeekday,
  getCompletionsByDayByCategory,
  getCompletionsByMonthByCategory,
  getCompletionDates,
  getStatSummary,
  getCompletionSummary,
  getTaskTypeSplit,
  getTopCategories,
  getPermanentTaskSummariesForCategory,
  getTodayRaw,
} from '../services/storage/statsStorage';

import {
  toLocalDateString,
  startOfCurrentWeek,
  endOfCurrentWeek,
  startOfCurrentMonth,
  endOfCurrentMonth,
  calcCurrentStreak,
  calcBestStreak,
} from '../utils/statsCalculations';

// Component prop types — imported so this hook returns exactly the shapes
// that components accept, with no transformation step in the screens.
import type { DayData }             from '../../components/stats/WeeklyMiniChart';
import type { CalendarDayData }     from '../../components/stats/detail/shared/MonthCalendarGraph';
import type { MonthData }           from '../../components/stats/detail/shared/YearOverviewGraph';
import type { DayOfWeekData }       from '../../components/stats/detail/shared/DayOfWeekPatternCard';
import type { TimeRangeBreakdown }  from '../../components/stats/detail/shared/TimeRangeCountsCard';
import type { CategoryBreakdownItem } from '../../components/stats/detail/overall/CategoryBreakdownCard';
import type { CategoryDayData }     from '../../components/stats/detail/overall/CategoryWeekBarGraph';
import type { CategoryMonthData }   from '../../components/stats/detail/overall/CategoryYearOverviewGraph';
import type { PermanentTaskStat }   from '../../components/stats/detail/category/PermanentTaskListCard';
import type { StatPreviewData }     from '../../components/stats/StatPreviewCard';
import type { TodayStats, CategoryStat } from '../../components/stats/TodayCard';

// =============================================================================
// Exported data types
//
// These match the mock interfaces in each detail screen (OverallDetailMockData,
// CategoryDetailMockData, PermanentDetailMockData) field-for-field. When Step 6
// (mock replacement) runs, each screen drops its mock interface and imports
// the corresponding type from here instead.
// =============================================================================

export interface OverallDetailData {
  // ── CompletionSummaryCard ─────────────────────────────────────────────────
  completed:           number;  // COUNT(outcome='completed') in bucket window
  total:               number;  // COUNT(*) in bucket window (all evaluated tasks)
  // ── StreakCard ────────────────────────────────────────────────────────────
  currentStreak:       number;  // consecutive days ending today with ≥1 completion
  bestStreak:          number;  // longest ever run within the bucket's lookback
  // ── TimeRangeCountsCard ───────────────────────────────────────────────────
  weekCount:           number;  // always the four canonical windows regardless of bucket
  monthCount:          number;
  yearCount:           number;
  allTimeCount:        number;
  breakdown:           TimeRangeBreakdown;  // per-window perm/one-off split
  // ── Graph cards ───────────────────────────────────────────────────────────
  weeklyData:          DayData[];          // 7 items Mon–Sun, current week
  monthlyData:         CalendarDayData[];  // sparse — only days with activity
  yearlyData:          MonthData[];        // 12 items Jan–Dec, current year
  dayOfWeekData:       DayOfWeekData[];    // 7 items Mon–Sun, bucket-scoped
  // ── TaskTypeBreakdownCard ─────────────────────────────────────────────────
  permanentCount:      number;  // bucket-scoped perm completions
  oneOffCount:         number;  // bucket-scoped one-off completions
  // ── CategoryBreakdownCard + category graphs ───────────────────────────────
  categories:          CategoryBreakdownItem[];  // top 5 by count, bucket-scoped
  categoryWeeklyData:  CategoryDayData[];        // 7 items, always current week
  categoryYearlyData:  CategoryMonthData[];      // 12 items, always current year
}

export interface CategoryDetailData {
  // Same card set as Overall minus the category graph cards.
  // All data is filtered to this category; time windows are all-time
  // (category screens don't have a bucket concept).
  completed:      number;
  total:          number;
  currentStreak:  number;
  bestStreak:     number;
  weekCount:      number;
  monthCount:     number;
  yearCount:      number;
  allTimeCount:   number;
  breakdown:      TimeRangeBreakdown;
  weeklyData:     DayData[];
  monthlyData:    CalendarDayData[];
  yearlyData:     MonthData[];
  dayOfWeekData:  DayOfWeekData[];
  permanentCount: number;
  oneOffCount:    number;
  // PermanentTaskListCard — templates that belong to this category
  permanentTasks: PermanentTaskStat[];
}

export interface PermanentDetailData {
  // Subset of the above — no category cards, no TaskTypeBreakdownCard.
  // Everything is filtered to this single template.
  completed:     number;
  total:         number;
  currentStreak: number;
  bestStreak:    number;
  weekCount:     number;
  monthCount:    number;
  yearCount:     number;
  allTimeCount:  number;
  weeklyData:    DayData[];
  monthlyData:   CalendarDayData[];
  yearlyData:    MonthData[];
  dayOfWeekData: DayOfWeekData[];
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Single-character day labels in Monday-first order (index 0 = Mon, 6 = Sun).
 * Note the two 'T's (Tuesday / Thursday) and two 'S's (Saturday / Sunday) —
 * this matches the UI convention used in WeekBarGraph and DayOfWeekPatternCard.
 */
const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

// Segment colors match the hardcoded values in TaskTypeBreakdownCard and the
// legend labels used in WeekBarGraph / YearOverviewGraph. These must stay in
// sync with those components if colors are ever changed.
const PERM_COLOR   = '#34C759'; // green — permanent task completions
const ONEOFF_COLOR = '#007AFF'; // blue  — one-off task completions
const FALLBACK_COLOR = '#8E8E93'; // mid-gray — category with no color, or unknown id

// =============================================================================
// Private helpers
// =============================================================================

/**
 * Returns a 'YYYY-MM-DD' string exactly `n` days after `dateStr`.
 *
 * Used by the week-bar builders to generate each day's date string from the
 * Monday anchor. Handles month/year boundaries correctly via the Date
 * constructor (e.g. addDays('2026-01-31', 1) → '2026-02-01').
 */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Passing d + n to new Date() rolls over month/year automatically.
  return toLocalDateString(new Date(y, m - 1, d + n));
}

/**
 * Maps a bucket id to the concrete start/end date pair for that window.
 * Returns null for 'all_time' — callers must treat null as "no date filter"
 * and pass undefined to storage functions instead of a date string.
 *
 * This is the single source of truth for time-window mapping. All three
 * detail functions call this rather than computing ranges independently.
 */
function bucketDateRange(bucketId: string): { startDate: string; endDate: string } | null {
  const year = new Date().getFullYear();
  // Each if-branch maps one of the four bucket ids to its canonical range.
  // The ranges are device-local (startOfCurrentWeek etc. use local time).
  if (bucketId === 'all_week')  return { startDate: startOfCurrentWeek(),  endDate: endOfCurrentWeek()  };
  if (bucketId === 'all_month') return { startDate: startOfCurrentMonth(), endDate: endOfCurrentMonth() };
  if (bucketId === 'all_year')  return { startDate: `${year}-01-01`,       endDate: `${year}-12-31`     };
  return null; // 'all_time' — storage functions omit the WHERE date clause when both args are undefined
}

/**
 * Loads all categories as a Map<id, {name, color}> in one sync query.
 *
 * Called once per detail-function invocation, then passed to all builders
 * that need category metadata. This avoids N individual lookups when
 * building category breakdown cards or stacked graphs.
 *
 * The fallback color is used for categories that exist in completion_log
 * rows but whose row in the categories table has been deleted or whose
 * color column is null.
 */
function getCategoryMap(): Map<string, { name: string; color: string }> {
  const rows = db.getAllSync<{ id: string; name: string; color: string | null }>(
    'SELECT id, name, color FROM categories',
  );
  return new Map(rows.map(r => [r.id, { name: r.name, color: r.color ?? FALLBACK_COLOR }]));
}

/**
 * Resolves a template's display title from its permanentId with a single-row
 * lookup against the templates table.
 *
 * The completion_log stores templateId (permanentId) but not the title — titles
 * can change over time and are not snapshotted in the log. This lookup always
 * returns the current title, which is the desired behaviour.
 *
 * Falls back to the raw id string if the template has been deleted, so the
 * PermanentTaskListCard row still renders rather than crashing.
 */
function getTemplateName(templateId: string): string {
  const rows = db.getAllSync<{ templateTitle: string }>(
    'SELECT templateTitle FROM templates WHERE permanentId = ?',
    [templateId],
  );
  return rows[0]?.templateTitle ?? templateId;
}

/**
 * Builds the four-window perm/one-off breakdown object for TimeRangeCountsCard.
 *
 * TimeRangeCountsCard always shows all four canonical windows regardless of
 * which bucket opened the screen. Each window needs a separate perm/one-off
 * split, so this calls getTaskTypeSplit four times — one per window. Each call
 * hits the idx_clog_kind_date index and is very cheap.
 *
 * An optional StatFilter scopes all four queries to a category or template.
 * For OverallDetailScreen, no filter is passed (global split across all tasks).
 */
function buildBreakdown(filter?: StatFilter): TimeRangeBreakdown {
  const year = new Date().getFullYear();
  // Each variable holds { permanentCount, oneOffCount } for one time window.
  const w  = getTaskTypeSplit(startOfCurrentWeek(),  endOfCurrentWeek(),  filter);
  const m  = getTaskTypeSplit(startOfCurrentMonth(), endOfCurrentMonth(), filter);
  const y  = getTaskTypeSplit(`${year}-01-01`,       `${year}-12-31`,     filter);
  const at = getTaskTypeSplit(undefined, undefined, filter); // all-time: no date bounds
  return {
    week:    { perm: w.permanentCount,  oneOff: w.oneOffCount  },
    month:   { perm: m.permanentCount,  oneOff: m.oneOffCount  },
    year:    { perm: y.permanentCount,  oneOff: y.oneOffCount  },
    allTime: { perm: at.permanentCount, oneOff: at.oneOffCount },
  };
}

// =============================================================================
// Graph builders
//
// Storage functions return sparse data — only dates/months/weekdays that had
// activity. Each builder zero-fills the missing slots so components always
// receive a fixed-length array (7 for week/DOW, 12 for year, variable for
// calendar). Builders never call storage directly; they receive pre-fetched
// rows as arguments to keep the call sites readable.
// =============================================================================

/**
 * Builds 7 DayData items (Mon index 0 → Sun index 6) with stacked segments.
 *
 * INPUT:  sparse rows from getCompletionsByDayWithKind — only days with
 *         ≥1 completion are present, so most weeks have 3–5 rows, not 7.
 * OUTPUT: exactly 7 DayData items, zero-filled for inactive days.
 *
 * `count` = permanent + oneOff (the bar height in Count mode).
 * `total` = scheduled (tasks due that day — denominator for % mode).
 * `segments` = two-element array so WeekBarGraph renders a stacked green/blue
 *              bar. An entry with count = 0 is included intentionally — the
 *              component renders it as zero-height, preserving the legend.
 *
 * Used by: OverallDetailScreen, CategoryDetailScreen (both have the full split).
 */
function buildWeekBars(
  rows: Array<{ date: string; permanent: number; oneOff: number; scheduled: number }>,
): DayData[] {
  // Index the sparse rows by date string for O(1) lookup per day.
  const byDate    = new Map(rows.map(r => [r.date, r]));
  // Anchor the 7 slots to this Monday — addDays(weekStart, 0..6) produces
  // Mon, Tue, Wed, Thu, Fri, Sat, Sun in device-local time.
  const weekStart = startOfCurrentWeek();
  return DOW_LABELS.map((day, i) => {
    const row       = byDate.get(addDays(weekStart, i)); // undefined if no activity
    const permanent = row?.permanent ?? 0;
    const oneOff    = row?.oneOff    ?? 0;
    return {
      day,
      count:    permanent + oneOff,   // total bar height
      total:    row?.scheduled ?? 0,  // 0 means "not scheduled" → bar hidden in % mode
      segments: [
        { label: 'Permanent', color: PERM_COLOR,   count: permanent },
        { label: 'One-off',   color: ONEOFF_COLOR, count: oneOff    },
      ],
    };
  });
}

/**
 * Builds 7 DayData items without segments.
 *
 * Used by PermanentDetailScreen WeekBarGraph and by buildPreviewWeek. Since all
 * completions on a template screen are for a single permanent task, a perm/one-off
 * split would always be 100% permanent — segments are omitted so WeekBarGraph
 * renders a solid bar using the screen's accent color instead.
 *
 * Also used for the preview cards on StatsScreen where the WeeklyMiniChart
 * renders solid bars in the card's own accent color regardless of task kind.
 */
function buildWeekBarsSimple(
  rows: Array<{ date: string; completed: number; scheduled: number }>,
): DayData[] {
  const byDate    = new Map(rows.map(r => [r.date, r]));
  const weekStart = startOfCurrentWeek();
  return DOW_LABELS.map((day, i) => {
    const row = byDate.get(addDays(weekStart, i));
    return {
      day,
      count: row?.completed ?? 0,
      total: row?.scheduled ?? 0,
      // No `segments` field — absent means WeekBarGraph uses a solid bar.
    };
  });
}

/**
 * Converts sparse per-day rows into CalendarDayData for MonthCalendarGraph.
 *
 * Storage returns only days that had ≥1 completion or ≥1 scheduled task.
 * The calendar component renders no ring for days absent from this array,
 * so we pass the sparse result through directly — no zero-fill needed here.
 *
 * The critical transform: storage uses 'YYYY-MM-DD' strings; the component
 * needs a 1-based day-of-month number. We extract [2] (the DD part) and
 * parse it as an integer.
 *
 * `total` (scheduled) is the denominator for the ring fill percentage. A day
 * where tasks were completed without a due_date will have completed > 0 but
 * total = 0. The component's safePct() handles this without crashing — it
 * shows a full ring or a special "no target" state depending on component config.
 */
function buildCalendarData(
  rows: Array<{ date: string; completed: number; scheduled: number }>,
): CalendarDayData[] {
  return rows.map(r => ({
    date:      parseInt(r.date.split('-')[2], 10), // 'YYYY-MM-DD' → day number 1–31
    completed: r.completed,
    total:     r.scheduled,
  }));
}

/**
 * Converts 12 monthly rows (always complete from storage) to MonthData[]
 * with stacked perm/one-off segments.
 *
 * `getCompletionsByMonthWithKind` already zero-fills missing months, so this
 * builder receives exactly 12 rows and maps them 1-to-1 — no gap-filling.
 *
 * `completed` on the MonthData interface = total completions (perm + oneOff).
 * The storage function returns them split; we sum them here and also attach
 * the original split as segments so YearOverviewGraph can show stacked bars.
 *
 * `total` (scheduled) is the denominator for % mode. Months with no scheduled
 * tasks get total = 0 and the component renders them at reduced opacity.
 *
 * Used by: OverallDetailScreen, CategoryDetailScreen.
 */
function buildMonthBars(
  rows: Array<{ month: number; permanent: number; oneOff: number; scheduled: number }>,
): MonthData[] {
  return rows.map(r => ({
    month:     r.month,                   // 0-indexed (Jan = 0)
    completed: r.permanent + r.oneOff,    // total bar height
    total:     r.scheduled,
    segments: [
      { label: 'Permanent', color: PERM_COLOR,   count: r.permanent },
      { label: 'One-off',   color: ONEOFF_COLOR, count: r.oneOff    },
    ],
  }));
}

/**
 * Converts 12 monthly rows to MonthData[] without segments.
 *
 * Used by PermanentDetailScreen where the template-scoped query returns
 * `getCompletionsByMonth` (not WithKind) — all completions are by definition
 * from the same permanent task, so a split is meaningless. Solid bars are
 * rendered in the screen's accent color by YearOverviewGraph.
 */
function buildMonthBarsSimple(
  rows: Array<{ month: number; completed: number; scheduled: number }>,
): MonthData[] {
  return rows.map(r => ({
    month:     r.month,
    completed: r.completed,
    total:     r.scheduled,
    // No `segments` — YearOverviewGraph renders a solid bar.
  }));
}

/**
 * Converts sparse weekday rows to exactly 7 DayOfWeekData items (Mon–Sun).
 *
 * ── SQLite weekday encoding ───────────────────────────────────────────────────
 * SQLite's strftime('%w') returns integers where 0 = Sunday and 6 = Saturday.
 * The UI uses Monday-first arrays (index 0 = Monday, index 6 = Sunday).
 * The remap formula is: uiIndex = (sqliteWeekday + 6) % 7
 *
 *   sqliteWeekday 0 (Sun) → (0 + 6) % 7 = 6   → UI index 6 ✓
 *   sqliteWeekday 1 (Mon) → (1 + 6) % 7 = 0   → UI index 0 ✓
 *   sqliteWeekday 6 (Sat) → (6 + 6) % 7 = 5   → UI index 5 ✓
 *
 * ── Why `total` is intentionally undefined for missing days ──────────────────
 * When a weekday has no rows at all (no completions, no scheduled tasks),
 * we set count = 0 and leave `total` undefined. DayOfWeekPatternCard interprets
 * undefined `total` as "no denominator available" and falls back to a
 * relative-to-max bar height in % mode rather than showing 0%. This avoids a
 * misleading "0% completion rate on Sundays" for new users with no history.
 */
function buildDowData(
  rows: Array<{ weekday: number; completed: number; scheduled: number }>,
): DayOfWeekData[] {
  // Map from UI-index (0=Mon) to the row, applying the remap inline.
  const byUiIndex = new Map(rows.map(r => [(r.weekday + 6) % 7, r]));
  return DOW_LABELS.map((day, i) => {
    const row = byUiIndex.get(i);
    return {
      day,
      count: row?.completed ?? 0,
      // Only attach `total` when the row exists. If undefined, the component
      // falls back to relative-to-max rendering rather than 0/0 = NaN.
      total: row?.scheduled,
    };
  });
}

/**
 * Builds CategoryDayData[] (exactly 7 items Mon–Sun) from sparse per-day ×
 * per-category rows for CategoryWeekBarGraph on OverallDetailScreen.
 *
 * ── Why group-then-map instead of filter-inside-map ───────────────────────────
 * A naïve approach would filter `rows` for each of the 7 days in the map()
 * call — O(n × 7) = O(n) but with a high constant. Instead we build a Map
 * keyed by date string in a single O(n) pass, then look up each day's segments
 * in O(1). With a typical week having ≤ 50 rows the difference is negligible,
 * but the grouped approach scales correctly to large datasets.
 *
 * Segments are ordered as returned from storage (descending by count within
 * each day). CategoryWeekBarGraph stacks them bottom-up, so the largest
 * category sits at the base of each bar.
 *
 * Days with no category activity get an empty `segments: []` array — the
 * component renders an empty (invisible) bar stub for that day.
 */
function buildCategoryWeekData(
  rows:   Array<{ date: string; categoryId: string; count: number }>,
  catMap: Map<string, { name: string; color: string }>,
): CategoryDayData[] {
  // Phase 1: group rows by date.
  const byDate = new Map<string, Array<{ categoryId: string; count: number }>>();
  for (const row of rows) {
    const bucket = byDate.get(row.date) ?? [];
    bucket.push({ categoryId: row.categoryId, count: row.count });
    byDate.set(row.date, bucket);
  }
  // Phase 2: build one CategoryDayData per day, enriching each segment with
  // name and color from catMap. Unknown categoryIds get a fallback gray.
  const weekStart = startOfCurrentWeek();
  return DOW_LABELS.map((day, i) => ({
    day,
    segments: (byDate.get(addDays(weekStart, i)) ?? []).map(s => ({
      name:  catMap.get(s.categoryId)?.name  ?? s.categoryId,
      color: catMap.get(s.categoryId)?.color ?? FALLBACK_COLOR,
      count: s.count,
    })),
  }));
}

/**
 * Builds CategoryMonthData[] (exactly 12 items Jan–Dec) from sparse per-month
 * × per-category rows for CategoryYearOverviewGraph on OverallDetailScreen.
 *
 * Same grouping strategy as buildCategoryWeekData — O(n) group pass then O(1)
 * lookup — applied over months (0–11) instead of day strings.
 *
 * Future months and months with no completions get `segments: []`.
 * CategoryYearOverviewGraph renders these at reduced opacity automatically.
 */
function buildCategoryYearData(
  rows:   Array<{ month: number; categoryId: string; count: number }>,
  catMap: Map<string, { name: string; color: string }>,
): CategoryMonthData[] {
  // Phase 1: group rows by month number (0 = Jan).
  const byMonth = new Map<number, Array<{ categoryId: string; count: number }>>();
  for (const row of rows) {
    const bucket = byMonth.get(row.month) ?? [];
    bucket.push({ categoryId: row.categoryId, count: row.count });
    byMonth.set(row.month, bucket);
  }
  // Phase 2: produce exactly 12 items, filling gaps with empty segments.
  return Array.from({ length: 12 }, (_, i) => ({
    month: i,
    segments: (byMonth.get(i) ?? []).map(s => ({
      name:  catMap.get(s.categoryId)?.name  ?? s.categoryId,
      color: catMap.get(s.categoryId)?.color ?? FALLBACK_COLOR,
      count: s.count,
    })),
  }));
}

/**
 * Builds the 7-item simple week data used by preview cards on StatsScreen.
 *
 * Preview cards use WeeklyMiniChart (not WeekBarGraph), which renders solid
 * bars in the card's own accent color. Segments are never shown, so we use
 * the simple variant. The filter scopes the query to a single template or
 * category when building template/category preview lists.
 */
function buildPreviewWeek(filter?: StatFilter): DayData[] {
  return buildWeekBarsSimple(
    getCompletionsByDay(startOfCurrentWeek(), endOfCurrentWeek(), filter),
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useStats() {

  // ── Detail screen bundles ────────────────────────────────────────────────

  /**
   * Assembles the full data bundle for OverallDetailScreen.
   *
   * Called with the `params.id` from navigation ('all_time' | 'all_year' |
   * 'all_month' | 'all_week'). The bucket id controls two things:
   *   1. The date range for bucket-scoped queries (CompletionSummaryCard,
   *      StreakCard, DayOfWeekPatternCard, TaskTypeBreakdownCard,
   *      CategoryBreakdownCard).
   *   2. Nothing else — graphs always show the current period regardless of
   *      which bucket opened the screen (per the UI spec: the graph cards are
   *      always "current week / current month / current year").
   *
   * The TimeRangeCountsCard always shows all four canonical window counts
   * regardless of which bucket is active — this is intentional per design.
   *
   * @param bucketId - The id passed via StatDetailParams.
   */
  function getOverallDetail(bucketId: string): OverallDetailData {
    const now   = new Date();
    const year  = now.getFullYear();
    const range = bucketDateRange(bucketId); // null for 'all_time'

    // ── Streaks ────────────────────────────────────────────────────────────
    // Pass range?.startDate to getCompletionDates so the date list is capped
    // to the bucket's window. This enforces the constraint that a "week" bucket
    // streak cannot count days before this Monday, and a "month" bucket streak
    // cannot count days before the 1st of this month.
    //
    // For 'all_time', range is null so startDate is undefined — the storage
    // function applies a 400-day lookback, which safely captures any realistic
    // streak while bounding the result set size.
    //
    // We fetch the date list once and pass it to both streak functions to avoid
    // two identical database queries.
    const dates         = getCompletionDates(range?.startDate);
    const currentStreak = calcCurrentStreak(dates);
    const bestStreak    = calcBestStreak(dates);

    // ── Completion summary ──────────────────────────────────────────────────
    // The ring + count on CompletionSummaryCard is scoped to the bucket window.
    // For 'all_time' we use a far-past start date rather than omitting it,
    // because getCompletionSummary requires explicit start/end bounds.
    const summary = range
      ? getCompletionSummary(range.startDate, range.endDate)
      : getCompletionSummary('2000-01-01', toLocalDateString(now));

    // ── Time-range counts + breakdown ───────────────────────────────────────
    // These always span all four canonical windows regardless of bucketId.
    // TimeRangeCountsCard shows all four rows on every detail screen.
    const timeSummary = getStatSummary();   // { allTimeCount, weekCount, monthCount, yearCount }
    const breakdown   = buildBreakdown();   // perm/one-off split per window, no filter

    // ── Graph data — always current period, regardless of bucket ───────────
    // Per UI spec: graphs show current week / month / year even when the screen
    // was opened from e.g. "All Time". The bucket only affects the summary cards.
    const weekStart  = startOfCurrentWeek();
    const weekEnd    = endOfCurrentWeek();
    // WithKind variant: splits permanent vs one-off for stacked bar segments.
    const weeklyData = buildWeekBars(getCompletionsByDayWithKind(weekStart, weekEnd));

    const monthStart  = startOfCurrentMonth();
    const monthEnd    = endOfCurrentMonth();
    // Plain variant for calendar: each cell needs completed + scheduled total,
    // but no segment split (the ring fill is a single percentage, not stacked).
    const monthlyData = buildCalendarData(getCompletionsByDay(monthStart, monthEnd));

    // 12 monthly rows, already zero-filled by storage. WithKind for segments.
    const yearlyData = buildMonthBars(getCompletionsByMonthWithKind(year));

    // ── Day-of-week pattern ─────────────────────────────────────────────────
    // Scoped to the bucket's window so the pattern reflects the selected period:
    //   all_week  → Mon–Sun only, shows this week's pattern
    //   all_month → this month's pattern
    //   all_year  → this year's pattern
    //   all_time  → undefined/undefined → no date filter → all-time pattern
    //
    // range?.startDate and range?.endDate are both undefined when range is null,
    // which getCompletionsByWeekday interprets as "no date filter". This is the
    // correct all-time behaviour.
    const dayOfWeekData = buildDowData(
      getCompletionsByWeekday(range?.startDate, range?.endDate),
    );

    // ── Task-type split ─────────────────────────────────────────────────────
    // Scoped to bucket. For 'all_time', both args are undefined — no date filter.
    const typeSplit = getTaskTypeSplit(range?.startDate, range?.endDate);

    // ── Category breakdown ──────────────────────────────────────────────────
    // catMap is loaded once and reused for both the breakdown card and the two
    // category graphs below, avoiding three separate category table queries.
    const catMap  = getCategoryMap();
    const topCats = getTopCategories(5, range?.startDate, range?.endDate);
    const categories: CategoryBreakdownItem[] = topCats.map(r => ({
      name:    catMap.get(r.categoryId)?.name  ?? r.categoryId,
      color:   catMap.get(r.categoryId)?.color ?? FALLBACK_COLOR,
      count:   r.count,
      percent: r.rate, // already 0–100 integer from storage
    }));

    // ── Category stacked graphs ─────────────────────────────────────────────
    // These always show the current period (not scoped to the bucket) because
    // they are full-fidelity graphs that show category breakdown over time,
    // not bucket-relative summaries. The bucket concept doesn't apply here.
    const categoryWeeklyData = buildCategoryWeekData(
      getCompletionsByDayByCategory(weekStart, weekEnd),
      catMap,
    );
    const categoryYearlyData = buildCategoryYearData(
      getCompletionsByMonthByCategory(year),
      catMap,
    );

    return {
      completed:      summary.completed,
      total:          summary.totalAttempts,
      currentStreak,
      bestStreak,
      // Spread timeSummary to get weekCount, monthCount, yearCount, allTimeCount
      // as flat fields — matches the OverallDetailMockData interface shape.
      ...timeSummary,
      breakdown,
      weeklyData,
      monthlyData,
      yearlyData,
      dayOfWeekData,
      permanentCount: typeSplit.permanentCount,
      oneOffCount:    typeSplit.oneOffCount,
      categories,
      categoryWeeklyData,
      categoryYearlyData,
    };
  }

  /**
   * Assembles the full data bundle for CategoryDetailScreen.
   *
   * Unlike OverallDetailScreen, CategoryDetailScreen has no bucket concept —
   * it always shows all-time data filtered to this category. There is no
   * bucket id to map; the entire screen is one "view" of one category.
   *
   * Key differences from getOverallDetail:
   *   - All queries receive { categoryId } as the StatFilter.
   *   - Streak lookback has no startDate cap (all-time window).
   *   - DayOfWeekPatternCard uses all-time data (no date restriction).
   *   - Task-type split is all-time within the category.
   *   - No category graph cards (CategoryWeekBarGraph / CategoryYearOverviewGraph
   *     are Overall-only — they would be a category-breakdown of a single
   *     category, which is meaningless).
   *   - PermanentTaskListCard is added — lists templates in this category.
   *
   * @param categoryId - The category's id (e.g. 'cat_work').
   */
  function getCategoryDetail(categoryId: string): CategoryDetailData {
    const filter: StatFilter = { categoryId };
    const now  = new Date();
    const year = now.getFullYear();

    // All-time streaks — no startDate cap. We want to know the user's actual
    // current streak for this category across all history, not just recent days.
    const dates         = getCompletionDates(undefined, filter);
    const currentStreak = calcCurrentStreak(dates);
    const bestStreak    = calcBestStreak(dates);

    // All-time completion summary scoped to this category.
    // '2000-01-01' is used as a guaranteed-earlier-than-any-data start date
    // so we don't need a special "no start date" branch in getCompletionSummary.
    const summary     = getCompletionSummary('2000-01-01', toLocalDateString(now), filter);
    const timeSummary = getStatSummary(filter);   // four window counts, category-scoped
    const breakdown   = buildBreakdown(filter);   // four window splits, category-scoped

    // Graphs — always current period, filtered to this category.
    // The graphs always show what's happening right now for this category.
    const weekStart  = startOfCurrentWeek();
    const weekEnd    = endOfCurrentWeek();
    // WithKind so WeekBarGraph can show a perm/one-off split within the category.
    const weeklyData = buildWeekBars(getCompletionsByDayWithKind(weekStart, weekEnd, filter));

    const monthStart  = startOfCurrentMonth();
    const monthEnd    = endOfCurrentMonth();
    const monthlyData = buildCalendarData(getCompletionsByDay(monthStart, monthEnd, filter));

    const yearlyData = buildMonthBars(getCompletionsByMonthWithKind(year, filter));

    // DayOfWeekPatternCard — all-time within this category. Unlike the overall
    // detail screen (where DOW is bucket-scoped), category DOW always shows the
    // user's full historical pattern for this category.
    const dayOfWeekData = buildDowData(getCompletionsByWeekday(undefined, undefined, filter));

    // Task-type split — all-time within this category. Shows how the user
    // mixes permanent and one-off tasks in this area of their life.
    const typeSplit = getTaskTypeSplit(undefined, undefined, filter);

    // Permanent task list — one row per template that belongs to this category
    // and has at least one logged completion. Sorted by totalCompleted DESC.
    // getTemplateName does a per-row lookup; with a typical ≤20 templates per
    // category this is negligible. If a template has no completions it won't
    // appear (getPermanentTaskSummariesForCategory only returns active ones).
    const templateRows = getPermanentTaskSummariesForCategory(categoryId);
    const permanentTasks: PermanentTaskStat[] = templateRows.map(r => ({
      id:             r.templateId,
      name:           getTemplateName(r.templateId),
      completed:      r.totalCompleted,
      total:          r.totalAttempts,
      // Guard against division by zero for templates that somehow have zero
      // attempts (shouldn't occur since the query only returns rows with ≥1
      // completion, but defensive coding prevents a NaN leaking to the UI).
      completionRate: r.totalAttempts > 0
        ? Math.round((r.totalCompleted / r.totalAttempts) * 100)
        : 0,
    }));

    return {
      completed:      summary.completed,
      total:          summary.totalAttempts,
      currentStreak,
      bestStreak,
      ...timeSummary,
      breakdown,
      weeklyData,
      monthlyData,
      yearlyData,
      dayOfWeekData,
      permanentCount: typeSplit.permanentCount,
      oneOffCount:    typeSplit.oneOffCount,
      permanentTasks,
    };
  }

  /**
   * Assembles the full data bundle for PermanentDetailScreen.
   *
   * The simplest of the three detail bundles — no category breakdown cards,
   * no TaskTypeBreakdownCard (the screen is already scoped to one task type),
   * no TimeRangeBreakdown (the four-window split is not shown on this screen).
   *
   * Key differences from the other detail functions:
   *   - Graph queries use getCompletionsByDay instead of WithKind (single
   *     template → no meaningful perm/one-off split → solid bars).
   *   - yearlyData uses getCompletionsByMonth instead of WithKind for the
   *     same reason.
   *   - No `breakdown` field — TimeRangeCountsCard on PermanentDetailScreen
   *     uses the simple two-column layout (no per-window split shown).
   *   - DayOfWeekPatternCard is all-time — shows the user's habitual completion
   *     pattern for this specific recurring task across all history.
   *
   * @param templateId - The template's permanentId (e.g. 'tpl_morning').
   */
  function getPermanentDetail(templateId: string): PermanentDetailData {
    const filter: StatFilter = { templateId };
    const now  = new Date();
    const year = now.getFullYear();

    // All-time streaks, template-scoped. No startDate cap — we want the full
    // consecutive-day history for this specific task.
    const dates         = getCompletionDates(undefined, filter);
    const currentStreak = calcCurrentStreak(dates);
    const bestStreak    = calcBestStreak(dates);

    // All-time summary scoped to this template.
    const summary     = getCompletionSummary('2000-01-01', toLocalDateString(now), filter);
    const timeSummary = getStatSummary(filter); // four window counts, template-scoped

    // Week bars — simple variant (solid bars, no perm/one-off segments).
    // All completions on this screen are for this template, so the split
    // would always be "100% permanent", which adds no information.
    const weekStart  = startOfCurrentWeek();
    const weekEnd    = endOfCurrentWeek();
    const weeklyData = buildWeekBarsSimple(getCompletionsByDay(weekStart, weekEnd, filter));

    const monthStart  = startOfCurrentMonth();
    const monthEnd    = endOfCurrentMonth();
    const monthlyData = buildCalendarData(getCompletionsByDay(monthStart, monthEnd, filter));

    // Year bars — use getCompletionsByMonth (not WithKind) for the same reason:
    // all bars represent this one template, no split needed.
    const yearlyData = buildMonthBarsSimple(getCompletionsByMonth(year, filter));

    // Day-of-week — all-time for this template. Reveals the user's habitual
    // pattern: "I tend to complete this task on weekdays, almost never on Sunday."
    const dayOfWeekData = buildDowData(getCompletionsByWeekday(undefined, undefined, filter));

    return {
      completed:     summary.completed,
      total:         summary.totalAttempts,
      currentStreak,
      bestStreak,
      ...timeSummary, // weekCount, monthCount, yearCount, allTimeCount
      weeklyData,
      monthlyData,
      yearlyData,
      dayOfWeekData,
    };
  }

  // ── StatsScreen preview card lists ────────────────────────────────────────
  //
  // These three functions replace the three getMock*() calls in StatsScreen.
  // Each returns an array of StatPreviewData — one item per card in the
  // collapsible section. The preview card shows: total completed, a completion
  // rate ring, current streak, and a 7-bar mini chart of this week's activity.

  /**
   * Returns one StatPreviewData for each of the four overall time buckets.
   *
   * ── Why weeklyData is shared across all four cards ────────────────────────
   * All four overall preview cards show the same WeeklyMiniChart data (current
   * week). This is intentional — the mini chart is a "recent activity" indicator,
   * not a bucket-scoped view. Bucket-scoped bar graphs live in the detail screen.
   *
   * ── Why streak is shared across all four cards ────────────────────────────
   * The "current streak" shown on an overall preview card is the user's global
   * current streak — the same value regardless of which bucket the card represents.
   * A single getCompletionDates() call (no filter, no startDate cap) is used
   * for all four cards to avoid four redundant streak queries.
   *
   * ── completionPercent ─────────────────────────────────────────────────────
   * Each bucket gets its own rate because the denominator differs:
   *   all_time → all evaluated tasks ever
   *   all_year → tasks evaluated this calendar year
   *   etc.
   * Four lightweight getCompletionSummary calls, each hitting idx_clog_date.
   */
  function getOverallStatsList(): StatPreviewData[] {
    const now  = new Date();
    const year = now.getFullYear();

    // Single call for all four counts — more efficient than four separate queries.
    const timeSummary = getStatSummary();
    // Shared streak and weekly chart for all four cards (see doc above).
    const streak     = calcCurrentStreak(getCompletionDates()); // 400-day lookback, no filter
    const weeklyData = buildPreviewWeek();

    // Per-bucket completion rates — one query each.
    const allTimeRate = getCompletionSummary('2000-01-01',          toLocalDateString(now));
    const yearRate    = getCompletionSummary(`${year}-01-01`,       `${year}-12-31`);
    const monthRate   = getCompletionSummary(startOfCurrentMonth(), endOfCurrentMonth());
    const weekRate    = getCompletionSummary(startOfCurrentWeek(),  endOfCurrentWeek());

    // Inline helper — avoids repeating the div-by-zero guard four times.
    // Returns 0 rather than NaN when no tasks have been evaluated yet.
    const pct = (s: { completed: number; totalAttempts: number }) =>
      s.totalAttempts > 0 ? Math.round((s.completed / s.totalAttempts) * 100) : 0;

    // Cards are ordered All Time → Year → Month → Week to match the visual
    // layout in StatsScreen (most expansive window at the top).
    return [
      {
        type: 'all', id: 'all_time',  name: 'All Time',
        totalCompleted: timeSummary.allTimeCount, completionPercent: pct(allTimeRate),
        currentStreak: streak, weeklyData, color: '#FF9500',
      },
      {
        type: 'all', id: 'all_year',  name: 'This Year',
        totalCompleted: timeSummary.yearCount,    completionPercent: pct(yearRate),
        currentStreak: streak, weeklyData, color: '#FF9500',
      },
      {
        type: 'all', id: 'all_month', name: 'This Month',
        totalCompleted: timeSummary.monthCount,   completionPercent: pct(monthRate),
        currentStreak: streak, weeklyData, color: '#FF9500',
      },
      {
        type: 'all', id: 'all_week',  name: 'This Week',
        totalCompleted: timeSummary.weekCount,    completionPercent: pct(weekRate),
        currentStreak: streak, weeklyData, color: '#FF9500',
      },
    ];
  }

  /**
   * Returns one StatPreviewData per permanent task template.
   *
   * ── Why query templates directly rather than going through storage ─────────
   * statsStorage.ts owns reads from completion_log. The templates table is a
   * separate lookup table for task definitions. Querying it directly here is
   * within the coupling rules (supplementary joins are permitted).
   *
   * ── Why a per-template loop rather than a single bulk query ───────────────
   * Each template needs its own completion rate and streak, which require
   * separate completion_log queries filtered by templateId. A bulk approach
   * would need complex SQL to compute all three fields across all templates
   * in a single query — the N-query loop is simpler and fast enough because
   * each query hits the idx_clog_template composite index.
   *
   * ── Color resolution ──────────────────────────────────────────────────────
   * Templates inherit their color from their category. If the template has no
   * category (category_id IS NULL) or the category has been deleted, we fall
   * back to the default blue '#007AFF'. catMap is built once and reused across
   * all iterations to avoid N category table queries.
   *
   * ── Templates with zero completions ──────────────────────────────────────
   * All templates are included even if totalCompleted = 0. The preview card
   * shows them with an empty ring (0%) and streak of 0. This lets users see
   * all their permanent tasks in the list, not just the active ones.
   */
  function getTemplateStatsList(): StatPreviewData[] {
    const now  = new Date();
    const rows = db.getAllSync<{
      permanentId:   string;
      templateTitle: string;
      category_id:   string | null;
    }>('SELECT permanentId, templateTitle, category_id FROM templates WHERE isTemplate = 1 ORDER BY createdAt ASC');

    const catMap = getCategoryMap(); // load once, reuse per template

    return rows.map(row => {
      const filter: StatFilter = { templateId: row.permanentId };

      // All-time summary for this template — provides totalCompleted and the
      // totalAttempts denominator for completionPercent.
      const summary = getCompletionSummary('2000-01-01', toLocalDateString(now), filter);

      // All-time streak for this template — no startDate cap.
      const streak = calcCurrentStreak(getCompletionDates(undefined, filter));

      // Current week mini-chart, template-scoped, simple (no segments).
      const weeklyData = buildPreviewWeek(filter);

      // Category color as the card accent. Falls back to blue if uncategorised.
      const color = row.category_id
        ? (catMap.get(row.category_id)?.color ?? '#007AFF')
        : '#007AFF';

      return {
        type:              'template' as const, // narrows type to StatType
        id:                row.permanentId,
        name:              row.templateTitle,
        totalCompleted:    summary.completed,
        completionPercent: summary.totalAttempts > 0
          ? Math.round((summary.completed / summary.totalAttempts) * 100)
          : 0,
        currentStreak:     streak,
        weeklyData,
        color,
      };
    });
  }

  /**
   * Returns one StatPreviewData per category.
   *
   * Same structure as getTemplateStatsList — each category gets its own
   * completion rate and streak filtered to that category's completions.
   *
   * ── Sort order ────────────────────────────────────────────────────────────
   * Categories are sorted default-first (is_default DESC), then alphabetically.
   * Default categories (Work, Health, etc.) appear at the top of the list,
   * user-created categories follow in alphabetical order. This matches the
   * order used by getAllCategories() in categoryStorage.
   *
   * ── Categories with zero completions ─────────────────────────────────────
   * Included. A category may exist but have no logged completions yet if the
   * user created it but hasn't completed any tasks in it since the backfill.
   * The preview card shows 0 completed, 0% rate, 0 streak — valid state.
   */
  function getCategoryStatsList(): StatPreviewData[] {
    const now  = new Date();
    const rows = db.getAllSync<{ id: string; name: string; color: string | null }>(
      'SELECT id, name, color FROM categories ORDER BY is_default DESC, name ASC',
    );

    return rows.map(row => {
      const filter: StatFilter = { categoryId: row.id };

      const summary    = getCompletionSummary('2000-01-01', toLocalDateString(now), filter);
      const streak     = calcCurrentStreak(getCompletionDates(undefined, filter));
      const weeklyData = buildPreviewWeek(filter);
      // Use category's own color, fall back to gray if the column is null.
      const color      = row.color ?? FALLBACK_COLOR;

      return {
        type:              'category' as const,
        id:                row.id,
        name:              row.name,
        totalCompleted:    summary.completed,
        completionPercent: summary.totalAttempts > 0
          ? Math.round((summary.completed / summary.totalAttempts) * 100)
          : 0,
        currentStreak:     streak,
        weeklyData,
        color,
      };
    });
  }

  // ── Past-period navigation helpers ──────────────────────────────────────────
  //
  // These are called by graph navigation callbacks in the detail screens.
  // Each one runs a targeted storage query for the requested period and
  // returns data shaped for the relevant graph component.
  //
  // Naming convention mirrors the private builders they wrap:
  //   *BarData     → with perm/one-off segments (OverallDetailScreen, CategoryDetailScreen)
  //   *DataSimple  → solid bars, no segments (PermanentDetailScreen)
  //   Category*    → category-stacked graphs (OverallDetailScreen only)
  //
  // The optional `filter` param scopes queries to a category or template,
  // matching the scope of the detail screen the callback lives in.

  /**
   * Week bar data (with perm/one-off segments) for a specific Monday.
   * Used by WeekBarGraph.onWeekChange in OverallDetailScreen and CategoryDetailScreen.
   */
  function getWeekBarData(weekStart: Date, filter?: StatFilter): DayData[] {
    const start = toLocalDateString(weekStart);
    const end   = addDays(start, 6);
    return buildWeekBars(getCompletionsByDayWithKind(start, end, filter));
  }

  /**
   * Week bar data (solid bars, no segments) for a specific Monday.
   * Used by WeekBarGraph.onWeekChange in PermanentDetailScreen.
   */
  function getWeekBarDataSimple(weekStart: Date, filter?: StatFilter): DayData[] {
    const start = toLocalDateString(weekStart);
    const end   = addDays(start, 6);
    return buildWeekBarsSimple(getCompletionsByDay(start, end, filter));
  }

  /**
   * Calendar data for a specific year + 0-indexed month.
   * Used by MonthCalendarGraph.onMonthChange in all three detail screens.
   * Finds the last day of the month via Date arithmetic to avoid hardcoding.
   */
  function getMonthCalendarData(
    year: number, month: number, filter?: StatFilter,
  ): CalendarDayData[] {
    const mm       = String(month + 1).padStart(2, '0');
    const lastDay  = new Date(year, month + 1, 0).getDate(); // day 0 of next month = last day of this month
    const start    = `${year}-${mm}-01`;
    const end      = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
    return buildCalendarData(getCompletionsByDay(start, end, filter));
  }

  /**
   * Year bar data (with perm/one-off segments) for a specific year.
   * Used by YearOverviewGraph.onYearChange in OverallDetailScreen and CategoryDetailScreen.
   */
  function getYearBarData(year: number, filter?: StatFilter): MonthData[] {
    return buildMonthBars(getCompletionsByMonthWithKind(year, filter));
  }

  /**
   * Year bar data (solid bars, no segments) for a specific year.
   * Used by YearOverviewGraph.onYearChange in PermanentDetailScreen.
   */
  function getYearBarDataSimple(year: number, filter?: StatFilter): MonthData[] {
    return buildMonthBarsSimple(getCompletionsByMonth(year, filter));
  }

  /**
   * Category-stacked week bar data for a specific Monday.
   * Used by CategoryWeekBarGraph.onWeekChange in OverallDetailScreen.
   * getCategoryMap() is called fresh each navigation to pick up any color changes.
   */
  function getCategoryWeekBarData(weekStart: Date): CategoryDayData[] {
    const start  = toLocalDateString(weekStart);
    const end    = addDays(start, 6);
    const catMap = getCategoryMap();
    return buildCategoryWeekData(getCompletionsByDayByCategory(start, end), catMap);
  }

  /**
   * Category-stacked year bar data for a specific year.
   * Used by CategoryYearOverviewGraph.onYearChange in OverallDetailScreen.
   */
  function getCategoryYearBarData(year: number): CategoryMonthData[] {
    const catMap = getCategoryMap();
    return buildCategoryYearData(getCompletionsByMonthByCategory(year), catMap);
  }

  // ── TodayCard ─────────────────────────────────────────────────────────────

  /**
   * Assembles the full TodayStats bundle for TodayCard.
   *
   * Combines two data sources:
   *   completion_log  — tasks completed today (outcome = 'completed')
   *   tasks table     — tasks still pending today (completed = 0, due today)
   *
   * `totalTasks`    = completedTasks + pendingTotal  (all evaluated tasks today)
   * `permanentTotal`= permanentDone + permanentPending
   * `oneOffTotal`   = oneOffDone    + oneOffPending
   *
   * Category rows are built by unioning done and pending per category, then
   * sorted by total (done + pending) descending so the most active category
   * appears first.
   *
   * Streak uses the global 400-day lookback (same as getOverallStatsList).
   */
  function getTodayStats(): TodayStats {
    const raw    = getTodayRaw();
    const catMap = getCategoryMap();

    const totalTasks     = raw.completedTasks + raw.permanentPending + raw.oneOffPending;
    const permanentTotal = raw.permanentDone  + raw.permanentPending;
    const oneOffTotal    = raw.oneOffDone     + raw.oneOffPending;

    // Build category rows by merging done and pending maps.
    const doneByCat    = new Map(raw.doneByCategory.map(r    => [r.categoryId, r.count]));
    const pendingByCat = new Map(raw.pendingByCategory.map(r => [r.categoryId, r.count]));
    const allCatIds    = new Set([
      ...raw.doneByCategory.map(r    => r.categoryId),
      ...raw.pendingByCategory.map(r => r.categoryId),
    ]);

    const categories: CategoryStat[] = [...allCatIds]
      .map(id => {
        const done    = doneByCat.get(id)    ?? 0;
        const pending = pendingByCat.get(id) ?? 0;
        const cat     = catMap.get(id);
        return {
          name:  cat?.name  ?? id,
          color: cat?.color ?? FALLBACK_COLOR,
          done,
          total: done + pending,
        };
      })
      .sort((a, b) => b.total - a.total); // most active category first

    const streak = calcCurrentStreak(getCompletionDates());

    return {
      totalTasks,
      completedTasks:  raw.completedTasks,
      permanentTotal,
      permanentDone:   raw.permanentDone,
      oneOffTotal,
      oneOffDone:      raw.oneOffDone,
      categories,
      streak,
    };
  }

  return {
    getOverallDetail,
    getCategoryDetail,
    getPermanentDetail,
    getOverallStatsList,
    getTemplateStatsList,
    getCategoryStatsList,
    getWeekBarData,
    getWeekBarDataSimple,
    getMonthCalendarData,
    getYearBarData,
    getYearBarDataSimple,
    getCategoryWeekBarData,
    getCategoryYearBarData,
    getTodayStats,
  };
}
