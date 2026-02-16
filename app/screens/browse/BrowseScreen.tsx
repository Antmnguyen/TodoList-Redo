// app/screens/browse/BrowseScreen.tsx
// =============================================================================
// BROWSE SCREEN (Placeholder)
// =============================================================================
//
// Will allow browsing and searching through all tasks with filters.
// Currently a placeholder - functionality to be implemented.
//
// PLANNED FEATURES:
// - Search tasks by title
// - Filter by category
// - Filter by date range
// - Filter by completion status
// - Browse permanent task templates
//
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

// =============================================================================
// COMPONENT
// =============================================================================

export const BrowseScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Browse</Text>
        <Text style={styles.subtitle}>Search and filter tasks</Text>
      </View>

      {/* Placeholder Content */}
      <View style={styles.content}>
        <Text style={styles.placeholderIcon}>🔍</Text>
        <Text style={styles.placeholderTitle}>Coming Soon</Text>
        <Text style={styles.placeholderText}>
          Search through all your tasks, filter by category, date, or status.
        </Text>
      </View>
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
    backgroundColor: '#5856D6', // Purple
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});
