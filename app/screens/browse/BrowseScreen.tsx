// app/screens/browse/BrowseScreen.tsx
// =============================================================================
// BROWSE SCREEN
// =============================================================================
//
// Entry point for Browse tab. Shows a feature list:
//   - Categories → CategoryManagementScreen
//   - (future) Templates, Settings
//
// Sub-screen navigation is handled with local state (consistent with
// the rest of the app's MainNavigator pattern).
//
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
} from 'react-native';

import { CategoryManagementScreen } from './CategoryManagementScreen';

// =============================================================================
// TYPES
// =============================================================================

type SubScreen = 'none' | 'categories';

interface FeatureItem {
  key: SubScreen;
  title: string;
  description: string;
  icon: string;
  color: string;
}

// =============================================================================
// FEATURE LIST
// =============================================================================

const FEATURES: FeatureItem[] = [
  {
    key: 'categories',
    title: 'Categories',
    description: 'Create and manage task categories',
    icon: '🏷️',
    color: '#5856D6',
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

export const BrowseScreen: React.FC = () => {
  const [subScreen, setSubScreen] = useState<SubScreen>('none');

  // ---------------------------------------------------------------------------
  // Sub-screen routing
  // ---------------------------------------------------------------------------
  if (subScreen === 'categories') {
    return (
      <CategoryManagementScreen onBack={() => setSubScreen('none')} />
    );
  }

  // ---------------------------------------------------------------------------
  // Main list
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Browse</Text>
        <Text style={styles.subtitle}>Manage your app features</Text>
      </View>

      {/* Feature list */}
      <FlatList
        data={FEATURES}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.featureRow}
            onPress={() => setSubScreen(item.key)}
            activeOpacity={0.7}
          >
            {/* Icon badge */}
            <View style={[styles.iconBadge, { backgroundColor: item.color }]}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>

            {/* Text */}
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureDesc}>{item.description}</Text>
            </View>

            {/* Chevron */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#5856D6',
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
  list: {
    padding: 16,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconText: {
    fontSize: 22,
  },
  featureInfo: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  featureDesc: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: '#ccc',
    fontWeight: '300',
  },
});
