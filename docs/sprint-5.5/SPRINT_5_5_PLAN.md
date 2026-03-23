# Sprint 5.5 — Bug Fixes & Usability

**Goal:** Resolve known bugs and usability gaps surfaced after Sprint 5 delivery.

**Status key:**
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

## Small Fixes

_Fast, low-risk corrections. Target: all completed before Medium work begins._

| # | Task | Status |
|---|------|--------|
| S1 | Very slightly reduce the history bar tab height at the top so it fits better | `[x]` |
| S2 | Repeat task — initial creation of a permanent task does not properly save the repeatability status on creation (editing saves fine, only creation is broken) | `[x]` |
| S3 | "Use permanent task" is being double-counted on creation and completion — remove the creation increment so it only increments upon completion (this is separate from the main stats counter, likely in perm task actions) | `[x]` |
| S4 | Stats screen — white circle text on percent value glitches visually (hardcoded white inner disc + white text shadow artifact) | `[x]` |
| S5 | Month view — completion fill should be continuous, not rounded to 4 discrete states (0, 1/4, 2/4, 3/4, 4/4). Keep the shape exactly the same, only change the fill logic to be continuous | `[x]` |
| S6 | Permanent Tasks / Categories collapsible sections clip content when list grows long — `MAX_CONTENT_HEIGHT` cap was too small | `[x]` |

---

## Medium Fixes

_Meaningful features or multi-part bugs. Each should be scoped and tracked individually._

| # | Task | Status | Notes |
|---|------|--------|-------|
| M1 | Week completions (category, tasks, weekly average) — data is not retrieved correctly when scrolling left/right; only the current week displays properly. Data exists (other stats access it fine) and processing is correct (current week is accurate) | `[x]` | |
| M2 | Undoing a permanent task in the visual scene does not revert the stats collection for that task — undo must properly revert the recorded values | `[x]` | |
| M3 | Today tab — add a fourth button alongside "Today / This Week / This Month" labelled "Choose Date". Selecting a date toggles it as the active reference date; Today/This Week/This Month then display relative to the chosen date. Default reference date is the current date. Reuse the existing date-picker used for task assignment | `[x]` | | Implement a similar date selection feature for history screen with the same logic displaying history of selected dates `[x]`
| M4 | Task lists and permanent tasks — sort/group by category so same-category items are adjacent. Secondary sort: completion status still takes priority (incomplete on top, complete on bottom); within each completion group, items are sorted by category. Use Permanent Tasks screen should follow the same scheme | `[x]` | 

## Medium large
| M5 | Task deletion — replace current delete interaction with a toggle-based flow to prevent accidental deletes: toggle on → select tasks → confirm delete. Toggle/button placement: corner button or part of the floating create-task button, whichever looks best | `[ ]` | |
| M6 | Edit task functionality for permanent tasks on the main screen — extend editing to include toggling and editing the repeatability of the task. Also consider expanding edit to allow changing categories for both temporary and permanent tasks | `[ ]` | |
---

## Large Fixes

_Complex, higher-risk work. Requires focused investigation before implementation._

| # | Task | Status | Notes |
|---|------|--------|-------|
| L1 | Streaks — not being calculated correctly | `[x]` | See LARGE_FIXES.md for full implementation detail |
| L2 | Repeatable tasks — broken in multiple places across the app | `[ ]` | Audit all repeat-task code paths first |

---

## Progress Tracking

**Small:** 6 / 6 done  (S1 S2 S3 S4 S5 S6)
**Medium:** 4 / 6 done  (M1 M2 M3 M4 done — M5 M6 pending)
**Large:** 1 / 2 done  (L1 done — L2 pending)
**Total:** 11 / 14 done

Update the table statuses and the counts above as work completes. Move items to `[~]` when actively in progress and `[x]` when merged/verified.

---

## Session Notes — 2026-03-22

### Fixes completed this session

**M1 — Week bar graph showing zeros for past weeks**
Root cause: `buildWeekBars`, `buildWeekBarsSimple`, and `buildCategoryWeekData` in `useStats.ts` all hardcoded `startOfCurrentWeek()` as the anchor when mapping the 7 day slots. The storage queries correctly fetched past-week rows, but the builders looked up `Mar 23`, `Mar 24`… instead of the actual past-week dates — every lookup missed, returning all zeros. Fixed by adding an optional `weekStart?: string` parameter to all three builders (defaulting to current week for existing callers) and passing `start` from `getWeekBarData`, `getWeekBarDataSimple`, and `getCategoryWeekBarData`.
- Files: `app/core/hooks/useStats.ts`

**M2 — Undoing a permanent task did not revert stats**
`uncompleteTask` in `taskActions.ts` only cleared the `tasks` table row — it never removed the `completion_log` entry written by `logCompletion`, and for permanent tasks it never rolled back the `template_stats`/`templates` counters incremented by `updateTemplateStats`. Added `deleteLatestCompletion(taskId)` to `statsStorage.ts` (deletes the most-recent `outcome='completed'` row for the task) and `revertTemplateStats(templateId)` to `permanentTaskStorage.ts` (decrements `completionCount`, `instanceCount`, `currentStreak`; recalculates `completionRate`; leaves `maxStreak` intact as historical high-water). Both are now called from `uncompleteTask`.
- Files: `app/core/services/storage/statsStorage.ts`, `app/core/services/storage/permanentTaskStorage.ts`, `app/core/domain/taskActions.ts`

**M4 — Task lists not grouped by category**
Added `sortTasksByCompletionAndCategory` to `taskSorting.ts`: primary sort by completion status (incomplete first), secondary sort by `categoryId` string so same-category tasks are adjacent within each group (no-category tasks sort last using `'\uffff'` sentinel). Replaced `sortTasksByCompletion` with the new function in `AllTasksScreen`, `TodayScreen`, and `UsePermanentTaskScreen`.
- Files: `app/core/utils/taskSorting.ts`, `app/screens/tasks/AllTasksScreen.tsx`, `app/screens/today/TodayScreen.tsx`, `app/screens/tasks/UsePermanentTaskScreen.tsx`

**S4 — CircularProgress white disc / white shadow on percent text**
Two issues in `CircularProgress.tsx`: (1) inner disc `backgroundColor` was hardcoded `#ffffff`, rendering as a glaring white circle in dark mode instead of matching the card background — fixed by using `theme.bgCard`. (2) percent label had a white "shadow" artifact from Android's font renderer blending against the View background — suppressed with `textShadowColor: 'transparent'`, `textShadowRadius: 0`, and `backgroundColor: 'transparent'` on the `Text`. Text color also moved from hardcoded `#1a1a1a` to `theme.textPrimary`.
- Files: `app/components/stats/CircularProgress.tsx`

**S6 — Collapsible sections clipping long lists**
`MAX_CONTENT_HEIGHT = 2000` in `StatsScreen.tsx` was too small for users with many permanent tasks or categories. Raised to `9999` — content naturally stops at its real height so nothing is clipped regardless of list size.
- Files: `app/screens/stats/StatsScreen.tsx`

---

## Session Notes — 2026-03-23

### Fixes completed this session

**L1 — Streak calculation rewrite**
The old implementation counted consecutive calendar days with any completion, which meant a weekly task would reset its streak every non-completion day. Replaced with two separate models as specified in `LARGE_FIXES.md`:

- **Template / category streaks** (slot-based): streak increments once per distinct completion day that covers a scheduled-date slot with no failures. Empty days between slots are neutral. Any `auto_failed` outcome resets to 0.
- **Overall streaks** (calendar-day): streak counts consecutive calendar days with ≥1 completion and 0 failures. A gap or any failure breaks it.

New storage functions in `statsStorage.ts`: `getScheduledDateSlots(filter?)`, `getCalendarDayActivity()`, `getDistinctCompletionDays(filter?)`.
New calculation functions in `statsCalculations.ts`: `calcTemplateCurrentStreak`, `calcTemplateBestStreak`, `calcOverallCurrentStreak`, `calcOverallBestStreak`.
All 7 streak call sites in `useStats.ts` updated to use the new functions. Naive streak increment removed from `updateTemplateStats` and `revertTemplateStats` in `permanentTaskStorage.ts` — streaks are now computed on-demand from `completion_log`, never stored in `template_stats`.

Sanity check confirmed: `scheduled_date` in `completion_log` correctly tracks the task due date at the time of completion. Editing a task's due date before completion propagates correctly through both in-memory state and the DB (`tasks.due_date` / `template_instances.dueDate`), so `scheduled_date` is always accurate.

- Files: `app/core/utils/statsCalculations.ts`, `app/core/services/storage/statsStorage.ts`, `app/core/hooks/useStats.ts`, `app/core/services/storage/permanentTaskStorage.ts`
