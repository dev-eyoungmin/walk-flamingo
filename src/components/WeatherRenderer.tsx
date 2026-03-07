import React from 'react';
import { Line, Circle, Group, vec } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface WeatherRendererProps {
  weatherType: SharedValue<number>; // 0=none, 1=rain, 2=snow
  /** Flat array: [x0, y0, x1, y1, ...] */
  particles: SharedValue<number[]>;
  width: number;
  height: number;
}

const MAX_RAIN = 60;
const MAX_SNOW = 40;

export const WeatherRenderer: React.FC<WeatherRendererProps> = ({
  weatherType,
  particles,
  width,
  height,
}) => {
  // Rain drops
  const rainDrops = Array.from({ length: MAX_RAIN }, (_, i) => i);
  // Snow flakes
  const snowFlakes = Array.from({ length: MAX_SNOW }, (_, i) => i);

  const isRain = useDerivedValue(() => weatherType.value === 1);
  const isSnow = useDerivedValue(() => weatherType.value === 2);

  return (
    <Group>
      {/* Rain */}
      {rainDrops.map((i) => {
        const p1 = useDerivedValue(() => {
          if (weatherType.value !== 1) return vec(-100, -100);
          const idx = i * 2;
          return vec(particles.value[idx] ?? -100, particles.value[idx + 1] ?? -100);
        });
        const p2 = useDerivedValue(() => {
          if (weatherType.value !== 1) return vec(-100, -100);
          const idx = i * 2;
          return vec(
            (particles.value[idx] ?? -100) + 4,
            (particles.value[idx + 1] ?? -100) + 16,
          );
        });
        return (
          <Line
            key={`rain-${i}`}
            p1={p1}
            p2={p2}
            color="#AACCFF"
            strokeWidth={1.5}
            opacity={0.45}
          />
        );
      })}

      {/* Snow */}
      {snowFlakes.map((i) => {
        const sx = useDerivedValue(() => {
          if (weatherType.value !== 2) return -100;
          return particles.value[i * 2] ?? -100;
        });
        const sy = useDerivedValue(() => {
          if (weatherType.value !== 2) return -100;
          return particles.value[i * 2 + 1] ?? -100;
        });
        return (
          <Circle
            key={`snow-${i}`}
            cx={sx}
            cy={sy}
            r={3}
            color="white"
            opacity={0.7}
          />
        );
      })}
    </Group>
  );
};
