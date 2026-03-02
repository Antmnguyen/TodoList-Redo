import React from 'react';
import { ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';

interface ScreenProps {
  children: React.ReactNode;
  style?:   ViewStyle;
  edges?:   Edge[];
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
}) => (
  <SafeAreaView style={[{ flex: 1 }, style]} edges={edges}>
    {children}
  </SafeAreaView>
);
