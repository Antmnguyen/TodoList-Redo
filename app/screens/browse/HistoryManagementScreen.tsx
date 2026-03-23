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
//     → every range is computed relative to a shared reference date
//     → grouped by local calendar day
//     → rendered as a SectionList
//
// All data loading is synchronous — getArchivedTasks wraps expo-sqlite's
// getAllSync. No useEffect / loading state needed for data.
//
// REFERENCE DATE MODEL
// --------------------
// All filter tabs share a single "reference date" (referenceDate state).
// By default this is today, so all tabs behave as normal.  When the user
// picks a date via the "Select Date" tab the reference date changes and
// every other tab immediately re-anchors:
//
//   all       – no date filter, ignores reference date, shows entire archive
//   today     – the full reference day (00:00 → 23:59:59)
//   week      – Monday of the reference day's ISO week → end of reference day
//   month     – 1st of the reference day's month → end of reference day
//   year      – Jan 1 of the reference day's year → end of reference day
//   select    – same as "today" (the exact reference day); its purpose is to
//               open the date picker so the user can change the reference date.
//               Once a date is chosen, tapping any of the other tabs shows
//               history relative to that date.
//
// Example: user picks 2025-03-05.
//   "Today"      → tasks on March 5, 2025
//   "This Week"  → tasks from Mon Feb 24 – Mar 5, 2025
//   "This Month" → tasks from Mar 1 – Mar 5, 2025
//   "This Year"  → tasks from Jan 1 – Mar 5, 2025
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
  Platform,
} from 'react-native';
// Native date/time picker — same package used by EditTaskModal and CreateTaskScreen.
// On Android it presents as a system dialog that auto-dismisses after a selection.
// On iOS it renders inline as a spinner; we show a "Done" button to close it.
import DateTimePicker from '@react-native-community/datetimepicker';
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

type FilterTab = 'all' | 'today' | 'week' | 'month' | 'year' | 'select';

type Section = {
  title:   string;
  dateKey: string;
  data:    ArchivedTask[];
};

// =============================================================================
// CONSTANTS
// =============================================================================

// Ordered list of tabs as they appear in the horizontal scroll bar.
const FILTER_TABS: FilterTab[] = ['all', 'today', 'week', 'month', 'year', 'select'];

// Static labels for all tabs. The 'select' tab label is overridden dynamically
// by getTabLabel() once the user has explicitly chosen a date.
const FILTER_LABELS: Record<FilterTab, string> = {
  all:    'All',
  today:  'Today',
  week:   'This Week',
  month:  'This Month',
  year:   'This Year',
  select: 'Select Date',
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Returns the [fromMs, toMs] epoch-ms window for a given filter tab,
 * anchored to referenceDate.
 *
 * Every non-'all' tab computes its range relative to referenceDate so that
 * switching the reference date (via the 'select' picker) updates every tab
 * simultaneously without each tab needing its own date state.
 *
 * The upper bound for all ranged tabs is the end of referenceDate's calendar
 * day rather than the current moment.  If referenceDate is today that is
 * functionally identical; for past dates it ensures the full day is included.
 *
 * @param tab           - The active filter tab.
 * @param referenceDate - The anchor date.  Defaults to today; changed by the
 *                        'select' tab date picker.
 */
function getFilterRange(
  tab: FilterTab,
  referenceDate: Date,
): { fromMs?: number; toMs?: number } {

  // End of the reference day — used as the upper bound for all ranged tabs.
  const endOfRefDay = new Date(referenceDate);
  endOfRefDay.setHours(23, 59, 59, 999);

  switch (tab) {

    // No date filter — return the entire archive regardless of reference date.
    case 'all':
      return {};

    // The full reference calendar day only.
    // 'select' is semantically identical: it shows the chosen day and serves
    // as the picker trigger.  Both cases share the same range.
    case 'today':
    case 'select': {
      const start = new Date(referenceDate);
      start.setHours(0, 0, 0, 0);
      return { fromMs: start.getTime(), toMs: endOfRefDay.getTime() };
    }

    // Monday of the reference day's ISO week → end of reference day.
    // (getDay() returns 0=Sun … 6=Sat; the formula maps Sun→6, Mon→0.)
    case 'week': {
      const start = new Date(referenceDate);
      const daysToMonday = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - daysToMonday);
      start.setHours(0, 0, 0, 0);
      return { fromMs: start.getTime(), toMs: endOfRefDay.getTime() };
    }

    // First of the reference day's month → end of reference day.
    case 'month': {
      const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0);
      return { fromMs: start.getTime(), toMs: endOfRefDay.getTime() };
    }

    // January 1st of the reference day's year → end of reference day.
    case 'year': {
      const start = new Date(referenceDate.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { fromMs: start.getTime(), toMs: endOfRefDay.getTime() };
    }
  }
}

/**
 * Groups a flat list of archived tasks into calendar-day sections.
 * Map insertion order preserves the sort already applied by getArchivedTasks
 * (newest tasks first → newest sections first).
 */
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

/**
 * Returns the label shown on a filter tab pill.
 *
 * For 'select': shows a short date string (e.g. "Mar 5") once the user has
 * explicitly chosen a custom reference date, giving visual confirmation of
 * which date all other tabs are currently anchored to.  Falls back to
 * "Select Date" until the picker has been used.
 *
 * All other tabs always show their static label.
 *
 * @param tab           - The tab to label.
 * @param hasCustomDate - True once the user has picked a date via the picker.
 * @param referenceDate - The current reference date (used for the 'select' label).
 */
function getTabLabel(tab: FilterTab, hasCustomDate: boolean, referenceDate: Date): string {
  if (tab === 'select' && hasCustomDate) {
    return referenceDate.toLocaleDateString('en-US', {
      month: 'short',
      day:   'numeric',
    });
  }
  return FILTER_LABELS[tab];
}

// =============================================================================
// COMPONENT
// =============================================================================

export const HistoryManagementScreen: React.FC<HistoryManagementScreenProps> = ({ onBack }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Currently active filter tab.
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  // The shared anchor date for all tab range calculations.
  // Initialised to today so existing tabs behave exactly as before by default.
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());

  // True once the user has explicitly chosen a date via the picker.
  // Used only to control the 'select' tab label — does not affect range logic.
  const [hasCustomDate, setHasCustomDate] = useState(false);

  // Controls visibility of the inline DateTimePicker.
  // On iOS it renders below the filter bar.
  // On Android it's an OS dialog that dismisses itself; showDatePicker is
  // set to false in handleDatePickerChange to mirror that.
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Re-compute sections whenever the active tab or reference date changes.
  // Both are deps: switching tabs changes the window; changing the reference
  // date shifts the anchor of the current window.
  const sections = useMemo<Section[]>(() => {
    const { fromMs, toMs } = getFilterRange(activeFilter, referenceDate);
    const tasks = getArchivedTasks(fromMs, toMs);
    return groupByDay(tasks);
  }, [activeFilter, referenceDate]);

  const totalCount = useMemo(
    () => sections.reduce((sum, s) => sum + s.data.length, 0),
    [sections],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  /**
   * Called when the user taps a filter tab pill.
   *
   * 'select': activates the tab and opens the date picker so the user can
   *           change the reference date.  Tapping it a second time re-opens
   *           the picker so they can adjust their selection.
   * others:   simply switches the active tab.  They immediately re-render
   *           using whatever referenceDate is currently set, so if a custom
   *           date was already chosen the new tab anchors to that date too.
   */
  const handleTabPress = (tab: FilterTab) => {
    setActiveFilter(tab);
    if (tab === 'select') {
      setShowDatePicker(true);
    } else {
      // Close the picker if it was open from a previous 'select' interaction.
      setShowDatePicker(false);
    }
  };

  /**
   * Called by DateTimePicker on every value change.
   *
   * Updates the shared referenceDate so all tabs instantly re-anchor to the
   * chosen day.  On Android the OS dismisses its dialog automatically; we
   * mirror that by closing showDatePicker.  On iOS the picker stays open
   * until the user taps "Done".
   */
  const handleDatePickerChange = (_event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      // Android system dialog closes itself — keep state in sync.
      setShowDatePicker(false);
    }
    if (date) {
      setReferenceDate(date);
      // Mark that the user has made an explicit selection so the 'select'
      // tab label switches from "Select Date" to the short date string.
      setHasCustomDate(true);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Screen edges={['top']} topColor="#5856D6" style={styles.container}>

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
          Slightly reduced height (44 px, down from 48 px).
          All tabs compute their range relative to referenceDate, so changing
          the reference via "Select Date" immediately updates whichever tab is
          currently active without needing to switch tabs.
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
              onPress={() => handleTabPress(tab)}
            >
              <Text style={[
                styles.filterTabText,
                activeFilter === tab && styles.filterTabTextActive,
              ]}>
                {getTabLabel(tab, hasCustomDate, referenceDate)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* -----------------------------------------------------------------------
          INLINE DATE PICKER
          Only shown when showDatePicker is true (always triggered by tapping
          the 'select' tab).  Rendered below the filter bar so the list
          remains visible underneath.

          On Android this block is effectively skipped — the OS dialog fires
          and handleDatePickerChange sets showDatePicker(false) before React
          can render this node.  On iOS the spinner stays visible until "Done".
         ----------------------------------------------------------------------- */}
      {showDatePicker && (
        <View style={styles.datePickerContainer}>
          <DateTimePicker
            value={referenceDate}
            mode="date"
            // iOS: spinner matches the in-modal style used in EditTaskModal.
            // Android: 'default' triggers the native system dialog.
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDatePickerChange}
            // Prevent picking future dates — there can be no archived history yet.
            maximumDate={new Date()}
          />

          {/* iOS keeps the spinner open; "Done" closes it. */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.datePickerDoneBtn}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.datePickerDoneBtnText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

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
    // Height reduced from 48 → 44 (very slight reduction).
    filterBar: {
      height:            44,
      backgroundColor:   theme.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    // paddingVertical reduced from 5 → 4 to match the tighter bar height.
    filterBarContent: {
      paddingHorizontal: 12,
      paddingVertical:   6,
      gap:               8,
      flexDirection:     'row',
    },//PADDING OF THE ACTUAL BUTTONS 
    filterTab: {
      paddingHorizontal: 14,
      paddingVertical:   4,
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

    // ── Inline date picker (shown below the filter bar on 'select' tap) ──────────
    datePickerContainer: {
      backgroundColor:   theme.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      // No extra padding — DateTimePicker owns its internal spacing.
    },
    // "Done" button only appears on iOS to close the persistent spinner picker.
    datePickerDoneBtn: {
      alignSelf:         'flex-end',
      paddingVertical:   8,
      paddingHorizontal: 16,
    },
    datePickerDoneBtnText: {
      fontSize:   16,
      fontWeight: '600',
      color:      '#5856D6',  // brand accent, matches active tab colour
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
