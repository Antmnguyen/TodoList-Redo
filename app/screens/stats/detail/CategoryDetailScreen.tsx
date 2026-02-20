// app/screens/stats/detail/CategoryDetailScreen.tsx
// WIP — placeholder screen (Phase 5)

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DetailHeader } from '../../../components/stats/detail/shared/DetailHeader';
import { StatDetailParams } from '../../../core/types/statDetailTypes';

interface CategoryDetailScreenProps {
  params: StatDetailParams;
  onBack: () => void;
}

export const CategoryDetailScreen: React.FC<CategoryDetailScreenProps> = ({ params, onBack }) => (
  <View style={styles.container}>
    <DetailHeader title={params.name} color={params.color} onBack={onBack} />
    <View style={styles.body}>
      <Text style={styles.wip}>Category Detail — coming soon</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  body:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wip:       { fontSize: 16, color: '#bbb', fontWeight: '500' },
});
