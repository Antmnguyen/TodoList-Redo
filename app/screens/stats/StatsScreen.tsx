// app/screens/stats/StatsScreen.tsx
// =============================================================================
// STATS SCREEN (Placeholder)
// =============================================================================
//
// Will display task completion statistics, streaks, and analytics.
// Currently a placeholder - functionality to be implemented.
//
// PLANNED FEATURES:
// - Tasks completed today/this week/this month
// - Completion streaks
// - Category breakdown
// - Productivity charts
//
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

// =============================================================================
// COMPONENT
// =============================================================================

export const StatsScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>Your productivity insights</Text>
      </View>

      {/* Placeholder Content */}
      <View style={styles.content}>
        <Text style={styles.placeholderIcon}>📊</Text>
        <Text style={styles.placeholderTitle}>Coming Soon</Text>
        <Text style={styles.placeholderText}>
          Track your task completion stats, streaks, and productivity trends.
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
    backgroundColor: '#FF9500', // Orange
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
