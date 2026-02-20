// app/components/stats/detail/shared/DetailHeader.tsx
// =============================================================================
// DETAIL HEADER
// =============================================================================
//
// Full-width colored header bar for all three detail screens.
// Back arrow on the left, title centered.
//
// Props:
//   title   - screen title (stat name)
//   color   - accent color for the background
//   onBack  - called when the back button is pressed
//
// =============================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// =============================================================================
// TYPES
// =============================================================================

interface DetailHeaderProps {
  title: string;
  color: string;
  onBack: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const DetailHeader: React.FC<DetailHeaderProps> = ({ title, color, onBack }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: color, paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.backArrow}>←</Text>
        <Text style={styles.backLabel}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      {/* Spacer to balance the back button and keep title centered */}
      <View style={styles.spacer} />
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 16,
    paddingBottom:    14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    minWidth:      60,
  },
  backArrow: {
    fontSize:   20,
    color:      '#fff',
    fontWeight: '600',
    lineHeight: 24,
  },
  backLabel: {
    fontSize:   15,
    color:      '#fff',
    fontWeight: '600',
  },
  title: {
    flex:       1,
    textAlign:  'center',
    fontSize:   17,
    fontWeight: '700',
    color:      '#fff',
    paddingHorizontal: 8,
  },
  spacer: {
    minWidth: 60,
  },
});
