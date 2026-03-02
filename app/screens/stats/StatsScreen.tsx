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
// DATA LAYER:
//   All data pulls from useStats() — no mock functions remain.
//
// =============================================================================

import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { Screen } from '../../components/layout/Screen';
import { StatPreviewCard, StatPreviewData } from '../../components/stats/StatPreviewCard';
import { TodayCard } from '../../components/stats/TodayCard';
import { StatDetailParams } from '../../core/types/statDetailTypes';
import { useStats } from '../../core/hooks/useStats';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

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

  renderIcon: () => React.ReactNode;

  badgeColor: string;
  badgeOpacity?: number;
  badgeSize?: number;
  badgeBorderRadius?: number;
  badgeBorderWidth?: number;
  badgeBorderColor?: string;
  emptyMessage?: string;
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
  const { theme } = useTheme();
  const sectionStyles = useMemo(() => makeSectionStyles(theme), [theme]);

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

  const chevronRotation = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '90deg'],
  });

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
        <View style={[sectionStyles.iconBadgeBase, badgeStyle]}>
          {renderIcon()}
        </View>

        <Text style={sectionStyles.title}>{title}</Text>

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

function makeSectionStyles(theme: AppTheme) {
  return StyleSheet.create({
    box: {
      backgroundColor: theme.bgCard,
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
    iconBadgeBase: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: theme.textPrimary,
      letterSpacing: 0.2,
    },
    chevron: {
      fontSize: 26,
      color: theme.hairline,
      lineHeight: 28,
    },
    content: {
      borderTopWidth: 1,
      borderTopColor: theme.separator,
    },
    emptyText: {
      padding: 20,
      textAlign: 'center',
      fontSize: 14,
      color: theme.textDisabled,
      fontWeight: '500',
    },
  });
}

// =============================================================================
// PROPS
// =============================================================================

interface StatsScreenProps {
  onStatCardPress?: (params: StatDetailParams) => void;
}

// =============================================================================
// HELPERS
// =============================================================================

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
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Inner card style — removes individual card chrome so cards sit flush inside the section box
  const innerCard = useMemo(() => ({
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
    borderTopWidth: 1,
    borderTopColor: theme.separator,
  }), [theme]);
  const innerCardFirst = useMemo(() => ({ ...innerCard, borderTopWidth: 0 }), [innerCard]);

  // ── Data ─────────────────────────────────────────────────────────────────
  const stats       = useStats();
  const todayStats  = stats.getTodayStats();
  const overallList = stats.getOverallStatsList();
  const templates   = stats.getTemplateStatsList();
  const categories  = stats.getCategoryStatsList();

  // ── Handlers ──────────────────────────────────────────────────────────────
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
    <Screen edges={['top']} style={styles.container}>
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
    header: {
      padding: 20,
      backgroundColor: '#FF9500',  // brand colour — stays same in dark mode
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
}
