// app/screens/TempScreen.tsx
// =============================================================================
// TEMP SCREEN (PLACEHOLDER)
// =============================================================================
//
// PURPOSE
// -------
// Generic placeholder screen used when a feature is not yet implemented.
//
// This screen:
//   • Preserves navigation structure via `onBack`
//   • Displays a centered "Coming Soon" message
//   • Contains no business logic
//   • Contains no data fetching
//   • Is safe to replace later with real functionality
//
// =============================================================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Screen } from '../../components/layout/Screen';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props expected by TempScreen.
 *
 * onBack:
 *   Callback provided by parent to navigate back.
 */
export interface TempScreenProps {
  onBack: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const HealthManagementScreen: React.FC<TempScreenProps> = ({ onBack }) => {
  return (
    <Screen edges={['top']} style={styles.container}>
      {/* -----------------------------------------------------------------------
          HEADER
         ----------------------------------------------------------------------- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Health Connect!</Text>

        {/* Right-side spacer to balance header */}
        <View style={styles.headerSpacer} />
      </View>

      {/* -----------------------------------------------------------------------
          MAIN CONTENT
         ----------------------------------------------------------------------- */}
      <View style={styles.content}>
        <Text style={styles.comingSoon}>Coming Soon</Text>
      </View>
    </Screen>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#5856D6',
  },

  backBtn: {
    padding: 4,
  },

  backText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },

  headerSpacer: {
    width: 60,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  comingSoon: {
    fontSize: 22,
    fontWeight: '600',
    color: '#555',
  },
});