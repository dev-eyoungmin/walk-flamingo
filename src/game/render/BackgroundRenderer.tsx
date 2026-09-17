import React, { useMemo } from 'react';
import { Circle, Group, Path, PathOp, Rect, Shader, Skia, vec, usePathValue } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { LAYOUT } from '../sim/constants';
import type { SimState } from '../sim/state';
import { nightAmount, Palette, sunState } from './palette';
import { skyEffect } from './skyShader';

interface Props {
  sim: SharedValue<SimState>;
  palette: SharedValue<Palette>;
  width: number;
  height: number;
}

const FAR_PARALLAX = 0.06;
const NEAR_PARALLAX = 0.22;

function buildRidge(width: number, period: number, baseY: number, amp: number, seed: number, trees: boolean) {
  const p = Skia.Path.Make();
  const total = period * 2 + width;
  p.moveTo(0, baseY + amp * 2);
  const step = 6;
  for (let x = 0; x <= total; x += step) {
    const u = (x / period) * Math.PI * 2;
    let y =
      baseY -
      amp *
        (0.55 +
          0.25 * Math.sin(u + seed) +
          0.12 * Math.sin(u * 3 + seed * 2.1) +
          0.08 * Math.sin(u * 7 + seed * 0.7));
    if (trees) {
      // Rounded tree-canopy bumps (sqrt keeps the tops round and the gaps pinched)
      const bump = Math.sqrt(Math.abs(Math.sin((u * Math.round(period / 46)) / 2 + seed)));
      y -= bump * amp * 0.22;
    }
    p.lineTo(x, y);
  }
  p.lineTo(total, baseY + 400);
  p.lineTo(0, baseY + 400);
  p.close();
  return p;
}

function buildCloud(variant: number) {
  const p = Skia.Path.Make();
  const blobs =
    variant === 0
      ? [0, 18, 46, 22, 26, 4, 40, 34, 54, 12, 36, 26, 74, 20, 30, 20]
      : variant === 1
        ? [0, 14, 36, 18, 18, 2, 34, 28, 44, 10, 30, 22]
        : [0, 16, 52, 20, 30, 0, 44, 34, 62, 8, 40, 28, 90, 16, 34, 22, 20, 10, 28, 20];
  for (let i = 0; i < blobs.length; i += 4) {
    p.addOval(Skia.XYWHRect(blobs[i], blobs[i + 1], blobs[i + 2], blobs[i + 3]));
  }
  return p;
}

const CLOUDS = [
  { x: 0.1, y: 0.1, s: 1.1, v: 0, drift: 6 },
  { x: 0.45, y: 0.05, s: 0.8, v: 1, drift: 9 },
  { x: 0.75, y: 0.16, s: 1.3, v: 2, drift: 5 },
  { x: 1.1, y: 0.08, s: 0.9, v: 0, drift: 7 },
  { x: 1.45, y: 0.2, s: 0.7, v: 1, drift: 8 },
];

const Cloud: React.FC<{
  sim: SharedValue<SimState>;
  palette: SharedValue<Palette>;
  path: ReturnType<typeof buildCloud>;
  index: number;
  width: number;
  height: number;
}> = ({ sim, palette, path, index, width, height }) => {
  const c = CLOUDS[index];
  const span = width + 360;
  const transform = useDerivedValue(() => {
    const s = sim.value;
    const raw = c.x * span - s.scrollX * (0.03 + index * 0.004) - s.t * c.drift;
    const x = (((raw % span) + span) % span) - 180;
    return [{ translateX: x }, { translateY: c.y * height - s.camY * 0.05 }, { scale: c.s * (height / 360) }];
  });
  const color = useDerivedValue(() => palette.value.cloud);
  return (
    <Group transform={transform}>
      <Path path={path} color={color} />
    </Group>
  );
};

export const BackgroundRenderer: React.FC<Props> = React.memo(({ sim, palette, width, height }) => {
  const groundY = height * LAYOUT.GROUND_RATIO;
  const farPeriod = width * 1.6;
  const nearPeriod = width * 1.1;

  const farRidge = useMemo(
    () => buildRidge(width, farPeriod, groundY - height * 0.1, height * 0.32, 1.3, false),
    [width, height, farPeriod, groundY],
  );
  const nearRidge = useMemo(
    () => buildRidge(width, nearPeriod, groundY - height * 0.02, height * 0.16, 4.2, true),
    [width, height, nearPeriod, groundY],
  );
  const cloudPaths = useMemo(() => [buildCloud(0), buildCloud(1), buildCloud(2)], []);

  const sunR = height * 0.075;
  const moonPath = useMemo(() => {
    const a = Skia.Path.Make();
    a.addCircle(0, 0, sunR * 0.8);
    const b = Skia.Path.Make();
    b.addCircle(sunR * 0.38, -sunR * 0.18, sunR * 0.72);
    return Skia.Path.MakeFromOp(a, b, PathOp.Difference) ?? a;
  }, [sunR]);

  const stars = useMemo(() => {
    const groups = [Skia.Path.Make(), Skia.Path.Make()];
    for (let i = 0; i < 44; i++) {
      const x = Math.abs(Math.sin(i * 137.508 + 1.7)) * width;
      const y = Math.abs(Math.sin(i * 73.156 + 0.3)) * height * 0.34;
      const r = 0.7 + Math.abs(Math.sin(i * 23.7)) * 1.3;
      groups[i % 2].addCircle(x, y, r);
    }
    return groups;
  }, [width, height]);


  const sunInfo = useDerivedValue(() => {
    const out = [0, 0];
    sunState(sim.value.dayT, out);
    return out;
  });
  const sunY = useDerivedValue(() => {
    const h = sunInfo.value[1];
    return height * 0.15 + (groundY - height * 0.15) * h - sim.value.camY * 0.05;
  });
  const sunCenter = useDerivedValue(() => vec(width * 0.78, sunY.value));
  const sunOpacity = useDerivedValue(() => (sunInfo.value[1] > 1.05 ? 0 : sunInfo.value[0]));
  const sunGlowColor = useDerivedValue(() => palette.value.sunGlow);
  const sunColor = useDerivedValue(() => (sunInfo.value[1] > 0.6 ? '#FFB347' : '#FFE27A'));

  const skyUniforms = useDerivedValue(() => {
    const sky = palette.value.sky;
    const low = Math.min(1, sunInfo.value[1]);
    const visible = sunInfo.value[1] > 1.05 ? 0 : sunInfo.value[0];
    return {
      resolution: [width, height],
      horizon: groundY,
      top: [sky[0], sky[1], sky[2]],
      mid: [sky[3], sky[4], sky[5]],
      bottom: [sky[6], sky[7], sky[8]],
      sun: [width * 0.78, sunY.value],
      sunAmount: visible,
      // Warmer scattering as the sun gets low
      sunTint: [1, 0.95 - low * 0.25, 0.75 - low * 0.4],
    };
  });

  const night = useDerivedValue(() => nightAmount(sim.value.dayT));
  const moonTransform = useDerivedValue(() => [
    { translateX: width * 0.2 },
    { translateY: height * 0.16 - night.value * height * 0.04 },
  ]);
  const starsA = useDerivedValue(() => night.value * (0.65 + 0.35 * Math.sin(sim.value.t * 2.1)));
  const starsB = useDerivedValue(() => night.value * (0.65 + 0.35 * Math.sin(sim.value.t * 1.6 + 2)));

  const farTransform = useDerivedValue(() => {
    const s = sim.value;
    return [{ translateX: -((s.scrollX * FAR_PARALLAX) % farPeriod) }, { translateY: -s.camY * 0.12 }];
  });
  const nearTransform = useDerivedValue(() => {
    const s = sim.value;
    return [{ translateX: -((s.scrollX * NEAR_PARALLAX) % nearPeriod) }, { translateY: -s.camY * 0.35 }];
  });
  const farColor = useDerivedValue(() => palette.value.mountainFar);
  const nearColor = useDerivedValue(() => palette.value.mountainNear);

  // Birds flap by rebuilding a tiny path; hidden at night
  const birds = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    for (let i = 0; i < 3; i++) {
      const span = width + 200;
      const raw = width * (0.3 + i * 0.37) - s.t * (22 + i * 6) - s.scrollX * 0.05;
      const x = (((raw % span) + span) % span) - 100;
      const y = height * (0.12 + i * 0.07) + Math.sin(s.t * 1.3 + i) * 6;
      const size = 5 + i * 1.5;
      const flap = Math.sin(s.t * (7 + i) + i * 2) * size * 0.7;
      p.moveTo(x - size, y - flap * 0.6);
      p.quadTo(x - size * 0.5, y - flap, x, y);
      p.quadTo(x + size * 0.5, y - flap, x + size, y - flap * 0.6);
    }
  });
  const birdOpacity = useDerivedValue(() => 0.55 * (1 - night.value));

  return (
    <Group>
      {skyEffect ? (
        <Rect x={0} y={0} width={width} height={height}>
          <Shader source={skyEffect} uniforms={skyUniforms} />
        </Rect>
      ) : (
        <Rect x={0} y={0} width={width} height={height} color="#94D2F3" />
      )}

      {/* Stars & moon behind everything else */}
      <Path path={stars[0]} color="#FFFFFF" opacity={starsA} />
      <Path path={stars[1]} color="#FFF6D5" opacity={starsB} />
      <Group transform={moonTransform} opacity={night}>
        <Circle cx={0} cy={0} r={sunR * 1.8} color="rgba(220,230,255,0.12)" />
        <Path path={moonPath} color="#FFF8DC" />
      </Group>

      {/* Sun disk (its glow is part of the sky shader) */}
      <Group opacity={sunOpacity}>
        <Circle c={sunCenter} r={sunR * 1.25} color={sunGlowColor} />
        <Circle c={sunCenter} r={sunR} color={sunColor} />
      </Group>

      {CLOUDS.map((c, i) => (
        <Cloud
          key={i}
          sim={sim}
          palette={palette}
          path={cloudPaths[c.v]}
          index={i}
          width={width}
          height={height}
        />
      ))}

      <Path path={birds} color="#3B3440" style="stroke" strokeWidth={1.6} strokeCap="round" opacity={birdOpacity} />

      <Group transform={farTransform}>
        <Path path={farRidge} color={farColor} />
      </Group>
      <Group transform={nearTransform}>
        <Path path={nearRidge} color={nearColor} />
      </Group>
    </Group>
  );
});
