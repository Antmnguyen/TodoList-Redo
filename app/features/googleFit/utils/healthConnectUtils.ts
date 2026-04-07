// app/features/googleFit/utils/healthConnectUtils.ts
// =============================================================================
// HEALTH CONNECT STATS HELPERS
// =============================================================================
//
// Pure computation layer for the Steps and Sleep detail screens.
// These helpers sit between the SQLite storage layer and the React UI — they
// accept arrays of already-loaded rows and return display-ready stats with no
// side effects, no SQLite calls, and no React imports.
//
// ── Why pure functions instead of hooks? ─────────────────────────────────────
//
//   The detail screens own all data loading (via useEffect + useState).
//   Computing stats inside a hook would create an implicit dependency boundary
//   that makes it harder to reason about when re-renders happen. By keeping
//   these as plain functions, the screens compute stats with useMemo and the
//   dependency array is explicit: [rows, goal]. Any time the goal changes (user
//   edits it inline), stats instantly update without a re-load.
//
// ── Calling pattern ──────────────────────────────────────────────────────────
//
//   Each detail screen calls computeStepsStats (or computeSleepStats) TWICE:
//
//     const weekStats  = computeStepsStats(weekRows,  goal);
//     const monthStats = computeStepsStats(monthRows, goal);
//
//   Because the same function handles both ranges, both `weekAvg` and `monthAvg`
//   are populated with the same value — the average of whatever rows were passed.
//   The screen then reads weekStats.weekAvg for the week figure and
//   monthStats.monthAvg for the month figure. This avoids branching inside the
//   function while keeping the interface self-documenting.
//
// ── Streak semantics ─────────────────────────────────────────────────────────
//
//   Streaks here use the simple calendar-day helpers from statsCalculations.ts
//   (calcCurrentStreak / calcBestStreak), NOT the slot-based template helpers.
//   Health data doesn't have "scheduled slots" — you either hit the goal on a
//   given day or you didn't. A gap of any size resets the streak.
//
//   Goal-met dates are extracted by filtering rows where the value (steps or
//   sleepHours) meets the threshold, then mapping to date strings. These date
//   strings are already in ascending order because the SQL query returns rows
//   ORDER BY date ASC.
//
// ── Personal best ────────────────────────────────────────────────────────────
//
//   The StepsStats / SleepStats interfaces include a `personalBest` field for
//   completeness, but it is always null when returned by these functions. The
//   detail screens load personal best separately via getStepsPersonalBest() /
//   getSleepPersonalBest() because those functions query the ALL-TIME max, not
//   a specific date range — they need a different SQL query than what's used
//   for the chart data.
//
// =============================================================================

import {
  StepsDayRecord,
  SleepDayRecord,
} from '../../../core/services/storage/healthConnectStorage';
import {
  calcCurrentStreak,
  calcBestStreak,
} from '../../../core/utils/statsCalculations';

// =============================================================================
// STEPS STATS
// =============================================================================

/**
 * All display statistics derived from a steps history row-set.
 *
 * weekAvg / monthAvg intentionally hold the same value — they are both set to
 * the average of the rows passed in. Which field the screen reads depends on
 * which range of rows it passed:
 *
 *   computeStepsStats(weekRows,  goal) → weekStats.weekAvg  = week average
 *   computeStepsStats(monthRows, goal) → monthStats.monthAvg = month average
 *
 * personalBest is always null here — the screen loads it via
 * getStepsPersonalBest() which issues its own SQL MAX query across all time.
 */
export interface StepsStats {
  /** Average steps across non-empty days in the input range. Null if no data. */
  weekAvg: number | null;
  /** Same as weekAvg — both set so the screen can read from either call. */
  monthAvg: number | null;
  /** Not computed here — provided by the screen via getStepsPersonalBest(). */
  personalBest: number | null;
  /** Number of consecutive days ending today where steps >= goal. */
  currentStreak: number;
  /** Longest ever consecutive run of days where steps >= goal (all time). */
  bestStreak: number;
}

/**
 * Derive display statistics from a slice of the steps history log.
 *
 * The function is intentionally range-agnostic — it computes stats from
 * whatever rows are passed. This makes it reusable for both week and month
 * ranges without any internal branching.
 *
 * Average calculation: only days with steps > 0 are included. A day that
 * exists in the log with steps = 0 would represent a recorded-but-empty day
 * (e.g. HC had permission but the user didn't walk at all). Including those
 * zeros would unfairly drag the average down, especially early in the month
 * when many future days haven't happened yet.
 *
 * @param rows  StepsDayRecord array for the desired date range, ascending.
 *              Comes from getStepsInRange(startDate, today).
 * @param goal  The user's current steps display goal from getStepsGoal().
 *              Used to filter goal-met dates for streak computation.
 */
export function computeStepsStats(rows: StepsDayRecord[], goal: number): StepsStats {

  // ── Average ───────────────────────────────────────────────────────────────
  //
  // Filter to days with recorded steps, then compute a simple arithmetic mean.
  // Round to the nearest integer because step counts are inherently whole numbers
  // and displaying "7,234.3 steps" would look odd.

  const activeDays = rows.filter(r => r.steps > 0);

  const avg =
    activeDays.length > 0
      ? Math.round(
          activeDays.reduce((sum, r) => sum + r.steps, 0) / activeDays.length,
        )
      : null;

  // ── Goal-met streak dates ─────────────────────────────────────────────────
  //
  // Extract only the dates where the user actually hit their goal. These are
  // passed to the streak helpers which expect an ascending array of 'YYYY-MM-DD'
  // strings — the SQL ORDER BY date ASC guarantees this order is already correct.
  //
  // Note: we filter by >= goal (not > goal) so that exactly hitting the goal
  // counts as a success — consistent with how the ring and colour logic work.

  const goalMetDates = rows
    .filter(r => r.steps >= goal)
    .map(r => r.date);

  const currentStreak = calcCurrentStreak(goalMetDates);
  const bestStreak    = calcBestStreak(goalMetDates);

  return {
    weekAvg:       avg,
    monthAvg:      avg,   // same value — screen reads the appropriate property
    personalBest:  null,  // loaded separately via getStepsPersonalBest()
    currentStreak,
    bestStreak,
  };
}

// =============================================================================
// SLEEP STATS
// =============================================================================

/**
 * All display statistics derived from a sleep history row-set.
 *
 * Mirrors StepsStats exactly — same two-call pattern, same null personalBest.
 * Sleep values are kept as floats (not rounded to integers) because the
 * difference between 7.3 h and 7.8 h is meaningful and users expect decimals
 * for hours. Rounded to 2 decimal places to avoid floating-point noise like
 * 7.000000000001.
 */
export interface SleepStats {
  /** Average sleep hours (2 dp) on nights with data in the input range. */
  weekAvg: number | null;
  /** Same as weekAvg — both set so the screen can read from either call. */
  monthAvg: number | null;
  /** Not computed here — provided by the screen via getSleepPersonalBest(). */
  personalBest: number | null;
  /** Consecutive nights ending today where sleepHours >= goalHours. */
  currentStreak: number;
  /** Longest ever consecutive run of nights where sleepHours >= goalHours. */
  bestStreak: number;
}

/**
 * Derive display statistics from a slice of the sleep history log.
 *
 * Same design as computeStepsStats — range-agnostic, pure, no side effects.
 *
 * Average: nights with sleepHours = 0 are excluded, again to avoid diluting
 * the average with nights that simply weren't recorded.
 *
 * The values returned in weekAvg / monthAvg are rounded to 2 decimal places
 * so callers can safely call .toFixed(1) without unexpected floating-point
 * artefacts from the division.
 *
 * @param rows       SleepDayRecord array for the desired date range, ascending.
 *                   Comes from getSleepInRange(startDate, today).
 * @param goalHours  The user's current sleep display goal from getSleepGoal().
 */
export function computeSleepStats(rows: SleepDayRecord[], goalHours: number): SleepStats {

  // ── Average ───────────────────────────────────────────────────────────────
  //
  // Keep as float — sleep hours are meaningful at one decimal place.
  // Round to 2dp to eliminate floating-point noise before handing to the screen.

  const activeNights = rows.filter(r => r.sleepHours > 0);

  const rawAvg =
    activeNights.length > 0
      ? activeNights.reduce((sum, r) => sum + r.sleepHours, 0) / activeNights.length
      : null;

  const avg = rawAvg !== null ? Math.round(rawAvg * 100) / 100 : null;

  // ── Goal-met streak dates ─────────────────────────────────────────────────
  //
  // Sleep records are indexed by the *morning* the session ended (see
  // upsertSleepForDate — `date` = the calendar day the user woke up).
  // This means 'streak' here means 'consecutive mornings with enough sleep',
  // which is the intuitive reading: "I slept well last night" → today's entry.

  const goalMetDates = rows
    .filter(r => r.sleepHours >= goalHours)
    .map(r => r.date);

  const currentStreak = calcCurrentStreak(goalMetDates);
  const bestStreak    = calcBestStreak(goalMetDates);

  return {
    weekAvg:       avg,
    monthAvg:      avg,   // same value — screen reads the appropriate property
    personalBest:  null,  // loaded separately via getSleepPersonalBest()
    currentStreak,
    bestStreak,
  };
}
