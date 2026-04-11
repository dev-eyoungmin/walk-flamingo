import React, { useMemo } from 'react';
import { Group, Path, Skia } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

/**
 * obstacleData flat array: [type(0=rock/1=branch), screenX, screenY, active(0/1), side(-1/1)]
 *
 * Usage:
 *   <ObstacleRenderer obstacleData={obstacleDataSV} groundY={groundY} width={width} height={height} />
 */
interface ObstacleRendererProps {
  obstacleData: SharedValue<number[]>;
  groundY: number;
  width: number;
  height: number;
}

export const ObstacleRenderer: React.FC<ObstacleRendererProps> = ({
  obstacleData,
  groundY,
  width,
  height,
}) => {
  // --- Rock path: irregular polygon ~30px wide, anchored at origin ---
  const rockFillPath = useMemo(() => {
    const p = Skia.Path.Make();
    // Irregular polygon roughly 30px wide, 24px tall
    p.moveTo(0, -12);
    p.lineTo(10, -18);
    p.lineTo(20, -14);
    p.lineTo(26, -4);
    p.lineTo(22, 6);
    p.lineTo(10, 10);
    p.lineTo(-4, 8);
    p.lineTo(-10, -2);
    p.lineTo(-6, -12);
    p.close();
    return p;
  }, []);

  const rockStrokePath = useMemo(() => {
    // Same shape, rendered as stroke for outline
    const p = Skia.Path.Make();
    p.moveTo(0, -12);
    p.lineTo(10, -18);
    p.lineTo(20, -14);
    p.lineTo(26, -4);
    p.lineTo(22, 6);
    p.lineTo(10, 10);
    p.lineTo(-4, 8);
    p.lineTo(-10, -2);
    p.lineTo(-6, -12);
    p.close();
    return p;
  }, []);

  // --- Branch path: horizontal line with small twigs, anchored at origin ---
  const branchPath = useMemo(() => {
    const p = Skia.Path.Make();
    // Main horizontal branch, 60px wide
    p.moveTo(-30, 0);
    p.lineTo(30, 0);
    // Twigs going upward at intervals
    p.moveTo(-18, 0);
    p.lineTo(-24, -12);
    p.moveTo(-6, 0);
    p.lineTo(-10, -10);
    p.moveTo(8, 0);
    p.lineTo(4, -14);
    p.moveTo(20, 0);
    p.lineTo(16, -10);
    return p;
  }, []);

  // --- Derived values ---

  const obstacleTransform = useDerivedValue(() => {
    const data = obstacleData.value;
    const x = data[1] ?? 0;
    const y = data[2] ?? 0;
    return [{ translateX: x }, { translateY: y }];
  });

  const obstacleOpacity = useDerivedValue(() => {
    const data = obstacleData.value;
    return (data[3] ?? 0) > 0.5 ? 1 : 0;
  });

  const rockOpacity = useDerivedValue(() => {
    const data = obstacleData.value;
    const active = (data[3] ?? 0) > 0.5 ? 1 : 0;
    const isRock = (data[0] ?? 0) < 0.5 ? 1 : 0;
    return active * isRock;
  });

  const branchOpacity = useDerivedValue(() => {
    const data = obstacleData.value;
    const active = (data[3] ?? 0) > 0.5 ? 1 : 0;
    const isBranch = (data[0] ?? 0) > 0.5 ? 1 : 0;
    return active * isBranch;
  });

  return (
    <Group transform={obstacleTransform}>
      {/* Rock: fill layer */}
      <Group opacity={rockOpacity}>
        <Path path={rockFillPath} color="#6B5B4F" />
        <Path
          path={rockStrokePath}
          color="#8B7B6F"
          style="stroke"
          strokeWidth={2}
        />
      </Group>

      {/* Branch */}
      <Group opacity={branchOpacity}>
        <Path
          path={branchPath}
          color="#5D4037"
          style="stroke"
          strokeWidth={3}
          strokeCap="round"
        />
      </Group>
    </Group>
  );
};
