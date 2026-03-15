import React from 'react';
import { Group, Text, Rect, matchFont, SkFont } from '@shopify/react-native-skia';
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
    if (Math.abs(f) < 0.2) return 'CALM';
    if (Math.abs(f) > 1.8) return 'GUST!';
    return 'WIND';
  }, [windForce]);

  // Color: white normal, orange-red blink for gust
  const color = useDerivedValue(() => {
    const mag = Math.abs(windForce?.value ?? 0);
    if (mag > 1.8) {
      return Math.floor(Date.now() / 150) % 2 === 0 ? '#FF4500' : '#FF8C00';
    }
    return 'white';
  }, [windForce]);

  // Arrow bar width proportional to wind (0–40px)
  const arrowWidth = useDerivedValue(() => {
    const mag = Math.abs(windForce?.value ?? 0);
    if (mag < 0.2) return 0;
    return Math.min(40, 8 + mag * 6);
  }, [windForce]);

  // Arrow bar x position (left of text for leftward wind, right for rightward)
  const arrowX = useDerivedValue(() => {
    const f = windForce?.value ?? 0;
    if (f >= 0) return 55; // right of text
    return 55; // same start, but we'll draw differently
  }, [windForce]);

  // Arrow direction indicator text (arrows)
  const arrowText = useDerivedValue(() => {
    const f = windForce?.value ?? 0;
    const mag = Math.abs(f);
    if (mag < 0.2) return '';
    if (f > 0) {
      return mag > 3 ? '>>>' : mag > 1.5 ? '>>' : '>';
    }
    return mag > 3 ? '<<<' : mag > 1.5 ? '<<' : '<';
  }, [windForce]);

  if (!displayFont) return null;

  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      {/* Shadow */}
      <Text x={1} y={1} text={text} font={displayFont} color="rgba(0,0,0,0.5)" />
      {/* Main Text */}
      <Text x={0} y={0} text={text} font={displayFont} color={color} />
      {/* Arrow indicators */}
      <Text x={55} y={0} text={arrowText} font={displayFont} color={color} />
      {/* Wind strength bar */}
      <Rect
        x={55}
        y={4}
        width={arrowWidth}
        height={3}
        color={color}
      />
    </Group>
  );
};
