// app/screens/browse/BrowseScreen.tsx
// =============================================================================
// BROWSE SCREEN
// =============================================================================
//
// WHAT YOU SEE ON SCREEN:
//   A purple header at the top that says "Browse" with a subtitle "Manage your
//   app features". Below it is a Dark Mode toggle row, then a scrollable list
//   of cards — each card represents one section of the app you can manage
//   (currently Categories, Location, History, etc.). Tapping a card navigates
//   into that section.
//
// WHAT YOU CAN DO ON THIS SCREEN:
//   - Toggle Dark Mode via the switch in the Dark Mode row
//   - Tap "Categories" to open the Category Management screen
//   - (More sections will appear here as the app grows)
//
// HOW NAVIGATION WORKS HERE (no-code explanation):
//   This screen does NOT use the app's main tab navigator to switch between
//   sub-screens. Instead it works like a light switch: a single variable called
//   `subScreen` tracks which section is open. When it equals 'none', the Browse
//   list is shown. When it equals 'categories' (or any future value), the
//   matching sub-screen fills the whole screen in its place.
//
// =============================================================================
//
// HOW TO ADD A NEW SECTION (e.g. "Templates", "Settings", "Notifications")
// =============================================================================
//
// There are exactly FOUR places you need to touch:
//
//  STEP 1 — Add the key to the SubScreen type  (line ~32)
//  STEP 2 — Add a row to the FEATURES array  (line ~45)
//  STEP 3 — Add a sub-screen routing branch  (line ~65)
//  STEP 4 — Import the new sub-screen component  (top of file, line ~15)
//
// =============================================================================

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Switch,
  TouchableOpacity,
  FlatList,
} from 'react-native';

import { CategoryManagementScreen } from './CategoryManagementScreen';
import { HealthManagementScreen } from './HealthManagementScreen';
import { HistoryManagementScreen } from './HistoryManagementScreen';
import { LocationManagementScreen } from './LocationManagementScreen';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

// =============================================================================
// TYPES
// =============================================================================

type SubScreen = 'none' | 'categories' | 'history' | 'location' | 'Health connect' | 'calendar' | 'transfer';

interface FeatureItem {
  key:         SubScreen;
  title:       string;
  description: string;
  icon:        string;
  color:       string;
}

// =============================================================================
// FEATURE LIST
// =============================================================================

const FEATURES: FeatureItem[] = [
  {
    key:         'categories',
    title:       'Categories',
    description: 'Create and manage task categories',
    icon:        '🏷️',
    color:       '#5856D6',
  },
  {
    key:         'location',
    title:       'Location',
    description: 'Auto Complete tasks at specified locations',
    icon:        '📍',
    color:       '#d32929',
  },
  {
    key:         'Health connect',
    title:       'Health connect',
    description: 'fitness tracker connection',
    icon:        '💓',
    color:       '#33ace5',
  },
  {
    key:         'calendar',
    title:       'Calendar',
    description: 'Connect to google calendar',
    icon:        '📅',
    color:       '#4caf50',
  },
  {
    key:         'transfer',
    title:       'Transfer',
    description: 'Transfer data between devices',
    icon:        '🔄',
    color:       '#ff9800',
  },
  {
    key:         'history',
    title:       'History',
    description: 'see previously completed tasks',
    icon:        '📜',
    color:       '#72552a',
  }
];

// =============================================================================
// COMPONENT
// =============================================================================

export const BrowseScreen: React.FC = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [subScreen, setSubScreen] = useState<SubScreen>('none');

  // ---------------------------------------------------------------------------
  // Sub-screen routing
  // ---------------------------------------------------------------------------
  if (subScreen === 'categories') {
    return (
      <CategoryManagementScreen onBack={() => setSubScreen('none')} />
    );
  }
  if (subScreen === 'location') {
    return (
      <LocationManagementScreen onBack={() => setSubScreen('none')} />
    );
  }
  if (subScreen === 'Health connect') {
    return (
      <HealthManagementScreen onBack={() => setSubScreen('none')} />
    );
  }
  if (subScreen === 'history') {
    return (
      <HistoryManagementScreen onBack={() => setSubScreen('none')} />
    );
  }

  // ---------------------------------------------------------------------------
  // Main list
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={[styles.container]}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Browse</Text>
        <Text style={styles.subtitle}>Manage your app features</Text>
      </View>

      {/* ── Dark Mode toggle row ─────────────────────────────────────────── */}
      <View style={styles.darkModeRow}>
        <View style={styles.darkModeIconBadge}>
          <Text style={styles.iconText}>🌙</Text>
        </View>
        <View style={styles.featureInfo}>
          <Text style={styles.featureTitle}>Dark Mode</Text>
          <Text style={styles.featureDesc}>{isDark ? 'On' : 'Off'}</Text>
        </View>
        <Switch
          value={isDark}
          onValueChange={toggleTheme}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor="#fff"
        />
      </View>

      {/* ── Feature card list ──────────────────────────────────────────────── */}
      <FlatList
        data={FEATURES}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.featureRow}
            onPress={() => setSubScreen(item.key)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBadge, { backgroundColor: item.color }]}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>

            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureDesc}>{item.description}</Text>
            </View>

            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex:            1,
      backgroundColor: theme.bgScreen,
    },

    // Purple top bar — brand colour, stays the same in dark mode
    header: {
      padding:         20,
      paddingTop:      60,
      backgroundColor: '#5856D6',
    },

    title: {
      fontSize:   32,
      fontWeight: 'bold',
      color:      '#fff',
    },

    subtitle: {
      fontSize: 16,
      color:    '#fff',
      opacity:  0.8,
    },

    // ── Dark mode toggle row ──────────────────────────────────────────────
    darkModeRow: {
      flexDirection:   'row',
      alignItems:      'center',
      backgroundColor: theme.bgCard,
      paddingHorizontal: 16,
      paddingVertical:   14,
      marginHorizontal:  16,
      marginTop:         16,
      borderRadius:      14,
      shadowColor:       '#000',
      shadowOffset:      { width: 0, height: 1 },
      shadowOpacity:     0.06,
      shadowRadius:      4,
      elevation:         2,
    },

    darkModeIconBadge: {
      width:           46,
      height:          46,
      borderRadius:    12,
      alignItems:      'center',
      justifyContent:  'center',
      marginRight:     14,
      backgroundColor: '#1c1c1e',
    },

    // Space around the list of cards
    list: {
      padding: 16,
      gap:     12,
    },

    // Each tappable card
    featureRow: {
      flexDirection:   'row',
      alignItems:      'center',
      backgroundColor: theme.bgCard,
      borderRadius:    14,
      padding:         16,
      shadowColor:     '#000',
      shadowOffset:    { width: 0, height: 1 },
      shadowOpacity:   0.06,
      shadowRadius:    4,
      elevation:       2,
    },

    // Coloured square badge holding the emoji
    iconBadge: {
      width:          46,
      height:         46,
      borderRadius:   12,
      alignItems:     'center',
      justifyContent: 'center',
      marginRight:    14,
    },

    iconText: {
      fontSize: 22,
    },

    featureInfo: {
      flex: 1,
    },

    featureTitle: {
      fontSize:   16,
      fontWeight: '600',
      color:      theme.textPrimary,
    },

    featureDesc: {
      fontSize:  13,
      color:     theme.textTertiary,
      marginTop: 2,
    },

    chevron: {
      fontSize:   24,
      color:      theme.hairline,
      fontWeight: '300',
    },
  });
}
