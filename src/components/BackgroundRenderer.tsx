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
  skyPhase?: SharedValue<number>; // 0=day, 1=sunset, 2=night
}

export const BackgroundRenderer: React.FC<BackgroundRendererProps> = ({
  width,
  height,
  distance,
  skyPhase,
}) => {
  const groundY = height * 0.75;

  // Parallax factors
  const P_CLOUD = 0.15;
  const P_HILLS_FAR = 0.4;

  // Sun/Moon
  const sunX = width * 0.85;
  const sunBaseY = height * 0.15;
  const sunR = Math.min(width, height) * 0.08;

  // Sky phase opacities
  const dayOpacity = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    return Math.max(0, 1 - phase);
  });
  const sunsetOpacity = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    return Math.max(0, 1 - Math.abs(phase - 1));
  });
  const nightOpacity = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    return Math.max(0, phase - 1);
  });

  // Sun sinks toward horizon during sunset
  const sunY = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    const t = Math.min(phase, 1);
    return sunBaseY + (groundY * 0.9 - sunBaseY) * t;
  });
  const sunOpacity = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    return Math.max(0, 1 - phase);
  });

  // Moon
  const moonOpacity = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    return Math.max(0, phase - 1);
  });

  // Stars (20 fixed positions)
  const starPositions = useMemo(() => {
    const stars: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < 20; i++) {
      const seed = Math.sin(i * 137.508 + 42.0);
      const seed2 = Math.sin(i * 73.156 + 13.0);
      stars.push({
        x: Math.abs(seed) * width,
        y: Math.abs(seed2) * (groundY * 0.8),
        r: 1 + Math.abs(Math.sin(i * 23.7)) * 1.5,
      });
    }
    return stars;
  }, [width, groundY]);

  const starOpacity = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    return Math.max(0, phase - 1);
  });

  // Clouds
  const cloudPath = useMemo(() => {
    const p = Skia.Path.Make();
    const cw = 120;
    p.addOval({ x: 0, y: 0, width: cw, height: cw * 0.6 });
    p.addOval({ x: cw * 0.3, y: -cw * 0.4, width: cw * 0.7, height: cw * 0.7 });
    p.addOval({ x: cw * 0.6, y: -cw * 0.1, width: cw * 0.6, height: cw * 0.6 });
    return p;
  }, []);

  const cloudTr1 = useDerivedValue(() => [
    { translateX: (-(distance.value * P_CLOUD) % (width + 300)) + 100 },
    { translateY: height * 0.1 },
  ]);
  const cloudTr2 = useDerivedValue(() => [
    { translateX: (-(distance.value * P_CLOUD * 1.5) % (width + 400)) + 400 },
    { translateY: height * 0.22 },
  ]);

  // Cloud opacity fades at night
  const cloudOpacity1 = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    return 0.6 * Math.max(0.1, 1 - phase * 0.4);
  });
  const cloudOpacity2 = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    return 0.8 * Math.max(0.1, 1 - phase * 0.4);
  });

  // Hills
  const farHillsTr = useDerivedValue(() => [
    { translateX: -(distance.value * P_HILLS_FAR) % width },
  ]);

  const farHillPath = useMemo(() => {
    const p = Skia.Path.Make();
    const hillW = width / 2;
    const hillH = height * 0.40;
    p.moveTo(0, groundY);
    for (let i = 0; i < 3; i++) {
      p.quadTo((i + 0.5) * hillW, groundY - hillH, (i + 1) * hillW, groundY);
    }
    p.lineTo(width * 2, height);
    p.lineTo(0, height);
    p.close();
    return p;
  }, [width, height, groundY]);

  // Hill colors darken at night
  const farHillColor = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    if (phase < 1) return '#A2D149';
    const t = phase - 1;
    // Lerp green → dark green
    const r = Math.round(162 - t * 100);
    const g = Math.round(209 - t * 120);
    const b = Math.round(73 - t * 30);
    return `rgb(${r},${g},${b})`;
  });

  return (
    <Group>
      {/* Solid base (prevents black bleed-through during sky transitions) */}
      <Rect x={0} y={0} width={width} height={groundY + 20} color="#87CEEB" />

      {/* Day sky */}
      <Rect x={0} y={0} width={width} height={groundY + 20} opacity={dayOpacity}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, groundY + 20)}
          colors={['#87CEEB', '#E0F7FA']}
        />
      </Rect>

      {/* Sunset sky */}
      <Rect x={0} y={0} width={width} height={groundY + 20} opacity={sunsetOpacity}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, groundY + 20)}
          colors={['#FF6B35', '#FFB347']}
        />
      </Rect>

      {/* Night sky */}
      <Rect x={0} y={0} width={width} height={groundY + 20} opacity={nightOpacity}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, groundY + 20)}
          colors={['#0D0D2B', '#1A1A4E']}
        />
      </Rect>

      {/* Sun */}
      <Circle cx={sunX} cy={sunY} r={sunR} color="#FFD700" opacity={sunOpacity} />
      <Circle cx={sunX} cy={sunY} r={sunR * 1.3} color="#FFD700" opacity={useDerivedValue(() => (sunOpacity.value ?? 0) * 0.25)} />

      {/* Moon (crescent) */}
      <Circle cx={sunX - 40} cy={sunBaseY} r={sunR} color="#FFFDE7" opacity={moonOpacity} />
      <Circle
        cx={sunX - 40 + sunR * 0.35}
        cy={sunBaseY - sunR * 0.1}
        r={sunR * 0.8}
        color="#0D0D2B"
        opacity={moonOpacity}
      />

      {/* Stars */}
      <Group opacity={starOpacity}>
        {starPositions.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} color="#FFFFFF" />
        ))}
      </Group>

      {/* Clouds */}
      <Group transform={cloudTr1} opacity={cloudOpacity1}>
        <Path path={cloudPath} color="#FFFFFF" />
      </Group>
      <Group transform={cloudTr2} opacity={cloudOpacity2}>
        <Path path={cloudPath} color="#FFFFFF" transform={[{ scale: 0.7 }]} />
      </Group>

      {/* Far hills */}
      <Group transform={farHillsTr}>
        <Path path={farHillPath} color={farHillColor} />
        <Path path={farHillPath} color={farHillColor} transform={[{ translateX: width }]} />
      </Group>

    </Group>
  );
};
