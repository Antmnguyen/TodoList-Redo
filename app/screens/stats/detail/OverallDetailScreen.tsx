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
// ── Data ─────────────────────────────────────────────────────────────────────
//
//   Uses useStats().getOverallDetail(id) — real data from completion_log.
//   Output varies by params.id (all_time / all_year / all_month / all_week).
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

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

  const now              = new Date();
  const bucket           = getBucket(params.id);
  const showMonth        = bucket !== 'week';
  const showYear         = bucket === 'year' || bucket === 'all_time';
  const showDayOfWeek    = bucket !== 'week';
  const showCategoryYear = bucket === 'year' || bucket === 'all_time';

  return (
    <View style={styles.container}>

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

        {/* 4. Week / Month / Year / All Time counts with perm/one-off breakdown */}
        <TimeRangeCountsCard
          weekCount={data.weekCount}
          monthCount={data.monthCount}
          yearCount={data.yearCount}
          allTimeCount={data.allTimeCount}
          color={params.color}
          breakdown={data.breakdown}
        />

        {/* 5. 7-bar week chart — segmented perm (green) + one-off (blue) */}
        <WeekBarGraph
          data={weeklyData}
          color={params.color}
          onWeekChange={weekStart => setWeeklyData(stats.getWeekBarData(weekStart))}
        />

        {/* 6. Calendar grid for the current month */}
        {showMonth && (
          <MonthCalendarGraph
            year={now.getFullYear()}
            month={now.getMonth()}
            data={monthlyData}
            color={params.color}
            onMonthChange={(y, m) => setMonthlyData(stats.getMonthCalendarData(y, m))}
          />
        )}

        {/* 7. 12-bar year overview — segmented bars */}
        {showYear && (
          <YearOverviewGraph
            data={yearlyData}
            color={params.color}
            onYearChange={year => setYearlyData(stats.getYearBarData(year))}
          />
        )}

        {/* 8. All-time completions by weekday — segmented bars */}
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

        {/* 11. Year overview stacked by category color */}
        {showCategoryYear && (
          <CategoryYearOverviewGraph
            data={categoryYearlyData}
            color={params.color}
            onYearChange={year => setCategoryYearlyData(stats.getCategoryYearBarData(year))}
          />
        )}

        <View style={styles.bottomPad} />

      </ScrollView>
    </View>
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
