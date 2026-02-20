// app/screens/stats/StatsScreen.tsx
// =============================================================================
// STATS SCREEN
// =============================================================================
//
// Three collapsible section boxes — tap header to expand/collapse:
//   - OVERALL       (All Time, This Year, This Month, This Week)
//   - CATEGORIES    (one card per category)
//   - PERMANENT TASKS (one card per template)
//
// DATA LAYER (current state):
//   All data is placeholder mock values. When Sprint 4 backend work is ready,
//   swap each getMock*() call with the real hook/storage function.
//
//   Functions to replace later:
//     getMockOverallStats()      → useStats().getOverallStatsList()
//     getMockTemplateStats()     → useStats().getTemplateStatsList()
//     getMockCategoryStats()     → useStats().getCategoryStatsList()
//
// =============================================================================

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatPreviewCard, StatPreviewData } from '../../components/stats/StatPreviewCard';
import { DayData } from '../../components/stats/WeeklyMiniChart';
import { TodayCard, TodayStats } from '../../components/stats/TodayCard';
import { StatDetailParams } from '../../core/types/statDetailTypes';

// =============================================================================
// COLLAPSIBLE SECTION
// =============================================================================
//
// Each section has a tappable header (icon badge + title + chevron) that
// expands / collapses the card list below with a smooth animation.
//
// ── HOW TO SWAP IN A CUSTOM ICON ─────────────────────────────────────────────
//
//  Pass a `renderIcon` function that returns any React element.
//  The element is centered inside the badge square — size it to fit.
//
//  Option A — Emoji (current default, zero dependencies):
//    renderIcon={() => <Text style={{ fontSize: 26 }}>📊</Text>}
//
//  Option B — Local image / PNG asset:
//    import { Image } from 'react-native';
//    renderIcon={() => (
//      <Image
//        source={require('../../assets/icons/overall.png')}
//        style={{ width: 28, height: 28 }}
//      />
//    )}
//
//  Option C — Vector icon library (e.g. @expo/vector-icons once installed):
//    import { Ionicons } from '@expo/vector-icons';
//    renderIcon={() => <Ionicons name="analytics" size={26} color="#FF9500" />}
//
// ── BADGE APPEARANCE PROPS ────────────────────────────────────────────────────
//
//  badgeColor        hex color string that tints the badge background
//  badgeOpacity      0–1 opacity of the background tint   (default 0.12)
//  badgeSize         width & height of the badge square   (default 52)
//  badgeBorderRadius corner roundness in px               (default 14)
//  badgeBorderWidth  set > 0 to show a visible border     (default 0)
//  badgeBorderColor  border color; defaults to badgeColor (default transparent)
//
// =============================================================================

/** Appends a two-digit hex alpha to a 6-char hex color string. */
function hexAlpha(hex: string, opacity: number): string {
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + alpha;
}

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;

  // ── Icon ──────────────────────────────────────────────────────────────────
  // Return any element here — emoji Text, Image, or a vector icon component.
  // See the guide above for examples.
  renderIcon: () => React.ReactNode;

  // ── Badge styling ─────────────────────────────────────────────────────────
  badgeColor: string;           // hex, e.g. '#FF9500'
  badgeOpacity?: number;        // bg opacity 0–1          default: 0.12
  badgeSize?: number;           // badge square px         default: 52
  badgeBorderRadius?: number;   // corner radius px        default: 14
  badgeBorderWidth?: number;    // 0 = no border           default: 0
  badgeBorderColor?: string;    // defaults to badgeColor
  emptyMessage?: string;        // shown inside section when there are no items
}

const ANIM_DURATION_OPEN  = 320;
const ANIM_DURATION_CLOSE = 240;
const MAX_CONTENT_HEIGHT  = 2000;

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = false,
  renderIcon,
  badgeColor,
  badgeOpacity      = 0.12,
  badgeSize         = 52,
  badgeBorderRadius = 14,
  badgeBorderWidth  = 0,
  badgeBorderColor,
  emptyMessage,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const anim    = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const opacity = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const opening = !open;
    setOpen(opening);

    Animated.parallel([
      Animated.timing(anim, {
        toValue:         opening ? 1 : 0,
        duration:        opening ? ANIM_DURATION_OPEN : ANIM_DURATION_CLOSE,
        easing:          opening ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue:         opening ? 1 : 0,
        duration:        opening ? ANIM_DURATION_OPEN * 0.7 : ANIM_DURATION_CLOSE * 0.5,
        easing:          Easing.linear,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const maxHeight = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, MAX_CONTENT_HEIGHT],
  });

  // Chevron: › rotated 0° (right = collapsed) → 90° (down = expanded)
  const chevronRotation = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  // Computed badge styles from props
  const badgeStyle = {
    width:           badgeSize,
    height:          badgeSize,
    borderRadius:    badgeBorderRadius,
    backgroundColor: hexAlpha(badgeColor, badgeOpacity),
    borderWidth:     badgeBorderWidth,
    borderColor:     badgeBorderColor ?? (badgeBorderWidth > 0 ? badgeColor : 'transparent'),
  };

  return (
    <View style={sectionStyles.box}>
      <TouchableOpacity
        style={sectionStyles.header}
        onPress={toggle}
        activeOpacity={0.75}
      >
        {/* ── Icon badge ─────────────────────────────────────────────────
            Swap renderIcon to change the icon. See guide at top of file. */}
        <View style={[sectionStyles.iconBadgeBase, badgeStyle]}>
          {renderIcon()}
        </View>

        {/* Title */}
        <Text style={sectionStyles.title}>{title}</Text>

        {/* Chevron — rotates 90° on open */}
        <Animated.Text
          style={[sectionStyles.chevron, { transform: [{ rotate: chevronRotation }] }]}
        >
          ›
        </Animated.Text>
      </TouchableOpacity>

      <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
        <Animated.View style={[sectionStyles.content, { opacity }]}>
          {React.Children.count(children) === 0 && emptyMessage ? (
            <Text style={sectionStyles.emptyText}>{emptyMessage}</Text>
          ) : (
            children
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const sectionStyles = StyleSheet.create({
  box: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 14,
  },
  // Base layout only — size/color/radius are applied inline from props
  iconBadgeBase: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.2,
  },
  chevron: {
    fontSize: 26,
    color: '#c0c0c0',
    lineHeight: 28,
  },
  content: {
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    fontSize: 14,
    color: '#ccc',
    fontWeight: '500',
  },
});

// Inner card style — removes individual card chrome so cards sit flush inside the section box
const innerCard = {
  marginHorizontal: 0,
  marginBottom: 0,
  borderRadius: 0,
  shadowOpacity: 0,
  elevation: 0,
  borderTopWidth: 1,
  borderTopColor: '#f2f2f2',
};
const innerCardFirst = { ...innerCard, borderTopWidth: 0 };

// =============================================================================
// MOCK DATA HELPERS
// =============================================================================

/** Build a 7-item Mon–Sun week array from raw completion counts. */
function week(mon: number, tue: number, wed: number, thu: number, fri: number, sat: number, sun: number): DayData[] {
  return [
    { day: 'M', count: mon },
    { day: 'T', count: tue },
    { day: 'W', count: wed },
    { day: 'T', count: thu },
    { day: 'F', count: fri },
    { day: 'S', count: sat },
    { day: 'S', count: sun },
  ];
}

// ---------------------------------------------------------------------------
// Replace these functions with real backend calls in Sprint 4
// ---------------------------------------------------------------------------

/** Today's snapshot — replace with useStats().getTodayStats() */
function getMockTodayStats(): TodayStats {
  return {
    totalTasks:      12,
    completedTasks:  8,
    permanentTotal:  4,
    permanentDone:   3,
    oneOffTotal:     8,
    oneOffDone:      5,
    categories: [
      { name: 'Work',      color: '#007AFF', total: 5, done: 4 },
      { name: 'Health',    color: '#FF9500', total: 4, done: 2 },
      { name: 'Lifestyle', color: '#34C759', total: 3, done: 2 },
    ],
    streak: 5,
  };
}

/** Overall stats — All Time, This Year, This Month, This Week. */
function getMockOverallStats(): StatPreviewData[] {
  return [
    {
      type: 'all',
      id: 'all_time',
      name: 'All Time',
      totalCompleted: 156,
      completionPercent: 78,
      currentStreak: 12,
      weeklyData: week(8, 6, 4, 8, 2, 0, 0),
      color: '#FF9500',
    },
    {
      type: 'all',
      id: 'all_year',
      name: 'This Year',
      totalCompleted: 620,
      completionPercent: 74,
      currentStreak: 5,
      weeklyData: week(8, 6, 4, 8, 2, 0, 0),
      color: '#FF9500',
    },
    {
      type: 'all',
      id: 'all_month',
      name: 'This Month',
      totalCompleted: 84,
      completionPercent: 72,
      currentStreak: 5,
      weeklyData: week(8, 6, 4, 8, 2, 0, 0),
      color: '#FF9500',
    },
    {
      type: 'all',
      id: 'all_week',
      name: 'This Week',
      totalCompleted: 28,
      completionPercent: 67,
      currentStreak: 5,
      weeklyData: week(8, 6, 4, 8, 2, 0, 0),
      color: '#FF9500',
    },
  ];
}

/** One card per permanent task template. */
function getMockTemplateStats(): StatPreviewData[] {
  return [
    {
      type: 'template',
      id: 'tpl_morning',
      name: 'Morning Workout',
      totalCompleted: 45,
      completionPercent: 90,
      currentStreak: 7,
      weeklyData: week(1, 1, 1, 1, 1, 1, 0),
      color: '#007AFF',
    },
    {
      type: 'template',
      id: 'tpl_review',
      name: 'Weekly Review',
      totalCompleted: 12,
      completionPercent: 60,
      currentStreak: 2,
      weeklyData: week(0, 0, 0, 0, 1, 0, 0),
      color: '#007AFF',
    },
  ];
}

/** One card per category. */
function getMockCategoryStats(): StatPreviewData[] {
  return [
    {
      type: 'category',
      id: 'cat_work',
      name: 'Work',
      totalCompleted: 64,
      completionPercent: 85,
      currentStreak: 9,
      weeklyData: week(5, 5, 4, 5, 3, 0, 0),
      color: '#007AFF',
    },
    {
      type: 'category',
      id: 'cat_health',
      name: 'Health',
      totalCompleted: 38,
      completionPercent: 70,
      currentStreak: 5,
      weeklyData: week(3, 2, 3, 1, 2, 1, 0),
      color: '#FF9500',
    },
    {
      type: 'category',
      id: 'cat_lifestyle',
      name: 'Lifestyle',
      totalCompleted: 54,
      completionPercent: 65,
      currentStreak: 3,
      weeklyData: week(2, 2, 1, 3, 2, 4, 1),
      color: '#34C759',
    },
  ];
}

// =============================================================================
// PROPS
// =============================================================================

interface StatsScreenProps {
  /**
   * Called when any StatPreviewCard is tapped.
   * MainNavigator provides this and routes to the correct detail screen
   * based on the card's type ('template' | 'category' | 'all').
   *
   * Optional so StatsScreen can still be rendered standalone in tests
   * or Storybook without a navigator wrapping it.
   */
  onStatCardPress?: (params: StatDetailParams) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Maps an overall card's id (e.g. 'all_week') to the matching TimeRange tab
 * so OverallDetailScreen opens pre-selected on the right tab.
 * Only meaningful for type === 'all' cards — other types return undefined.
 */
function resolveInitialTimeRange(id: string): StatDetailParams['initialTimeRange'] {
  const map: Record<string, StatDetailParams['initialTimeRange']> = {
    all_week:  'week',
    all_month: 'month',
    all_year:  'year',
    all_time:  'all',
  };
  return map[id];
}

// =============================================================================
// COMPONENT
// =============================================================================

export const StatsScreen: React.FC<StatsScreenProps> = ({ onStatCardPress }) => {
  // ── Data (replace with real hooks when backend is ready) ──────────────────
  const todayStats  = getMockTodayStats();
  const overallList = getMockOverallStats();
  const templates   = getMockTemplateStats();
  const categories  = getMockCategoryStats();

  // ── Handlers ──────────────────────────────────────────────────────────────
  /**
   * Fired by every StatPreviewCard tap, for all three card types.
   * Converts StatPreviewData → StatDetailParams and delegates to the
   * navigator's handler. Falls back to a log if no handler is wired.
   */
  const handleCardPress = (data: StatPreviewData) => {
    if (!onStatCardPress) {
      console.log('Stat card tapped (no handler):', data.type, data.name);
      return;
    }
    onStatCardPress({
      type:               data.type,
      id:                 data.id,
      name:               data.name,
      color:              data.color,
      initialTimeRange:   data.type === 'all' ? resolveInitialTimeRange(data.id) : undefined,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>Your productivity insights</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Today ────────────────────────────────────────────────── */}
        <TodayCard data={todayStats} />

        {/* ── Overall ───────────────────────────────────────────────── */}
        {/* 📊 swap renderIcon to use an image or vector icon — see guide at top */}
        <CollapsibleSection
          title="Overall"
          renderIcon={() => <Text style={{ fontSize: 26 }}>📊</Text>}
          badgeColor="#FF9500"
          badgeOpacity={0.12}
          defaultOpen
        >
          {overallList.map((o, i) => (
            <StatPreviewCard
              key={o.id}
              data={o}
              onPress={handleCardPress}
              style={i === 0 ? innerCardFirst : innerCard}
            />
          ))}
        </CollapsibleSection>

        {/* ── Categories ────────────────────────────────────────────── */}
        {/* 🗂️ swap renderIcon to use an image or vector icon — see guide at top */}
        <CollapsibleSection
          title="Categories"
          renderIcon={() => <Text style={{ fontSize: 26 }}>🗂️</Text>}
          badgeColor="#007AFF"
          badgeOpacity={0.12}
          emptyMessage="No categories yet"
        >
          {categories.map((c, i) => (
            <StatPreviewCard
              key={c.id}
              data={c}
              onPress={handleCardPress}
              style={i === 0 ? innerCardFirst : innerCard}
            />
          ))}
        </CollapsibleSection>

        {/* ── Permanent Tasks ───────────────────────────────────────── */}
        {/* 🔁 swap renderIcon to use an image or vector icon — see guide at top */}
        <CollapsibleSection
          title="Permanent Tasks"
          renderIcon={() => <Text style={{ fontSize: 26 }}>🔁</Text>}
          badgeColor="#34C759"
          badgeOpacity={0.12}
          emptyMessage="No permanent tasks yet"
        >
          {templates.map((t, i) => (
            <StatPreviewCard
              key={t.id}
              data={t}
              onPress={handleCardPress}
              style={i === 0 ? innerCardFirst : innerCard}
            />
          ))}
        </CollapsibleSection>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FF9500',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
  },
  bottomPad: {
    height: 32,
  },
});
