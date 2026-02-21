import React from 'react';
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
import { COLORS } from '../game/constants';

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

  // ─── SUN ───
  const sunX = width * 0.85;
  const sunY = height * 0.15;
  const sunR = Math.min(width, height) * 0.08;

  // ─── CLOUDS (Simple Shapes) ───
  const cloudPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const cw = 120;
    // Create a fluffy cloud shape using arcs/ovals
    p.addOval({ x: 0, y: 0, width: cw, height: cw * 0.6 });
    p.addOval({ x: cw * 0.3, y: -cw * 0.4, width: cw * 0.7, height: cw * 0.7 });
    p.addOval({ x: cw * 0.6, y: -cw * 0.1, width: cw * 0.6, height: cw * 0.6 });
    return p;
  }, []);

  const cloudOffset1 = useDerivedValue(() => -(distance.value * 0.02) % (width + 200));
  const cloudOffset2 = useDerivedValue(() => -(distance.value * 0.04) % (width + 200));

  // ─── HILLS ───
  const farHillsOffset = useDerivedValue(() => -(distance.value * 0.1) % width);
  const nearHillsOffset = useDerivedValue(() => -(distance.value * 0.25) % width);

  const farHillPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const hillW = width / 3;
    const hillH = height * 0.12;
    const baseY = groundY;
    p.moveTo(-hillW, baseY);
    for (let x = -hillW; x < width * 2 + hillW; x += hillW) {
      p.quadTo(x + hillW / 2, baseY - hillH, x + hillW, baseY);
    }
    p.lineTo(width * 2 + hillW, height);
    p.lineTo(-hillW, height);
    p.close();
    return p;
  }, [width, height, groundY]);

  const nearHillPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const hillW = width / 2.5;
    const hillH = height * 0.08;
    const baseY = groundY + height * 0.02;
    p.moveTo(-hillW, baseY);
    for (let x = -hillW; x < width * 2 + hillW; x += hillW) {
      p.quadTo(x + hillW / 2, baseY - hillH, x + hillW, baseY);
    }
    p.lineTo(width * 2 + hillW, height);
    p.lineTo(-hillW, height);
    p.close();
    return p;
  }, [width, height, groundY]);

  // Transforms
  const farHillsTr = useDerivedValue(() => [{ translateX: farHillsOffset.value }]);
  const nearHillsTr = useDerivedValue(() => [{ translateX: nearHillsOffset.value }]);
  
  const cloudTr1 = useDerivedValue(() => [{ translateX: cloudOffset1.value }, { translateY: height * 0.1 }]);
  const cloudTr2 = useDerivedValue(() => [{ translateX: cloudOffset2.value }, { translateY: height * 0.25 }]);

  return (
    <Group>
      {/* Sky Gradient */}
      <Rect x={0} y={0} width={width} height={groundY + 20}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, groundY + 20)}
          colors={['#87CEEB', '#E0F7FA']}
        />
      </Rect>

      {/* Sun */}
      <Circle cx={sunX} cy={sunY} r={sunR} color="#FFD700" opacity={0.9} />
      <Circle cx={sunX} cy={sunY} r={sunR * 1.3} color="#FFD700" opacity={0.3} />

      {/* Clouds (White, Semi-transparent) */}
      <Group transform={cloudTr1} opacity={0.7}>
        <Path path={cloudPath} color="#FFFFFF" style="fill" />
         {/* Extra cloud for loop illusion */}
        <Path path={cloudPath} color="#FFFFFF" style="fill" transform={[{ translateX: width * 0.6 }]} />
      </Group>

      <Group transform={cloudTr2} opacity={0.8}>
         <Path path={cloudPath} color="#FFFFFF" style="fill" transform={[{ translateX: width * 0.3 }, { scale: 0.8 }]} />
         <Path path={cloudPath} color="#FFFFFF" style="fill" transform={[{ translateX: width * 0.9 }, { scale: 0.8 }]} />
      </Group>

      {/* Far Hills */}
      <Group transform={farHillsTr}>
        <Path path={farHillPath} color="#A2D149" />
      </Group>

      {/* Near Hills */}
      <Group transform={nearHillsTr}>
        <Path path={nearHillPath} color="#558B2F" />
      </Group>
    </Group>
  );
};
