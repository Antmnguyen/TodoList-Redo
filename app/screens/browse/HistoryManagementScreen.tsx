// app/screens/browse/HistoryManagementScreen.tsx
// =============================================================================
// HISTORY MANAGEMENT SCREEN
// =============================================================================
//
// PURPOSE
// -------
// Displays the user's completed task history, sourced from the task_archive
// table populated by archiveCompletedTasks() (midnight job #3).
//
// DATA FLOW
// ---------
//   getArchivedTasks() (archiveStorage.ts)
//     → filtered by selected time range (All / Today / This Week / etc.)
//     → grouped by local calendar day
//     → rendered as a SectionList
//
// All data loading is synchronous — getArchivedTasks wraps expo-sqlite's
// getAllSync. No useEffect / loading state needed for data.
//
// NAVIGATION
// ----------
// Rendered by BrowseScreen when subScreen === 'history'.
// onBack navigates back to the BrowseScreen feature grid.
// =============================================================================

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  ScrollView,
} from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { getArchivedTasks, ArchivedTask } from '../../core/services/storage/archiveStorage';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

export interface HistoryManagementScreenProps {
  onBack: () => void;
}

type FilterTab = 'all' | 'today' | 'week' | 'month' | 'year';

type Section = {
  title:   string;
  dateKey: string;
  data:    ArchivedTask[];
};

// =============================================================================
// CONSTANTS
// =============================================================================

const FILTER_TABS: FilterTab[] = ['all', 'today', 'week', 'month', 'year'];

const FILTER_LABELS: Record<FilterTab, string> = {
  all:   'All',
  today: 'Today',
  week:  'This Week',
  month: 'This Month',
  year:  'This Year',
};

// =============================================================================
// HELPERS
// =============================================================================

function getFilterRange(tab: FilterTab): { fromMs?: number; toMs?: number } {
  const now = new Date();

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  switch (tab) {
    case 'all':
      return {};

    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { fromMs: start.getTime(), toMs: endOfToday.getTime() };
    }

    case 'week': {
      const start = new Date(now);
      const daysToMonday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - daysToMonday);
      start.setHours(0, 0, 0, 0);
      return { fromMs: start.getTime(), toMs: endOfToday.getTime() };
    }

    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { fromMs: start.getTime(), toMs: endOfToday.getTime() };
    }

    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { fromMs: start.getTime(), toMs: endOfToday.getTime() };
    }
  }
}

function groupByDay(tasks: ArchivedTask[]): Section[] {
  const map = new Map<string, ArchivedTask[]>();

  for (const task of tasks) {
    const d    = new Date(task.completedAt);
    const year = d.getFullYear();
    const mon  = String(d.getMonth() + 1).padStart(2, '0');
    const day  = String(d.getDate()).padStart(2, '0');
    const key  = `${year}-${mon}-${day}`;

    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(task);
  }

  return Array.from(map.entries()).map(([dateKey, data]) => ({
    dateKey,
    title: new Date(data[0].completedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      month:   'short',
      day:     'numeric',
      year:    'numeric',
    }),
    data,
  }));
}

// =============================================================================
// COMPONENT
// =============================================================================

export const HistoryManagementScreen: React.FC<HistoryManagementScreenProps> = ({ onBack }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const sections = useMemo<Section[]>(() => {
    const { fromMs, toMs } = getFilterRange(activeFilter);
    const tasks = getArchivedTasks(fromMs, toMs);
    return groupByDay(tasks);
  }, [activeFilter]);

  const totalCount = useMemo(
    () => sections.reduce((sum, s) => sum + s.data.length, 0),
    [sections],
  );

  return (
    <Screen edges={['top']} style={styles.container}>

      {/* -----------------------------------------------------------------------
          HEADER
         ----------------------------------------------------------------------- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>History</Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* -----------------------------------------------------------------------
          FILTER TAB BAR
         ----------------------------------------------------------------------- */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBarContent}
        >
          {FILTER_TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
              onPress={() => setActiveFilter(tab)}
            >
              <Text style={[
                styles.filterTabText,
                activeFilter === tab && styles.filterTabTextActive,
              ]}>
                {FILTER_LABELS[tab]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* -----------------------------------------------------------------------
          CONTENT — section list or empty state
         ----------------------------------------------------------------------- */}
      {totalCount === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No completed tasks archived yet.</Text>
          <Text style={styles.emptySubtitle}>
            Tasks are moved here automatically each day.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          stickySectionHeadersEnabled

          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>
          )}

          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.checkmark}>✓</Text>

              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>

              <View style={styles.rowRight}>
                {item.categoryName ? (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText} numberOfLines={1}>
                      {item.categoryName}
                    </Text>
                  </View>
                ) : null}

                {item.wasRecurring ? (
                  <Text style={styles.recurringIcon}>🔁</Text>
                ) : null}
              </View>
            </View>
          )}

          contentContainerStyle={styles.listContent}
        />
      )}

    </Screen>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bgScreen,
    },

    // ── Header ──────────────────────────────────────────────────────────────────
    header: {
      flexDirection:     'row',
      alignItems:        'center',
      justifyContent:    'space-between',
      paddingHorizontal: 16,
      paddingVertical:   12,
      backgroundColor:   '#5856D6',  // brand colour — stays same in dark mode
    },
    backBtn: {
      padding: 4,
    },
    backText: {
      fontSize:   16,
      color:      '#fff',
      fontWeight: '500',
    },
    title: {
      fontSize:   20,
      fontWeight: '700',
      color:      '#fff',
    },
    headerSpacer: {
      width: 60,
    },

    // ── Filter tab bar ───────────────────────────────────────────────────────────
    filterBar: {
      height:            48,
      backgroundColor:   theme.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    filterBarContent: {
      paddingHorizontal: 12,
      paddingVertical:   5,
      gap:               8,
      flexDirection:     'row',
    },
    filterTab: {
      paddingHorizontal: 14,
      paddingVertical:   5,
      borderRadius:      16,
      backgroundColor:   theme.bgInput,
    },
    filterTabActive: {
      backgroundColor: '#5856D6',
    },
    filterTabText: {
      fontSize:   13,
      fontWeight: '500',
      color:      theme.textSecondary,
    },
    filterTabTextActive: {
      color: '#fff',
    },

    // ── Section headers ──────────────────────────────────────────────────────────
    sectionHeader: {
      paddingHorizontal: 16,
      paddingVertical:   7,
      backgroundColor:   theme.bgInput,
    },
    sectionHeaderText: {
      fontSize:      12,
      fontWeight:    '600',
      color:         theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },

    // ── Task rows ────────────────────────────────────────────────────────────────
    listContent: {
      paddingBottom: 32,
    },
    row: {
      flexDirection:     'row',
      alignItems:        'center',
      paddingHorizontal: 16,
      paddingVertical:   12,
      backgroundColor:   theme.bgCard,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    checkmark: {
      fontSize:    14,
      color:       '#34C759',
      fontWeight:  '700',
      marginRight: 10,
    },
    rowTitle: {
      flex:     1,
      fontSize: 15,
      color:    theme.textPrimary,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems:    'center',
      gap:           6,
      marginLeft:    8,
      flexShrink:    0,
    },
    categoryBadge: {
      paddingHorizontal: 7,
      paddingVertical:   2,
      borderRadius:      10,
      backgroundColor:   theme.bgInput,
      maxWidth:          100,
    },
    categoryBadgeText: {
      fontSize:   11,
      color:      theme.textSecondary,
      fontWeight: '500',
    },
    recurringIcon: {
      fontSize: 12,
    },

    // ── Empty state ──────────────────────────────────────────────────────────────
    emptyState: {
      flex:              1,
      justifyContent:    'center',
      alignItems:        'center',
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize:     16,
      fontWeight:   '600',
      color:        theme.textSecondary,
      textAlign:    'center',
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize:   14,
      color:      theme.textTertiary,
      textAlign:  'center',
      lineHeight: 20,
    },
  });
}
