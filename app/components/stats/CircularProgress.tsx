// app/components/stats/CircularProgress.tsx
// =============================================================================
// CIRCULAR PROGRESS RING
// =============================================================================
//
// Draws a ring (track) filled clockwise from 12 o'clock by `percent`.
// Uses two half-ring clip boxes — no SVG required.
//
// Props:
//   percent     - 0–100 fill value
//   size        - outer diameter in px (default 64)
//   color       - accent color for the filled arc
//   trackWidth  - ring stroke width (default 7)
//
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// =============================================================================
// TYPES
// =============================================================================

interface CircularProgressProps {
  percent: number;
  size?: number;
  color?: string;
  trackWidth?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CircularProgress: React.FC<CircularProgressProps> = ({
  percent,
  size = 64,
  color = '#FF9500',
  trackWidth = 7,
}) => {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const angle = (p / 100) * 360;
  const half = size / 2;

  // Each border side on a perfect circle covers a 90° arc divided at the 45° diagonals:
  //   borderTop   → 315° to  45° (10:30 → 1:30 through 12)
  //   borderRight →  45° to 135° ( 1:30 → 4:30 through  3)
  //   borderBottom→ 135° to 225° ( 4:30 → 7:30 through  6)
  //   borderLeft  → 225° to 315° ( 7:30 → 10:30 through 9)
  //
  // Right ring (borderTop + borderRight) naturally sits at 315°→135° (right D-shape).
  // To hide it fully at 0 %: rotate to -135° (arc moves into left half).
  // To show it fully at 50%: rotate to  +45° (arc realigns to right half).
  // Rotation range: -135° → +45°  (span of 180°), driven by angle 0°→180°.
  //
  // Left ring (borderBottom + borderLeft) naturally sits at 135°→315° (left D-shape).
  // Same range: starts at -135° (hidden in right half) → +45° (full left half visible).
  // Only active for angle 180°→360°.

  const rightRotation = -135 + Math.min(angle, 180);
  const leftRotation  = -135 + Math.max(0, angle - 180);

  const innerSize = size - trackWidth * 2;
  const innerRadius = innerSize / 2;

  return (
    <View style={{ width: size, height: size }}>

      {/* Grey track ring */}
      <View style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: half,
          borderWidth: trackWidth,
          borderColor: '#e0e0e0',
        },
      ]} />

      {/* ── Right half arc (0–50%) ─────────────────────────────────────── */}
      <View style={{
        position: 'absolute',
        top: 0, left: half,
        width: half, height: size,
        overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute',
          top: 0, left: -half,
          width: size, height: size,
          borderRadius: half,
          borderWidth: trackWidth,
          // Top + right arcs colored → covers the right-side sweep
          borderTopColor: color,
          borderRightColor: color,
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
          transform: [{ rotate: `${rightRotation}deg` }],
        }} />
      </View>

      {/* ── Left half arc (50–100%) ────────────────────────────────────── */}
      <View style={{
        position: 'absolute',
        top: 0, left: 0,
        width: half, height: size,
        overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute',
          top: 0, left: 0,
          width: size, height: size,
          borderRadius: half,
          borderWidth: trackWidth,
          // Bottom + left arcs colored → covers the left-side sweep
          borderBottomColor: color,
          borderLeftColor: color,
          borderTopColor: 'transparent',
          borderRightColor: 'transparent',
          transform: [{ rotate: `${leftRotation}deg` }],
        }} />
      </View>

      {/* ── White inner disc → creates the ring hole ───────────────────── */}
      <View style={{
        position: 'absolute',
        top: trackWidth,
        left: trackWidth,
        width: innerSize,
        height: innerSize,
        borderRadius: innerRadius,
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{
          fontSize: innerSize * 0.24,
          fontWeight: '700',
          color: '#1a1a1a',
          includeFontPadding: false,
        }}>
          {p}%
        </Text>
      </View>

    </View>
  );
};
