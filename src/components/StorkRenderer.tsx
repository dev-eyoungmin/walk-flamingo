import React, { useMemo } from 'react';
import { Group, Circle, Path, Rect, RoundedRect, Oval, Skia } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface StorkRendererProps {
  width: number;
  height: number;
  angle: SharedValue<number>;
  animFrame: SharedValue<number>;
  elapsedTime: SharedValue<number>;
}

export const StorkRenderer: React.FC<StorkRendererProps> = ({
  width,
  height,
  angle,
  animFrame,
  elapsedTime,
}) => {
  const cx = width / 2;
  const groundY = height * 0.75;

  // Unit scale
  const U = Math.min(width, height) * 0.02;
  const WALK_HZ = 1.2;
  const TAU = Math.PI * 2;
  const LEG_SWING = 0.35;

  // Colors
  const C_BODY = '#FF7A9A';
  const C_BODY_LIGHT = '#FFA0B8';
  const C_LEG = '#E86A6A';
  const C_LEG_DARK = '#D05A5A';
  const C_NECK = '#FF7A9A';
  const C_BEAK = '#FF8845';
  const C_BEAK_TIP = '#2A2A2A';
  const C_EYE_W = '#FFFFFF';
  const C_EYE_B = '#1A1A1A';
  const C_CHEEK = '#FF5070';
  const C_SHADOW = 'rgba(0,0,0,0.15)';
  const C_WING = '#E8658A';

  // Dimensions — SVG-matched proportions: long legs + original body/head sizes
  const thighLen = U * 6.5;
  const shinLen = U * 6.5;
  const totalLegLen = thighLen + shinLen;
  const legW = U * 0.65;

  const bodyRx = U * 5.0;
  const bodyRy = U * 4.5;
  const bodyYOffset = -U * 3.5;

  const headR = U * 2.8;
  const headX = U * 4.5;
  const headY = -U * 16;

  // ════════════ TRANSFORMS (Hierarchical) ════════════

  // 1. Root: Moves to Ground Pivot (cx, groundY) and rotates the whole bird
  const rootTr = useDerivedValue(() => [
    { translateX: cx },
    { translateY: groundY },
    { rotate: angle.value }
  ]);

  // 2. Hip: Moves UP from Ground to Hip height.
  // All body parts attach here (0,0 is now the Hip).
  const hipTr = useDerivedValue(() => [
    { translateY: -totalLegLen }
  ]);

  // 3. Body: Bobs + sways with tilt (inertia)
  const bodyBobTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const bob = Math.sin(t * 2) * U * 0.2;
    const sway = angle.value * U * 0.8;          // horizontal drift when tilting
    return [
      { translateX: sway },
      { translateY: bob },
      { rotate: angle.value * 0.35 },            // increased body inertia tilt
    ];
  });

  // 3b. Neck+Head: Extra whiplash sway (rotates around neck base)
  const neckBaseX = U * 1.5;
  const neckBaseY = bodyYOffset - bodyRy * 0.7;
  const neckSwayTr = useDerivedValue(() => {
    const wobble = Math.sin(elapsedTime.value * 5) * angle.value * 0.2;
    const neckTilt = angle.value * 0.6 + wobble;
    return [
      { translateX: neckBaseX },
      { translateY: neckBaseY },
      { rotate: neckTilt },
      { translateX: -neckBaseX },
      { translateY: -neckBaseY },
    ];
  });

  // 3c. Face zoom/shake: periodic cycle (~10s), stronger shake when zoomed
  const faceZoomTr = useDerivedValue(() => {
    const t = elapsedTime.value;
    const cycle = (Math.sin(t * 0.63) + 1) * 0.5; // 0~1, ~10s period
    const faceScale = 1.0 + cycle * 0.35;           // 1.0x ~ 1.35x
    const faceShake = Math.sin(t * 8) * cycle * U * 1.2;
    return [
      { translateX: headX + faceShake },
      { translateY: headY },
      { scale: faceScale },
      { translateX: -headX },
      { translateY: -headY },
    ];
  });

  // 4. Legs: Rotate relative to Hip (0,0)
  const backLegTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const swing = Math.sin(t) * LEG_SWING;
    return [{ rotate: swing - angle.value * 0.3 }];
  });

  const frontLegTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const swing = Math.sin(t + Math.PI) * LEG_SWING;
    return [{ rotate: swing - angle.value * 0.3 }];
  });

  // 5. Knees: Move down to end of thigh, then rotate
  const kneeBendBack = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const sinT = Math.sin(t);
    // Bend logic: Only bend when lifting
    const bend = 20 * (Math.PI/180) + Math.max(0, sinT) * 0.8;
    return [{ translateY: thighLen }, { rotate: bend }];
  });

  const kneeBendFront = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const sinT = Math.sin(t + Math.PI);
    const bend = 20 * (Math.PI/180) + Math.max(0, sinT) * 0.8;
    return [{ translateY: thighLen }, { rotate: bend }];
  });


  // ════════════ PATHS (Relative to (0,0)) ════════════

  // Neck: Curves from Body (near 0,0) to Head (headX, headY)
  const neckPath = useMemo(() => {
    const p = Skia.Path.Make();
    const startX = U * 1.5;
    const startY = bodyYOffset - bodyRy * 0.7;
    p.moveTo(startX, startY);
    // Single cubic bezier S-curve:
    // CP1 pulls LEFT → backward bow at bottom
    // CP2 pulls RIGHT → forward bow at top
    p.cubicTo(
        startX + U * 4, startY - U * 4,     // CP1: right & up (forward lean from body)
        headX - U * 5, headY + U * 5,       // CP2: left & down from head (backward curve at top)
        headX, headY                          // End: head
    );
    return p;
  }, [U, bodyYOffset, bodyRy, headX, headY]);

  // Beak
  const beakPath = useMemo(() => {
    const p = Skia.Path.Make();
    const bx = headX + headR * 0.5;
    const by = headY + U * 0.1;
    const bLen = U * 4.8;
    p.moveTo(bx, by - U * 0.5);
    p.quadTo(bx + bLen * 0.6, by - U * 0.5, bx + bLen, by + U * 0.2);
    p.lineTo(bx + bLen * 0.9, by + U * 0.5);
    p.quadTo(bx + bLen * 0.2, by + U * 0.5, bx, by + U * 0.3);
    p.close();
    return p;
  }, [headX, headY, headR, U]);

  const beakTipPath = useMemo(() => {
    const p = Skia.Path.Make();
    const bx = headX + headR * 0.5;
    const by = headY + U * 0.1;
    const bLen = U * 4.8;
    p.moveTo(bx + bLen * 0.75, by - U * 0.1);
    p.lineTo(bx + bLen, by + U * 0.2);
    p.lineTo(bx + bLen * 0.9, by + U * 0.5);
    p.close();
    return p;
  }, [headX, headY, headR, U]);

  // Tail
  const tailPath = useMemo(() => {
    const p = Skia.Path.Make();
    const tx = -bodyRx * 0.8;
    const ty = bodyYOffset;
    p.moveTo(tx, ty);
    p.quadTo(tx - U * 2, ty - U * 2, tx - U * 1.5, ty - U * 4);
    return p;
  }, [bodyRx, bodyYOffset, U]);

  const lowerLegPath = useMemo(() => {
    const p = Skia.Path.Make();
    const r = legW * 0.5;
    // Draw from (0,0) down to shinLen
    const startY = 0;
    p.addRRect({ rect: { x: -r, y: startY, width: r * 2, height: shinLen }, rx: r, ry: r });
    // Foot
    p.moveTo(-r, shinLen);
    p.lineTo(r + U * 1.5, shinLen);
    p.lineTo(r, shinLen + U * 0.8);
    p.lineTo(-r, shinLen);
    p.close();
    return p;
  }, [legW, shinLen, U]);


  return (
    <Group>
      {/* Shadow (On ground) */}
      <Group transform={[{ translateX: cx }, { translateY: groundY }]}>
         <RoundedRect x={-U * 4} y={-U * 0.5} width={U * 8} height={U} r={U/2} color={C_SHADOW} />
      </Group>

      {/* Root Pivot (Feet) */}
      <Group transform={rootTr}>

        {/* Move UP to Hip (Everything below is relative to Hip) */}
        <Group transform={hipTr}>

            {/* Back Leg */}
            <Group transform={backLegTr}>
                {/* Thigh (Draw from 0,0 down) */}
                <RoundedRect x={-legW/2} y={0} width={legW} height={thighLen} r={legW/2} color={C_LEG_DARK} />
                {/* Knee Joint */}
                <Group transform={kneeBendBack}>
                    <Circle cx={0} cy={0} r={legW * 0.6} color={C_LEG_DARK} />
                    <Path path={lowerLegPath} color={C_LEG_DARK} />
                </Group>
            </Group>

            {/* Front Leg */}
            <Group transform={frontLegTr}>
                <RoundedRect x={-legW/2} y={0} width={legW} height={thighLen} r={legW/2} color={C_LEG} />
                <Group transform={kneeBendFront}>
                    <Circle cx={0} cy={0} r={legW * 0.6} color={C_LEG} />
                    <Path path={lowerLegPath} color={C_LEG} />
                </Group>
            </Group>

            {/* Body Group */}
            <Group transform={bodyBobTr}>
                {/* Main Body (Centered at 0, bodyYOffset) */}
                <Oval x={-bodyRx} y={bodyYOffset - bodyRy} width={bodyRx*2} height={bodyRy*2} color={C_BODY} />
                <Circle cx={-U*2} cy={bodyYOffset - U*2} r={U*1.7} color={C_BODY_LIGHT} />

                {/* Wing */}
                <Group transform={[{translateX: -U*0.7}, {translateY: bodyYOffset - U*0.7}]}>
                    <Circle cx={0} cy={0} r={U * 2.5} color={C_WING} />
                    <Circle cx={0} cy={0} r={U * 2.5} color={C_WING} transform={[{scaleY: 0.7}]} />
                </Group>

                {/* Tail */}
                <Path path={tailPath} color={C_WING} style="stroke" strokeWidth={U} strokeCap="round" />

                {/* Neck + Head Group (extra whiplash sway) */}
                <Group transform={neckSwayTr}>
                    {/* Neck */}
                    <Path path={neckPath} color={C_NECK} style="stroke" strokeWidth={U * 1.2} strokeCap="round" />

                    {/* Head (with periodic zoom/shake) */}
                    <Group transform={faceZoomTr}>
                        <Circle cx={headX} cy={headY} r={headR} color={C_BODY} />
                        <Circle cx={headX - U*0.7} cy={headY - U*0.7} r={U} color={C_BODY_LIGHT} />
                        <Circle cx={headX + U*0.5} cy={headY + U*0.7} r={U*0.8} color={C_CHEEK} />

                        {/* Beak */}
                        <Path path={beakPath} color={C_BEAK} />
                        <Path path={beakTipPath} color={C_BEAK_TIP} />

                        {/* Eye */}
                        <Circle cx={headX + U*0.5} cy={headY - U*0.3} r={U*0.9} color={C_EYE_W} />
                        <Circle cx={headX + U*0.5} cy={headY - U*0.3} r={U*0.5} color={C_EYE_B} />
                        <Circle cx={headX + U*0.7} cy={headY - U*0.4} r={U*0.15} color={C_EYE_W} />
                    </Group>
                </Group>
            </Group>

        </Group>
      </Group>
    </Group>
  );
};
