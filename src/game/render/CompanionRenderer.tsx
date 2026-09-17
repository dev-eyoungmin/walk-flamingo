import React, { useMemo } from 'react';
import { Circle, Group, Oval, Path, Skia, usePathValue } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { CHICKS, MODE_FALLING, MODE_OVER, MODE_PLAYING } from '../sim/constants';
import type { SimState } from '../sim/state';
import { STORK } from '../sim/storkGeometry';
import { SimConfig, terrainOffsetAt, terrainSlopeAt } from '../sim/terrain';
import type { SkinPalette } from '../../lib/skins';
import { StorkPose, StorkRenderer } from './StorkRenderer';

const INK = '#3B1F2B';

/** Fluffy grey-pink baby flamingo colors */
const CHICK_SKIN: SkinPalette = {
  id: 'chick',
  name: 'Chick',
  body: '#F1E3EA',
  bodyLight: '#FFFFFF',
  legs: '#C9B3BE',
  legsDark: '#B39CA8',
  wing: '#E2CCD7',
  neck: '#F1E3EA',
  cheek: '#FFB3C7',
};

const Chick: React.FC<{ sim: SharedValue<SimState>; cfg: SimConfig; index: number }> = ({ sim, cfg, index }) => {
  const pose = useDerivedValue<StorkPose & { visible: number }>(() => {
    const s = sim.value;
    const U = cfg.unit;
    const baseOffset = -(CHICKS.FIRST_OFFSET_U + CHICKS.SPACING_U * index) * U;
    let visible = index < s.chicks ? 1 : 0;
    let offsetX = baseOffset;
    let running = 0;
    const join = s.chickJoin[index];
    if (visible && join > 0) {
      // Runs in from the left edge
      const k = join / CHICKS.JOIN_ANIM;
      offsetX = baseOffset - k * k * cfg.storkX * 1.2;
      running = 1;
    }
    if (!visible && index === s.chicks && s.chickLeaveT > 0) {
      // The chick that got scared off runs away to the left
      visible = 1;
      const k = 1 - s.chickLeaveT / CHICKS.LEAVE_ANIM;
      offsetX = baseOffset - k * cfg.storkX * 1.3;
      running = 1;
    }
    const worldX = s.scrollX + cfg.storkX + offsetX;
    const over = s.mode === MODE_OVER || s.mode === MODE_FALLING;
    return {
      mode: MODE_PLAYING,
      t: s.t + index * 0.9,
      angle: s.chickAngles[index],
      omega: 0,
      walkPhase: s.walkPhase * 1.7 + index * 0.33 + (running ? s.t * 3 : 0),
      danger: over ? 0.8 : s.danger * 0.5,
      fallT: 0,
      feetY: cfg.groundY + terrainOffsetAt(cfg, worldX),
      camY: s.camY,
      slope: terrainSlopeAt(cfg, worldX),
      invulnT: 0,
      happyT: over ? 0 : s.happyT,
      hurtT: !over && index === s.chicks && s.chickLeaveT > 0 ? 0.5 : 0,
      cheerT: over ? 0 : s.cheerT,
      lookX: 0.6,
      lookY: -0.2,
      offsetX,
      visible,
    };
  });
  const opacity = useDerivedValue(() => pose.value.visible);
  return (
    <Group opacity={opacity}>
      <StorkRenderer pose={pose} unit={cfg.unit * CHICKS.SCALE} x={cfg.storkX} skin={CHICK_SKIN} />
    </Group>
  );
};

/** Baby flamingos that follow the parent. Only as many as have joined this run are mounted. */
export const ChicksRenderer: React.FC<{ sim: SharedValue<SimState>; cfg: SimConfig; count: number }> = React.memo(
  ({ sim, cfg, count }) => (
    <Group>
      {Array.from({ length: Math.min(CHICKS.MAX, count) }, (_, i) => (
        <Chick key={i} sim={sim} cfg={cfg} index={i} />
      ))}
    </Group>
  ),
);

// Balloon offset behind and above the head, low enough to stay on screen
const BALLOON_X_U = 12;
const BALLOON_Y_U = 34;

/** Things attached to the flamingo: the balloon (saved fall), magnet field, feather calm aura, flap ring. */
export const StorkExtrasRenderer: React.FC<{ sim: SharedValue<SimState>; cfg: SimConfig; layer: 'back' | 'front' }> =
  React.memo(({ sim, cfg, layer }) => {
    const U = cfg.unit;
    const bodyLocalY = (STORK.HIP_Y + STORK.BODY_Y) * U;

    // Balloon floats up-left of the body, tied to the back
    const balloonTransform = useDerivedValue(() => {
      const s = sim.value;
      const sway = Math.sin(s.t * 2.2) * U * 1.2;
      return [
        { translateX: cfg.storkX - BALLOON_X_U * U + sway },
        { translateY: s.feetY - s.camY - BALLOON_Y_U * U + Math.sin(s.t * 3) * U * 0.6 },
      ];
    });
    const balloonOpacity = useDerivedValue(() => {
      const s = sim.value;
      return s.shield > 0 && (s.mode === MODE_PLAYING || s.mode === MODE_OVER) ? 1 : 0;
    });
    const string = usePathValue((p) => {
      'worklet';
      const s = sim.value;
      if (s.shield <= 0) return;
      const cos = Math.cos(s.angle);
      const sin = Math.sin(s.angle);
      const lx = -3.5 * U;
      const ly = bodyLocalY - 2 * U;
      const ax = cfg.storkX + lx * cos - ly * sin;
      const ay = s.feetY - s.camY + lx * sin + ly * cos;
      const sway = Math.sin(s.t * 2.2) * U * 1.2;
      const bx = cfg.storkX - BALLOON_X_U * U + sway;
      const by = s.feetY - s.camY - BALLOON_Y_U * U + Math.sin(s.t * 3) * U * 0.6 + 3.2 * U;
      p.moveTo(ax, ay);
      p.quadTo((ax + bx) / 2 - 2 * U, (ay + by) / 2, bx, by);
    });

    // Magnet: arcs pulse outward from the chest
    const magnetArcs = usePathValue((p) => {
      'worklet';
      const s = sim.value;
      if (s.magnetT <= 0 || s.mode !== MODE_PLAYING) return;
      const cx = cfg.storkX + Math.sin(s.angle) * 16 * U;
      const cy = s.feetY - s.camY - Math.cos(s.angle) * 16 * U;
      for (let i = 0; i < 3; i++) {
        const k = (s.t * 1.5 + i / 3) % 1;
        const r = U * (6 + k * 11);
        p.addArc(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2), -40, 80);
      }
    });
    const magnetOpacity = useDerivedValue(() => Math.min(1, sim.value.magnetT) * 0.55);

    // Feather calm: small feathers drift around the body
    const calmFeathers = usePathValue((p) => {
      'worklet';
      const s = sim.value;
      if (s.featherT <= 0 || s.mode !== MODE_PLAYING) return;
      for (let i = 0; i < 4; i++) {
        const a = s.t * 1.4 + (i / 4) * Math.PI * 2;
        const x = cfg.storkX + Math.cos(a) * 11 * U;
        const y = s.feetY - s.camY - 18 * U + Math.sin(a) * 6 * U;
        const rot = a + Math.PI / 2;
        const len = 1.6 * U;
        const dx = Math.cos(rot) * len;
        const dy = Math.sin(rot) * len;
        p.moveTo(x - dx, y - dy);
        p.quadTo(x - dy * 0.5, y + dx * 0.5, x + dx, y + dy);
        p.quadTo(x + dy * 0.5, y - dx * 0.5, x - dx, y - dy);
        p.close();
      }
    });
    const calmOpacity = useDerivedValue(() => Math.min(1, sim.value.featherT) * 0.9);
    const calmGlow = useDerivedValue(() => Math.min(1, sim.value.featherT) * (0.12 + 0.05 * Math.sin(sim.value.t * 4)));
    const calmCenter = useDerivedValue(() => {
      const s = sim.value;
      return [{ translateX: cfg.storkX }, { translateY: s.feetY - s.camY - 17 * U }];
    });

    // Flap: a ring of air bursts out from the wings
    const flapRing = usePathValue((p) => {
      'worklet';
      const s = sim.value;
      if (s.flapAnim <= 0) return;
      const k = 1 - s.flapAnim / 0.5;
      const cx = cfg.storkX + Math.sin(s.angle) * 16 * U;
      const cy = s.feetY - s.camY - Math.cos(s.angle) * 16 * U;
      const r = U * (5 + k * 14);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 360;
        p.addArc(Skia.XYWHRect(cx - r, cy - r, r * 2, r * 2), a, 22);
      }
    });
    const flapOpacity = useDerivedValue(() => sim.value.flapAnim / 0.5);

    const balloonR = 3.2 * U;
    const shine = useMemo(() => Skia.XYWHRect(-balloonR * 0.5, -balloonR * 0.75, balloonR * 0.4, balloonR * 0.65), [balloonR]);

    if (layer === 'back') {
      return (
        <Group>
          <Group transform={calmCenter} opacity={calmGlow}>
            <Circle cx={0} cy={0} r={16 * U} color="#9EE7FF" />
          </Group>
          <Group opacity={balloonOpacity}>
            <Path path={string} color={INK} style="stroke" strokeWidth={U * 0.22} />
            <Group transform={balloonTransform}>
              <Oval x={-balloonR} y={-balloonR * 1.2} width={balloonR * 2} height={balloonR * 2.4} color="#FF5A6E" />
              <Oval x={-balloonR} y={-balloonR * 1.2} width={balloonR * 2} height={balloonR * 2.4} color={INK} style="stroke" strokeWidth={U * 0.35} />
              <Oval rect={shine} color="rgba(255,255,255,0.65)" />
            </Group>
          </Group>
        </Group>
      );
    }
    return (
      <Group>
        <Path path={magnetArcs} color="#FF7A8C" style="stroke" strokeWidth={U * 0.45} strokeCap="round" opacity={magnetOpacity} />
        <Path path={calmFeathers} color="#E8FBFF" opacity={calmOpacity} />
        <Path path={calmFeathers} color="#6FC3E0" style="stroke" strokeWidth={U * 0.2} opacity={calmOpacity} />
        <Path path={flapRing} color="#FFFFFF" style="stroke" strokeWidth={U * 0.6} strokeCap="round" opacity={flapOpacity} />
      </Group>
    );
  });
