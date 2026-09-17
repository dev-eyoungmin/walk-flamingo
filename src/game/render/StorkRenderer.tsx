import React, { useMemo } from 'react';
import { Circle, Group, Oval, Path, Skia, SkPath, usePathValue } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { ANIM, MODE_FALLING, MODE_OVER } from '../sim/constants';
import { StorkAccessory } from './StorkAccessory';
import { STORK } from '../sim/storkGeometry';
import { DEFAULT_SKIN, SkinPalette } from '../../lib/skins';

/** The subset of simulation state the stork needs. SimState satisfies it; previews can fake it. */
export interface StorkPose {
  mode: number;
  t: number;
  angle: number;
  omega: number;
  walkPhase: number;
  danger: number;
  fallT: number;
  feetY: number;
  camY: number;
  slope: number;
  invulnT: number;
  happyT: number;
  hurtT: number;
  cheerT: number;
  lookX: number;
  lookY: number;
  /** Big wing flap after the flap action (counts down) */
  flapAnim?: number;
  /** Horizontal offset from `x` (used by the baby flamingos) */
  offsetX?: number;
}

interface Props {
  /** A SharedValue/DerivedValue holding the pose (only read inside worklets) */
  pose: { readonly value: StorkPose };
  unit: number;
  x: number;
  skin?: SkinPalette;
  shadow?: boolean;
}

const OUTLINE = '#3B1F2B';
const BEAK = '#FFE6D2';
const BEAK_TIP = '#2A2230';
const TAU = Math.PI * 2;

/** Builds a path from a flat list of commands scaled by U: ['M', x, y, 'C', x1, y1, x2, y2, x, y, 'Q', ..., 'L', ..., 'Z'] */
function shape(U: number, cmds: (string | number)[]): SkPath {
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

/** Filled neck that tapers from the body to the head along the NECK cubic. */
function taperedNeck(U: number, baseW: number, topW: number): SkPath {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = STORK.NECK;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  const N = 20;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const mt = 1 - t;
    const px = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
    const py = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
    const dx = 3 * mt * mt * (x1 - x0) + 6 * mt * t * (x2 - x1) + 3 * t * t * (x3 - x2);
    const dy = 3 * mt * mt * (y1 - y0) + 6 * mt * t * (y2 - y1) + 3 * t * t * (y3 - y2);
    const len = Math.hypot(dx, dy) || 1;
    const half = (baseW + (topW - baseW) * t) / 2;
    const nx = (-dy / len) * half;
    const ny = (dx / len) * half;
    left.push([(px + nx) * U, (py + ny) * U]);
    right.push([(px - nx) * U, (py - ny) * U]);
  }
  const p = Skia.Path.Make();
  p.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) p.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) p.lineTo(right[i][0], right[i][1]);
  p.close();
  return p;
}

export const StorkRenderer: React.FC<Props> = React.memo(({ pose, unit: U, x, skin = DEFAULT_SKIN, shadow = true }) => {
  const OW = U * 0.36; // outline width
  const legW = STORK.LEG_W * U;
  const thigh = STORK.THIGH * U;
  const shin = STORK.SHIN * U;
  const headX = STORK.HEAD_X * U;
  const headY = STORK.HEAD_Y * U;
  const headR = STORK.HEAD_R * U;
  const eyeX = headX + U * 0.85;
  const eyeY = headY - U * 0.55;
  const neckPivotX = STORK.NECK[0] * U;
  const neckPivotY = STORK.NECK[1] * U;
  const wingPivotX = U * 1.2;
  const wingPivotY = U * -5.0;
  const tailPivotX = U * -5.4;
  const tailPivotY = U * -5.6;

  const paths = useMemo(() => {
    const leg = (len: number) => {
      const p = Skia.Path.Make();
      p.moveTo(0, 0);
      p.lineTo(0, len);
      return p;
    };
    // Webbed foot pointing forward
    const foot = shape(U, ['M', -0.5, -0.15, 'Q', 1.3, -0.35, 2.5, 0.5, 'Q', 1.9, 0.75, 1.9, 0.95, 'Q', 0.6, 1.0, -0.45, 0.8, 'Z']);

    // Egg-shaped body with a swept-back tail tuft
    const body = shape(U, [
      'M', 3.6, -7.2,
      'C', 5.9, -6.2, 6.1, -1.3, 3.4, 0.6,
      'C', 1.0, 2.1, -3.6, 1.9, -5.3, -0.8,
      'C', -6.5, -2.6, -7.7, -4.5, -9.1, -6.5,
      'C', -7.3, -6.7, -6.3, -6.9, -5.6, -7.3,
      'C', -3.8, -8.7, 1.2, -8.9, 3.6, -7.2,
      'Z',
    ]);
    const bodyShade = shape(U, ['M', 6.5, -3.5, 'C', 5.5, 2.5, -3.0, 3.5, -7.0, -1.2, 'L', -7.0, 4.0, 'L', 6.5, 4.0, 'Z']);
    const belly = shape(U, ['M', 4.4, -4.6, 'C', 4.2, -1.6, 1.5, 0.2, -1.4, 0.4, 'C', 0.8, -1.2, 2.6, -3.0, 4.4, -4.6, 'Z']);

    // Extra tail feathers peeking out behind the body (they sway)
    const tail = shape(U, [
      'M', 0, 0, 'C', -1.6, -0.6, -3.0, -1.6, -3.9, -3.2, 'C', -2.4, -2.6, -1.0, -1.8, 0.4, -1.0, 'Z',
      'M', 0.2, 0.6, 'C', -1.4, 0.4, -3.2, -0.2, -4.4, -1.4, 'C', -2.8, -1.4, -1.2, -1.0, 0.4, -0.2, 'Z',
    ]);

    // Folded wing with scalloped feather edge (relative to its pivot)
    const wing = shape(U, [
      'M', 1.8, -0.6,
      'C', 0.6, -2.5, -4.6, -2.3, -7.3, 0.8,
      'Q', -5.8, 0.9, -5.1, 2.0,
      'Q', -3.9, 1.2, -2.9, 2.4,
      'Q', -1.6, 1.4, -0.5, 2.3,
      'Q', 1.1, 1.4, 1.8, -0.6,
      'Z',
    ]);
    const wingDetail = shape(U, ['M', -0.4, -0.2, 'Q', -2.6, 0.0, -4.6, 1.0]);

    const neck = taperedNeck(U, 1.75, 1.1);

    // Little feather tuft on the back of the head
    const tuft = shape(U, [
      'M', 1.9, -17.4, 'C', 0.6, -18.0, -0.3, -18.7, -0.1, -19.6, 'C', 0.7, -18.9, 1.7, -18.6, 2.8, -18.4, 'Z',
      'M', 2.5, -18.3, 'C', 1.5, -19.0, 1.1, -19.9, 1.5, -20.6, 'C', 2.0, -19.8, 2.8, -19.4, 3.7, -19.1, 'Z',
    ]);

    // Signature flamingo beak: thick at the base, sharply bent down, black tip
    const beak = shape(U, [
      'M', 6.7, -17.2,
      'C', 8.7, -17.5, 10.7, -16.9, 11.3, -15.0,
      'C', 11.7, -13.8, 11.3, -12.5, 10.5, -11.7,
      'C', 10.3, -12.9, 9.5, -13.9, 8.3, -14.2,
      'C', 7.6, -14.4, 7.0, -14.6, 6.4, -14.9,
      'Z',
    ]);
    const beakTip = shape(U, [
      'M', 10.9, -15.9,
      'C', 11.7, -14.4, 11.3, -12.5, 10.5, -11.7,
      'C', 10.4, -12.8, 10.0, -13.6, 9.3, -14.0,
      'C', 9.9, -14.5, 10.5, -15.1, 10.9, -15.9,
      'Z',
    ]);
    const beakLine = shape(U, ['M', 7.2, -15.6, 'Q', 8.6, -15.4, 9.6, -14.6]);

    const brows = shape(U, ['M', 4.3, -18.6, 'Q', 5.2, -18.2, 6.4, -18.9]);

    // Happy "^" eye and smile
    const happyEye = Skia.Path.Make();
    happyEye.moveTo(eyeX - U * 1.05, eyeY + U * 0.35);
    happyEye.quadTo(eyeX, eyeY - U * 1.1, eyeX + U * 1.05, eyeY + U * 0.35);
    const smile = shape(U, ['M', 5.3, -14.0, 'Q', 6.1, -13.1, 7.0, -13.8]);

    // Swirly dazed eye
    const hurtEye = Skia.Path.Make();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 4;
      const r = U * (0.15 + (i / 28) * 1.0);
      const px = eyeX + Math.cos(a) * r;
      const py = eyeY + Math.sin(a) * r;
      if (i === 0) hurtEye.moveTo(px, py);
      else hurtEye.lineTo(px, py);
    }

    const d = U * 0.7;
    const dizzy = Skia.Path.Make();
    dizzy.moveTo(eyeX - d, eyeY - d);
    dizzy.lineTo(eyeX + d, eyeY + d);
    dizzy.moveTo(eyeX + d, eyeY - d);
    dizzy.lineTo(eyeX - d, eyeY + d);

    return {
      thigh: leg(thigh),
      shin: leg(shin),
      foot,
      body,
      bodyShade,
      belly,
      tail,
      wing,
      wingDetail,
      neck,
      tuft,
      beak,
      beakTip,
      beakLine,
      brows,
      dizzy,
      happyEye,
      smile,
      hurtEye,
    };
  }, [U, thigh, shin, eyeX, eyeY]);

  // ── Transforms ──
  const root = useDerivedValue(() => {
    const p = pose.value;
    const falling = p.mode === MODE_FALLING || p.mode === MODE_OVER;
    const drop = falling ? p.fallT * p.fallT * 420 : 0;
    return [{ translateX: x + (p.offsetX ?? 0) }, { translateY: p.feetY - p.camY + drop }, { rotate: p.angle }];
  });

  const walk = useDerivedValue(() => pose.value.walkPhase * TAU);

  const hip = useDerivedValue(() => [{ translateY: STORK.HIP_Y * U }, { translateX: Math.sin(walk.value) * U * 0.3 }]);

  const body = useDerivedValue(() => {
    const p = pose.value;
    const w = walk.value;
    const bob = Math.sin(w * 2) * U * 0.45;
    // Walking squash plus a sharp squash right after getting hit
    const hit = p.hurtT > ANIM.HURT - 0.25 ? (p.hurtT - (ANIM.HURT - 0.25)) / 0.25 : 0;
    const squash = Math.sin(w * 2) * 0.03 + hit * 0.16;
    // A little hop when cheering
    const hop = p.cheerT > 0 ? -Math.abs(Math.sin(p.cheerT * 11)) * U * 0.8 : 0;
    return [
      { translateY: bob + hop },
      { rotate: -p.slope * 0.3 },
      { scaleX: 1 + squash },
      { scaleY: 1 - squash },
    ];
  });

  const makeLeg = (phase: number) => () => {
    'worklet';
    const w = walk.value + phase;
    const raw = Math.sin(w) + 0.3 * Math.sin(2 * w);
    return [{ translateY: -Math.abs(raw) * U * 0.3 }, { rotate: raw * 0.45 }];
  };
  const makeKnee = (phase: number) => () => {
    'worklet';
    const w = walk.value + phase;
    const s = Math.sin(w);
    const lift = Math.max(0, s);
    const contact = Math.max(0, -s);
    const bend = 0.35 + lift * 1.0 + contact * 0.3 + contact * 0.15 * Math.sin(w * 6);
    return [{ translateY: thigh }, { rotate: bend }];
  };
  const makeAnkle = (phase: number) => () => {
    'worklet';
    const s = Math.sin(walk.value + phase);
    return [{ translateY: shin }, { rotate: -Math.max(0, s) * 0.4 + Math.max(0, -s) * 0.25 - 0.35 }];
  };
  const backLeg = useDerivedValue(makeLeg(0));
  const frontLeg = useDerivedValue(makeLeg(Math.PI));
  const backKnee = useDerivedValue(makeKnee(0));
  const frontKnee = useDerivedValue(makeKnee(Math.PI));
  const backAnkle = useDerivedValue(makeAnkle(0));
  const frontAnkle = useDerivedValue(makeAnkle(Math.PI));

  const neck = useDerivedValue(() => {
    const p = pose.value;
    const w = walk.value;
    const counter = -p.angle * 0.12 - p.omega * 0.1 - p.omega * 0.06 * Math.sin(p.t * 12);
    const lean = -p.slope * 0.15;
    const headBob = -Math.sin(w * 2 + 0.4) * U * 0.25;
    // Birds pump their head forward with each step
    const thrust = Math.sin(w * 2 + 0.9) * U * 0.35;
    // Dazed wobble after a hit
    const daze = p.hurtT > 0 ? Math.sin(p.t * 14) * 0.12 * (p.hurtT / ANIM.HURT) : 0;
    return [
      { translateX: neckPivotX + thrust },
      { translateY: neckPivotY + headBob },
      { rotate: daze },
      { rotate: lean + counter },
      { translateX: -neckPivotX },
      { translateY: -neckPivotY },
    ];
  });

  const wing = useDerivedValue(() => {
    const p = pose.value;
    const freq = 2 + p.danger * 8;
    const amp = 0.06 + p.danger * 0.55;
    const flap = Math.sin(p.t * freq * TAU) * amp + Math.sin(walk.value * 2) * 0.04;
    // Positive rotation lifts the wing tip up and back
    let rotate = Math.abs(flap) + flap * 0.3;
    if (p.mode === MODE_FALLING) rotate = 0.9 + Math.abs(Math.sin(p.t * 30)) * 0.9;
    else if ((p.flapAnim ?? 0) > 0) {
      // Two strong beats of the wing
      const k = 1 - (p.flapAnim ?? 0) / 0.5;
      rotate = Math.abs(Math.sin(k * Math.PI * 2)) * 1.6;
    } else if (p.cheerT > 0) {
      // Wing thrown up in celebration
      const k = Math.min(1, p.cheerT / 0.2);
      rotate = rotate * (1 - k) + (1.25 + Math.abs(Math.sin(p.t * 20)) * 0.4) * k;
    }
    return [{ translateX: wingPivotX }, { translateY: wingPivotY }, { rotate }];
  });

  const tail = useDerivedValue(() => {
    const p = pose.value;
    const a = -p.omega * 0.2 + Math.sin(p.t * 1.5 * TAU) * 0.06;
    return [{ translateX: tailPivotX }, { translateY: tailPivotY }, { rotate: a }];
  });

  const alive = useDerivedValue(() => (pose.value.mode === MODE_FALLING || pose.value.mode === MODE_OVER ? 0 : 1));
  const dead = useDerivedValue(() => 1 - alive.value);

  const eye = useDerivedValue(() => {
    const p = pose.value;
    const blink = p.t % 3.4 < 0.12 ? 0.1 : 1;
    const widen = 1 + p.danger * 0.35;
    return [
      { translateX: eyeX },
      { translateY: eyeY },
      { scaleX: widen },
      { scaleY: widen * blink },
      { translateX: -eyeX },
      { translateY: -eyeY },
    ];
  });
  const pupilR = useDerivedValue(() => U * (0.72 - pose.value.danger * 0.3));
  const pupilX = useDerivedValue(() => eyeX + pose.value.lookX * U * 0.42);
  const pupilY = useDerivedValue(() => eyeY + U * 0.05 + pose.value.lookY * U * 0.35);

  // Expression layers: dead > hurt > happy > normal
  const hurtFace = useDerivedValue(() => (alive.value > 0 && pose.value.hurtT > 0 ? 1 : 0));
  const happyFace = useDerivedValue(() =>
    alive.value > 0 && hurtFace.value === 0 && pose.value.happyT > 0 && pose.value.danger < 0.6 ? 1 : 0,
  );
  const normalFace = useDerivedValue(() => alive.value * (1 - hurtFace.value) * (1 - happyFace.value));
  const cheekOpacity = useDerivedValue(() => 0.5 + happyFace.value * 0.3);

  // Dizzy stars circling the head after a hit
  const dizzyStars = usePathValue((path) => {
    'worklet';
    const p = pose.value;
    if (p.hurtT <= 0 || p.mode === MODE_FALLING || p.mode === MODE_OVER) return;
    const cx = headX - U * 0.3;
    const cy = headY - headR - U * 1.4;
    const size = U * 1.1 * Math.min(1, p.hurtT / 0.3);
    for (let i = 0; i < 3; i++) {
      const a = p.t * 6 + (i / 3) * TAU;
      const x = cx + Math.cos(a) * U * 3.8;
      const y = cy + Math.sin(a) * U * 1.1;
      for (let k = 0; k < 10; k++) {
        const ang = -Math.PI / 2 + (k / 10) * TAU;
        const r = k % 2 === 0 ? size : size * 0.45;
        const sx = x + Math.cos(ang) * r;
        const sy = y + Math.sin(ang) * r;
        if (k === 0) path.moveTo(sx, sy);
        else path.lineTo(sx, sy);
      }
      path.close();
    }
  });
  const browOpacity = useDerivedValue(() => Math.min(1, Math.max(0, (pose.value.danger - 0.4) * 3)));
  const mouth = useDerivedValue(() => {
    const open = Math.max(0, (pose.value.danger - 0.7) / 0.3);
    const cx = headX + U * 1.6;
    const cy = headY + U * 1.6;
    return [{ translateX: cx }, { translateY: cy }, { scaleY: open }, { translateX: -cx }, { translateY: -cy }];
  });
  const mouthOpacity = useDerivedValue(() => (pose.value.danger > 0.7 ? 1 : 0));

  const shadowTransform = useDerivedValue(() => {
    const p = pose.value;
    return [{ translateX: x + (p.offsetX ?? 0) + Math.sin(p.angle) * U * 4 }, { translateY: p.feetY - p.camY + U * 0.5 }];
  });
  const shadowOpacity = useDerivedValue(() => {
    const p = pose.value;
    const falling = p.mode === MODE_FALLING || p.mode === MODE_OVER;
    return falling ? Math.max(0, 1 - p.fallT * 3) : 1;
  });
  const shadowWidth = useDerivedValue(() => U * 11 * (1 - pose.value.danger * 0.25));
  const shadowX = useDerivedValue(() => -shadowWidth.value / 2);

  const bubbleOpacity = useDerivedValue(() => {
    const p = pose.value;
    return p.invulnT > 0 ? 0.35 + 0.25 * Math.sin(p.t * 20) : 0;
  });

  // Outlines are separate stroke draws (child <Paint> nodes would ignore group opacity)
  const outlined = (path: SkPath, fill: string, width = OW) => (
    <>
      <Path path={path} color={fill} />
      <Path path={path} color={OUTLINE} style="stroke" strokeWidth={width} strokeJoin="round" />
    </>
  );
  const legStroke = (path: SkPath, color: string) => (
    <>
      <Path path={path} color={OUTLINE} style="stroke" strokeWidth={legW + OW * 2} strokeCap="round" />
      <Path path={path} color={color} style="stroke" strokeWidth={legW} strokeCap="round" />
    </>
  );

  const renderLeg = (
    legTr: typeof backLeg,
    kneeTr: typeof backKnee,
    ankleTr: typeof backAnkle,
    color: string,
  ) => (
    <Group transform={legTr}>
      {legStroke(paths.thigh, color)}
      <Group transform={kneeTr}>
        {legStroke(paths.shin, color)}
        <Circle cx={0} cy={0} r={legW * 0.85} color={color} />
        <Circle cx={0} cy={0} r={legW * 0.85} color={OUTLINE} style="stroke" strokeWidth={OW * 0.8} />
        <Group transform={ankleTr}>{outlined(paths.foot, color)}</Group>
      </Group>
    </Group>
  );

  return (
    <Group>
      {shadow && (
        <Group transform={shadowTransform} opacity={shadowOpacity}>
          <Oval x={shadowX} y={-U * 0.8} width={shadowWidth} height={U * 1.6} color="rgba(30,20,40,0.22)" />
        </Group>
      )}
      <Group transform={root}>
        <Group transform={hip}>
          {renderLeg(backLeg, backKnee, backAnkle, skin.legsDark)}
          {renderLeg(frontLeg, frontKnee, frontAnkle, skin.legs)}

          <Group transform={body}>
            <Group transform={tail}>{outlined(paths.tail, skin.wing)}</Group>

            {/* Neck sits behind the body so the body outline covers its base */}
            <Group transform={neck}>{outlined(paths.neck, skin.neck)}</Group>

            <Path path={paths.body} color={skin.body} />
            <Group clip={paths.body}>
              <Path path={paths.bodyShade} color={skin.legsDark} opacity={0.22} />
              <Path path={paths.belly} color={skin.bodyLight} opacity={0.9} />
              <Oval x={-U * 3.6} y={U * -8.2} width={U * 4.2} height={U * 2.2} color={skin.bodyLight} opacity={0.75} />
            </Group>
            <Path path={paths.body} color={OUTLINE} style="stroke" strokeWidth={OW} strokeJoin="round" />

            <Group transform={wing}>
              {outlined(paths.wing, skin.wing)}
              <Path path={paths.wingDetail} color={OUTLINE} style="stroke" strokeWidth={OW * 0.6} strokeCap="round" opacity={0.4} />
            </Group>

            <Group transform={neck}>
              {outlined(paths.tuft, skin.wing, OW * 0.8)}
              <Circle cx={headX} cy={headY} r={headR} color={skin.body} />
              <Circle cx={headX - U * 1.1} cy={headY - U * 1.2} r={U * 1.1} color={skin.bodyLight} opacity={0.9} />
              <Circle cx={headX} cy={headY} r={headR} color={OUTLINE} style="stroke" strokeWidth={OW} />
              <Oval x={headX + U * 0.4} y={headY + U * 0.6} width={U * 1.8} height={U * 1.0} color={skin.cheek} opacity={cheekOpacity} />

              {outlined(paths.beak, BEAK)}
              <Path path={paths.beakTip} color={BEAK_TIP} />
              <Path path={paths.beakLine} color={OUTLINE} style="stroke" strokeWidth={OW * 0.5} strokeCap="round" opacity={0.35} />

              <Group opacity={normalFace}>
                <Group transform={eye}>
                  <Circle cx={eyeX} cy={eyeY} r={U * 1.25} color="#FFFFFF" />
                  <Circle cx={eyeX} cy={eyeY} r={U * 1.25} color={OUTLINE} style="stroke" strokeWidth={OW * 0.65} />
                  <Circle cx={pupilX} cy={pupilY} r={pupilR} color="#1A1420" />
                  <Circle cx={eyeX + U * 0.55} cy={eyeY - U * 0.35} r={U * 0.26} color="#FFFFFF" />
                  <Circle cx={eyeX + U * 0.05} cy={eyeY + U * 0.35} r={U * 0.12} color="#FFFFFF" />
                </Group>
              </Group>
              <Group opacity={happyFace}>
                <Path path={paths.happyEye} color={OUTLINE} style="stroke" strokeWidth={OW * 1.25} strokeCap="round" />
                <Path path={paths.smile} color={OUTLINE} style="stroke" strokeWidth={OW * 0.9} strokeCap="round" />
              </Group>
              <Group opacity={hurtFace}>
                <Circle cx={eyeX} cy={eyeY} r={U * 1.25} color="#FFFFFF" />
                <Path path={paths.hurtEye} color={OUTLINE} style="stroke" strokeWidth={OW * 0.7} strokeCap="round" />
              </Group>
              <Group opacity={alive}>
                <Path path={paths.brows} color={OUTLINE} style="stroke" strokeWidth={OW * 0.85} strokeCap="round" opacity={browOpacity} />
                <Group transform={mouth} opacity={mouthOpacity}>
                  <Oval x={headX + U * 1.1} y={headY + U * 1.2} width={U * 1.0} height={U * 0.9} color="#B8324A" />
                </Group>
              </Group>
              <Path path={paths.dizzy} color={OUTLINE} style="stroke" strokeWidth={OW * 0.9} strokeCap="round" opacity={dead} />
              {skin.accessory && <StorkAccessory type={skin.accessory} U={U} pose={pose} />}
              <Path path={dizzyStars} color="#FFD84A" />
              <Path path={dizzyStars} color={OUTLINE} style="stroke" strokeWidth={OW * 0.6} strokeJoin="round" />
            </Group>
          </Group>
        </Group>
        <Circle cx={U * 1} cy={(STORK.HIP_Y + STORK.BODY_Y) * U} r={U * 12} color="#7FDBFF" style="stroke" strokeWidth={U * 0.5} opacity={bubbleOpacity} />
      </Group>
    </Group>
  );
});
