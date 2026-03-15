import React from 'react';
import {
  RoundedRect,
  Group,
  Text,
  matchFont,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface ComboDisplayProps {
  comboMultiplier: SharedValue<number>;
  comboLevelUpAnim: SharedValue<number>;
  comboBrokenAnim: SharedValue<number>;
  elapsedTime: SharedValue<number>;
  x: number;
  y: number;
}

const COMBO_COLORS = ['#888888', '#88BB66', '#DAA520', '#E84393'];

export const ComboDisplay: React.FC<ComboDisplayProps> = ({
  comboMultiplier,
  comboLevelUpAnim,
  comboBrokenAnim,
  elapsedTime,
  x,
  y,
}) => {
  const font = matchFont({ fontSize: 16 });

  const pillWidth = 50;
  const pillHeight = 24;
  const pillX = x - pillWidth / 2;
  const pillY = y - pillHeight / 2;

  const visible = useDerivedValue(() => comboMultiplier.value >= 2);

  const pillScale = useDerivedValue(() => {
    if (comboMultiplier.value < 2) return [{ scale: 0 }];
    const baseScale = 1.0 + (comboMultiplier.value - 2) * 0.1; // x3=1.1, x4=1.2
    const pulse =
      comboLevelUpAnim.value > 0
        ? baseScale + Math.sin(comboLevelUpAnim.value * Math.PI / 0.6) * 0.4
        : baseScale;
    return [
      { translateX: x },
      { translateY: y },
      { scale: pulse },
      { translateX: -x },
      { translateY: -y },
    ];
  });

  const pillColor = useDerivedValue(() => {
    const idx = Math.min(comboMultiplier.value - 1, 3);
    return COMBO_COLORS[idx];
  });

  const pillOpacity = useDerivedValue(() => {
    if (comboMultiplier.value < 2) return 0;
    return 0.7;
  });

  const breakOpacity = useDerivedValue(() =>
    comboBrokenAnim.value > 0 ? comboBrokenAnim.value / 0.3 : 0,
  );

  const labelText = useDerivedValue(() => `x${comboMultiplier.value}`);

  return (
    <Group transform={pillScale} opacity={pillOpacity}>
      {/* Glow */}
      <RoundedRect
        x={pillX - 4}
        y={pillY - 4}
        width={pillWidth + 8}
        height={pillHeight + 8}
        r={20}
        color={pillColor}
        opacity={0.3}
      />
      {/* Pill background */}
      <RoundedRect
        x={pillX}
        y={pillY}
        width={pillWidth}
        height={pillHeight}
        r={16}
        color={pillColor}
      />
      {/* Break flash overlay */}
      <RoundedRect
        x={pillX}
        y={pillY}
        width={pillWidth}
        height={pillHeight}
        r={16}
        color="#FF0000"
        opacity={breakOpacity}
      />
      {/* Label */}
      <Text
        x={x - 12}
        y={y + 8}
        text={labelText}
        font={font}
        color="white"
      />
    </Group>
  );
};
