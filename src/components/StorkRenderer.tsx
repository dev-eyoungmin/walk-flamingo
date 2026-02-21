import React from 'react';
import {
  Group,
  Circle,
  Path,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface StorkRendererProps {
  width: number;
  height: number;
  angle: SharedValue<number>;
  animFrame: SharedValue<number>;
  elapsedTime: SharedValue<number>;
}

/**
 * Flamingo character — rigid-body rotation like original game.
 *
 * Structure:
 *   1. Shadow (world space — always flat on ground)
 *   2. Character (rotates as rigid body around feet)
 *      ├── Legs (walk swing + knee flex)
 *      └── Upper body (extra hip tilt + neck/head cascade)
 */
export const StorkRenderer: React.FC<StorkRendererProps> = ({
  width,
  height,
  angle,
  animFrame,
  elapsedTime,
}) => {
  const groundY = height * 0.65;
  const cx = width / 2;
  const pivotY = groundY;

  const U = Math.min(width, height) * 0.02;
  const WALK_HZ = 3.0;
  const TAU = Math.PI * 2;
  const LEG_SWING = 0.28;

  // ── Leg segments ──
  const upperLegLen = U * 6.5;
  const lowerLegLen = U * 6.5;
  const upperLegW = U * 1.1;
  const lowerLegW = U * 0.85;
  const kneeR = U * 0.85;
  const ankleR = U * 0.6;
  const hipSpread = U * 1.5;

  // ── Body ──
  const hipY = pivotY - (upperLegLen + lowerLegLen);
  const bodyW = U * 5.0;
  const bodyH = U * 5.5;
  const bodyCY = hipY - bodyH * 0.15;

  // ── Neck / Head ──
  const headR = U * 2.8;
  const headCX = cx + U * 1.8;
  const headCY = bodyCY - bodyH * 0.35 - U * 6;
  const neckBaseY = bodyCY - bodyH * 0.25;

  // ── Colors (Flamingo) ──
  const C_BODY = '#FF7A9A';
  const C_BODY_LIGHT = '#FFA0B8';
  const C_LEG = '#E86A6A';
  const C_LEG_DARK = '#D05A5A';
  const C_JOINT = '#CC5555';
  const C_JOINT_DARK = '#B84A4A';
  const C_WING = '#E8658A';
  const C_NECK = '#FF7A9A';
  const C_BEAK = '#FF8845';
  const C_BEAK_TIP = '#2A2A2A';
  const C_EYE_W = '#FFFFFF';
  const C_EYE_B = '#1A1A1A';
  const C_CHEEK = '#FF5070';
  const C_SHADOW = 'rgba(0,0,0,0.10)';
  const C_TAIL = '#FF6585';

  // ════════════ TRANSFORMS ════════════

  // Rigid-body rotation around feet (like original game)
  const rootTr = useDerivedValue(() => [
    { translateX: cx },
    { translateY: pivotY },
    { rotate: angle.value },
    { translateX: -cx },
    { translateY: -pivotY },
  ]);

  // ── BACK LEG ──

  const backHipTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const swing = Math.sin(t) * LEG_SWING;
    const counter = -angle.value * 0.15;
    return [
      { translateX: cx - hipSpread },
      { translateY: hipY },
      { rotate: swing + counter },
    ];
  });

  const backKneeTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const sinT = Math.sin(t);
    const walkFlex = -(0.12 + Math.max(0, sinT) * 0.5);
    const tiltFlex = -Math.abs(angle.value) * 0.25;
    return [
      { translateY: upperLegLen },
      { rotate: walkFlex + tiltFlex },
    ];
  });

  // ── FRONT LEG ──

  const frontHipTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const swing = Math.sin(t + Math.PI) * LEG_SWING;
    const counter = -angle.value * 0.1;
    return [
      { translateX: cx + hipSpread },
      { translateY: hipY },
      { rotate: swing + counter },
    ];
  });

  const frontKneeTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const sinT = Math.sin(t + Math.PI);
    const walkFlex = -(0.12 + Math.max(0, sinT) * 0.5);
    const tiltFlex = -Math.abs(angle.value) * 0.25;
    return [
      { translateY: upperLegLen },
      { rotate: walkFlex + tiltFlex },
    ];
  });

  // ── BODY ──

  // Extra hip tilt + walk bob
  const bodyTiltTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const bob = -Math.abs(Math.sin(t)) * U * 0.5;
    const extraTilt = angle.value * 0.22;
    return [
      { translateY: bob },
      { rotate: extraTilt },
    ];
  });

  // Wing: lifts when tilting (balance reflex)
  const wingReactTr = useDerivedValue(() => {
    const absA = Math.abs(angle.value);
    const lift = -absA * U * 3;
    const wingRot = angle.value > 0 ? -absA * 0.3 : absA * 0.3;
    return [
      { translateY: lift },
      { rotate: wingRot },
    ];
  });

  // Neck+Head: cascading whip flop
  const neckHeadTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const sway = Math.sin(t * 0.5 + 0.9) * U * 0.25;
    const nod = Math.sin(t + 0.5) * U * 0.3;
    const flopRot = angle.value * 0.35;
    const flopX = angle.value * U * 1.2;
    return [
      { translateX: sway + flopX },
      { translateY: nod },
      { rotate: flopRot },
    ];
  });

  // Eye panic: pupils shift toward fall
  const eyePanicTr = useDerivedValue(() => {
    const maxShift = U * 0.4; // white radius - pupil radius
    let lookX = angle.value * U * 2;
    let lookY = Math.abs(angle.value) * U * 0.8;
    const dist = Math.sqrt(lookX * lookX + lookY * lookY);
    if (dist > maxShift) {
      const s = maxShift / dist;
      lookX *= s;
      lookY *= s;
    }
    return [
      { translateX: lookX },
      { translateY: lookY },
    ];
  });

  // ════════════ STATIC PATHS ════════════

  const upperLegPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const hw = upperLegW / 2;
    p.moveTo(-hw, 0);
    p.lineTo(-hw, upperLegLen);
    p.lineTo(hw, upperLegLen);
    p.lineTo(hw, 0);
    p.close();
    return p;
  }, [upperLegW, upperLegLen]);

  const lowerLegPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const hw = lowerLegW / 2;
    const curveX = -U * 0.8;
    p.moveTo(-hw, 0);
    p.quadTo(-hw + curveX, lowerLegLen * 0.5, -hw, lowerLegLen);
    p.lineTo(hw, lowerLegLen);
    p.quadTo(hw + curveX, lowerLegLen * 0.5, hw, 0);
    p.close();
    return p;
  }, [lowerLegW, lowerLegLen, U]);

  const footPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const fw = U * 2.2;
    const fh = U * 0.8;
    p.moveTo(-fw * 0.3, lowerLegLen);
    p.lineTo(fw, lowerLegLen);
    p.lineTo(fw * 0.5, lowerLegLen + fh);
    p.lineTo(-fw * 0.3, lowerLegLen);
    p.close();
    return p;
  }, [lowerLegLen, U]);

  const bodyPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.addOval({
      x: cx - bodyW,
      y: bodyCY - bodyH / 2,
      width: bodyW * 2,
      height: bodyH,
    });
    return p;
  }, [cx, bodyCY, bodyW, bodyH]);

  const wingPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const ww = bodyW * 0.75;
    const wh = bodyH * 0.55;
    p.addOval({
      x: cx - ww * 0.4,
      y: bodyCY - wh / 2 + U * 0.3,
      width: ww * 1.5,
      height: wh,
    });
    return p;
  }, [cx, bodyCY, bodyW, bodyH, U]);

  const neckPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const nw = U * 1.4;
    const nsx = cx + U * 0.5;
    const nsy = neckBaseY;
    const nex = headCX;
    const ney = headCY + headR * 0.6;

    p.moveTo(nsx - nw, nsy);
    p.cubicTo(
      nsx - nw + U * 2.5, nsy - U * 3.5,
      nex - nw - U * 1.2, ney + U * 3.0,
      nex - nw * 0.7, ney,
    );
    p.lineTo(nex + nw * 0.7, ney);
    p.cubicTo(
      nex + nw - U * 1.2, ney + U * 3.0,
      nsx + nw + U * 2.5, nsy - U * 3.5,
      nsx + nw, nsy,
    );
    p.close();
    return p;
  }, [cx, neckBaseY, headCX, headCY, headR, U]);

  const beakPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const bx = headCX + headR * 0.55;
    const by = headCY + U * 0.15;
    const bLen = U * 5.5;
    p.moveTo(bx, by - U * 0.55);
    p.quadTo(bx + bLen * 0.7, by - U * 0.55, bx + bLen * 0.55, by + U * 0.8);
    p.quadTo(bx + bLen * 0.15, by + U * 0.55, bx, by + U * 0.4);
    p.close();
    return p;
  }, [headCX, headCY, headR, U]);

  const beakTipPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const bx = headCX + headR * 0.55;
    const by = headCY + U * 0.15;
    const bLen = U * 5.5;
    p.moveTo(bx + bLen * 0.35, by - U * 0.15);
    p.quadTo(bx + bLen * 0.7, by - U * 0.45, bx + bLen * 0.55, by + U * 0.8);
    p.quadTo(bx + bLen * 0.3, by + U * 0.6, bx + bLen * 0.35, by + U * 0.2);
    p.close();
    return p;
  }, [headCX, headCY, headR, U]);

  const tailPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    const tx = cx - bodyW * 0.75;
    const ty = bodyCY - U * 0.3;
    p.moveTo(tx, ty);
    p.quadTo(tx - U * 3.5, ty - U * 3, tx - U * 2.5, ty - U * 4.5);
    p.quadTo(tx - U * 1.2, ty - U * 3, tx + U * 0.5, ty - U * 0.3);
    p.close();
    p.moveTo(tx, ty + U * 0.5);
    p.quadTo(tx - U * 4, ty - U * 0.5, tx - U * 3, ty - U * 3);
    p.quadTo(tx - U * 1.8, ty - U * 0.5, tx + U * 0.3, ty + U * 0.3);
    p.close();
    return p;
  }, [cx, bodyCY, bodyW, U]);

  const shadowPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.addOval({
      x: cx - U * 5,
      y: pivotY - U * 0.5,
      width: U * 10,
      height: U * 1.4,
    });
    return p;
  }, [cx, pivotY, U]);

  const eyeX = headCX + U * 0.5;
  const eyeY = headCY - U * 0.3;

  return (
    <Group>
      {/* Shadow — world space, always flat on ground */}
      <Path path={shadowPath} color={C_SHADOW} />

      {/* ═══ CHARACTER (rigid body, rotates around feet) ═══ */}
      <Group transform={rootTr}>

        {/* ═══ BACK LEG ═══ */}
        <Group transform={backHipTr}>
          <Circle cx={0} cy={0} r={kneeR * 0.7} color={C_JOINT_DARK} />
          <Path path={upperLegPath} color={C_LEG_DARK} />
          <Group transform={backKneeTr}>
            <Circle cx={0} cy={0} r={kneeR} color={C_JOINT_DARK} />
            <Path path={lowerLegPath} color={C_LEG_DARK} />
            <Circle cx={0} cy={lowerLegLen} r={ankleR} color={C_JOINT_DARK} />
            <Path path={footPath} color={C_LEG_DARK} />
          </Group>
        </Group>

        {/* ═══ FRONT LEG ═══ */}
        <Group transform={frontHipTr}>
          <Circle cx={0} cy={0} r={kneeR * 0.7} color={C_JOINT} />
          <Path path={upperLegPath} color={C_LEG} />
          <Group transform={frontKneeTr}>
            <Circle cx={0} cy={0} r={kneeR} color={C_JOINT} />
            <Path path={lowerLegPath} color={C_LEG} />
            <Circle cx={0} cy={lowerLegLen} r={ankleR} color={C_JOINT} />
            <Path path={footPath} color={C_LEG} />
          </Group>
        </Group>

        {/* ═══ UPPER BODY (extra tilt at hip) ═══ */}
        <Group transform={bodyTiltTr} origin={vec(cx, hipY)}>
          <Path path={tailPath} color={C_TAIL} />

          {/* ═══ NECK + HEAD (behind body) ═══ */}
          <Group
            transform={neckHeadTr}
            origin={vec(cx + U * 0.5, neckBaseY)}
          >
            <Path path={neckPath} color={C_NECK} />
            <Circle cx={headCX} cy={headCY} r={headR} color={C_BODY} />
            <Circle
              cx={headCX - U * 0.5}
              cy={headCY - U * 0.8}
              r={U * 1.0}
              color={C_BODY_LIGHT}
            />
            <Circle
              cx={headCX + U * 0.2}
              cy={headCY + U * 1.2}
              r={U * 0.8}
              color={C_CHEEK}
            />
            <Path path={beakPath} color={C_BEAK} />
            <Path path={beakTipPath} color={C_BEAK_TIP} />
            <Circle cx={eyeX} cy={eyeY} r={U * 0.95} color={C_EYE_W} />
            <Group transform={eyePanicTr}>
              <Circle cx={eyeX} cy={eyeY} r={U * 0.52} color={C_EYE_B} />
            </Group>
            <Circle
              cx={eyeX + U * 0.25}
              cy={eyeY - U * 0.2}
              r={U * 0.16}
              color={C_EYE_W}
            />
          </Group>

          <Path path={bodyPath} color={C_BODY} />

          <Group transform={wingReactTr} origin={vec(cx, bodyCY)}>
            <Path path={wingPath} color={C_WING} />
          </Group>

          <Circle
            cx={cx - bodyW * 0.25}
            cy={bodyCY - bodyH * 0.15}
            r={U * 1.8}
            color={C_BODY_LIGHT}
          />
        </Group>

      </Group>
    </Group>
  );
};
