import React from 'react';
import { Group, Text, matchFont } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { FLOATING_TEXT } from '../game/constants';

interface FloatingTextRendererProps {
  /**
   * Flat array of floating text slots.
   * Each slot = [active, timer, x, y, value, type]
   * type: 0=coin(gold), 1=bonus(cyan), 2=combo(pink)
   */
  floatingTexts: SharedValue<number[]>;
  width: number;
  height: number;
}

const COLORS = ['#FFD700', '#4ECDC4', '#FF6B8A'];
const PREFIXES = ['+', '+', 'x'];

/** Single floating text slot rendered as a Skia component */
const FloatingTextSlot: React.FC<{
  slotIndex: number;
  floatingTexts: SharedValue<number[]>;
}> = ({ slotIndex, floatingTexts }) => {
  const font = matchFont({ fontSize: 20 });
  const boldFont = matchFont({ fontSize: 24 });

  const baseIdx = slotIndex * FLOATING_TEXT.SLOT_SIZE;

  const opacity = useDerivedValue(() => {
    const data = floatingTexts.value;
    const active = data[baseIdx];
    if (!active) return 0;
    const timer = data[baseIdx + 1];
    const progress = timer / FLOATING_TEXT.DURATION;
    // Fade out in last 30%
    if (progress > 0.7) {
      return 1 - (progress - 0.7) / 0.3;
    }
    return 1;
  });

  const transform = useDerivedValue(() => {
    const data = floatingTexts.value;
    const active = data[baseIdx];
    if (!active) return [{ translateX: -200 }, { translateY: -200 }];
    const timer = data[baseIdx + 1];
    const x = data[baseIdx + 2];
    const y = data[baseIdx + 3];
    const progress = timer / FLOATING_TEXT.DURATION;
    const floatY = y - progress * FLOATING_TEXT.FLOAT_DISTANCE;
    // Scale pop effect at start
    const scale = progress < 0.15 ? 0.5 + progress / 0.15 * 0.5 : 1.0;
    return [
      { translateX: x },
      { translateY: floatY },
      { scale: scale },
    ];
  });

  const textValue = useDerivedValue(() => {
    const data = floatingTexts.value;
    const active = data[baseIdx];
    if (!active) return '';
    const value = Math.floor(data[baseIdx + 4]);
    const type = Math.floor(data[baseIdx + 5]);
    const prefix = type === 0 ? '+' : type === 1 ? '+' : 'x';
    return prefix + value;
  });

  const color = useDerivedValue(() => {
    const data = floatingTexts.value;
    const type = Math.floor(data[baseIdx + 5]);
    if (type === 0) return '#FFD700';
    if (type === 1) return '#4ECDC4';
    return '#FF6B8A';
  });

  return (
    <Group transform={transform} opacity={opacity}>
      {/* Shadow */}
      <Text x={1} y={1} text={textValue} font={boldFont} color="rgba(0,0,0,0.6)" />
      {/* Main text */}
      <Text x={0} y={0} text={textValue} font={boldFont} color={color} />
    </Group>
  );
};

export const FloatingTextRenderer: React.FC<FloatingTextRendererProps> = ({
  floatingTexts,
  width,
  height,
}) => {
  return (
    <Group>
      <FloatingTextSlot slotIndex={0} floatingTexts={floatingTexts} />
      <FloatingTextSlot slotIndex={1} floatingTexts={floatingTexts} />
      <FloatingTextSlot slotIndex={2} floatingTexts={floatingTexts} />
    </Group>
  );
};
