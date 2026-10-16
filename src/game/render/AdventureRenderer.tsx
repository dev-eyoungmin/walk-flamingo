import React, { useMemo } from 'react';
import { Circle, Group, Oval, Path, RoundedRect, Skia, Text, usePathValue, useTypeface } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { fill, t } from '../../i18n';
import { DISPLAY_SOURCE } from '../../i18n/fonts';
import { ghostMetersAt } from '../../lib/ghost';
import type { SkinPalette } from '../../lib/skins';
import { CHICKS, COIN, ENV_LEAVES, ENV_WAVE, EVT_ENVIRONMENT, MODE_PLAYING, STAGE_ACTIVE } from '../sim/constants';
import type { SimState } from '../sim/state';
import { SimConfig, terrainOffsetAt } from '../sim/terrain';
import { fitFont } from './FeatureHud';
import { StorkPose, StorkRenderer } from './StorkRenderer';

const COPY = {
  gold: t('play.goldHint'), perfect: t('play.perfect'), rest: t('play.rest'), rescue: t('play.rescue'), nest: t('play.nest'),
  saved: t('play.saved'), ghost: t('play.ghost'), stages: [t('play.stage1'), t('play.stage2'), t('play.stage3')],
};
const BABY: SkinPalette = { id: 'rescue', name: 'Baby', body: '#FFE3AE', bodyLight: '#FFF8DD', legs: '#CC9D84', legsDark: '#B47C64', wing: '#FFD4A0', neck: '#FFE3AE', cheek: '#FF92AD' };

/** World markers and a translucent personal-best distance ghost, with no input or collision. */
export const AdventureWorld: React.FC<{ sim: SharedValue<SimState>; cfg: SimConfig; skin: SkinPalette; trace?: number[] }> = ({ sim, cfg, skin, trace = [] }) => {
  const U = cfg.unit;
  const ghostPose = useDerivedValue<StorkPose>(() => {
    const s = sim.value;
    const m = ghostMetersAt(trace, s.t - s.playStart);
    const offsetX = (m - s.meters) * cfg.pxPerMeter;
    return { t: s.t, omega: 0, walkPhase: s.walkPhase, fallT: 0, camY: s.camY, slope: 0, invulnT: 0, happyT: s.happyT, hurtT: 0, cheerT: s.cheerT, lookX: 0.5, lookY: 0, angle: 0, offsetX, feetY: cfg.groundY + terrainOffsetAt(cfg, s.scrollX + cfg.storkX + offsetX), mode: MODE_PLAYING, danger: 0, flapAnim: 0 };
  });
  const ghostVisible = useDerivedValue(() => trace.length && sim.value.mode === MODE_PLAYING && Math.abs(ghostPose.value.offsetX ?? 0) < cfg.width ? 0.24 : 0);
  const babyPose = useDerivedValue<StorkPose>(() => {
    const s = sim.value;
    const offsetX = s.rescueCargo ? -(CHICKS.FIRST_OFFSET_U + CHICKS.SPACING_U * s.chicks) * U : s.rescueX - s.scrollX - cfg.storkX;
    return { t: s.t, omega: 0, walkPhase: s.walkPhase, fallT: 0, camY: s.camY, slope: 0, invulnT: 0, happyT: s.happyT, hurtT: 0, cheerT: s.cheerT, lookX: 0.5, lookY: 0, angle: s.rescueCargo ? s.angle * 0.5 : Math.sin(s.t * 2) * 0.06, offsetX, feetY: cfg.groundY + terrainOffsetAt(cfg, s.scrollX + cfg.storkX + offsetX), danger: 0, mode: MODE_PLAYING, flapAnim: 0 };
  });
  const babyVisible = useDerivedValue(() => sim.value.mode === MODE_PLAYING && (sim.value.rescueCargo || sim.value.rescueX >= 0) ? 1 : 0);
  const nestTransform = useDerivedValue(() => {
    const s = sim.value;
    const x = cfg.storkX + (s.nestAt - s.meters) * cfg.pxPerMeter;
    return [{ translateX: x }, { translateY: cfg.groundY + terrainOffsetAt(cfg, s.scrollX + x) - s.camY }];
  });
  const nestVisible = useDerivedValue(() => sim.value.mode === MODE_PLAYING && sim.value.rescueCargo ? 1 : 0);
  const nestTwigs = useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = 0; i < 7; i++) {
      p.moveTo((-5 + i * 1.2) * U, -1 * U);
      p.lineTo((-3 + i * 1.2) * U, -3 * U);
    }
    return p;
  }, [U]);
  const regional = usePathValue(p => {
    'worklet';
    const s = sim.value;
    if (s.evStage !== STAGE_ACTIVE || s.evType !== EVT_ENVIRONMENT) return;
    if (s.evSub === ENV_WAVE) {
      const y = s.feetY - s.camY + 4 * U;
      p.moveTo(0, y);
      for (let x = 0; x <= cfg.width; x += 8) p.lineTo(x, y + Math.sin(x / 25 - s.t * 3) * 2 * U);
    } else if (s.evSub === ENV_LEAVES) {
      for (let i = 0; i < 18; i++) {
        const x = ((i * 61 + s.t * 90 * s.evDir) % cfg.width + cfg.width) % cfg.width;
        const y = 55 + (i * 37 + s.t * 20) % (cfg.height - 80);
        p.addOval(Skia.XYWHRect(x, y, U * 2, U));
      }
    }
  });
  const regionalColor = useDerivedValue(() => sim.value.evSub === ENV_WAVE ? '#7FDBFF' : '#FFA944');
  return <Group>
    <Group opacity={ghostVisible}><StorkRenderer pose={ghostPose} unit={U} x={cfg.storkX} skin={skin} shadow={false} /></Group>
    <Group opacity={babyVisible}><StorkRenderer pose={babyPose} unit={U * 0.45} x={cfg.storkX} skin={BABY} /></Group>
    <Group transform={nestTransform} opacity={nestVisible}>
      <Oval x={-7*U} y={-3*U} width={14*U} height={4*U} color="#9D6542" />
      <Oval x={-5*U} y={-3*U} width={10*U} height={2*U} color="#E0B878" />
      <Path path={nestTwigs} color="#6B3F2D" style="stroke" strokeWidth={U * 0.5} />
      <Circle cx={0} cy={-7*U} r={2*U} color="#5EE6C9" />
    </Group>
    <Path path={regional} color={regionalColor} style="stroke" strokeWidth={U * 0.6} opacity={0.8} />
  </Group>;
};

export const AdventureHud: React.FC<{ sim: SharedValue<SimState>; cfg: SimConfig; trace?: number[] }> = ({ sim, cfg, trace = [] }) => {
  const typeface = useTypeface(DISPLAY_SOURCE);
  const x = cfg.storkX + 14 * cfg.unit;
  const maxW = Math.max(80, cfg.width - x - 85);
  const fonts = useMemo(() => {
    if (!typeface) return null;
    const base = Skia.Font(typeface, 13);
    return { body: fitFont(base, typeface, [...Object.values(COPY).filter(v => typeof v === 'string'), ...COPY.stages].join(' ').slice(0, 32), maxW), perfect: Skia.Font(typeface, 23) };
  }, [typeface, maxW]);
  const visible = useDerivedValue(() => sim.value.mode === MODE_PLAYING ? 1 : 0);
  const status = useDerivedValue(() => {
    const s = sim.value;
    if (s.rescueCargo) return fill(COPY.nest, { n: Math.max(0, Math.ceil(s.nestAt - s.meters)) });
    if (s.rescueX >= 0) return COPY.rescue;
    if (s.t < s.restUntil) return COPY.rest;
    for (let c = 0; c < s.coinSlots.length; c += COIN.SLOT) {
      if (s.coinSlots[c] > 0.5 && s.coinSlots[c+5] === 2 && s.coinSlots[c+1] - s.scrollX < cfg.width && s.coinSlots[c+1] - s.scrollX > cfg.storkX - 10*cfg.unit) return COPY.gold;
    }
    return s.rescued ? fill(COPY.saved, { n: s.rescued }) : '';
  });
  const goal = useDerivedValue(() => {
    const s = sim.value;
    if (!s.stage) return '';
    const limit = s.stage === 1 ? 60 : s.stage === 2 ? 90 : 100;
    const count = s.stage === 1 ? `${Math.floor(s.meters)}/60m` : s.stage === 2 ? `${s.dodges}/5` : `${s.rescued}/2`;
    return `${count} / ${Math.max(0, Math.ceil(limit - s.t + s.playStart))}s`;
  });
  const ghostText = useDerivedValue(() => trace.length ? fill(COPY.ghost, { n: Math.floor(ghostMetersAt(trace, sim.value.t - sim.value.playStart)) }) : '');
  const perfectOpacity = useDerivedValue(() => Math.min(1, sim.value.perfectT * 3));
  const progressW = useDerivedValue(() => {
    const s = sim.value;
    const ratio = s.stage === 1 ? s.meters / 60 : s.stage === 2 ? s.dodges / 5 : s.stage === 3 ? s.rescued / 2 : 0;
    return maxW * Math.min(1, ratio);
  });
  const goalOpacity = useDerivedValue(() => sim.value.stage ? 1 : 0);
  if (!fonts) return null;
  return <Group opacity={visible}>
    <Group opacity={goalOpacity}>
      <RoundedRect x={x-6} y={cfg.height*0.36-15} width={maxW+12} height={31} r={8} color="rgba(43,22,48,0.65)" />
      <Text x={x} y={cfg.height*0.36} text={goal} font={fonts.body} color="#FFFFFF" />
      <RoundedRect x={x} y={cfg.height*0.36+7} width={maxW} height={3} r={1.5} color="#60546A" />
      <RoundedRect x={x} y={cfg.height*0.36+7} width={progressW} height={3} r={1.5} color="#5EE6C9" />
    </Group>
    <Text x={x} y={cfg.height*0.48} text={status} font={fonts.body} color="#2B1630" style="stroke" strokeWidth={3} />
    <Text x={x} y={cfg.height*0.48} text={status} font={fonts.body} color="#FFE3AE" />
    <Text x={x} y={cfg.height*0.56} text={ghostText} font={fonts.body} color="#FFFFFF" />
    <Group opacity={perfectOpacity}>
      <Text x={cfg.storkX-50} y={cfg.height*0.33} text={COPY.perfect} font={fonts.perfect} color="#2B1630" style="stroke" strokeWidth={4} />
      <Text x={cfg.storkX-50} y={cfg.height*0.33} text={COPY.perfect} font={fonts.perfect} color="#FFE14D" />
    </Group>
  </Group>;
};
