import React, { useMemo } from 'react';
import {
  Rect,
  Circle,
  Path,
  Group,
  LinearGradient,
  vec,
  Skia,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface BackgroundRendererProps {
  width: number;
  height: number;
  distance: SharedValue<number>;
}

export const BackgroundRenderer: React.FC<BackgroundRendererProps> = ({
  width,
  height,
  distance,
}) => {
  const groundY = height * 0.65;

  // ─── PARALLAX FACTORS (Higher values = Faster movement) ───
  const P_CLOUD = 0.15;   // Faster clouds
  const P_HILLS_FAR = 0.4; // Far hills
  const P_HILLS_NEAR = 1.2; // Near hills (must be fast for dynamic feel)

  // ─── SUN ───
  const sunX = width * 0.85;
  const sunY = height * 0.15;
  const sunR = Math.min(width, height) * 0.08;

  // ─── CLOUDS ───
  const cloudPath = useMemo(() => {
    const p = Skia.Path.Make();
    const cw = 120;
    p.addOval({ x: 0, y: 0, width: cw, height: cw * 0.6 });
    p.addOval({ x: cw * 0.3, y: -cw * 0.4, width: cw * 0.7, height: cw * 0.7 });
    p.addOval({ x: cw * 0.6, y: -cw * 0.1, width: cw * 0.6, height: cw * 0.6 });
    return p;
  }, []);

  // Multi-layer clouds with different speeds
  const cloudTr1 = useDerivedValue(() => [
    { translateX: (-(distance.value * P_CLOUD) % (width + 300)) + 100 },
    { translateY: height * 0.1 }
  ]);
  const cloudTr2 = useDerivedValue(() => [
    { translateX: (-(distance.value * P_CLOUD * 1.5) % (width + 400)) + 400 },
    { translateY: height * 0.22 }
  ]);

  // ─── HILLS (Seamless Loop) ───
  // Far Hills: Slower
  const farHillsTr = useDerivedValue(() => [
    { translateX: -(distance.value * P_HILLS_FAR) % width }
  ]);

  // Near Hills: Faster (The "key" to speed feel)
  const nearHillsTr = useDerivedValue(() => [
    { translateX: -(distance.value * P_HILLS_NEAR) % width }
  ]);

  const farHillPath = useMemo(() => {
    const p = Skia.Path.Make();
    const hillW = width / 2; // Wider hills
    const hillH = height * 0.15;
    p.moveTo(0, groundY);
    for (let i = 0; i < 3; i++) {
        p.quadTo((i+0.5)*hillW, groundY - hillH, (i+1)*hillW, groundY);
    }
    p.lineTo(width * 2, height);
    p.lineTo(0, height);
    p.close();
    return p;
  }, [width, height, groundY]);

  const nearHillPath = useMemo(() => {
    const p = Skia.Path.Make();
    const hillW = width / 1.5; // Irregular, large hills
    const hillH = height * 0.1;
    const baseY = groundY + height * 0.02;
    p.moveTo(0, baseY);
    for (let i = 0; i < 3; i++) {
        p.quadTo((i+0.5)*hillW, baseY - hillH, (i+1)*hillW, baseY);
    }
    p.lineTo(width * 2, height);
    p.lineTo(0, height);
    p.close();
    return p;
  }, [width, height, groundY]);

  return (
    <Group>
      <Rect x={0} y={0} width={width} height={groundY + 20}>
        <LinearGradient start={vec(0, 0)} end={vec(0, groundY + 20)} colors={['#87CEEB', '#E0F7FA']} />
      </Rect>

      <Circle cx={sunX} cy={sunY} r={sunR} color="#FFD700" opacity={0.8} />
      <Circle cx={sunX} cy={sunY} r={sunR * 1.3} color="#FFD700" opacity={0.2} />

      <Group transform={cloudTr1} opacity={0.6}>
        <Path path={cloudPath} color="#FFFFFF" />
      </Group>
      <Group transform={cloudTr2} opacity={0.8}>
        <Path path={cloudPath} color="#FFFFFF" transform={[{scale: 0.7}]} />
      </Group>

      <Group transform={farHillsTr}>
        <Path path={farHillPath} color="#A2D149" />
        <Path path={farHillPath} color="#A2D149" transform={[{translateX: width}]} />
      </Group>

      <Group transform={nearHillsTr}>
        <Path path={nearHillPath} color="#558B2F" />
        <Path path={nearHillPath} color="#558B2F" transform={[{translateX: width}]} />
      </Group>
    </Group>
  );
};
