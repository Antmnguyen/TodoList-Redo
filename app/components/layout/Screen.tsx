import React from 'react';
import { View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge, useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenProps {
  children:  React.ReactNode;
  style?:    ViewStyle;
  edges?:    Edge[];
  /** Fills the status-bar inset area with this color instead of the screen background */
  topColor?: string;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
  topColor,
}) => {
  const insets = useSafeAreaInsets();

  // When topColor is set we handle the top inset with a plain colored View,
  // so remove 'top' from SafeAreaView edges to avoid double-padding.
  const effectiveEdges = topColor
    ? (edges.filter(e => e !== 'top') as Edge[])
    : edges;

  return (
    <SafeAreaView style={[{ flex: 1 }, style]} edges={effectiveEdges}>
      {topColor && (
        <View style={{ height: insets.top, backgroundColor: topColor }} />
      )}
      {children}
    </SafeAreaView>
  );
};
