import React from 'react';
import {
  Rect,
  RoundedRect,
  Group,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { COLORS, PHYSICS } from '../game/constants';

interface BalanceIndicatorProps {
  angle: SharedValue<number>;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const BalanceIndicator: React.FC<BalanceIndicatorProps> = ({
  angle,
  x,
  y,
  width: barWidth,
  height: barHeight,
}) => {
  const centerX = x + barWidth / 2;

  // Indicator position (maps angle to bar position)
  const indicatorX = useDerivedValue(() => {
    const ratio = angle.value / PHYSICS.gameOverAngle;
    const clamped = Math.max(-1, Math.min(1, ratio));
    return centerX + clamped * (barWidth / 2 - 6);
  });

  // Color based on angle
  const indicatorColor = useDerivedValue(() => {
    const absRatio = Math.abs(angle.value) / PHYSICS.gameOverAngle;
    if (absRatio > 0.75) return COLORS.gaugeRed;
    if (absRatio > 0.5) return COLORS.gaugeYellow;
    return COLORS.gaugeGreen;
  });

  return (
    <Group>
      {/* Background bar */}
      <RoundedRect
        x={x}
        y={y}
        width={barWidth}
        height={barHeight}
        r={barHeight / 2}
        color={'rgba(0,0,0,0.4)'}
      />

      {/* Center mark */}
      <Rect
        x={centerX - 1}
        y={y + 2}
        width={2}
        height={barHeight - 4}
        color={'rgba(255,255,255,0.3)'}
      />

      {/* Warning zone markers */}
      <Rect
        x={x + barWidth * 0.125}
        y={y + 2}
        width={1}
        height={barHeight - 4}
        color={'rgba(255,255,255,0.15)'}
      />
      <Rect
        x={x + barWidth * 0.875}
        y={y + 2}
        width={1}
        height={barHeight - 4}
        color={'rgba(255,255,255,0.15)'}
      />

      {/* Indicator dot */}
      <RoundedRect
        x={useDerivedValue(() => indicatorX.value - 5)}
        y={y + 1}
        width={10}
        height={barHeight - 2}
        r={(barHeight - 2) / 2}
        color={indicatorColor}
      />
    </Group>
  );
};
