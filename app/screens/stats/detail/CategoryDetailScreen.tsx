// app/screens/stats/detail/CategoryDetailScreen.tsx
// =============================================================================
// CATEGORY DETAIL SCREEN
// =============================================================================
//
// Full-screen detail view for a single task category (e.g. Work, Health).
// Opened when the user taps a Category StatPreviewCard in StatsScreen.
//
// ── Layout (top to bottom) ────────────────────────────────────────────────────
//
//   DetailHeader          ← category accent color, category name, back arrow
//   CompletionSummaryCard ← ring + total completed + rate %
//   StreakCard            ← current streak + best streak pills
//   TimeRangeCountsCard   ← Week / Month / Year / All Time counts
//   WeekBarGraph          ← segmented bars (permanent green / one-off blue)
//   MonthCalendarGraph    ← current month calendar
//   YearOverviewGraph     ← 12-bar Jan–Dec, segmented bars
//   DayOfWeekPatternCard  ← all-time by weekday, segmented bars
//   TaskTypeBreakdownCard ← permanent vs one-off split within this category
//   PermanentTaskListCard ← tappable list of permanent templates in this category
//
// ── Data ─────────────────────────────────────────────────────────────────────
//
//   Uses useStats().getCategoryDetail(id) — real data from completion_log,
//   filtered to this category. All windows are all-time (no bucket concept).
//
// ── Navigation from PermanentTaskListCard ─────────────────────────────────────
//
//   Tapping a task row calls onStatCardPress({ type: 'template', ... }) which
//   MainNavigator handles to open PermanentDetailScreen for that task.
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

// ── Category-specific components ──────────────────────────────────────────────
import { PermanentTaskListCard, PermanentTaskStat } from '../../../components/stats/detail/category/PermanentTaskListCard';

// ── Types ─────────────────────────────────────────────────────────────────────
import { StatDetailParams } from '../../../core/types/statDetailTypes';
import { useStats }         from '../../../core/hooks/useStats';
import { useTheme }         from '../../../theme/ThemeContext';

// =============================================================================
// TYPES
// =============================================================================

interface CategoryDetailScreenProps {
  params:           StatDetailParams;
  onBack:           () => void;
  /** Re-uses MainNavigator's handleStatCardPress to open PermanentDetailScreen */
  onStatCardPress:  (p: StatDetailParams) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CategoryDetailScreen: React.FC<CategoryDetailScreenProps> = ({
  params,
  onBack,
  onStatCardPress,
}) => {
  const { theme } = useTheme();
  const stats = useStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data  = useMemo(() => stats.getCategoryDetail(params.id), [params.id]);

  const [weeklyData,  setWeeklyData]  = useState(data.weeklyData);
  const [monthlyData, setMonthlyData] = useState(data.monthlyData);
  const [yearlyData,  setYearlyData]  = useState(data.yearlyData);

  const now  = new Date();

  /** Called by PermanentTaskListCard when a task row is tapped. */
  const handleTaskPress = (id: string, name: string, color: string) => {
    onStatCardPress({ type: 'template', id, name, color });
  };

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

        {/* 3. Permanent vs one-off split within this category */}
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
          onWeekChange={weekStart =>
            setWeeklyData(stats.getWeekBarData(weekStart, { categoryId: params.id }))
          }
        />

        {/* 6. Calendar grid for the current month */}
        <MonthCalendarGraph
          year={now.getFullYear()}
          month={now.getMonth()}
          data={monthlyData}
          color={params.color}
          onMonthChange={(y, m) =>
            setMonthlyData(stats.getMonthCalendarData(y, m, { categoryId: params.id }))
          }
        />

        {/* 7. 12-bar year overview — segmented bars */}
        <YearOverviewGraph
          data={yearlyData}
          color={params.color}
          onYearChange={year =>
            setYearlyData(stats.getYearBarData(year, { categoryId: params.id }))
          }
        />

        {/* 8. All-time completions by weekday — segmented bars */}
        <DayOfWeekPatternCard
          data={data.dayOfWeekData}
          color={params.color}
        />

        {/* 9. Tappable list of permanent tasks — drills into PermanentDetailScreen */}
        <PermanentTaskListCard
          tasks={data.permanentTasks}
          color={params.color}
          onTaskPress={handleTaskPress}
        />

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
