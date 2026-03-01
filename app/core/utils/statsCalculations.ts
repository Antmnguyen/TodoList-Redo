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
