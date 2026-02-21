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

  // ─── PARALLAX FACTORS ───
  const P_SUN = 0.0;       // Sun is static (or very slow)
  const P_CLOUD_FAR = 0.02;
  const P_CLOUD_NEAR = 0.05;
  const P_HILLS_FAR = 0.1;
  const P_HILLS_NEAR = 0.25;

  // ─── SUN ───
  const sunX = width * 0.85;
  const sunY = height * 0.15;
  const sunR = Math.min(width, height) * 0.08;

  // ─── CLOUDS ───
  // Create a simple cloud shape
  const cloudPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const cw = 100;
    p.addOval({ x: 0, y: 0, width: cw, height: cw * 0.6 });
    p.addOval({ x: cw * 0.3, y: -cw * 0.3, width: cw * 0.8, height: cw * 0.8 });
    p.addOval({ x: cw * 0.6, y: 0, width: cw * 0.7, height: cw * 0.5 });
    return p;
  }, []);

  // Animated Cloud Offsets
  const cloudFarOffset = useDerivedValue(() => {
    return -(distance.value * P_CLOUD_FAR) % (width + 200);
  });
  
  const cloudNearOffset = useDerivedValue(() => {
    return -(distance.value * P_CLOUD_NEAR) % (width + 200);
  });

  const cloudFarTr = useDerivedValue(() => [{ translateX: cloudFarOffset.value }]);
  const cloudNearTr = useDerivedValue(() => [{ translateX: cloudNearOffset.value }]);

  // ─── HILLS ───
  const farHillsOffset = useDerivedValue(() => -(distance.value * P_HILLS_FAR) % width);
  const nearHillsOffset = useDerivedValue(() => -(distance.value * P_HILLS_NEAR) % width);

  const farHillPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const hillW = width / 3;
    const hillH = height * 0.15; // Slightly taller
    const baseY = groundY;
    p.moveTo(-hillW, baseY);
    for (let x = -hillW; x < width * 2 + hillW; x += hillW) {
      // More jagged/varied hills
      p.cubicTo(
        x + hillW * 0.3, baseY - hillH,
        x + hillW * 0.7, baseY - hillH * 0.6,
        x + hillW, baseY
      );
    }
    p.lineTo(width * 2 + hillW, height);
    p.lineTo(-hillW, height);
    p.close();
    return p;
  }, [width, height, groundY]);

  const nearHillPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const hillW = width / 2.5;
    const hillH = height * 0.1;
    const baseY = groundY + height * 0.02;
    p.moveTo(-hillW, baseY);
    for (let x = -hillW; x < width * 2 + hillW; x += hillW) {
      p.quadTo(x + hillW * 0.5, baseY - hillH, x + hillW, baseY);
    }
    p.lineTo(width * 2 + hillW, height);
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
          colors={['#87CEEB', '#E0F7FA']} // Brighter sky
        />
      </Rect>

      {/* Sun */}
      <Circle cx={sunX} cy={sunY} r={sunR} color="#FFD700" opacity={0.8} />
      <Circle cx={sunX} cy={sunY} r={sunR * 1.2} color="#FFD700" opacity={0.3} />

      {/* Clouds Layer 1 (Far/Slow) */}
      <Group transform={cloudFarTr} opacity={0.6}>
        <Path path={cloudPath} color="#FFFFFF" style="fill" transform={[{ translateX: width * 0.2 }, { translateY: height * 0.15 }, { scale: 0.8 }]} />
        <Path path={cloudPath} color="#FFFFFF" style="fill" transform={[{ translateX: width * 0.7 }, { translateY: height * 0.1 }, { scale: 0.6 }]} />
        {/* Repeat for seamless loop illusion (simplified) */}
        <Path path={cloudPath} color="#FFFFFF" style="fill" transform={[{ translateX: width * 1.2 + 200 }, { translateY: height * 0.15 }, { scale: 0.8 }]} />
      </Group>

      {/* Clouds Layer 2 (Near/Faster) */}
      <Group transform={cloudNearTr} opacity={0.8}>
        <Path path={cloudPath} color="#FFFFFF" style="fill" transform={[{ translateX: width * 0.5 }, { translateY: height * 0.25 }, { scale: 1.0 }]} />
         <Path path={cloudPath} color="#FFFFFF" style="fill" transform={[{ translateX: width * 1.5 + 200 }, { translateY: height * 0.25 }, { scale: 1.0 }]} />
      </Group>

      {/* Far Hills */}
      <Group transform={farHillsTr}>
        <Path path={farHillPath} color="#A2D149" /> {/* Lighter Green */}
      </Group>

      {/* Near Hills */}
      <Group transform={nearHillsTr}>
        <Path path={nearHillPath} color="#558B2F" /> {/* Corrected Green */}
        {/* We use manual colors here to be more vibrant than constants */}
        <Path path={nearHillPath} color="#6E9E3B" />
      </Group>
    </Group>
  );
};
