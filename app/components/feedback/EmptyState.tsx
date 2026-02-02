// app/components/feedback/EmptyState.tsx
// Presentational empty list message.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type EmptyStateProps = {
  message: string;
};

export const EmptyState: React.FC<EmptyStateProps> = ({ message }) => (
  <View style={styles.container}>
    <Text style={styles.text}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  text: {
    fontSize: 16,
    color: '#666',
  },
});
