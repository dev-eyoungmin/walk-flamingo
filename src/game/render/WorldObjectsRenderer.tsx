import React, { useMemo } from 'react';
import { Circle, Group, Oval, Path, RoundedRect, Skia, SkPath, Text, usePathValue, useTypeface } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import {
  BIOME_AUTUMN,
  BIOME_BEACH,
  BIOME_MEADOW,
  BIOME_SNOW,
  COIN,
  EVENTS,
  ITEM_BALLOON,
  ITEM_FEATHER,
  ITEM_MAGNET,
  ITEMS,
  MODE_ATTRACT,
  OBS_BRANCH,
  OBS_GULL,
  OBS_ROCK,
} from '../sim/constants';
import type { SimState } from '../sim/state';
import { SimConfig, terrainOffsetAt } from '../sim/terrain';
import { DISPLAY_SOURCE } from '../../i18n/fonts';

interface Props {
  sim: SharedValue<SimState>;
  cfg: SimConfig;
}

const INK = '#3B1F2B';

/** All coins in a handful of batched paths (no per-coin components). */
export const CoinRenderer: React.FC<Props> = React.memo(({ sim, cfg }) => {
  const U = cfg.unit;
  const R = COIN.RADIUS_U * U;

  const buildCoins = (layer: number) => (p: ReturnType<typeof Skia.Path.Make>) => {
    'worklet';
    const s = sim.value;
    const slots = s.coinSlots;
    const spin = Math.abs(Math.cos(s.t * 4));
    for (let c = 0; c < COIN.MAX; c++) {
      const b = c * COIN.SLOT;
      if (slots[b] < 0.5) continue;
      const x = slots[b + 1] - s.scrollX;
      if (x < -R * 2 || x > cfg.width + R * 2) continue;
      const bob = Math.sin(s.t * 3 + slots[b + 1] * 0.01) * U * 0.3;
      const y = slots[b + 2] - s.camY + bob;
      const big = slots[b + 5] > 0.5 ? 1.2 : 1;
      const r = R * big;
      const w = Math.max(0.18, spin) * r;
      if (layer === 0) p.addOval(Skia.XYWHRect(x - w, y - r, w * 2, r * 2));
      else if (layer === 1) p.addOval(Skia.XYWHRect(x - w * 0.68, y - r * 0.68, w * 1.36, r * 1.36));
      else if (layer === 2 && spin > 0.45) p.addOval(Skia.XYWHRect(x - w * 0.45, y - r * 0.55, w * 0.3, r * 0.5));
    }
  };
  const outer = usePathValue(buildCoins(0));
  const inner = usePathValue(buildCoins(1));
  const shine = usePathValue(buildCoins(2));

  const sparkle = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    const slots = s.coinSlots;
    for (let c = 0; c < COIN.MAX; c++) {
      const b = c * COIN.SLOT;
      const anim = slots[b + 4];
      if (slots[b] > 0.5 || anim <= 0) continue;
      const k = 1 - anim / COIN.COLLECT_ANIM;
      const x = slots[b + 1] - s.scrollX;
      const y = slots[b + 2] - s.camY - k * U * 3;
      const dist = R * (0.8 + k * 1.8);
      const size = U * 0.55 * (1 - k);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + k;
        const sx = x + Math.cos(a) * dist;
        const sy = y + Math.sin(a) * dist;
        p.moveTo(sx, sy - size);
        p.lineTo(sx + size * 0.35, sy);
        p.lineTo(sx, sy + size);
        p.lineTo(sx - size * 0.35, sy);
        p.close();
      }
    }
  });

  return (
    <Group>
      <Path path={outer} color="#D08A12" />
      <Path path={inner} color="#FFD23F" />
      <Path path={outer} color="#7A4B00" style="stroke" strokeWidth={U * 0.28} />
      <Path path={shine} color="rgba(255,255,255,0.75)" />
      <Path path={sparkle} color="#FFF2A8" />
    </Group>
  );
});

// ─── Obstacles ─────────────────────────────────────────────────────────────────

function polygon(points: number): (r: number) => SkPath {
  return (r) => {
    const p = Skia.Path.Make();
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const rr = r * (0.86 + 0.14 * Math.sin(i * 2.7 + 0.4));
      if (i === 0) p.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else p.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    p.close();
    return p;
  };
}

/** Angry little face shared by all rolling obstacles; it doesn't spin with the body. */
const GlareFace: React.FC<{ sim: SharedValue<SimState>; r: number; U: number }> = ({ sim, r, U }) => {
  const brows = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(-r * 0.55, -r * 0.55);
    p.lineTo(-r * 0.12, -r * 0.4);
    p.moveTo(r * 0.55, -r * 0.55);
    p.lineTo(r * 0.12, -r * 0.4);
    return p;
  }, [r]);
  const pupilOffset = useDerivedValue(() => -sim.value.obs[8] * r * 0.08);
  const leftPupilX = useDerivedValue(() => -r * 0.32 + pupilOffset.value);
  const rightPupilX = useDerivedValue(() => r * 0.3 + pupilOffset.value);
  return (
    <>
      <Circle cx={-r * 0.32} cy={-r * 0.2} r={r * 0.24} color="#FFFFFF" />
      <Circle cx={r * 0.3} cy={-r * 0.2} r={r * 0.24} color="#FFFFFF" />
      <Circle cx={leftPupilX} cy={-r * 0.16} r={r * 0.11} color="#2B1630" />
      <Circle cx={rightPupilX} cy={-r * 0.16} r={r * 0.11} color="#2B1630" />
      <Path path={brows} color="#2B1630" style="stroke" strokeWidth={U * 0.35} strokeCap="round" />
    </>
  );
};

/** Rolling rock (meadow), crab (beach), snowball (peaks) or acorn (woods), plus the falling
 *  branch / coconut / snow clump / autumn branch. Same mechanics, zone-appropriate look. */
export const ObstacleRenderer: React.FC<Props> = React.memo(({ sim, cfg }) => {
  const U = cfg.unit;
  const rockR = EVENTS.ROCK_RADIUS_U * U;
  const halfW = EVENTS.BRANCH_HALF_W_U * U;

  const art = useMemo(() => {
    const rock = polygon(9)(rockR);
    const rockDetail = Skia.Path.Make();
    rockDetail.moveTo(-rockR * 0.35, -rockR * 0.1);
    rockDetail.lineTo(rockR * 0.05, rockR * 0.25);
    rockDetail.moveTo(rockR * 0.25, -rockR * 0.45);
    rockDetail.lineTo(rockR * 0.45, -rockR * 0.1);

    const crabBody = Skia.Path.Make();
    crabBody.addOval(Skia.XYWHRect(-rockR, -rockR * 0.55, rockR * 2, rockR * 1.2));
    const crabClaws = Skia.Path.Make();
    for (const side of [-1, 1]) {
      const cx = side * rockR * 1.15;
      const cy = -rockR * 0.75;
      crabClaws.addCircle(cx, cy, rockR * 0.38);
    }
    const crabLegs = Skia.Path.Make();
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        crabLegs.moveTo(side * rockR * (0.5 + k * 0.18), rockR * 0.45);
        crabLegs.lineTo(side * rockR * (0.9 + k * 0.2), rockR * 0.95);
      }
      crabLegs.moveTo(side * rockR * 0.6, -rockR * 0.3);
      crabLegs.lineTo(side * rockR * 1.05, -rockR * 0.6);
    }

    const acorn = Skia.Path.Make();
    acorn.moveTo(-rockR * 0.85, -rockR * 0.1);
    acorn.quadTo(-rockR * 0.9, rockR * 0.9, 0, rockR);
    acorn.quadTo(rockR * 0.9, rockR * 0.9, rockR * 0.85, -rockR * 0.1);
    acorn.close();
    const acornCap = Skia.Path.Make();
    acornCap.moveTo(-rockR, -rockR * 0.05);
    acornCap.quadTo(0, -rockR * 1.35, rockR, -rockR * 0.05);
    acornCap.close();
    acornCap.addRect(Skia.XYWHRect(-rockR * 0.1, -rockR * 1.15, rockR * 0.2, rockR * 0.4));

    const branch = Skia.Path.Make();
    branch.moveTo(-halfW, U * 0.2);
    branch.quadTo(0, -U * 0.5, halfW, U * 0.1);
    branch.moveTo(-halfW * 0.3, -U * 0.1);
    branch.lineTo(-halfW * 0.55, -U * 1.6);
    branch.moveTo(halfW * 0.35, -U * 0.15);
    branch.lineTo(halfW * 0.6, -U * 1.4);
    const leaves = Skia.Path.Make();
    const leaf = (x: number, y: number, r: number) => leaves.addOval(Skia.XYWHRect(x - r, y - r * 0.6, r * 2, r * 1.2));
    leaf(-halfW * 0.55, -U * 1.9, U * 0.9);
    leaf(halfW * 0.62, -U * 1.7, U * 0.8);
    leaf(halfW * 0.95, U * 0.1, U * 0.7);
    leaf(-halfW * 0.95, U * 0.3, U * 0.7);

    const coconuts = Skia.Path.Make();
    coconuts.addCircle(-halfW * 0.45, 0, U * 1.5);
    coconuts.addCircle(halfW * 0.45, U * 0.2, U * 1.5);
    coconuts.addCircle(0, -U * 0.9, U * 1.4);
    const coconutEyes = Skia.Path.Make();
    for (const [cx, cy] of [
      [-halfW * 0.45, 0],
      [halfW * 0.45, U * 0.2],
      [0, -U * 0.9],
    ]) {
      coconutEyes.addCircle(cx - U * 0.35, cy - U * 0.3, U * 0.22);
      coconutEyes.addCircle(cx + U * 0.35, cy - U * 0.3, U * 0.22);
      coconutEyes.addCircle(cx, cy + U * 0.35, U * 0.22);
    }

    const clump = Skia.Path.Make();
    clump.addCircle(-halfW * 0.5, 0, U * 1.5);
    clump.addCircle(0, -U * 0.5, U * 1.9);
    clump.addCircle(halfW * 0.55, U * 0.1, U * 1.4);
    const icicles = Skia.Path.Make();
    for (let k = -2; k <= 2; k++) {
      const x = k * halfW * 0.32;
      icicles.moveTo(x - U * 0.4, U * 0.9);
      icicles.lineTo(x, U * (2.6 + (k % 2 === 0 ? 0.8 : 0)));
      icicles.lineTo(x + U * 0.4, U * 0.9);
      icicles.close();
    }
    return { rock, rockDetail, crabBody, crabClaws, crabLegs, acorn, acornCap, branch, leaves, coconuts, coconutEyes, clump, icicles };
  }, [rockR, halfW, U]);

  const spinTransform = useDerivedValue(() => {
    const s = sim.value;
    const o = s.obs;
    return [{ translateX: o[2] - s.scrollX }, { translateY: o[3] - s.camY }, { rotate: o[6] }];
  });
  const faceTransform = useDerivedValue(() => {
    const s = sim.value;
    const o = s.obs;
    return [{ translateX: o[2] - s.scrollX }, { translateY: o[3] - s.camY }];
  });
  // Crabs skitter instead of rolling
  const crabTransform = useDerivedValue(() => {
    const s = sim.value;
    const o = s.obs;
    const hop = -Math.abs(Math.sin(s.t * 22)) * U * 0.6;
    return [{ translateX: o[2] - s.scrollX }, { translateY: o[3] - s.camY + hop + rockR * 0.3 }];
  });

  const visible = (kind: number, biome: number) => () => {
    'worklet';
    const o = sim.value.obs;
    return o[0] > 0.5 && o[1] === kind && o[9] === biome ? 1 : 0;
  };
  const rockMeadow = useDerivedValue(visible(OBS_ROCK, BIOME_MEADOW));
  const rockBeach = useDerivedValue(visible(OBS_ROCK, BIOME_BEACH));
  const rockSnow = useDerivedValue(visible(OBS_ROCK, BIOME_SNOW));
  const rockAutumn = useDerivedValue(visible(OBS_ROCK, BIOME_AUTUMN));
  const branchMeadow = useDerivedValue(visible(OBS_BRANCH, BIOME_MEADOW));
  const branchBeach = useDerivedValue(visible(OBS_BRANCH, BIOME_BEACH));
  const branchSnow = useDerivedValue(visible(OBS_BRANCH, BIOME_SNOW));
  const branchAutumn = useDerivedValue(visible(OBS_BRANCH, BIOME_AUTUMN));
  const rolling = useDerivedValue(() => Math.max(rockMeadow.value, rockSnow.value, rockAutumn.value));

  return (
    <Group>
      {/* Meadow rock */}
      <Group transform={spinTransform} opacity={rockMeadow}>
        <Path path={art.rock} color="#9A6F58" />
        <Path path={art.rock} color={INK} style="stroke" strokeWidth={U * 0.4} strokeJoin="round" />
        <Path path={art.rockDetail} color="#6B4A3A" style="stroke" strokeWidth={U * 0.3} strokeCap="round" />
      </Group>
      {/* Snowball */}
      <Group transform={spinTransform} opacity={rockSnow}>
        <Circle cx={0} cy={0} r={rockR} color="#F5FAFF" />
        <Oval x={-rockR * 0.2} y={rockR * 0.1} width={rockR * 1.1} height={rockR * 0.8} color="#CFE0F2" />
        <Circle cx={0} cy={0} r={rockR} color={INK} style="stroke" strokeWidth={U * 0.4} />
      </Group>
      {/* Acorn */}
      <Group transform={spinTransform} opacity={rockAutumn}>
        <Path path={art.acorn} color="#C98A4B" />
        <Path path={art.acorn} color={INK} style="stroke" strokeWidth={U * 0.4} strokeJoin="round" />
        <Path path={art.acornCap} color="#7A5033" />
        <Path path={art.acornCap} color={INK} style="stroke" strokeWidth={U * 0.35} strokeJoin="round" />
      </Group>
      <Group transform={faceTransform} opacity={rolling}>
        <GlareFace sim={sim} r={rockR} U={U} />
      </Group>
      {/* Crab */}
      <Group transform={crabTransform} opacity={rockBeach}>
        <Path path={art.crabLegs} color={INK} style="stroke" strokeWidth={U * 0.4} strokeCap="round" />
        <Path path={art.crabClaws} color="#F0573F" />
        <Path path={art.crabClaws} color={INK} style="stroke" strokeWidth={U * 0.35} />
        <Path path={art.crabBody} color="#F0573F" />
        <Path path={art.crabBody} color={INK} style="stroke" strokeWidth={U * 0.4} />
        <GlareFace sim={sim} r={rockR} U={U} />
      </Group>

      {/* Falling hazards */}
      <Group transform={spinTransform} opacity={branchMeadow}>
        <Path path={art.leaves} color="#4FA85A" />
        <Path path={art.branch} color={INK} style="stroke" strokeWidth={U * 1.25} strokeCap="round" />
        <Path path={art.branch} color="#8A5A3B" style="stroke" strokeWidth={U * 0.75} strokeCap="round" />
      </Group>
      <Group transform={spinTransform} opacity={branchAutumn}>
        <Path path={art.leaves} color="#E8872F" />
        <Path path={art.branch} color={INK} style="stroke" strokeWidth={U * 1.25} strokeCap="round" />
        <Path path={art.branch} color="#7A4E33" style="stroke" strokeWidth={U * 0.75} strokeCap="round" />
      </Group>
      <Group transform={spinTransform} opacity={branchBeach}>
        <Path path={art.coconuts} color="#7A5033" />
        <Path path={art.coconuts} color={INK} style="stroke" strokeWidth={U * 0.35} />
        <Path path={art.coconutEyes} color="#3F2A1C" />
      </Group>
      <Group transform={spinTransform} opacity={branchSnow}>
        <Path path={art.icicles} color="#BFE6FF" />
        <Path path={art.icicles} color={INK} style="stroke" strokeWidth={U * 0.3} strokeJoin="round" />
        <Path path={art.clump} color="#FFFFFF" />
        <Path path={art.clump} color={INK} style="stroke" strokeWidth={U * 0.35} />
      </Group>
    </Group>
  );
});

// ─── Course items ──────────────────────────────────────────────────────────────

const ItemSlot: React.FC<{ sim: SharedValue<SimState>; cfg: SimConfig; index: number; art: ItemArt }> = ({
  sim,
  cfg,
  index,
  art,
}) => {
  const U = cfg.unit;
  const b = index * ITEMS.SLOT;
  const transform = useDerivedValue(() => {
    const s = sim.value;
    const it = s.items;
    const bob = Math.sin(s.t * 3 + index) * U * 0.6;
    return [{ translateX: it[b + 1] - s.scrollX }, { translateY: it[b + 2] - s.camY + bob }];
  });
  const shown = (type: number) => () => {
    'worklet';
    const it = sim.value.items;
    return it[b] > 0.5 && it[b + 3] === type ? 1 : 0;
  };
  const magnet = useDerivedValue(shown(ITEM_MAGNET));
  const feather = useDerivedValue(shown(ITEM_FEATHER));
  const balloon = useDerivedValue(shown(ITEM_BALLOON));
  const glow = useDerivedValue(() => {
    const s = sim.value;
    return s.items[b] > 0.5 ? 0.35 + 0.2 * Math.sin(s.t * 6) : 0;
  });
  const burstR = useDerivedValue(() => {
    const k = 1 - sim.value.items[b + 4] / ITEMS.COLLECT_ANIM;
    return U * (2.5 + k * 5);
  });
  const burstOpacity = useDerivedValue(() => (sim.value.items[b + 4] > 0 ? sim.value.items[b + 4] / ITEMS.COLLECT_ANIM : 0));
  const R = ITEMS.RADIUS_U * U;

  return (
    <Group transform={transform}>
      <Circle cx={0} cy={0} r={R * 1.35} color="#FFFFFF" opacity={glow} />
      <Group opacity={magnet}>
        <Path path={art.magnet} color={INK} style="stroke" strokeWidth={U * 1.35} strokeCap="butt" />
        <Path path={art.magnet} color="#E8475F" style="stroke" strokeWidth={U * 0.85} strokeCap="butt" />
        <Path path={art.magnetTips} color="#DDE6EE" />
        <Path path={art.magnetTips} color={INK} style="stroke" strokeWidth={U * 0.25} />
      </Group>
      <Group opacity={feather}>
        <Path path={art.feather} color="#E8FBFF" />
        <Path path={art.feather} color={INK} style="stroke" strokeWidth={U * 0.3} strokeJoin="round" />
        <Path path={art.featherRib} color="#6FC3E0" style="stroke" strokeWidth={U * 0.25} strokeCap="round" />
      </Group>
      <Group opacity={balloon}>
        <Path path={art.balloonString} color={INK} style="stroke" strokeWidth={U * 0.2} />
        <Oval x={-R * 0.8} y={-R * 1.15} width={R * 1.6} height={R * 1.9} color="#FF5A6E" />
        <Oval x={-R * 0.8} y={-R * 1.15} width={R * 1.6} height={R * 1.9} color={INK} style="stroke" strokeWidth={U * 0.3} />
        <Oval x={-R * 0.45} y={-R * 0.9} width={R * 0.35} height={R * 0.6} color="rgba(255,255,255,0.7)" />
      </Group>
      <Circle cx={0} cy={0} r={burstR} color="#FFF2A8" style="stroke" strokeWidth={U * 0.5} opacity={burstOpacity} />
    </Group>
  );
};

interface ItemArt {
  magnet: SkPath;
  magnetTips: SkPath;
  feather: SkPath;
  featherRib: SkPath;
  balloonString: SkPath;
}

export const ItemsRenderer: React.FC<Props> = React.memo(({ sim, cfg }) => {
  const U = cfg.unit;
  const art = useMemo<ItemArt>(() => {
    const R = ITEMS.RADIUS_U * U;
    const magnet = Skia.Path.Make();
    magnet.moveTo(-R * 0.65, -R * 0.7);
    magnet.lineTo(-R * 0.65, R * 0.05);
    magnet.cubicTo(-R * 0.65, R * 0.95, R * 0.65, R * 0.95, R * 0.65, R * 0.05);
    magnet.lineTo(R * 0.65, -R * 0.7);
    const magnetTips = Skia.Path.Make();
    magnetTips.addRect(Skia.XYWHRect(-R * 0.65 - U * 0.42, -R * 0.95, U * 0.84, R * 0.4));
    magnetTips.addRect(Skia.XYWHRect(R * 0.65 - U * 0.42, -R * 0.95, U * 0.84, R * 0.4));
    const feather = Skia.Path.Make();
    feather.moveTo(-R * 0.7, R * 0.8);
    feather.cubicTo(-R * 0.9, -R * 0.2, R * 0.2, -R * 1.2, R * 0.8, -R * 0.9);
    feather.cubicTo(R * 0.6, -R * 0.1, R * 0.1, R * 0.6, -R * 0.7, R * 0.8);
    feather.close();
    const featherRib = Skia.Path.Make();
    featherRib.moveTo(-R * 0.9, R * 1.0);
    featherRib.quadTo(0, -R * 0.1, R * 0.75, -R * 0.85);
    const balloonString = Skia.Path.Make();
    balloonString.moveTo(0, R * 0.75);
    balloonString.quadTo(-R * 0.3, R * 1.2, R * 0.1, R * 1.6);
    return { magnet, magnetTips, feather, featherRib, balloonString };
  }, [U]);

  return (
    <Group>
      {Array.from({ length: ITEMS.MAX }, (_, i) => (
        <ItemSlot key={i} sim={sim} cfg={cfg} index={i} art={art} />
      ))}
    </Group>
  );
});

// ─── Seagull (drawn in front of the flamingo so it can sit on its head) ──────

export const GullRenderer: React.FC<Props> = React.memo(({ sim, cfg }) => {
  const U = cfg.unit;
  const art = useMemo(() => {
    const body = Skia.Path.Make();
    body.addOval(Skia.XYWHRect(-2.6 * U, -3.6 * U, 5.2 * U, 3.2 * U));
    const tail = Skia.Path.Make();
    tail.moveTo(-2.2 * U, -2.4 * U);
    tail.lineTo(-3.8 * U, -3.2 * U);
    tail.lineTo(-3.6 * U, -1.7 * U);
    tail.close();
    const beak = Skia.Path.Make();
    beak.moveTo(2.8 * U, -4.6 * U);
    beak.lineTo(4.4 * U, -4.1 * U);
    beak.lineTo(2.8 * U, -3.7 * U);
    beak.close();
    const legs = Skia.Path.Make();
    legs.moveTo(-0.5 * U, -0.6 * U);
    legs.lineTo(-0.6 * U, 0);
    legs.moveTo(0.6 * U, -0.6 * U);
    legs.lineTo(0.7 * U, 0);
    return { body, tail, beak, legs };
  }, [U]);

  const opacity = useDerivedValue(() => {
    const o = sim.value.obs;
    return o[0] > 0.5 && o[1] === OBS_GULL ? 1 : 0;
  });
  const transform = useDerivedValue(() => {
    const s = sim.value;
    const o = s.obs;
    // Faces the way it's flying; perched gulls face forward
    const flip = o[7] < 0.5 ? -1 : 1;
    return [{ translateX: o[2] - s.scrollX }, { translateY: o[3] - s.camY }, { rotate: o[6] }, { scaleX: flip }];
  });
  // Wings beat while flying, folded while perched (with the odd smug flutter)
  const wing = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    const o = s.obs;
    if (o[0] < 0.5 || o[1] !== OBS_GULL) return;
    const perched = o[7] > 0.5 && o[7] < 1.5;
    const beat = perched ? 0.15 + 0.1 * Math.max(0, Math.sin(s.t * 3)) : Math.sin(s.t * 18);
    const tipY = -2.6 * U - beat * 3.6 * U;
    p.moveTo(-1.4 * U, -2.6 * U);
    p.quadTo(-0.2 * U, tipY - 1.2 * U, 1.2 * U, -2.4 * U);
    p.lineTo(-0.9 * U, tipY);
    p.close();
  });
  const legsOpacity = useDerivedValue(() => {
    const o = sim.value.obs;
    return o[7] > 0.5 && o[7] < 1.5 ? 1 : 0;
  });

  return (
    <Group transform={transform} opacity={opacity}>
      <Group opacity={legsOpacity}>
        <Path path={art.legs} color="#F29C1F" style="stroke" strokeWidth={U * 0.45} strokeCap="round" />
      </Group>
      <Path path={art.tail} color="#AEB9C6" />
      <Path path={art.tail} color={INK} style="stroke" strokeWidth={U * 0.3} strokeJoin="round" />
      <Path path={art.body} color="#FFFFFF" />
      <Path path={art.body} color={INK} style="stroke" strokeWidth={U * 0.35} />
      <Circle cx={2.1 * U} cy={-4.2 * U} r={1.35 * U} color="#FFFFFF" />
      <Circle cx={2.1 * U} cy={-4.2 * U} r={1.35 * U} color={INK} style="stroke" strokeWidth={U * 0.3} />
      <Path path={art.beak} color="#F2B31F" />
      <Path path={art.beak} color={INK} style="stroke" strokeWidth={U * 0.25} strokeJoin="round" />
      <Circle cx={2.5 * U} cy={-4.5 * U} r={0.32 * U} color={INK} />
      <Path path={wing} color="#C9D3DE" />
      <Path path={wing} color={INK} style="stroke" strokeWidth={U * 0.3} strokeJoin="round" />
    </Group>
  );
});

// ─── Personal best flag ──────────────────────────────────────────────────────────

/** A flag planted where the best run ended, so you can see it coming. */
export const BestFlagRenderer: React.FC<Props & { label: string }> = React.memo(({ sim, cfg, label }) => {
  const U = cfg.unit;
  const typeface = useTypeface(DISPLAY_SOURCE);
  const font = useMemo(() => (typeface ? Skia.Font(typeface, Math.max(11, U * 2.6)) : null), [typeface, U]);
  const poleH = 24 * U;

  const worldX = useDerivedValue(() => {
    const s = sim.value;
    return s.scrollStart + cfg.storkX + s.bestMeters * cfg.pxPerMeter;
  });
  const opacity = useDerivedValue(() => {
    const s = sim.value;
    if (s.bestMeters <= 0 || s.mode === MODE_ATTRACT) return 0;
    const x = worldX.value - s.scrollX;
    return x < -40 * U || x > cfg.width + 40 * U ? 0 : 1;
  });
  const transform = useDerivedValue(() => {
    const s = sim.value;
    const wx = worldX.value;
    return [{ translateX: wx - s.scrollX }, { translateY: cfg.groundY + terrainOffsetAt(cfg, wx) - s.camY }];
  });
  const flagColor = useDerivedValue<string>(() => (sim.value.bestPassed ? '#FFD23F' : '#FF6F9C'));
  // Triangular pennant with a travelling wave along its length
  const pennant = usePathValue((p) => {
    'worklet';
    const t = sim.value.t;
    const w = 12 * U;
    const h = 7 * U;
    const top = -poleH;
    const wave = (i: number) => Math.sin(t * 6 - i * 0.9) * U * 0.7 * (i / 6);
    p.moveTo(0, top);
    for (let i = 1; i <= 6; i++) p.lineTo((i / 6) * w, top + (h / 2) * (i / 6) + wave(i));
    for (let i = 5; i >= 0; i--) p.lineTo((i / 6) * w, top + h - (h / 2) * (i / 6) + wave(i));
    p.close();
  });
  const labelX = font ? 1.5 * U : 0;
  const labelY = -poleH + 5 * U;

  return (
    <Group transform={transform} opacity={opacity}>
      <Oval x={-2 * U} y={-0.6 * U} width={4 * U} height={1.2 * U} color="rgba(43,22,48,0.3)" />
      <RoundedRect x={-0.5 * U} y={-poleH} width={U} height={poleH} r={U * 0.5} color="#FFFFFF" />
      <RoundedRect x={-0.5 * U} y={-poleH} width={U} height={poleH} r={U * 0.5} color={INK} style="stroke" strokeWidth={U * 0.3} />
      <Path path={pennant} color={flagColor} />
      <Path path={pennant} color={INK} style="stroke" strokeWidth={U * 0.35} strokeJoin="round" />
      <Circle cx={0} cy={-poleH} r={U * 0.9} color="#FFD23F" />
      {font && (
        <>
          <Text x={labelX} y={labelY} text={label} font={font} color={INK} style="stroke" strokeWidth={3} strokeJoin="round" />
          <Text x={labelX} y={labelY} text={label} font={font} color="#FFFFFF" />
        </>
      )}
    </Group>
  );
});
