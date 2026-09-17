import React, { useMemo } from 'react';
import { Circle, Group, Path, RoundedRect, Skia, SkPath, usePathValue } from '@shopify/react-native-skia';
import type { SkinAccessory } from '../../lib/skins';
import type { StorkPose } from './StorkRenderer';

const OUTLINE = '#3B1F2B';

interface Props {
  type: SkinAccessory;
  /** Stork unit in px */
  U: number;
  pose: { readonly value: StorkPose };
}

function scaled(U: number, cmds: (string | number)[]): SkPath {
  const p = Skia.Path.Make();
  let i = 0;
  const n = () => (cmds[i++] as number) * U;
  while (i < cmds.length) {
    const c = cmds[i++];
    if (c === 'M') p.moveTo(n(), n());
    else if (c === 'L') p.lineTo(n(), n());
    else if (c === 'Q') p.quadTo(n(), n(), n(), n());
    else if (c === 'C') p.cubicTo(n(), n(), n(), n(), n(), n());
    else if (c === 'Z') p.close();
  }
  return p;
}

/**
 * Skin accessories. Drawn inside the stork's neck/head group, so coordinates are hip-relative
 * and they follow the head's motion automatically.
 */
export const StorkAccessory: React.FC<Props> = ({ type, U, pose }) => {
  const ow = U * 0.3;
  const art = useMemo(() => {
    return {
      crown: scaled(U, ['M', -1.9, 0.5, 'L', -2.2, -1.7, 'L', -1.0, -0.6, 'L', 0, -2.3, 'L', 1.0, -0.6, 'L', 2.2, -1.7, 'L', 1.9, 0.5, 'Z']),
      crownBand: scaled(U, ['M', -1.95, 0.0, 'L', 1.95, 0.0, 'L', 1.9, 0.5, 'L', -1.9, 0.5, 'Z']),
      lens: scaled(U, ['M', 3.5, -17.1, 'Q', 5.2, -17.6, 6.8, -17.0, 'Q', 7.0, -15.4, 5.6, -15.0, 'Q', 4.0, -14.9, 3.6, -15.9, 'Z']),
      lensGlint: scaled(U, ['M', 4.1, -16.6, 'Q', 4.8, -16.9, 5.6, -16.8]),
      temple: scaled(U, ['M', 3.6, -16.5, 'L', 1.6, -16.1]),
      bowLoops: scaled(U, [
        'M', 0, 0, 'C', -0.8, -1.5, -2.4, -1.3, -2.3, 0, 'C', -2.4, 1.3, -0.8, 1.5, 0, 0, 'Z',
        'M', 0, 0, 'C', 0.8, -1.5, 2.4, -1.3, 2.3, 0, 'C', 2.4, 1.3, 0.8, 1.5, 0, 0, 'Z',
      ]),
    };
  }, [U]);

  // Scarf tails ripple harder the faster the flamingo walks
  const scarfTails = usePathValue((p) => {
    'worklet';
    if (type !== 'scarf') return;
    const s = pose.value;
    const knotX = 2.7 * U;
    const knotY = -8.4 * U;
    const flutter = 0.35 * U + Math.min(1.5, Math.abs(s.omega) * 0.3) * U * 0.3;
    for (let tail = 0; tail < 2; tail++) {
      const len = (tail === 0 ? 4.4 : 3.4) * U;
      const dirX = -0.94;
      const dirY = tail === 0 ? 0.34 : 0.62;
      const nx = -dirY;
      const ny = dirX;
      const halfW = 0.45 * U;
      const N = 8;
      const left: number[] = [];
      const right: number[] = [];
      for (let i = 0; i <= N; i++) {
        const k = i / N;
        const wave = Math.sin(s.t * 9 - k * 5 + tail * 1.7) * flutter * k;
        const cx = knotX + dirX * len * k + nx * wave;
        const cy = knotY + dirY * len * k + ny * wave;
        const w = halfW * (1 - k * 0.3);
        left.push(cx + nx * w, cy + ny * w);
        right.push(cx - nx * w, cy - ny * w);
      }
      p.moveTo(left[0], left[1]);
      for (let i = 1; i <= N; i++) p.lineTo(left[i * 2], left[i * 2 + 1]);
      for (let i = N; i >= 0; i--) p.lineTo(right[i * 2], right[i * 2 + 1]);
      p.close();
    }
  });

  if (type === 'crown') {
    return (
      <Group transform={[{ translateX: 3.5 * U }, { translateY: -18.7 * U }, { rotate: -0.25 }]}>
        <Path path={art.crown} color="#FFC93C" />
        <Path path={art.crownBand} color="#E0A21A" />
        <Path path={art.crown} color={OUTLINE} style="stroke" strokeWidth={ow} strokeJoin="round" />
        <Circle cx={0} cy={0.1 * U} r={0.38 * U} color="#FF4D6D" />
        <Circle cx={-2.2 * U} cy={-1.7 * U} r={0.32 * U} color="#FFF3B0" />
        <Circle cx={0} cy={-2.3 * U} r={0.32 * U} color="#FFF3B0" />
        <Circle cx={2.2 * U} cy={-1.7 * U} r={0.32 * U} color="#FFF3B0" />
      </Group>
    );
  }

  if (type === 'shades') {
    return (
      <Group>
        <Path path={art.temple} color={OUTLINE} style="stroke" strokeWidth={ow * 1.3} strokeCap="round" />
        <Path path={art.lens} color="#1A1420" />
        <Path path={art.lens} color={OUTLINE} style="stroke" strokeWidth={ow} strokeJoin="round" />
        <Path path={art.lensGlint} color="rgba(255,255,255,0.75)" style="stroke" strokeWidth={ow * 0.9} strokeCap="round" />
      </Group>
    );
  }

  if (type === 'flower') {
    const cx = 1.6 * U;
    const cy = -18.3 * U;
    return (
      <Group>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          return <Circle key={i} cx={cx + Math.cos(a) * 0.95 * U} cy={cy + Math.sin(a) * 0.95 * U} r={0.85 * U} color="#FF5E7E" />;
        })}
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          return (
            <Circle
              key={`o${i}`}
              cx={cx + Math.cos(a) * 0.95 * U}
              cy={cy + Math.sin(a) * 0.95 * U}
              r={0.85 * U}
              color={OUTLINE}
              style="stroke"
              strokeWidth={ow * 0.7}
              opacity={0.55}
            />
          );
        })}
        <Circle cx={cx} cy={cy} r={0.5 * U} color="#FFE14D" />
      </Group>
    );
  }

  if (type === 'bow') {
    return (
      <Group transform={[{ translateX: 2.3 * U }, { translateY: -19.0 * U }, { rotate: -0.35 }]}>
        <Path path={art.bowLoops} color="#FFF4F7" />
        <Path path={art.bowLoops} color={OUTLINE} style="stroke" strokeWidth={ow} strokeJoin="round" />
        <Circle cx={-1.4 * U} cy={-0.3 * U} r={0.24 * U} color="#FF1744" />
        <Circle cx={-1.2 * U} cy={0.5 * U} r={0.2 * U} color="#FF1744" />
        <Circle cx={1.4 * U} cy={-0.3 * U} r={0.24 * U} color="#FF1744" />
        <Circle cx={1.2 * U} cy={0.5 * U} r={0.2 * U} color="#FF1744" />
        <Circle cx={0} cy={0} r={0.55 * U} color="#FF1744" />
        <Circle cx={0} cy={0} r={0.55 * U} color={OUTLINE} style="stroke" strokeWidth={ow * 0.8} />
      </Group>
    );
  }

  // Scarf: band wraps the lower neck, two tails flutter behind
  return (
    <Group>
      <Path path={scarfTails} color="#E84A5F" />
      <Path path={scarfTails} color={OUTLINE} style="stroke" strokeWidth={ow} strokeJoin="round" />
      <Group transform={[{ translateX: 3.9 * U }, { translateY: -8.0 * U }, { rotate: 0.4 }]}>
        <RoundedRect x={-1.9 * U} y={-0.8 * U} width={3.8 * U} height={1.6 * U} r={0.7 * U} color="#E84A5F" />
        <RoundedRect x={-1.0 * U} y={-0.8 * U} width={0.5 * U} height={1.6 * U} r={0.1 * U} color="#FFFFFF" />
        <RoundedRect x={0.5 * U} y={-0.8 * U} width={0.5 * U} height={1.6 * U} r={0.1 * U} color="#FFFFFF" />
        <RoundedRect x={-1.9 * U} y={-0.8 * U} width={3.8 * U} height={1.6 * U} r={0.7 * U} color={OUTLINE} style="stroke" strokeWidth={ow} />
      </Group>
    </Group>
  );
};
