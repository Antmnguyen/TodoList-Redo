Stats — What's Left
2026-02-24

---

## Must do

1. **Runtime verify the permanent task fix**
   fix.md verification checklist steps 1–6. Code was fixed 2026-02-24 but never run.
   Complete a permanent task, restart app, confirm `completion_log` rows have
   `task_kind='permanent'` and a valid `template_id`. Also verify auto-fail path.

2. **Step 8 — empty states** (marked PENDING in STATS_COMPLETION_ROADMAP.md)
   New user / zero-completions case. Cards currently render with 0s but there is no
   "No data yet" message or visual treatment. Needs a pass on all three detail screens
   and StatsScreen sections.

3. **Update docs/sprint-4/2026-02-22/CHANGES.md**
   fix.md says to mark "Step 4 runtime verification" done and remove it from the open
   issues list after implementing.

---

## Minor gaps

4. **CategoryWeekBarGraph legend** derives from `data[0]?.segments` (Monday only).
   If Monday has no completions the legend is empty even when other days do.
   Should union segments across all 7 days instead.

5. ~~**StatsScreen perf**~~ — assessed 2026-02-24, not needed. ~47 sync SQLite reads per render
   ≈ 10–30ms. `useMemo` has no viable dep array (no React dep tracks DB changes).
   If perf ever matters: `statsVersion` context counter, not `useMemo`.

---

## Already done (confirmed clean as of 2026-02-24)

- Mock data removed from all 5 graph components (MonthCalendarGraph, WeekBarGraph,
  YearOverviewGraph, CategoryWeekBarGraph, CategoryYearOverviewGraph)
- All screens wired to real useStats() hook
- Past-period graph navigation hitting real DB
- TodayCard real data
- Permanent task kind/metadata fix (getAllInstanceMetaSync in permanentTaskStorage.ts,
  getAllTasks() in taskStorage.ts)
- Storage layer, indexes, streak calculations
- Completion rate >100% fix (5 queries in statsStorage.ts — `scheduled` denominator
  changed from subset-of-completions to `COUNT(*)` = all evaluated tasks)
