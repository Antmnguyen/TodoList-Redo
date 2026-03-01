/**
 * @file statsStorage.ts
 * @description Stats storage service — the single gateway for all reads from
 *   and writes to the `completion_log` table.
 *
 * ## Architectural position
 *
 * ```
 * UI / React hooks
 *       │
 *       ▼
 *   useStats.ts  (hook — reads only, never writes)
 *       │
 *       ▼
 *   statsStorage.ts  ← this file
 *       │
 *       ├── completion_log  (append-only event log — all stats reads go here)
 *       └── tasks / template_instances / categories  (supplementary reads only)
 * ```
 *
 * ## Coupling rules (strictly enforced)
 *
 *   - `statsStorage.ts` is the ONLY file that reads `completion_log`.
 *   - `statsStorage.ts` is the ONLY file that writes `completion_log`
 *     (via `logCompletion()`).
 *   - `taskActions.ts` calls `logCompletion()` — it is the only external
 *     file that imports from this module for writes.
 *   - UI components and other service files never import this module.
 *
 * ## Synchronous API
 *
 *   All functions are synchronous. The hook assembles multiple calls into a
 *   plain object and returns it directly — no Promises needed. This matches
 *   the expo-sqlite sync API used throughout the app.
 *
 * ## Filter parameter
 *
 *   Most read functions accept an optional `StatFilter`. Passing no filter
 *   returns overall/all-task data. Passing `{ templateId }` scopes results
 *   to one permanent task template. Passing `{ categoryId }` scopes to one
 *   category. Both are never set simultaneously.
 *
 * @module services/storage/statsStorage
 */

import { db } from './database';
import {
  toLocalDateString,
  startOfCurrentWeek,
  startOfCurrentMonth,
  calcCurrentStreak,
  calcBestStreak,
} from '../../utils/statsCalculations';

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optional filter applied to all read queries.
 *
 *   templateId  — restrict results to completions of one permanent task template.
 *                 Maps to `completion_log.template_id`.
 *
 *   categoryId  — restrict results to completions within one category.
 *                 Maps to `completion_log.category_id`.
 *
 * Omit both for overall / all-task queries.
 * Both are never set simultaneously — the hook always uses one or neither.
 */
export interface StatFilter {
  templateId?: string;
  categoryId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal SQL helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the WHERE clause fragment and parameter array for a `StatFilter`.
 *
 * The returned `clause` always starts with a space and uses `AND` so it can
 * be safely concatenated after an existing WHERE condition:
 *
 *   `WHERE completed_date >= ?${filterClause(filter).clause}`
 *   params: [startDate, ...filterClause(filter).params]
 *
 * If no filter is supplied, clause is an empty string and params is empty.
 *
 * @param filter - Optional stat filter
 * @returns { clause: string, params: string[] }
 */
function buildFilterClause(filter?: StatFilter): { clause: string; params: string[] } {
  if (!filter) return { clause: '', params: [] };

  const parts: string[] = [];
  const params: string[] = [];

  if (filter.templateId) {
    parts.push('template_id = ?');
    params.push(filter.templateId);
  }
  if (filter.categoryId) {
    parts.push('category_id = ?');
    params.push(filter.categoryId);
  }

  if (parts.length === 0) return { clause: '', params: [] };
  return { clause: ' AND ' + parts.join(' AND '), params };
}

// ─────────────────────────────────────────────────────────────────────────────
// Write side
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Writes one row to `completion_log` when a task is marked complete.
 *
 * This is the **only write path** into `completion_log`. It is called
 * exclusively by `taskActions.completeTask()` — no UI, hook, or other service
 * calls this function.
 *
 * The log is **append-only**: this function only inserts. Rows are never
 * updated or deleted, even if the task is later toggled back to incomplete or
 * deleted. This preserves historical accuracy.
 *
 * ## ID format
 *   `clog_<completedAt>_<4-char random>` — the timestamp component gives
 *   temporal ordering; the random suffix handles the rare case of multiple
 *   completions within the same millisecond.
 *
 * ## completed_date
 *   Derived from `completedAt` using `toLocalDateString` — same function used
 *   by the backfill — so old and new rows sort consistently in calendar queries.
 *
 * @param entry.taskId        - tasks.id of the completed task
 * @param entry.templateId    - templates.permanentId, or null for one-off tasks
 * @param entry.categoryId    - categories.id at time of completion, or null
 * @param entry.taskKind      - 'permanent' | 'one_off'
 * @param entry.completedAt   - Unix ms timestamp (Date.now())
 * @param entry.scheduledDate - 'YYYY-MM-DD' of the task's due_date, or null
 *                              if the task had no due_date. Used as the
 *                              denominator for % mode in bar/calendar graphs.
 */
export function logCompletion(entry: {
  taskId:        string;
  templateId:    string | null;
  categoryId:    string | null;
  taskKind:      'one_off' | 'permanent';
  completedAt:   number;
  scheduledDate: string | null;
}): void {
  const id            = `clog_${entry.completedAt}_${Math.random().toString(36).slice(2, 6)}`;
  const completedDate = toLocalDateString(new Date(entry.completedAt));

  db.runSync(
    `INSERT INTO completion_log
       (id, task_id, template_id, category_id, task_kind, outcome,
        completed_at, completed_date, scheduled_date)
     VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
    [
      id,
      entry.taskId,
      entry.templateId,
      entry.categoryId,
      entry.taskKind,
      entry.completedAt,
      completedDate,
      entry.scheduledDate,
    ]
  );
}

/**
 * Writes one row to `completion_log` when a task is auto-failed (missed its
 * due date and pushed forward on app start).
 *
 * Key difference from `logCompletion`: `completed_date` is set to
 * `entry.scheduledDate` (the DUE day), NOT the detection date. This attributes
 * the failure to the correct calendar day in graphs even if detected the next
 * morning. `completed_at` stores `entry.failedAt` (actual detection timestamp).
 *
 * Called exclusively by `taskActions.autoFailOverdueTasks()`.
 *
 * @param entry.taskId        - tasks.id of the overdue task
 * @param entry.templateId    - templates.permanentId, or null for one-off tasks
 * @param entry.categoryId    - categories.id at detection time, or null
 * @param entry.taskKind      - 'permanent' | 'one_off'
 * @param entry.failedAt      - Unix ms timestamp of detection (Date.now())
 * @param entry.scheduledDate - 'YYYY-MM-DD' of the missed due_date
 */
export function logAutoFail(entry: {
  taskId:        string;
  templateId:    string | null;
  categoryId:    string | null;
  taskKind:      'one_off' | 'permanent';
  failedAt:      number;
  scheduledDate: string;
}): void {
  const id = `clog_${entry.failedAt}_${Math.random().toString(36).slice(2, 6)}`;

  db.runSync(
    `INSERT INTO completion_log
       (id, task_id, template_id, category_id, task_kind, outcome,
        completed_at, completed_date, scheduled_date)
     VALUES (?, ?, ?, ?, ?, 'auto_failed', ?, ?, ?)`,
    [
      id,
      entry.taskId,
      entry.templateId,
      entry.categoryId,
      entry.taskKind,
      entry.failedAt,
      entry.scheduledDate,  // completed_date = the due day, not detection day
      entry.scheduledDate,
    ]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Count queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Total number of completions within a calendar date range (inclusive).
 *
 * Used as a quick scalar when only the raw count is needed (e.g. for building
 * the TimeRangeCountsCard buckets individually). For the full four-bucket
 * summary in one call, prefer `getStatSummary()`.
 *
 * Index used: `idx_clog_date` (or composite template/category index when
 * a filter is applied).
 *
 * @param startDate - Inclusive start date 'YYYY-MM-DD'
 * @param endDate   - Inclusive end date 'YYYY-MM-DD'
 * @param filter    - Optional scope (template or category)
 * @returns Total completion count in the range
 */
export function getCompletionCount(
  startDate: string,
  endDate:   string,
  filter?:   StatFilter,
): number {
  const { clause, params } = buildFilterClause(filter);
  const rows = db.getAllSync<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM completion_log
     WHERE completed_date BETWEEN ? AND ?${clause}`,
    [startDate, endDate, ...params],
  );
  return rows[0]?.n ?? 0;
}

/**
 * Completions grouped by calendar day within a date range.
 *
 * Returns **only** days that had at least one completion. The caller (hook)
 * is responsible for zero-filling the gaps before passing data to UI components.
 *
 * Each row includes:
 *   date       — 'YYYY-MM-DD'
 *   completed  — total completions that day
 *   scheduled  — tasks completed on the day they were due (scheduled_date =
 *                completed_date). This is the denominator for % mode.
 *                Tasks without a due_date contribute 0 to this column.
 *
 * Index: `idx_clog_date` (or composite when filtered).
 * Used by: WeekBarGraph (count mode), MonthCalendarGraph.
 *
 * @param startDate - Inclusive start 'YYYY-MM-DD'
 * @param endDate   - Inclusive end 'YYYY-MM-DD'
 * @param filter    - Optional scope
 * @returns Sparse array — only days with activity
 */
export function getCompletionsByDay(
  startDate: string,
  endDate:   string,
  filter?:   StatFilter,
): Array<{ date: string; completed: number; scheduled: number }> {
  const { clause, params } = buildFilterClause(filter);
  return db.getAllSync<{ date: string; completed: number; scheduled: number }>(
    `SELECT completed_date AS date,
            COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS completed,
            COUNT(*) AS scheduled
     FROM completion_log
     WHERE completed_date BETWEEN ? AND ?${clause}
     GROUP BY completed_date
     ORDER BY completed_date ASC`,
    [startDate, endDate, ...params],
  );
}

/**
 * Completions grouped by calendar day, split by task_kind (permanent / one_off).
 *
 * Returns **only** days with activity — caller zero-fills.
 *
 * Each row includes:
 *   date      — 'YYYY-MM-DD'
 *   permanent — completions of kind 'permanent' that day
 *   oneOff    — completions of kind 'one_off' that day
 *   scheduled — tasks completed on their due day (denominator for % mode)
 *
 * Index: `idx_clog_date` (or composite when filtered).
 * Used by: WeekBarGraph (segment mode) — stacked perm/one-off bars.
 *
 * @param startDate - Inclusive start 'YYYY-MM-DD'
 * @param endDate   - Inclusive end 'YYYY-MM-DD'
 * @param filter    - Optional scope
 * @returns Sparse array — only days with activity
 */
export function getCompletionsByDayWithKind(
  startDate: string,
  endDate:   string,
  filter?:   StatFilter,
): Array<{ date: string; permanent: number; oneOff: number; scheduled: number }> {
  const { clause, params } = buildFilterClause(filter);
  return db.getAllSync<{ date: string; permanent: number; oneOff: number; scheduled: number }>(
    `SELECT completed_date AS date,
            COUNT(CASE WHEN outcome = 'completed' AND task_kind = 'permanent' THEN 1 END) AS permanent,
            COUNT(CASE WHEN outcome = 'completed' AND task_kind = 'one_off'   THEN 1 END) AS oneOff,
            COUNT(*) AS scheduled
     FROM completion_log
     WHERE completed_date BETWEEN ? AND ?${clause}
     GROUP BY completed_date
     ORDER BY completed_date ASC`,
    [startDate, endDate, ...params],
  );
}

/**
 * Completions grouped by calendar month for a given year.
 *
 * Always returns **exactly 12 rows** (one per month, 0-indexed Jan=0 … Dec=11).
 * Future months (where completed_date > today) return completed = 0,
 * scheduled = 0. This matches the YearOverviewGraph contract which renders
 * future months at reduced opacity automatically.
 *
 * Months with no activity also return 0/0 — zero-filling is done here so the
 * caller receives a predictable fixed-length array.
 *
 * Index: `idx_clog_date` (or composite when filtered).
 * Used by: YearOverviewGraph (count mode).
 *
 * @param year   - Full calendar year (e.g. 2026)
 * @param filter - Optional scope
 * @returns 12-item array, index = month (0 = Jan, 11 = Dec)
 */
export function getCompletionsByMonth(
  year:    number,
  filter?: StatFilter,
): Array<{ month: number; completed: number; scheduled: number }> {
  const { clause, params } = buildFilterClause(filter);
  const startDate = `${year}-01-01`;
  const endDate   = `${year}-12-31`;

  // SQLite returns only months with activity — we need to zero-fill.
  // substr(completed_date, 6, 2) extracts the 'MM' part of 'YYYY-MM-DD'.
  const rows = db.getAllSync<{ mm: string; completed: number; scheduled: number }>(
    `SELECT substr(completed_date, 6, 2) AS mm,
            COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS completed,
            COUNT(*) AS scheduled
     FROM completion_log
     WHERE completed_date BETWEEN ? AND ?${clause}
     GROUP BY mm
     ORDER BY mm ASC`,
    [startDate, endDate, ...params],
  );

  // Build a map from 'MM' → row for fast lookup during zero-fill.
  const byMm = new Map(rows.map(r => [r.mm, r]));

  // Return all 12 months, filling absent ones with 0/0.
  return Array.from({ length: 12 }, (_, i) => {
    const mm  = String(i + 1).padStart(2, '0');
    const row = byMm.get(mm);
    return {
      month:     i,                    // 0-indexed for the UI
      completed: row?.completed  ?? 0,
      scheduled: row?.scheduled  ?? 0,
    };
  });
}

/**
 * Completions grouped by calendar month, split by task_kind.
 *
 * Always returns **exactly 12 rows** (same zero-filling contract as
 * `getCompletionsByMonth`). Future months return permanent = 0, oneOff = 0.
 *
 * Index: `idx_clog_date` (or composite when filtered).
 * Used by: YearOverviewGraph (segment mode) — stacked perm/one-off bars.
 *
 * @param year   - Full calendar year
 * @param filter - Optional scope
 * @returns 12-item array, index = month (0 = Jan, 11 = Dec)
 */
export function getCompletionsByMonthWithKind(
  year:    number,
  filter?: StatFilter,
): Array<{ month: number; permanent: number; oneOff: number; scheduled: number }> {
  const { clause, params } = buildFilterClause(filter);
  const startDate = `${year}-01-01`;
  const endDate   = `${year}-12-31`;

  const rows = db.getAllSync<{ mm: string; permanent: number; oneOff: number; scheduled: number }>(
    `SELECT substr(completed_date, 6, 2) AS mm,
            COUNT(CASE WHEN outcome = 'completed' AND task_kind = 'permanent' THEN 1 END) AS permanent,
            COUNT(CASE WHEN outcome = 'completed' AND task_kind = 'one_off'   THEN 1 END) AS oneOff,
            COUNT(*) AS scheduled
     FROM completion_log
     WHERE completed_date BETWEEN ? AND ?${clause}
     GROUP BY mm
     ORDER BY mm ASC`,
    [startDate, endDate, ...params],
  );

  const byMm = new Map(rows.map(r => [r.mm, r]));

  return Array.from({ length: 12 }, (_, i) => {
    const mm  = String(i + 1).padStart(2, '0');
    const row = byMm.get(mm);
    return {
      month:     i,
      permanent: row?.permanent ?? 0,
      oneOff:    row?.oneOff    ?? 0,
      scheduled: row?.scheduled ?? 0,
    };
  });
}

/**
 * Completions grouped by weekday within an optional date range.
 *
 * Returns **only** weekdays with at least one completion — caller zero-fills
 * the remaining days. This keeps the query result small; the hook's
 * `buildDayOfWeekData` always produces exactly 7 items.
 *
 * ## SQLite weekday encoding
 *   SQLite `strftime('%w', date)` returns: 0 = Sunday … 6 = Saturday.
 *   The UI uses Monday-first arrays (index 0 = Mon … 6 = Sun).
 *   The hook applies the remap: `uiIndex = (sqliteWeekday + 6) % 7`.
 *   This function returns the raw SQLite weekday integers — do NOT remap here.
 *
 * ## Date scoping
 *   Pass `startDate` / `endDate` to restrict to a bucket's window:
 *     - all_week  → Mon–Sun of current week
 *     - all_month → 1st–last of current month
 *     - all_year  → Jan 1 – Dec 31 current year
 *     - all_time  → omit both (no WHERE date filter added)
 *
 * Index: `idx_clog_date` (or composite when filtered).
 * Used by: DayOfWeekPatternCard.
 *
 * @param startDate - Optional inclusive start 'YYYY-MM-DD'
 * @param endDate   - Optional inclusive end 'YYYY-MM-DD'
 * @param filter    - Optional scope
 * @returns Sparse array with raw SQLite weekday values (0=Sun … 6=Sat)
 */
export function getCompletionsByWeekday(
  startDate?: string,
  endDate?:   string,
  filter?:    StatFilter,
): Array<{ weekday: number; completed: number; scheduled: number }> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (startDate && endDate) {
    conditions.push('completed_date BETWEEN ? AND ?');
    params.push(startDate, endDate);
  }

  const { clause: filterClause, params: filterParams } = buildFilterClause(filter);
  // filterClause already starts with ' AND ' if non-empty, so append directly
  const whereBlock = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}${filterClause}`
    : filterClause
      ? `WHERE 1=1${filterClause}`  // no date range but have a filter
      : '';                          // no conditions at all (all-time, no filter)

  return db.getAllSync<{ weekday: number; completed: number; scheduled: number }>(
    `SELECT CAST(strftime('%w', completed_date) AS INTEGER) AS weekday,
            COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS completed,
            COUNT(*) AS scheduled
     FROM completion_log
     ${whereBlock}
     GROUP BY weekday
     ORDER BY weekday ASC`,
    [...params, ...filterParams],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category breakdown queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Completions grouped by (calendar day × category) within a date range.
 *
 * Returns **only** (day, category) pairs with at least one completion.
 * Rows where `category_id IS NULL` are excluded — uncategorised completions
 * do not appear in stacked category bars.
 *
 * The hook joins `categoryId → { name, color }` from the `categories` table
 * to build the `CategorySegment[]` arrays for each day.
 *
 * Index: `idx_clog_date` (no filter — category IS the breakdown dimension).
 * Used by: CategoryWeekBarGraph (OverallDetailScreen).
 *
 * @param startDate - Inclusive start 'YYYY-MM-DD'
 * @param endDate   - Inclusive end 'YYYY-MM-DD'
 * @returns Sparse rows — only active (date, category) pairs
 */
export function getCompletionsByDayByCategory(
  startDate: string,
  endDate:   string,
): Array<{ date: string; categoryId: string; count: number }> {
  return db.getAllSync<{ date: string; categoryId: string; count: number }>(
    `SELECT completed_date AS date,
            category_id    AS categoryId,
            COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS count
     FROM completion_log
     WHERE completed_date BETWEEN ? AND ?
       AND category_id IS NOT NULL
     GROUP BY completed_date, category_id
     ORDER BY completed_date ASC, count DESC`,
    [startDate, endDate],
  );
}

/**
 * Completions grouped by (calendar month × category) for a given year.
 *
 * Returns **only** (month, category) pairs with at least one completion.
 * The hook zero-fills missing months to produce exactly 12 month entries,
 * each with a (possibly empty) segments array.
 *
 * `month` is 0-indexed (0 = Jan … 11 = Dec) to match the UI convention
 * and `getCompletionsByMonth`.
 *
 * Rows where `category_id IS NULL` are excluded.
 *
 * Index: `idx_clog_date`.
 * Used by: CategoryYearOverviewGraph (OverallDetailScreen).
 *
 * @param year - Full calendar year (e.g. 2026)
 * @returns Sparse rows — only active (month, category) pairs
 */
export function getCompletionsByMonthByCategory(
  year: number,
): Array<{ month: number; categoryId: string; count: number }> {
  const startDate = `${year}-01-01`;
  const endDate   = `${year}-12-31`;

  const rows = db.getAllSync<{ mm: string; categoryId: string; count: number }>(
    `SELECT substr(completed_date, 6, 2) AS mm,
            category_id                  AS categoryId,
            COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS count
     FROM completion_log
     WHERE completed_date BETWEEN ? AND ?
       AND category_id IS NOT NULL
     GROUP BY mm, category_id
     ORDER BY mm ASC, count DESC`,
    [startDate, endDate],
  );

  // Convert 'MM' string to 0-indexed month number for the UI.
  return rows.map(r => ({
    month:      parseInt(r.mm, 10) - 1,
    categoryId: r.categoryId,
    count:      r.count,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Streak queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns an ascending array of distinct calendar dates ('YYYY-MM-DD') that
 * have at least one completion matching the optional filter.
 *
 * This is the input to `calcCurrentStreak()` and `calcBestStreak()` in
 * `statsCalculations.ts`. Querying a single sorted list and walking it in
 * TypeScript is faster than trying to express the streak logic in SQL.
 *
 * ## Lookback window
 *   When `startDate` is provided, only dates on or after it are returned.
 *   This caps bucket-scoped streaks so they cannot count completions before
 *   the bucket window began:
 *     - Week bucket  → pass the Monday of the current week
 *     - Month bucket → pass the 1st of the current month
 *   For all-time streaks, omit `startDate`; the query defaults to a 400-day
 *   lookback, which is safely larger than any plausible best streak while
 *   keeping the result set small.
 *
 * Index: `idx_clog_date` (or composite when filtered).
 *
 * @param startDate - Optional inclusive lower bound 'YYYY-MM-DD'
 * @param filter    - Optional scope (template or category)
 * @returns Sorted ascending array of date strings
 */
export function getCompletionDates(
  startDate?: string,
  filter?:    StatFilter,
): string[] {
  // Default lookback: 400 days — large enough to capture any realistic streak
  // without scanning the entire table on apps with years of history.
  const floor = startDate ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 400);
    return toLocalDateString(d);
  })();

  const { clause, params } = buildFilterClause(filter);

  const rows = db.getAllSync<{ completed_date: string }>(
    `SELECT DISTINCT completed_date
     FROM completion_log
     WHERE outcome = 'completed'
       AND completed_date >= ?${clause}
     ORDER BY completed_date ASC`,
    [floor, ...params],
  );

  return rows.map(r => r.completed_date);
}

/**
 * Current streak — number of consecutive days ending today (or yesterday)
 * that each have at least one completion matching the filter.
 *
 * Delegates date-list retrieval to `getCompletionDates()` and streak math to
 * `calcCurrentStreak()` in `statsCalculations.ts`.
 *
 * Pass `startDate` to cap the streak window to a bucket:
 *   - Week bucket  → this Monday (streak cannot exceed 7)
 *   - Month bucket → 1st of this month (streak capped at days in month)
 *
 * @param startDate - Optional lower bound for the lookback window
 * @param filter    - Optional scope
 * @returns Streak length in days (0 if no completions today or yesterday)
 */
export function getCurrentStreak(
  startDate?: string,
  filter?:    StatFilter,
): number {
  const dates = getCompletionDates(startDate, filter);
  return calcCurrentStreak(dates);
}

/**
 * Best-ever streak — longest consecutive run of days with ≥1 completion
 * within the lookback window.
 *
 * Pass `startDate` to cap the window to a bucket (e.g. first day of the
 * current month for a month-bucket best streak).
 *
 * @param startDate - Optional lower bound for the lookback window
 * @param filter    - Optional scope
 * @returns Best streak length in days (0 if no completions)
 */
export function getBestStreak(
  startDate?: string,
  filter?:    StatFilter,
): number {
  const dates = getCompletionDates(startDate, filter);
  return calcBestStreak(dates);
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Four time-range completion counts for the TimeRangeCountsCard.
 *
 * Always returns counts for the four canonical windows regardless of which
 * bucket opened the detail screen — the card always shows all four rows.
 *
 * Runs four lightweight COUNT queries, each hitting `idx_clog_date` (or the
 * composite filter index). All four complete in a single synchronous call
 * sequence with no joins.
 *
 * @param filter - Optional scope (template or category)
 * @returns { allTimeCount, weekCount, monthCount, yearCount }
 */
export function getStatSummary(filter?: StatFilter): {
  allTimeCount: number;
  weekCount:    number;
  monthCount:   number;
  yearCount:    number;
} {
  const now        = new Date();
  const year       = now.getFullYear();
  const weekStart  = startOfCurrentWeek();
  const monthStart = startOfCurrentMonth();
  const yearStart  = `${year}-01-01`;

  const { clause, params } = buildFilterClause(filter);

  // All four queries share the same structure — a COUNT with a date lower-bound
  // and an optional filter clause. Each hits the idx_clog_date index.
  const allTime = db.getAllSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM completion_log WHERE outcome = 'completed'${clause}`,
    [...params],
  )[0]?.n ?? 0;

  const weekCount = db.getAllSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM completion_log WHERE outcome = 'completed' AND completed_date >= ?${clause}`,
    [weekStart, ...params],
  )[0]?.n ?? 0;

  const monthCount = db.getAllSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM completion_log WHERE outcome = 'completed' AND completed_date >= ?${clause}`,
    [monthStart, ...params],
  )[0]?.n ?? 0;

  const yearCount = db.getAllSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM completion_log WHERE outcome = 'completed' AND completed_date >= ?${clause}`,
    [yearStart, ...params],
  )[0]?.n ?? 0;

  return { allTimeCount: allTime, weekCount, monthCount, yearCount };
}

/**
 * Completion count and scheduled count for a specific date range.
 *
 * Used by CompletionSummaryCard which must be scoped to the bucket's window:
 *   - all_week  → Mon of this week … Sun of this week
 *   - all_month → 1st … last day of this month
 *   - all_year  → Jan 1 … Dec 31 this year
 *   - all_time  → very early date … today
 *
 * `scheduled` counts rows where `scheduled_date = completed_date` within the
 * window — i.e. tasks completed on the day they were due. This is the "total"
 * denominator for the completion ring. Tasks completed without a due_date
 * contribute to `completed` but not `scheduled`.
 *
 * @param startDate - Inclusive start 'YYYY-MM-DD'
 * @param endDate   - Inclusive end 'YYYY-MM-DD'
 * @param filter    - Optional scope
 * @returns { completed, scheduled }
 */
export function getCompletionSummary(
  startDate: string,
  endDate:   string,
  filter?:   StatFilter,
): { completed: number; totalAttempts: number } {
  const { clause, params } = buildFilterClause(filter);

  const rows = db.getAllSync<{ completed: number; totalAttempts: number }>(
    `SELECT COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS completed,
            COUNT(*) AS totalAttempts
     FROM completion_log
     WHERE completed_date BETWEEN ? AND ?${clause}`,
    [startDate, endDate, ...params],
  );

  return {
    completed:     rows[0]?.completed     ?? 0,
    totalAttempts: rows[0]?.totalAttempts ?? 0,
  };
}

/**
 * Task-type split for the TaskTypeBreakdownCard.
 *
 * Returns how many completions in the window were permanent task instances
 * versus one-off tasks. Optional date range scopes the window to the bucket;
 * omit both for an all-time split.
 *
 * Index: `idx_clog_kind_date` (or composite when filtered).
 *
 * @param startDate - Optional inclusive start 'YYYY-MM-DD'
 * @param endDate   - Optional inclusive end 'YYYY-MM-DD'
 * @param filter    - Optional scope
 * @returns { permanentCount, oneOffCount }
 */
export function getTaskTypeSplit(
  startDate?: string,
  endDate?:   string,
  filter?:    StatFilter,
): { permanentCount: number; oneOffCount: number } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (startDate && endDate) {
    conditions.push('completed_date BETWEEN ? AND ?');
    params.push(startDate, endDate);
  }

  const { clause: filterClause, params: filterParams } = buildFilterClause(filter);
  const whereBlock = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}${filterClause}`
    : filterClause
      ? `WHERE 1=1${filterClause}`
      : '';

  const rows = db.getAllSync<{ permanentCount: number; oneOffCount: number }>(
    `SELECT COUNT(CASE WHEN task_kind = 'permanent' THEN 1 END) AS permanentCount,
            COUNT(CASE WHEN task_kind = 'one_off'   THEN 1 END) AS oneOffCount
     FROM completion_log
     ${whereBlock}`,
    [...params, ...filterParams],
  );

  return {
    permanentCount: rows[0]?.permanentCount ?? 0,
    oneOffCount:    rows[0]?.oneOffCount    ?? 0,
  };
}

/**
 * Top-N categories by completion count for the CategoryBreakdownCard.
 *
 * Returns raw `categoryId` + `count` + `rate` — the hook joins these against
 * the `categories` table to attach `name` and `color` before passing to the
 * card component.
 *
 * `rate` is the completion rate: `(completed / MAX(scheduled, completed)) * 100`,
 * clamped to 100 so completing more than were formally scheduled never exceeds
 * 100%. Returned as an integer (rounded).
 *
 * Rows where `category_id IS NULL` are excluded.
 *
 * ## Date scoping
 *   Pass `startDate` / `endDate` to restrict to the bucket's window.
 *   Omit both for all-time (still shows category breakdown across all history).
 *
 * Index: `idx_clog_category`.
 *
 * @param limit     - Maximum number of categories to return (e.g. 5)
 * @param startDate - Optional inclusive start 'YYYY-MM-DD'
 * @param endDate   - Optional inclusive end 'YYYY-MM-DD'
 * @returns Array of up to `limit` items, sorted descending by count
 */
export function getTopCategories(
  limit:      number,
  startDate?: string,
  endDate?:   string,
): Array<{ categoryId: string; count: number; rate: number }> {
  const conditions: string[] = ['category_id IS NOT NULL'];
  const params: (string | number)[] = [];

  if (startDate && endDate) {
    conditions.push('completed_date BETWEEN ? AND ?');
    params.push(startDate, endDate);
  }

  const rows = db.getAllSync<{ categoryId: string; count: number; totalAttempts: number }>(
    `SELECT category_id AS categoryId,
            COUNT(CASE WHEN outcome = 'completed' THEN 1 END) AS count,
            COUNT(*) AS totalAttempts
     FROM completion_log
     WHERE ${conditions.join(' AND ')}
     GROUP BY category_id
     ORDER BY count DESC
     LIMIT ?`,
    [...params, limit],
  );

  return rows.map(r => ({
    categoryId: r.categoryId,
    count:      r.count,
    rate:       r.totalAttempts > 0 ? Math.round((r.count / r.totalAttempts) * 100) : 0,
  }));
}

/**
 * Per-template completion summary within a category for the PermanentTaskListCard.
 *
 * Returns one row per template that belongs to the given category and has at
 * least one logged completion. The hook joins results with the `templates`
 * table to get `templateTitle` and with `categories` for `color`, then calls
 * `getCurrentStreak({ templateId })` for each template's streak.
 *
 * The JOIN with `template_instances` links `completion_log.task_id` (the
 * instance's tasks.id) back to its parent `templateId`.
 *
 * ## Optional date range
 *   Omit for all-time (most useful — the PermanentTaskListCard typically shows
 *   all-time counts). Pass dates to scope to a bucket window.
 *
 * @param categoryId - Category to list templates for
 * @param startDate  - Optional inclusive start 'YYYY-MM-DD'
 * @param endDate    - Optional inclusive end 'YYYY-MM-DD'
 * @returns One row per template with completions, sorted by totalCompleted DESC
 */
// ─────────────────────────────────────────────────────────────────────────────
// Today snapshot (TodayCard)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw data needed to build the TodayCard snapshot.
 *
 * Runs four fast queries — two against completion_log (what's done) and two
 * against the tasks table (what's still pending). The hook assembles these
 * into the final `TodayStats` shape and adds category name/color enrichment.
 *
 * ## "Pending today" definition
 *   A task counts as pending if: `completed = 0` AND the local calendar date
 *   of its `due_date` (Unix ms) equals today. After `autoFailOverdueTasks`
 *   runs on mount, overdue tasks have already been pushed forward, so this
 *   set is guaranteed to be today-only.
 *
 * ## Task kind for pending tasks
 *   The tasks table has no `kind` column — we infer permanence from the
 *   `template_instances` junction table. If a task's id appears as an
 *   `instanceId` in `template_instances`, it is a permanent task instance.
 *
 * @returns Raw counts and category-id-keyed arrays (no name/color enrichment)
 */
export function getTodayRaw(): {
  completedTasks:    number;
  permanentDone:     number;
  oneOffDone:        number;
  permanentPending:  number;
  oneOffPending:     number;
  doneByCategory:    Array<{ categoryId: string; count: number }>;
  pendingByCategory: Array<{ categoryId: string; count: number }>;
} {
  const today = toLocalDateString(new Date());

  // ── Completion log: what was completed today ──────────────────────────────
  const doneTotals = db.getAllSync<{
    total: number; permanentDone: number; oneOffDone: number;
  }>(
    `SELECT COUNT(*) AS total,
            COUNT(CASE WHEN task_kind = 'permanent' THEN 1 END) AS permanentDone,
            COUNT(CASE WHEN task_kind = 'one_off'   THEN 1 END) AS oneOffDone
     FROM completion_log
     WHERE completed_date = ? AND outcome = 'completed'`,
    [today],
  )[0] ?? { total: 0, permanentDone: 0, oneOffDone: 0 };

  const doneByCategory = db.getAllSync<{ categoryId: string; count: number }>(
    `SELECT category_id AS categoryId, COUNT(*) AS count
     FROM completion_log
     WHERE completed_date = ? AND outcome = 'completed' AND category_id IS NOT NULL
     GROUP BY category_id
     ORDER BY count DESC`,
    [today],
  );

  // ── Tasks table: what is still pending today ──────────────────────────────
  // LEFT JOIN template_instances to determine task kind without a kind column.
  const pendingTotals = db.getAllSync<{
    permanentPending: number; oneOffPending: number;
  }>(
    `SELECT COUNT(CASE WHEN ti.instanceId IS NOT NULL THEN 1 END) AS permanentPending,
            COUNT(CASE WHEN ti.instanceId IS NULL     THEN 1 END) AS oneOffPending
     FROM tasks t
     LEFT JOIN template_instances ti ON ti.instanceId = t.id
     WHERE t.completed = 0
       AND date(t.due_date / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')`,
    [],
  )[0] ?? { permanentPending: 0, oneOffPending: 0 };

  const pendingByCategory = db.getAllSync<{ categoryId: string; count: number }>(
    `SELECT category_id AS categoryId, COUNT(*) AS count
     FROM tasks
     WHERE completed = 0
       AND date(due_date / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')
       AND category_id IS NOT NULL
     GROUP BY category_id
     ORDER BY count DESC`,
    [],
  );

  return {
    completedTasks:   doneTotals.total,
    permanentDone:    doneTotals.permanentDone,
    oneOffDone:       doneTotals.oneOffDone,
    permanentPending: pendingTotals.permanentPending,
    oneOffPending:    pendingTotals.oneOffPending,
    doneByCategory,
    pendingByCategory,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduling support (read-only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the most recent `completed_at` timestamp (Unix ms) for a given
 * template, or `null` if the template has never been completed.
 *
 * ## Why completion_log and not the tasks table?
 *   The `tasks` table will eventually be pruned by the archival system (Sprint 5
 *   §2.4), so a completed row might no longer be present there. `completion_log`
 *   is append-only and is never cleaned up, making it the safe long-term source
 *   of truth for "when was this last done?".
 *
 * ## Why only 'completed' outcome?
 *   `completion_log` also stores 'auto_failed' rows (tasks that were missed and
 *   pushed forward). We deliberately exclude those — an auto-fail is NOT a
 *   real completion. Scheduling the next instance relative to an auto-fail would
 *   mean "the user never actually did it, but we're scheduling the next one
 *   anyway", which is wrong.
 *
 * ## Sync API
 *   Matches the rest of this file — all queries use the expo-sqlite synchronous
 *   `getAllSync` method so callers don't need to await or handle promises.
 *
 * Called exclusively by `taskActions.autoScheduleRecurringTasks()`.
 *
 * @param templateId - The `permanentId` of the template to look up
 * @returns Latest `completed_at` ms timestamp, or null if never completed
 */
export function getLastCompletionTimestamp(templateId: string): number | null {
  const rows = db.getAllSync<{ completed_at: number | null }>(
    // MAX(completed_at) across all real completions for this template.
    // Returns one row always: null if no matching rows exist.
    `SELECT MAX(completed_at) AS completed_at
     FROM completion_log
     WHERE template_id = ?
       AND outcome = 'completed'`,
    [templateId],
  );
  // rows[0] always exists (MAX returns a row even with no matches), but
  // completed_at will be null if there are no completions.
  return rows.length > 0 && rows[0].completed_at != null
    ? rows[0].completed_at
    : null;
}

export function getPermanentTaskSummariesForCategory(
  categoryId: string,
  startDate?: string,
  endDate?:   string,
): Array<{ templateId: string; totalCompleted: number; totalAttempts: number }> {
  const conditions: string[] = ['cl.category_id = ?'];
  const params: (string | number)[] = [categoryId];

  if (startDate && endDate) {
    conditions.push('cl.completed_date BETWEEN ? AND ?');
    params.push(startDate, endDate);
  }

  return db.getAllSync<{ templateId: string; totalCompleted: number; totalAttempts: number }>(
    `SELECT ti.templateId,
            COUNT(CASE WHEN cl.outcome = 'completed' THEN 1 END) AS totalCompleted,
            COUNT(cl.id) AS totalAttempts
     FROM completion_log cl
     JOIN template_instances ti ON ti.instanceId = cl.task_id
     WHERE ${conditions.join(' AND ')}
     GROUP BY ti.templateId
     ORDER BY totalCompleted DESC`,
    params,
  );
}
