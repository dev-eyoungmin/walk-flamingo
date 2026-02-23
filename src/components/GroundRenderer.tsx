import React, { useMemo } from 'react';
import {
  Rect,
  Line,
  Group,
  vec,
  LinearGradient,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

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

  // Ground scroll speed multiplier
  const P_GROUND = 2.5; 

  // Infinite texture lines scroll
  const groundOffset = useDerivedValue(() => {
    return -(distance.value * P_GROUND) % 100;
  });

  // Generate line positions once
  const lineInterval = 100;
  const lineCount = Math.ceil(width / lineInterval) + 2;
  const lineIndices = Array.from({ length: lineCount }, (_, i) => i);

  const lineTr = useDerivedValue(() => [{ translateX: groundOffset.value }]);

  return (
    <Group>
      {/* Main ground fill */}
      <Rect x={0} y={groundY} width={width} height={groundHeight}>
        <LinearGradient
          start={vec(0, groundY)}
          end={vec(0, groundY + groundHeight)}
          colors={['#5D4037', '#3E2723']} // Deep brown
        />
      </Rect>

      {/* Surface line */}
      <Line
        p1={vec(0, groundY)}
        p2={vec(width, groundY)}
        color="#2E1C18"
        strokeWidth={4}
      />

      {/* Scrolling texture details (Small stones/lines) */}
      <Group transform={lineTr}>
        {lineIndices.map((i) => (
          <Group key={i} transform={[{ translateX: i * lineInterval }]}>
            {/* Horizontal texture line */}
            <Rect x={10} y={groundY + 15} width={40} height={2} color="rgba(255,255,255,0.1)" rx={1} />
            {/* Small stone */}
            <Rect x={60} y={groundY + 40} width={6} height={4} color="rgba(0,0,0,0.2)" rx={2} />
            {/* Lower texture line */}
            <Rect x={-20} y={groundY + 60} width={30} height={2} color="rgba(255,255,255,0.05)" rx={1} />
          </Group>
        ))}
      </Group>
    </Group>
  );
};
