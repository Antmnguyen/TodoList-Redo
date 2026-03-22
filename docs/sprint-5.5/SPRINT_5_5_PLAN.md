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
| S4 | Stats screen — white circle text on percent value glitches visually | `[]` |
| S5 | Month view — completion fill should be continuous, not rounded to 4 discrete states (0, 1/4, 2/4, 3/4, 4/4). Keep the shape exactly the same, only change the fill logic to be continuous | `[x]` |

---

## Medium Fixes

_Meaningful features or multi-part bugs. Each should be scoped and tracked individually._

| # | Task | Status | Notes |
|---|------|--------|-------|
| M1 | Week completions (category, tasks, weekly average) — data is not retrieved correctly when scrolling left/right; only the current week displays properly. Data exists (other stats access it fine) and processing is correct (current week is accurate) | `[ ]` | |
| M2 | Undoing a permanent task in the visual scene does not revert the stats collection for that task — undo must properly revert the recorded values | `[ ]` | |
| M3 | Today tab — add a fourth button alongside "Today / This Week / This Month" labelled "Choose Date". Selecting a date toggles it as the active reference date; Today/This Week/This Month then display relative to the chosen date. Default reference date is the current date. Reuse the existing date-picker used for task assignment | `[x]` | | Implement a similar date selection feature for history screen with the same logic displaying history of selected dates `[x]`
| M4 | Task lists and permanent tasks — sort/group by category so same-category items are adjacent. Secondary sort: completion status still takes priority (incomplete on top, complete on bottom); within each completion group, items are sorted by category. Use Permanent Tasks screen should follow the same scheme | `[]` | |

## Medium large
| M5 | Task deletion — replace current delete interaction with a toggle-based flow to prevent accidental deletes: toggle on → select tasks → confirm delete. Toggle/button placement: corner button or part of the floating create-task button, whichever looks best | `[ ]` | |
| M6 | Edit task functionality for permanent tasks on the main screen — extend editing to include toggling and editing the repeatability of the task. Also consider expanding edit to allow changing categories for both temporary and permanent tasks | `[ ]` | |
---

## Large Fixes

_Complex, higher-risk work. Requires focused investigation before implementation._

| # | Task | Status | Notes |
|---|------|--------|-------|
| L1 | Streaks — not being calculated correctly | `[ ]` | Investigate root cause before touching logic |
  Streak logic, Streaks should be calculated based on streaks of ASSIGNED completion, not streaks of days. For permant tasks this means as long as all instances of the permant task / category is completed before the asssinged due date the streak is incremented.  So lets say I have perm task / a set of tasks for category A  due on wenesday,  and one friday.  If I complete all the tasks on wenesday that is + 1 to the streak.  If I do NOTHING on thursday, the streak stille exists, and then complete all before friday the streak is incremented again +1.  These streaks are calculated daily, an edge case would be having  tasks due monday tuesdya wenesday and you complete them all on monday, in this case we go by day range, the range of tasks were 3 days, our streak only increases by 1 in this case as we only increment by 1 a day IN THE EVENT we complete a task. So if we complete an instance of a task. AND said task was due today increment streak by one.  If we have task due on monday and one on tuesday and we compelte both on tuesday we only incremnt by one. Task streaks only increase from completion of the category / streak on that day, AND THEY ONLY RESET IF YOU MISS A DUE DATE. so EMPTY DATES between two instances of permant tasks or categories do not warrant a failure of the task and reseeting of the streak. It is only a FAILURE to complete a task on time does this fail. However in the case of overall overall works simirailry except overall covers EVERY TASK so every task for the day must be compelted for overall streak to increase. and if you miss a single task overall dies. (while keeping the yearly monthly weekely logic sound)
| L2 | Repeatable tasks — broken in multiple places across the app | `[ ]` | Audit all repeat-task code paths first |

---

## Progress Tracking

**Small:** 0 / 5 done
**Medium:** 0 / 6 done
**Large:** 0 / 2 done
**Total:** 0 / 13 done

Update the table statuses and the counts above as work completes. Move items to `[~]` when actively in progress and `[x]` when merged/verified.
