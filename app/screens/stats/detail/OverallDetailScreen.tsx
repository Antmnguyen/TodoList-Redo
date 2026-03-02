// app/screens/stats/detail/OverallDetailScreen.tsx
// =============================================================================
// OVERALL DETAIL SCREEN
// =============================================================================
//
// Full-screen detail view for an overall stats bucket (All Time / This Year /
// This Month / This Week). Opened when the user taps an overall StatPreviewCard
// in StatsScreen.
//
// ── Layout (top to bottom) ────────────────────────────────────────────────────
//
//   DetailHeader          ← orange accent, bucket name, back arrow
//   CompletionSummaryCard ← ring + total completed + rate %
//   StreakCard            ← current streak + best streak pills
//   TimeRangeCountsCard   ← Week / Month / Year / All Time counts
//   WeekBarGraph          ← segmented bars (permanent green / one-off blue)
//   MonthCalendarGraph    ← current month calendar
//   YearOverviewGraph     ← 12-bar Jan–Dec, segmented bars
//   DayOfWeekPatternCard  ← all-time by weekday, segmented bars
//   TaskTypeBreakdownCard ← permanent vs one-off split
//   CategoryBreakdownCard ← top 5 categories horizontal bar list
//
// ── Card visibility by bucket ─────────────────────────────────────────────────
//
//   Card                    | All Time | Year | Month | Week
//   ────────────────────────|──────────|──────|───────|──────
//   CompletionSummaryCard   |    ✓     |  ✓   |   ✓   |  ✓
//   StreakCard               |    ✓     |  ✓   |   ✓   |  ✓
//   TaskTypeBreakdownCard   |    ✓     |  ✓   |   ✓   |  ✓
//   TimeRangeCountsCard     |    ✓     |  ✓   |   ✓   |  ✓
//   WeekBarGraph            |    ✓     |  ✓   |   ✓   |  ✓   ← always shown
//   MonthCalendarGraph      |    ✓     |  ✓   |   ✓   |  ✗   showMonth
//   YearOverviewGraph       |    ✓     |  ✓   |   ✗   |  ✗   showYear
//   DayOfWeekPatternCard    |    ✓     |  ✓   |   ✓   |  ✗   showDayOfWeek
//   CategoryBreakdownCard   |    ✓     |  ✓   |   ✓   |  ✓   ← always shown
//   CategoryWeekBarGraph    |    ✓     |  ✓   |   ✓   |  ✓   ← always shown
//   CategoryYearOverviewGraph|   ✓     |  ✓   |   ✗   |  ✗   showCategoryYear
//
// Rationale:
//   - Week bucket: a monthly calendar and day-of-week pattern are not useful
//     when the window is only 7 days. Year graphs are also hidden.
//   - Month bucket: a year graph would show mostly empty months; hidden to
//     avoid confusion. Day-of-week is shown (useful even in a month window).
//   - Year / All Time: all cards shown.
//
// ── Data ─────────────────────────────────────────────────────────────────────
//
//   Uses useStats().getOverallDetail(id) — real data from completion_log.
//   Output varies by params.id (all_time / all_year / all_month / all_week).
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../../../components/layout/Screen';

// ── Shared detail components ─────────────────────────────────────────────────
import { DetailHeader }          from '../../../components/stats/detail/shared/DetailHeader';
import { CompletionSummaryCard } from '../../../components/stats/detail/shared/CompletionSummaryCard';
import { StreakCard }            from '../../../components/stats/detail/shared/StreakCard';
import { TimeRangeCountsCard } from '../../../components/stats/detail/shared/TimeRangeCountsCard';
import { WeekBarGraph }          from '../../../components/stats/detail/shared/WeekBarGraph';
import { MonthCalendarGraph }    from '../../../components/stats/detail/shared/MonthCalendarGraph';
import { YearOverviewGraph }     from '../../../components/stats/detail/shared/YearOverviewGraph';
import { DayOfWeekPatternCard }  from '../../../components/stats/detail/shared/DayOfWeekPatternCard';
import { TaskTypeBreakdownCard } from '../../../components/stats/detail/shared/TaskTypeBreakdownCard';

// ── Overall-specific components ───────────────────────────────────────────────
import { CategoryBreakdownCard }     from '../../../components/stats/detail/overall/CategoryBreakdownCard';
import { CategoryWeekBarGraph }      from '../../../components/stats/detail/overall/CategoryWeekBarGraph';
import { CategoryYearOverviewGraph } from '../../../components/stats/detail/overall/CategoryYearOverviewGraph';

// ── Types ─────────────────────────────────────────────────────────────────────
import { StatDetailParams } from '../../../core/types/statDetailTypes';
import { useStats }         from '../../../core/hooks/useStats';
import { useTheme }         from '../../../theme/ThemeContext';

// =============================================================================
// TYPES
// =============================================================================

interface OverallDetailScreenProps {
  params: StatDetailParams;
  onBack: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

type OverallBucket = 'week' | 'month' | 'year' | 'all_time';

// Maps the navigation param string (params.id) to the internal bucket enum
// used by the show* visibility flags below.
//   'all_week'  → 'week'     (This Week bucket)
//   'all_month' → 'month'    (This Month bucket)
//   'all_year'  → 'year'     (This Year bucket)
//   anything else → 'all_time' (All Time bucket, the default)
function getBucket(id: string): OverallBucket {
  if (id === 'all_week')  return 'week';
  if (id === 'all_month') return 'month';
  if (id === 'all_year')  return 'year';
  return 'all_time';
}

// =============================================================================
// COMPONENT
// =============================================================================

export const OverallDetailScreen: React.FC<OverallDetailScreenProps> = ({
  params,
  onBack,
}) => {
  const { theme } = useTheme();
  const stats  = useStats();
  // Static fields — recomputed only if the bucket changes (params.id).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data   = useMemo(() => stats.getOverallDetail(params.id), [params.id]);

  // Graph data — each piece has its own state so navigation updates it
  // independently without re-fetching the static summary fields.
  const [weeklyData,         setWeeklyData]         = useState(data.weeklyData);
  const [monthlyData,        setMonthlyData]        = useState(data.monthlyData);
  const [yearlyData,         setYearlyData]         = useState(data.yearlyData);
  const [categoryWeeklyData, setCategoryWeeklyData] = useState(data.categoryWeeklyData);
  const [categoryYearlyData, setCategoryYearlyData] = useState(data.categoryYearlyData);

  const now    = new Date();
  const bucket = getBucket(params.id);

  // ── HOW TO CONTROL CARD VISIBILITY ──────────────────────────────────────────
  //
  // Each card can be shown or hidden depending on which time bucket the user
  // tapped (Week / Month / Year / All Time).
  //
  // `bucket` is one of four string values:
  //   'week'     → user opened "This Week"
  //   'month'    → user opened "This Month"
  //   'year'     → user opened "This Year"
  //   'all_time' → user opened "All Time"
  //
  // To make a card conditional, define a boolean flag using `bucket`, then
  // wrap the card's JSX in {showXxx && ( ... )}.
  //
  // ── RECIPES ─────────────────────────────────────────────────────────────────
  //
  //  Show for ALL buckets (always visible — no flag needed, just render it):
  //    <MyCard />
  //
  //  Show for ONE bucket only:
  //    const showMyCard = bucket === 'week';
  //    const showMyCard = bucket === 'month';
  //    const showMyCard = bucket === 'year';
  //    const showMyCard = bucket === 'all_time';
  //
  //  Hide for ONE bucket, show for everything else:
  //    const showMyCard = bucket !== 'week';
  //    const showMyCard = bucket !== 'month';
  //    const showMyCard = bucket !== 'year';
  //    const showMyCard = bucket !== 'all_time';
  //
  //  Show for TWO specific buckets:
  //    const showMyCard = bucket === 'year' || bucket === 'all_time';
  //    const showMyCard = bucket === 'week' || bucket === 'month';
  //
  //  Hide for TWO specific buckets:
  //    const showMyCard = bucket !== 'week' && bucket !== 'month';
  //    const showMyCard = bucket !== 'year' && bucket !== 'all_time';
  //
  // ── HOW TO APPLY THE FLAG ───────────────────────────────────────────────────
  //
  //  In the JSX below, wrap the card like this:
  //
  //    {showMyCard && (
  //      <MyCard prop={value} />
  //    )}
  //
  //  To remove an existing flag and always show a card, just unwrap it:
  //    Before:  {showYear && (<YearOverviewGraph ... />)}
  //    After:   <YearOverviewGraph ... />
  //
  // ── CURRENT FLAGS ───────────────────────────────────────────────────────────
  // AllCompletions: Week and month should have minimal information to avoid clutter
  const showCompletions = bucket == 'year' || bucket === 'all_time';

  // MonthCalendarGraph: a 7-day window doesn't need a calendar view.
  const showMonth        = bucket !== 'week';

  // YearOverviewGraph: only meaningful when the window spans a full year or more.
  const showYear         = bucket === 'year' || bucket === 'all_time';

  // DayOfWeekPatternCard: a single week has at most 7 data points — not enough
  // to establish a weekday pattern. Hidden for the week bucket only.
  const showDayOfWeek    = bucket !== 'week';

  // CategoryYearOverviewGraph: mirrors showYear — only shown when the time window
  // is large enough that a 12-bar year breakdown adds information.
  const showCategoryYear = bucket === 'year' || bucket === 'all_time';

  return (
    <Screen edges={['bottom']} style={[styles.container, { backgroundColor: theme.bgScreen }]}>

      {/* ── Fixed header ────────────────────────────────────────────────── */}
      <DetailHeader
        title={params.name}
        color={params.color}
        onBack={onBack}
      />

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* 1. Large ring + completed count + rate % */}
        <CompletionSummaryCard
          completed={data.completed}
          total={data.total}
          color={params.color}
        />

        {/* 2. Current streak + best streak */}
        <StreakCard
          currentStreak={data.currentStreak}
          bestStreak={data.bestStreak}
          color={params.color}
        />

        {/* 3. Permanent vs one-off split */}
        <TaskTypeBreakdownCard
          permanentCount={data.permanentCount}
          oneOffCount={data.oneOffCount}
          color={params.color}
        />

        {/* 4. Year / All Time counts with perm/one-off breakdown */}
        {showCompletions && (<TimeRangeCountsCard
          weekCount={data.weekCount}
          monthCount={data.monthCount}
          yearCount={data.yearCount}
          allTimeCount={data.allTimeCount}
          color={params.color}
          breakdown={data.breakdown}
        />)}

        {/* 5. 7-bar week chart — segmented perm (green) + one-off (blue) */}
        <WeekBarGraph
          data={weeklyData}
          color={params.color}
          onWeekChange={weekStart => setWeeklyData(stats.getWeekBarData(weekStart))}
        />

        {/* 6. Calendar grid for the current month (showMonth — hidden for week bucket) */}
        {showMonth && (
          <MonthCalendarGraph
            year={now.getFullYear()}
            month={now.getMonth()}
            data={monthlyData}
            color={params.color}
            onMonthChange={(y, m) => setMonthlyData(stats.getMonthCalendarData(y, m))}
          />
        )}

        {/* 7. 12-bar year overview — segmented bars (showYear — hidden for week + month buckets) */}
        {showYear && (
          <YearOverviewGraph
            data={yearlyData}
            color={params.color}
            onYearChange={year => setYearlyData(stats.getYearBarData(year))}
          />
        )}

        {/* 8. All-time completions by weekday — segmented bars (showDayOfWeek — hidden for week bucket) */}
        {showDayOfWeek && (
          <DayOfWeekPatternCard
            data={data.dayOfWeekData}
            color={params.color}
          />
        )}

        {/* 9. Top 5 categories horizontal bar list */}
        <CategoryBreakdownCard
          categories={data.categories}
          color={params.color}
        />

        {/* 10. Weekly completions stacked by category color */}
        <CategoryWeekBarGraph
          data={categoryWeeklyData}
          color={params.color}
          onWeekChange={weekStart => setCategoryWeeklyData(stats.getCategoryWeekBarData(weekStart))}
        />

        {/* 11. Year overview stacked by category color (showCategoryYear — mirrors showYear, hidden for week + month) */}
        {showCategoryYear && (
          <CategoryYearOverviewGraph
            data={categoryYearlyData}
            color={params.color}
            onYearChange={year => setCategoryYearlyData(stats.getCategoryYearBarData(year))}
          />
        )}

        <View style={styles.bottomPad} />

      </ScrollView>
    </Screen>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#f5f5f5',
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingTop: 16,
  },

  bottomPad: {
    height: 40,
  },
});
