// app/components/navigation/TabBar.tsx
// =============================================================================
// TAB BAR COMPONENT
// =============================================================================
//
// Reusable bottom tab bar for main app navigation.
// Receives a config array of tabs, making it easy to add/remove tabs.
//
// USAGE:
//   import { TabBar } from '../../components/navigation/TabBar';
//
//   const TABS = [
//     { key: 'tasks', label: 'All Tasks', icon: '📋' },
//     { key: 'today', label: 'Today', icon: '📅' },
//   ];
//
//   <TabBar tabs={TABS} activeTab={activeTab} onTabPress={setActiveTab} />
//
// TO ADD A NEW TAB:
//   1. Add entry to TABS array in MainNavigator.tsx
//   2. Create the screen component
//   3. Add case to renderContent switch in MainNavigator.tsx
//
// =============================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// =============================================================================
// TYPES
// =============================================================================

export interface Tab {
  key: string;    // Unique identifier for the tab
  label: string;  // Display text below the icon
  icon: string;   // Emoji icon (can be swapped for icon library later)
}

interface TabBarProps {
  tabs: Tab[];                      // Array of tab configurations
  activeTab: string;                // Currently selected tab key
  onTabPress: (key: string) => void; // Callback when a tab is pressed
}

// =============================================================================
// COMPONENT
// =============================================================================

export const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onTabPress }) => {
  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.key;

        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => onTabPress(tab.key)}
            activeOpacity={0.7}
          >
            {/* Tab Icon */}
            <Text style={[styles.icon, isActive && styles.activeIcon]}>
              {tab.icon}
            </Text>

            {/* Tab Label */}
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // ---------------------------------------------------------------------------
  // Container - The tab bar itself
  // ---------------------------------------------------------------------------
  container: {
    flexDirection: 'row',
    height: 65,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    // Elevation for Android
    elevation: 8,
  },

  // ---------------------------------------------------------------------------
  // Individual Tab
  // ---------------------------------------------------------------------------
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingBottom: 12, // Extra padding for home indicator on newer phones
  },

  // Active tab gets a subtle background highlight
  activeTab: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
  },

  // ---------------------------------------------------------------------------
  // Icon
  // ---------------------------------------------------------------------------
  icon: {
    fontSize: 22,
    marginBottom: 4,
    opacity: 0.6,
  },

  activeIcon: {
    opacity: 1,
  },

  // ---------------------------------------------------------------------------
  // Label
  // ---------------------------------------------------------------------------
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8e8e93',
  },

  activeLabel: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
