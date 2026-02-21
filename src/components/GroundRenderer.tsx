import React from 'react';
import {
  Rect,
  Line,
  Group,
  vec,
  LinearGradient,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { COLORS, PARALLAX } from '../game/constants';

interface GroundRendererProps {
  width: number;
  height: number;
  distance: SharedValue<number>;
}

export const GroundRenderer: React.FC<GroundRendererProps> = ({
  width,
  height,
  distance,
}) => {
  const groundY = height * 0.65;
  const groundHeight = height - groundY;

  // Ground scroll offset for texture lines
  const groundOffset = useDerivedValue(() => {
    return -(distance.value * PARALLAX.ground) % 40;
  });

  // Ground texture lines (road markings)
  const linePositions = React.useMemo(() => {
    const lines: number[] = [];
    for (let x = -40; x < width + 80; x += 40) {
      lines.push(x);
    }
    return lines;
  }, [width]);

  const lineTransform = useDerivedValue(() => {
    return [{ translateX: groundOffset.value }];
  });

  return (
    <Group>
      {/* Main ground fill */}
      <Rect x={0} y={groundY} width={width} height={groundHeight}>
        <LinearGradient
          start={vec(0, groundY)}
          end={vec(0, groundY + groundHeight)}
          colors={[COLORS.ground, COLORS.groundDark]}
        />
      </Rect>

      {/* Ground surface line */}
      <Line
        p1={vec(0, groundY)}
        p2={vec(width, groundY)}
        color={COLORS.groundLine}
        strokeWidth={3}
      />

      {/* Scrolling texture lines */}
      <Group transform={lineTransform}>
        {linePositions.map((x, i) => (
          <Line
            key={i}
            p1={vec(x, groundY + 8)}
            p2={vec(x + 20, groundY + 8)}
            color={COLORS.groundLine}
            strokeWidth={1}
            opacity={0.4}
          />
        ))}
      </Group>
    </Group>
  );
};
