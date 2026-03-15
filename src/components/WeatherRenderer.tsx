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

const RainDrop: React.FC<{
  index: number;
  weatherType: SharedValue<number>;
  particles: SharedValue<number[]>;
}> = ({ index, weatherType, particles }) => {
  const p1 = useDerivedValue(() => {
    if (weatherType.value !== 1) return vec(-100, -100);
    const idx = index * 2;
    return vec(particles.value[idx] ?? -100, particles.value[idx + 1] ?? -100);
  });
  const p2 = useDerivedValue(() => {
    if (weatherType.value !== 1) return vec(-100, -100);
    const idx = index * 2;
    return vec(
      (particles.value[idx] ?? -100) + 4,
      (particles.value[idx + 1] ?? -100) + 16,
    );
  });
  return (
    <Line p1={p1} p2={p2} color="#AACCFF" strokeWidth={1.5} opacity={0.45} />
  );
};

const SnowFlake: React.FC<{
  index: number;
  weatherType: SharedValue<number>;
  particles: SharedValue<number[]>;
}> = ({ index, weatherType, particles }) => {
  const sx = useDerivedValue(() => {
    if (weatherType.value !== 2) return -100;
    return particles.value[index * 2] ?? -100;
  });
  const sy = useDerivedValue(() => {
    if (weatherType.value !== 2) return -100;
    return particles.value[index * 2 + 1] ?? -100;
  });
  return <Circle cx={sx} cy={sy} r={3} color="white" opacity={0.7} />;
};

const rainIndices = Array.from({ length: MAX_RAIN }, (_, i) => i);
const snowIndices = Array.from({ length: MAX_SNOW }, (_, i) => i);

export const WeatherRenderer: React.FC<WeatherRendererProps> = ({
  weatherType,
  particles,
  width,
  height,
}) => {
  return (
    <Group>
      {/* Rain */}
      {rainIndices.map((i) => (
        <RainDrop
          key={`rain-${i}`}
          index={i}
          weatherType={weatherType}
          particles={particles}
        />
      ))}

      {/* Snow */}
      {snowIndices.map((i) => (
        <SnowFlake
          key={`snow-${i}`}
          index={i}
          weatherType={weatherType}
          particles={particles}
        />
      ))}
    </Group>
  );
};
