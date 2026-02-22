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
  const groundY = height * 0.75;

  // ─── PARALLAX FACTORS ───
  const P_CLOUD_FAR = 0.02;
  const P_CLOUD_NEAR = 0.05;
  const P_HILLS_FAR = 0.1;
  const P_HILLS_NEAR = 0.25;

  // ─── SUN ───
  const sunX = width * 0.85;
  const sunY = height * 0.15;
  const sunR = Math.min(width, height) * 0.08;

  // ─── CLOUDS (Manual Path Construction) ───
  const cloudPath = useMemo(() => {
    const p = Skia.Path.Make();
    const cw = 100;
    // Cloud bubbles
    p.addOval({ x: 0, y: 0, width: cw, height: cw * 0.6 });
    p.addOval({ x: cw * 0.3, y: -cw * 0.3, width: cw * 0.8, height: cw * 0.8 });
    p.addOval({ x: cw * 0.6, y: 0, width: cw * 0.7, height: cw * 0.5 });
    return p;
  }, []);

  const cloudFarOffset = useDerivedValue(() => -(distance.value * P_CLOUD_FAR) % (width + 200));
  const cloudNearOffset = useDerivedValue(() => -(distance.value * P_CLOUD_NEAR) % (width + 200));

  const cloudFarTr = useDerivedValue(() => [{ translateX: cloudFarOffset.value }]);
  const cloudNearTr = useDerivedValue(() => [{ translateX: cloudNearOffset.value }]);

  // ─── HILLS (Manual Path Construction) ───
  const farHillsOffset = useDerivedValue(() => -(distance.value * P_HILLS_FAR) % width);
  const nearHillsOffset = useDerivedValue(() => -(distance.value * P_HILLS_NEAR) % width);

  const farHillPath = useMemo(() => {
    const p = Skia.Path.Make();
    const hillW = width / 3;
    const hillH = height * 0.12;
    const baseY = groundY;
    
    p.moveTo(-hillW, baseY);
    // Draw 4 hills to cover screen + buffer
    for (let i = -1; i < 4; i++) {
        const startX = i * hillW;
        p.quadTo(startX + hillW/2, baseY - hillH, startX + hillW, baseY);
    }
    p.lineTo(width * 2, height);
    p.lineTo(-hillW, height);
    p.close();
    return p;
  }, [width, height, groundY]);

  const nearHillPath = useMemo(() => {
    const p = Skia.Path.Make();
    const hillW = width / 2.5;
    const hillH = height * 0.08;
    const baseY = groundY + height * 0.02;

    p.moveTo(-hillW, baseY);
    for (let i = -1; i < 4; i++) {
        const startX = i * hillW;
        p.quadTo(startX + hillW/2, baseY - hillH, startX + hillW, baseY);
    }
    p.lineTo(width * 2, height);
    p.lineTo(-hillW, height);
    p.close();
    return p;
  }, [width, height, groundY]);

  const farHillsTr = useDerivedValue(() => [{ translateX: farHillsOffset.value }]);
  const nearHillsTr = useDerivedValue(() => [{ translateX: nearHillsOffset.value }]);

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
      <Circle cx={sunX} cy={sunY} r={sunR} color="#FFD700" opacity={0.8} />
      <Circle cx={sunX} cy={sunY} r={sunR * 1.3} color="#FFD700" opacity={0.3} />

      {/* Clouds */}
      <Group transform={cloudFarTr} opacity={0.6}>
        <Path path={cloudPath} color="#FFFFFF" style="fill" transform={[{ translateX: width * 0.2 }, { translateY: height * 0.15 }, { scale: 0.8 }]} />
        <Path path={cloudPath} color="#FFFFFF" style="fill" transform={[{ translateX: width * 0.7 }, { translateY: height * 0.1 }, { scale: 0.6 }]} />
        <Path path={cloudPath} color="#FFFFFF" style="fill" transform={[{ translateX: width * 1.2 + 200 }, { translateY: height * 0.15 }, { scale: 0.8 }]} />
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
