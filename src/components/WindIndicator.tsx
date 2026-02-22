import React from 'react';
import { Group, Text, matchFont, SkFont } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface WindIndicatorProps {
  windForce: SharedValue<number>;
  x: number;
  y: number;
  font?: SkFont | null;
}

export const WindIndicator: React.FC<WindIndicatorProps> = ({
  windForce,
  x,
  y,
  font,
}) => {
  const fallbackFont = matchFont({ fontSize: 24 });
  const displayFont = font || fallbackFont;

  const text = useDerivedValue(() => {
    const f = windForce?.value ?? 0;
    if (Math.abs(f) < 0.2) return "WIND: CALM";
    
    const arrow = f > 0 ? "➜" : "⬅";
    if (Math.abs(f) > 1.8) return `WIND GUST! ${arrow}`;
    return `WIND: ${arrow}`;
  }, [windForce]);

  const color = useDerivedValue(() => {
    return Math.abs(windForce?.value ?? 0) > 1.8 ? "#FF4500" : "white";
  }, [windForce]);

  if (!displayFont) return null;

  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      {/* Shadow */}
      <Text x={1} y={1} text={text} font={displayFont} color="rgba(0,0,0,0.5)" />
      {/* Main Text */}
      <Text x={0} y={0} text={text} font={displayFont} color={color} />
    </Group>
  );
};
