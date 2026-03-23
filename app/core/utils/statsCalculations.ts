// app/core/utils/statsCalculations.ts
// Pure date math and streak logic — no storage or React imports.

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Returns a 'YYYY-MM-DD' string in device-local time for the given Date.
 */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the Monday of the current week as 'YYYY-MM-DD'.
 * JS getDay(): 0=Sun, 1=Mon … 6=Sat
 */
export function startOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return toLocalDateString(monday);
}

/**
 * Returns the Sunday of the current week as 'YYYY-MM-DD'.
 */
export function endOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 0 : 7 - day; // shift to Sunday
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + diff);
  return toLocalDateString(sunday);
}

/**
 * Returns the first day of the current month as 'YYYY-MM-DD'.
 */
export function startOfCurrentMonth(): string {
  const now = new Date();
  return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
}

/**
 * Returns the last day of the current month as 'YYYY-MM-DD'.
 */
export function endOfCurrentMonth(): string {
  const now = new Date();
  // Day 0 of next month = last day of this month
  return toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

/**
 * Returns the day before a 'YYYY-MM-DD' string, as 'YYYY-MM-DD'.
 */
export function prevDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d - 1);
  return toLocalDateString(date);
}

/**
 * Returns true if b is exactly one day after a (both 'YYYY-MM-DD').
 */
export function isNextDay(a: string, b: string): boolean {
  return prevDay(b) === a;
}

// ── Streak logic ──────────────────────────────────────────────────────────────

/**
 * Returns the current streak length: the number of consecutive days ending
 * today (or yesterday) that each have at least one completion.
 *
 * @param dates - sorted ascending array of distinct 'YYYY-MM-DD' strings,
 *                each representing a day with ≥1 completion.
 */
export function calcCurrentStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const today = toLocalDateString(new Date());
  let streak = 0;
  let cursor = today;

  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] === cursor) {
      streak++;
      cursor = prevDay(cursor);
    } else if (dates[i] < cursor) {
      // Gap found — streak is over
      break;
    }
    // dates[i] > cursor shouldn't happen with a sorted array, skip
  }

  return streak;
}

/**
 * Returns the longest-ever consecutive run of days with ≥1 completion.
 *
 * @param dates - sorted ascending array of distinct 'YYYY-MM-DD' strings.
 */
export function calcBestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  let best = 1;
  let current = 1;

  for (let i = 1; i < dates.length; i++) {
    if (isNextDay(dates[i - 1], dates[i])) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }

  return best;
}

// ── Slot-based streak logic (template / category scope) ───────────────────────
//
// These functions replace calcCurrentStreak / calcBestStreak for template and
// category scopes. The key differences:
//
//   - Unit of measurement: scheduled-date slots, not calendar days.
//   - Empty days between two scheduled slots are neutral (no reset).
//   - A slot with any auto_failed outcome breaks the streak immediately.
//   - The 1-increment-per-day cap: even if one completion day covers multiple
//     scheduled slots, it only contributes +1 to the streak count.

type SlotRow = { scheduled_date: string; failures: number; successes: number };

/**
 * Current streak for a template or category scope.
 *
 * Walks backward through scheduled-date slots (most recent first). Stops at
 * the first slot with any failures. Returns the number of distinct completion
 * days that covered slots in the unbroken run — the 1-per-day cap means
 * completing tasks from three consecutive slots all on one physical day still
 * only adds +1 to the streak.
 *
 * @param slots         - ascending array of scheduled-date slots with failure/success counts
 * @param completionDays - ascending array of distinct 'YYYY-MM-DD' strings where
 *                         at least one task was completed (outcome = 'completed')
 */
export function calcTemplateCurrentStreak(
  slots: SlotRow[],
  completionDays: string[],
): number {
  if (slots.length === 0) return 0;

  const sortedDays = [...completionDays].sort();
  const runDaySet  = new Set<string>();

  for (let i = slots.length - 1; i >= 0; i--) {
    const slot = slots[i];
    if (slot.failures > 0) break; // any failure ends the streak

    // Attribute a completion day to this slot's window:
    // (slots[i-1].scheduled_date, slots[i].scheduled_date]
    // The lower-bound exclusion prevents a single completion day from being
    // credited to two different slot windows.
    const lowerBound = i > 0 ? slots[i - 1].scheduled_date : null;
    for (const day of sortedDays) {
      if (lowerBound !== null && day <= lowerBound) continue;
      if (day <= slot.scheduled_date) {
        runDaySet.add(day);
        break;
      }
    }
  }

  return runDaySet.size;
}

/**
 * Best-ever streak for a template or category scope.
 *
 * Walks forward through scheduled-date slots. Consecutive slots with no
 * failures form a "run". A slot with failures ends the current run. Returns
 * the size of the longest run measured in distinct completion days
 * (1-per-day cap applied the same way as calcTemplateCurrentStreak).
 *
 * @param slots          - ascending array of scheduled-date slots
 * @param completionDays - ascending array of distinct completion date strings
 */
export function calcTemplateBestStreak(
  slots: SlotRow[],
  completionDays: string[],
): number {
  if (slots.length === 0) return 0;

  const sortedDays = [...completionDays].sort();
  let best       = 0;
  let runDaySet  = new Set<string>();

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    if (slot.failures > 0) {
      best      = Math.max(best, runDaySet.size);
      runDaySet = new Set<string>();
      continue;
    }

    const lowerBound = i > 0 ? slots[i - 1].scheduled_date : null;
    for (const day of sortedDays) {
      if (lowerBound !== null && day <= lowerBound) continue;
      if (day <= slot.scheduled_date) {
        runDaySet.add(day);
        break;
      }
    }
  }

  return Math.max(best, runDaySet.size);
}

// ── Calendar-day streak logic (overall scope) ─────────────────────────────────
//
// Overall streaks count consecutive calendar days where all scheduled tasks
// were completed (no auto_failed outcomes). A day with no tasks at all is
// neutral for template/category scopes but counts as a GAP for overall streaks
// — because "overall" means you must have been productive every day.

type DayRow = { completed_date: string; failures: number; successes: number };

/**
 * Overall current streak — consecutive calendar days ending today (or
 * yesterday) where at least one task was completed AND no tasks were
 * auto-failed.
 *
 * A gap between two active days (a calendar day with no logged activity)
 * breaks the overall streak. Days with failures > 0 also break it.
 *
 * @param days - ascending array of calendar days with failure/success counts
 *               (from getCalendarDayActivity — only days with any activity)
 */
export function calcOverallCurrentStreak(
  days: DayRow[],
): number {
  if (days.length === 0) return 0;

  const today     = toLocalDateString(new Date());
  const yesterday = prevDay(today);
  const dayMap    = new Map(days.map(d => [d.completed_date, d]));

  // Start from today; fall back to yesterday if today has no activity yet
  // (matches the standard streak UX: "I did it yesterday" keeps streak alive).
  const startDate = dayMap.has(today) ? today : yesterday;

  let streak = 0;
  let cursor = startDate;

  while (true) {
    const day = dayMap.get(cursor);
    if (!day) break;               // no activity on this day → gap → stop
    if (day.failures > 0) break;   // any failure kills the streak
    streak++;
    cursor = prevDay(cursor);
  }

  return streak;
}

/**
 * Overall best-ever streak — longest consecutive run of calendar days with
 * at least one completion and no failures.
 *
 * Any date gap or day with failures resets the current run.
 *
 * @param days - ascending array of calendar days with failure/success counts
 */
export function calcOverallBestStreak(
  days: DayRow[],
): number {
  if (days.length === 0) return 0;

  let best    = 0;
  let current = 0;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];

    // A date gap (non-consecutive day) ends the current run.
    if (i > 0 && !isNextDay(days[i - 1].completed_date, day.completed_date)) {
      best    = Math.max(best, current);
      current = 0;
    }

    if (day.failures > 0) {
      best    = Math.max(best, current);
      current = 0;
      continue;
    }

    current++;
  }

  return Math.max(best, current);
}
