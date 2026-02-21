import React from 'react';
import {
  Group,
  Rect,
  Text,
  Skia,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface WindIndicatorProps {
  windDirection: SharedValue<number>;
  windForce: SharedValue<number>;
  x: number;
  y: number;
}

export const WindIndicator: React.FC<WindIndicatorProps> = ({
  windDirection,
  windForce,
  x,
  y,
}) => {
  const BAR_W = 100;
  const BAR_H = 12;
  const FONT_SIZE = 14;

  const font = Skia.Font(undefined, FONT_SIZE);

  // Derive wind intensity (0.0 ~ 1.0+)
  const intensity = useDerivedValue(() => {
    return Math.abs(windForce.value);
  }, [windForce]);

  // Is strong wind? (> 1.5)
  const isStrong = useDerivedValue(() => {
    return Math.abs(windForce.value) > 1.5;
  }, [windForce]);

  // Determine text: "WIND" or "GUST!"
  const labelText = useDerivedValue(() => {
    return isStrong.value ? "WIND GUST!" : "WIND";
  }, [isStrong]);

  // Determine color: White (calm) or Red (strong)
  const color = useDerivedValue(() => {
    return isStrong.value ? "#FF4500" : "white";
  }, [isStrong]);

  // Determine bar width and position based on wind force
  const barFillW = useDerivedValue(() => {
    const f = windForce.value; // -3.0 ~ +3.0
    // Map -3..3 to 0..100 width (centered at 50)
    // Actually, let's just show magnitude from center
    return Math.min(Math.abs(f) * 20, 50); // Max 50px each side
  }, [windForce]);
  
  const barX = useDerivedValue(() => {
    const w = barFillW.value;
    // If wind > 0 (Right), start at center (50)
    // If wind < 0 (Left), start at center - w
    return windForce.value > 0 ? 50 : 50 - w;
  }, [windForce, barFillW]);


  if (!font) return null;

  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      
      {/* Background Bar (Translucent Black) */}
      <Rect x={0} y={0} width={BAR_W} height={BAR_H} rx={BAR_H/2} color="rgba(0,0,0,0.3)" />

      {/* Wind Strength Bar (Animated) */}
      <Rect
        x={barX}
        y={0}
        width={barFillW}
        height={BAR_H}
        rx={BAR_H/2}
        color={color}
      />

      {/* Center Marker (White Dot) */}
      <Circle cx={50} cy={BAR_H/2} r={3} color="white" />

      {/* Label Text below bar */}
      <Text
        x={50 - (labelText.value.length * 4)} // Approximate centering
        y={BAR_H + FONT_SIZE + 4}
        text={labelText}
        font={font}
        color={color}
        style="fill"
      />
    </Group>
  );
};
