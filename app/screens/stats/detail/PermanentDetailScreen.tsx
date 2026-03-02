// app/screens/stats/detail/PermanentDetailScreen.tsx
// =============================================================================
// PERMANENT DETAIL SCREEN
// =============================================================================
//
// Full-screen detail view for a single permanent task template.
// Opened when the user taps a card in the "Permanent Tasks" section of
// StatsScreen. One instance of this screen exists per template card tapped —
// the template's id, name, and color are passed in via `params`.
//
// ── Layout (top to bottom) ────────────────────────────────────────────────────
//
//   DetailHeader          ← blue accent, task name, back arrow
//   CompletionSummaryCard ← ring + total completed + rate %
//   StreakCard            ← current streak + best streak pills
//   TimeRangeCountsCard   ← Week / Month / Year / All Time counts
//   WeekBarGraph          ← 7-bar chart, count/% toggle
//   MonthCalendarGraph    ← current month calendar with fill circles
//   YearOverviewGraph     ← 12-bar Jan–Dec summary
//   DayOfWeekPatternCard  ← all-time totals grouped by weekday (Mon–Sun)
//
// ── Data ─────────────────────────────────────────────────────────────────────
//
//   Uses useStats().getPermanentDetail(id) — real data from completion_log,
//   filtered to this template. All windows are all-time.
//
// ── Navigation ────────────────────────────────────────────────────────────────
//
//   Rendered as an overlay screen by MainNavigator (same pattern as
//   CreateTaskScreen). Tab bar is hidden while this screen is visible.
//   Back press calls `onBack`, which clears the overlay and restores tabs.
//
// Props:
//   params  - id, name, and color of the template being shown
//   onBack  - called when the user taps the back arrow in DetailHeader
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../../../components/layout/Screen';

// ── Shared detail components ─────────────────────────────────────────────────
import { DetailHeader }          from '../../../components/stats/detail/shared/DetailHeader';
import { CompletionSummaryCard } from '../../../components/stats/detail/shared/CompletionSummaryCard';
import { StreakCard }            from '../../../components/stats/detail/shared/StreakCard';
import { TimeRangeCountsCard }   from '../../../components/stats/detail/shared/TimeRangeCountsCard';
import { WeekBarGraph }          from '../../../components/stats/detail/shared/WeekBarGraph';
import { MonthCalendarGraph } from '../../../components/stats/detail/shared/MonthCalendarGraph';
import { YearOverviewGraph }  from '../../../components/stats/detail/shared/YearOverviewGraph';
import { DayOfWeekPatternCard } from '../../../components/stats/detail/shared/DayOfWeekPatternCard';

// ── Types ─────────────────────────────────────────────────────────────────────
import { StatDetailParams } from '../../../core/types/statDetailTypes';
import { useStats }         from '../../../core/hooks/useStats';
import { useTheme }         from '../../../theme/ThemeContext';

// =============================================================================
// TYPES
// =============================================================================

interface PermanentDetailScreenProps {
  /** Id, name, and accent color of the template, passed from MainNavigator */
  params: StatDetailParams;
  /** Called when the user presses the back arrow — clears the overlay */
  onBack: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const PermanentDetailScreen: React.FC<PermanentDetailScreenProps> = ({
  params,
  onBack,
}) => {
  const { theme } = useTheme();
  const stats = useStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data  = useMemo(() => stats.getPermanentDetail(params.id), [params.id]);

  const [weeklyData,  setWeeklyData]  = useState(data.weeklyData);
  const [monthlyData, setMonthlyData] = useState(data.monthlyData);
  const [yearlyData,  setYearlyData]  = useState(data.yearlyData);

  const now = new Date();

  return (
    // flex: 1 so the screen fills the overlay container in MainNavigator
    <Screen edges={['bottom']} style={[styles.container, { backgroundColor: theme.bgScreen }]}>

      {/* ── Fixed header — not scrollable ───────────────────────────────── */}
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

        {/* 3. Four-box count summary: Week / Month / Year / All Time */}
        <TimeRangeCountsCard
          weekCount={data.weekCount}
          monthCount={data.monthCount}
          yearCount={data.yearCount}
          allTimeCount={data.allTimeCount}
          color={params.color}
        />

        {/* 4. Full-width 7-bar chart for the current week */}
        <WeekBarGraph
          data={weeklyData}
          color={params.color}
          onWeekChange={weekStart =>
            setWeeklyData(stats.getWeekBarDataSimple(weekStart, { templateId: params.id }))
          }
        />

        {/* 5. Calendar grid for the current month */}
        <MonthCalendarGraph
          year={now.getFullYear()}
          month={now.getMonth()}
          data={monthlyData}
          color={params.color}
          onMonthChange={(y, m) =>
            setMonthlyData(stats.getMonthCalendarData(y, m, { templateId: params.id }))
          }
        />

        {/* 6. 12-bar year overview */}
        <YearOverviewGraph
          data={yearlyData}
          color={params.color}
          onYearChange={year =>
            setYearlyData(stats.getYearBarDataSimple(year, { templateId: params.id }))
          }
        />

        {/* 7. All-time completions grouped by weekday — reveals patterns */}
        <DayOfWeekPatternCard
          data={data.dayOfWeekData}
          color={params.color}
        />

        {/* Bottom breathing room above the system home indicator */}
        <View style={styles.bottomPad} />

      </ScrollView>
    </Screen>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // Fills the full overlay container; background matches the screen bg
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

  // Space at the bottom so the last card doesn't sit flush against the edge
  bottomPad: {
    height: 40,
  },
});
