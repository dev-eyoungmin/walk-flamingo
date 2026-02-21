import React, { useMemo } from 'react';
import {
  Group,
  Circle,
  Path,
  vec,
  Rect,
  Skia,
} from '@shopify/react-native-skia';
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
  const groundY = height * 0.65;
  const cx = width / 2;
  const pivotY = groundY;

  // Unit scale
  const U = Math.min(width, height) * 0.02;
  const WALK_HZ = 3.0;
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

  const legLen = U * 6.5;
  const legW = U * 1.1;
  const hipY = pivotY - (legLen * 2);

  // Animation Transforms
  const rootTr = useDerivedValue(() => [
    { translateX: cx },
    { translateY: pivotY },
    { rotate: angle.value },
    { translateX: -cx },
    { translateY: -pivotY },
  ]);

  const backLegTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const swing = Math.sin(t) * LEG_SWING;
    return [{ translateX: cx }, { translateY: hipY }, { rotate: swing - angle.value * 0.3 }];
  });

  const frontLegTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const swing = Math.sin(t + Math.PI) * LEG_SWING;
    return [{ translateX: cx }, { translateY: hipY }, { rotate: swing - angle.value * 0.3 }];
  });

  const kneeBendBack = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const sinT = Math.sin(t);
    return [{ translateY: legLen }, { rotate: 20 * (Math.PI/180) + Math.max(0, sinT) }];
  });

  const kneeBendFront = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const sinT = Math.sin(t + Math.PI);
    return [{ translateY: legLen }, { rotate: 20 * (Math.PI/180) + Math.max(0, sinT) }];
  });

  const bodyTr = useDerivedValue(() => {
    const t = elapsedTime.value * WALK_HZ * TAU;
    const bob = Math.sin(t * 2) * U * 0.2;
    return [{ translateX: cx }, { translateY: hipY + bob }, { rotate: angle.value * 0.5 }];
  });

  // Body Dimensions relative to hip (0,0)
  const bodyRx = U * 5.0;
  const bodyRy = U * 4.5;
  const bodyYOffset = -U * 2.8;

  const headR = U * 2.8;
  const headCX = U * 4.5;
  const headCY = -U * 12.4;

  // ════════════ SIMPLE PATHS (Rect/Circle/RRect) ════════════
  // Replaced complex SVG paths with simple primitives to fix crash

  return (
    <Group>
      {/* Shadow */}
      <Group transform={rootTr}>
         <Rect x={cx - U * 4} y={pivotY - U * 0.5} width={U * 8} height={U} rx={U/2} color={C_SHADOW} />
      </Group>

      <Group transform={rootTr}>
        
        {/* Back Leg */}
        <Group transform={backLegTr} origin={vec(cx, hipY)}>
             <Rect x={-legW/2} y={0} width={legW} height={legLen} rx={legW/2} color={C_LEG_DARK} />
             <Group transform={kneeBendBack} origin={vec(0, legLen)}>
                <Rect x={-legW/2} y={0} width={legW} height={legLen} rx={legW/2} color={C_LEG_DARK} />
             </Group>
        </Group>

        {/* Front Leg */}
        <Group transform={frontLegTr} origin={vec(cx, hipY)}>
             <Rect x={-legW/2} y={0} width={legW} height={legLen} rx={legW/2} color={C_LEG} />
             <Group transform={kneeBendFront} origin={vec(0, legLen)}>
                <Rect x={-legW/2} y={0} width={legW} height={legLen} rx={legW/2} color={C_LEG} />
             </Group>
        </Group>

        {/* Body Group */}
        <Group transform={bodyTr} origin={vec(cx, hipY)}>
            
            {/* Neck (Simplified Line) */}
            {/* Using Rect for neck instead of Path to avoid crash */}
            <Rect 
              x={U*0.7} y={headCY} width={U*1.4} height={bodyYOffset - headCY} 
              color={C_NECK} 
              transform={[{rotate: -15 * (Math.PI/180)}, {translateX: U*2}]}
            />

            {/* Head */}
            <Circle cx={headCX} cy={headCY} r={headR} color={C_BODY} />
            <Circle cx={headCX - U*0.7} cy={headCY - U*0.7} r={U} color={C_BODY_LIGHT} />
            <Circle cx={headCX + U*0.5} cy={headCY + U*0.7} r={U*0.8} color={C_CHEEK} />

            {/* Beak (Simple Rects/Circles instead of Path) */}
            <Rect x={headCX + headR*0.5} y={headCY} width={U*4.8} height={U} rx={U*0.2} color={C_BEAK} />
            <Rect x={headCX + headR*0.5 + U*3.5} y={headCY} width={U*1.3} height={U} rx={U*0.2} color={C_BEAK_TIP} />

            {/* Eye */}
            <Circle cx={headCX + U*0.5} cy={headCY - U*0.3} r={U*0.9} color={C_EYE_W} />
            <Circle cx={headCX + U*0.5} cy={headCY - U*0.3} r={U*0.5} color={C_EYE_B} />
            <Circle cx={headCX + U*0.7} cy={headCY - U*0.4} r={U*0.15} color={C_EYE_W} />

            {/* Body Main */}
            <Rect x={-bodyRx} y={bodyYOffset - bodyRy} width={bodyRx*2} height={bodyRy*2} rx={bodyRx} ry={bodyRy} color={C_BODY} />
            <Circle cx={-U*2} cy={bodyYOffset - U*2} r={U*1.7} color={C_BODY_LIGHT} />

            {/* Wing */}
            <Group transform={[{translateX: -U*0.7}, {translateY: bodyYOffset - U*0.7}]}>
                <Circle cx={0} cy={0} r={U * 2.5} color={C_WING} />
            </Group>

            {/* Tail (Simple Circle) */}
            <Circle cx={-bodyRx*0.8 - U} cy={bodyYOffset - U*2} r={U} color={C_WING} />
        </Group>

      </Group>
    </Group>
  );
};
