import React from 'react';
import { Group, LinearGradient, Path, Rect, usePathValue, vec } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import {
  ANIM,
  ENV_GUST,
  EVT_ENVIRONMENT,
  MODE_ATTRACT,
  MODE_FALLING,
  MODE_OVER,
  MODE_PLAYING,
  STAGE_ACTIVE,
  WALK,
  WEATHER_RAIN,
  WEATHER_SNOW,
  WEATHER_WINDY,
} from '../sim/constants';
import type { SimState } from '../sim/state';
import { STORK } from '../sim/storkGeometry';
import type { SimConfig } from '../sim/terrain';
import type { Palette } from './palette';

interface Props {
  sim: SharedValue<SimState>;
  palette: SharedValue<Palette>;
  cfg: SimConfig;
  /** Loose feathers use the character's body color */
  featherColor?: string;
}

/** Deterministic hash in 0..1 */
function hash(i: number, salt: number): number {
  'worklet';
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** World-space particles: footstep dust, combo burst, sweat, fall impact, weather. */
export const WorldEffectsRenderer: React.FC<Props> = React.memo(({ sim, palette, cfg, featherColor = '#FF7A9A' }) => {
  const { width, height, unit: U, storkX } = cfg;

  const dust = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    if (s.mode !== MODE_PLAYING && s.mode !== MODE_ATTRACT) return;
    if (s.speed <= 0.05) return;
    const steps = s.walkPhase * 2;
    const hz = s.speed * WALK.CYCLES_PER_METER;
    const scrollSpeed = s.speed * cfg.pxPerMeter;
    const baseY = s.feetY - s.camY;
    for (let k = 0; k < 4; k++) {
      const idx = Math.floor(steps) - k;
      const ageSteps = steps - idx;
      const age = ageSteps / 2 / Math.max(hz, 0.1);
      if (age > 0.55) continue;
      const side = idx % 2 === 0 ? 1 : -1;
      const x = storkX + side * U * 1.2 - age * scrollSpeed;
      const r = U * (0.5 + age * 2.6) * (1 - age / 0.7);
      p.addCircle(x - U * 0.8, baseY - age * U * 3, r);
      p.addCircle(x + U * 0.6, baseY - age * U * 2, r * 0.7);
    }
  });

  const burst = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    if (s.comboPulse <= 0) return;
    const k = 1 - s.comboPulse / ANIM.COMBO_PULSE;
    const cx = storkX;
    const cy = s.feetY - s.camY + (STORK.HIP_Y + STORK.BODY_Y) * U;
    const dist = U * (3 + k * 12);
    const size = U * 0.9 * (1 - k);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = cx + Math.cos(a) * dist;
      const y = cy + Math.sin(a) * dist;
      // four-point star
      p.moveTo(x, y - size * 1.6);
      p.lineTo(x + size * 0.45, y - size * 0.45);
      p.lineTo(x + size * 1.6, y);
      p.lineTo(x + size * 0.45, y + size * 0.45);
      p.lineTo(x, y + size * 1.6);
      p.lineTo(x - size * 0.45, y + size * 0.45);
      p.lineTo(x - size * 1.6, y);
      p.lineTo(x - size * 0.45, y - size * 0.45);
      p.close();
    }
  });

  const sweat = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    if (s.mode !== MODE_PLAYING || s.danger < 0.55) return;
    const intensity = (s.danger - 0.55) / 0.45;
    const cos = Math.cos(s.angle);
    const sin = Math.sin(s.angle);
    const hx = STORK.HEAD_X * U - U * 1.5;
    const hy = (STORK.HIP_Y + STORK.HEAD_Y - 2.4) * U;
    const headX = storkX + hx * cos - hy * sin;
    const headY = s.feetY - s.camY + hx * sin + hy * cos;
    for (let i = 0; i < 3; i++) {
      const life = (s.t * 2.2 + i / 3) % 1;
      const side = i === 1 ? 1 : -1;
      const x = headX + side * (U * 1.5 + life * U * 3.5);
      const y = headY - U * 1.2 + life * life * U * 6 - life * U * 2.5;
      const r = U * 0.45 * intensity * (1 - life * 0.5);
      p.moveTo(x, y - r * 2);
      p.quadTo(x + r * 1.1, y + r * 0.1, x, y + r);
      p.quadTo(x - r * 1.1, y + r * 0.1, x, y - r * 2);
      p.close();
    }
  });

  // Feathers puff out when the flamingo gets hit or falls over
  const feathers = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    let k = -1;
    let count = 0;
    let spread = 1;
    if (s.hurtT > ANIM.HURT - 0.8 && s.mode === MODE_PLAYING) {
      k = (ANIM.HURT - s.hurtT) / 0.8;
      count = 6;
    } else if ((s.mode === MODE_FALLING || s.mode === MODE_OVER) && s.fallT < 1.0) {
      k = s.fallT;
      count = 9;
      spread = 1.4;
    }
    if (k < 0 || k >= 1) return;
    const cos = Math.cos(s.angle);
    const sin = Math.sin(s.angle);
    const by = (STORK.HIP_Y + STORK.BODY_Y) * U;
    const cx = storkX - by * sin;
    const cy = s.feetY - s.camY + by * cos;
    for (let i = 0; i < count; i++) {
      const a = hash(i, 31) * Math.PI * 2;
      const speed = U * (6 + hash(i, 32) * 8) * spread;
      const x = cx + Math.cos(a) * speed * k * 1.2 + Math.sin(s.t * 6 + i) * U * 1.2 * k;
      const y = cy + Math.sin(a) * speed * k * 0.6 + k * k * U * 10;
      const rot = s.t * 5 + i * 1.3;
      const len = U * (1.4 + hash(i, 33) * 0.6) * (1 - k * 0.5);
      const dx = Math.cos(rot) * len;
      const dy = Math.sin(rot) * len;
      const w = 0.4;
      p.moveTo(x - dx, y - dy);
      p.quadTo(x - dy * w, y + dx * w, x + dx, y + dy);
      p.quadTo(x + dy * w, y - dx * w, x - dx, y - dy);
      p.close();
    }
  });

  const impact = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    if (s.mode !== MODE_FALLING && s.mode !== MODE_OVER) return;
    const k = Math.min(1, s.fallT / 0.7);
    if (k >= 1) return;
    const baseY = s.feetY - s.camY;
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + (i / 13) * Math.PI;
      const speed = U * (5 + hash(i, 3) * 7);
      const x = storkX + Math.cos(a) * speed * k * 1.4;
      const y = baseY + Math.sin(a) * speed * k + k * k * U * 5;
      p.addCircle(x, y, U * (0.9 + hash(i, 7) * 0.7) * (1 - k));
    }
  });

  const snowfall = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    const amt = s.weather === WEATHER_SNOW ? s.weatherAmt : 0;
    if (amt < 0.02) return;
    const count = Math.floor(70 * amt);
    for (let i = 0; i < count; i++) {
      const speed = 40 + hash(i, 41) * 50;
      const drift = Math.sin(s.t * (0.8 + hash(i, 42)) + i) * 14;
      const span = width + 40;
      const x = ((((hash(i, 43) * span - s.scrollX * 0.25 + drift) % span) + span) % span) - 20;
      const y = ((hash(i, 44) * (height + 20) + s.t * speed) % (height + 20)) - 10;
      p.addCircle(x, y, 1.2 + hash(i, 45) * 1.8);
    }
  });

  // Fever: golden sparkles swirl around the flamingo
  const feverSparkles = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    if (s.feverT <= 0 || s.mode !== MODE_PLAYING) return;
    const cx = storkX;
    const cy = s.feetY - s.camY - 16 * U;
    for (let i = 0; i < 10; i++) {
      const life = (s.t * 0.9 + hash(i, 51)) % 1;
      const a = hash(i, 52) * Math.PI * 2 + s.t * 1.5;
      const r = U * (6 + life * 14);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.8 - life * U * 6;
      const size = U * 0.9 * (1 - life);
      p.moveTo(x, y - size * 1.6);
      p.lineTo(x + size * 0.4, y - size * 0.4);
      p.lineTo(x + size * 1.6, y);
      p.lineTo(x + size * 0.4, y + size * 0.4);
      p.lineTo(x, y + size * 1.6);
      p.lineTo(x - size * 0.4, y + size * 0.4);
      p.lineTo(x - size * 1.6, y);
      p.lineTo(x - size * 0.4, y - size * 0.4);
      p.close();
    }
  });
  // Rainbow cycle computed as rgb so it doesn't depend on hsl() parsing
  const feverColor = useDerivedValue(() => {
    const h = sim.value.t * 3;
    const r = Math.round(200 + 55 * Math.sin(h));
    const g = Math.round(200 + 55 * Math.sin(h + 2.1));
    const b = Math.round(200 + 55 * Math.sin(h + 4.2));
    return `rgb(${r},${g},${b})`;
  });

  const rain = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    const amt = s.weather === WEATHER_RAIN ? s.weatherAmt : 0;
    if (amt < 0.02) return;
    const count = Math.floor(80 * amt);
    const slant = 4 + s.wind * 1.2;
    for (let i = 0; i < count; i++) {
      const speed = 620 + hash(i, 1) * 260;
      const x = (((hash(i, 2) * (width + 80) - s.t * slant * 30 - s.scrollX * 0.3) % (width + 80)) + width + 80) % (width + 80) - 40;
      const y = ((hash(i, 3) * (height + 40) + s.t * speed) % (height + 40)) - 20;
      p.moveTo(x, y);
      p.lineTo(x + slant, y + 16);
    }
  });

  const leaves = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    const gust = s.evStage === STAGE_ACTIVE && s.evType === EVT_ENVIRONMENT && s.evSub === ENV_GUST;
    const windy = s.weather === WEATHER_WINDY ? s.weatherAmt : 0;
    const amount = Math.max(windy, gust ? 1 : 0);
    if (amount < 0.02) return;
    const dir = gust ? s.evDir : s.wind >= 0 ? 1 : -1;
    const count = Math.floor(22 * amount);
    const span = width + 120;
    for (let i = 0; i < count; i++) {
      const speed = 160 + hash(i, 4) * 180 + (gust ? 180 : 0);
      const raw = hash(i, 5) * span + dir * s.t * speed;
      const x = ((raw % span) + span) % span - 60;
      const y = hash(i, 6) * height * 0.85 + Math.sin(s.t * 3 + i) * 18;
      const a = s.t * (4 + hash(i, 8) * 4) + i;
      const len = U * (0.9 + hash(i, 9) * 0.6);
      const c = Math.cos(a) * len;
      const d = Math.sin(a) * len;
      p.moveTo(x - c, y - d);
      p.quadTo(x - d * 0.6, y + c * 0.6, x + c, y + d);
      p.quadTo(x + d * 0.6, y - c * 0.6, x - c, y - d);
      p.close();
    }
  });

  const gustLines = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    const gust = s.evStage === STAGE_ACTIVE && s.evType === EVT_ENVIRONMENT && s.evSub === ENV_GUST;
    if (!gust) return;
    const span = width + 200;
    for (let i = 0; i < 9; i++) {
      const raw = hash(i, 11) * span + s.evDir * s.t * (520 + hash(i, 12) * 200);
      const x = ((raw % span) + span) % span - 100;
      const y = height * (0.12 + hash(i, 13) * 0.6);
      const len = 50 + hash(i, 14) * 50;
      p.moveTo(x, y);
      p.quadTo(x - s.evDir * len * 0.5, y - 6, x - s.evDir * len, y + 2);
    }
  });

  const dustColor = useDerivedValue(() => palette.value.grassLight);
  const leafColor = useDerivedValue(() => palette.value.canopyLight);
  const overlay = useDerivedValue(() => palette.value.overlay);

  return (
    <Group>
      <Path path={dust} color={dustColor} opacity={0.55} />
      <Path path={impact} color="#B08A63" />
      <Path path={feathers} color={featherColor} />
      <Path path={feathers} color="#3B1F2B" style="stroke" strokeWidth={U * 0.2} strokeJoin="round" opacity={0.6} />
      <Path path={leaves} color={leafColor} />
      <Path path={gustLines} color="rgba(255,255,255,0.7)" style="stroke" strokeWidth={2} strokeCap="round" />
      <Rect x={-40} y={-40} width={width + 80} height={height * 2} color={overlay} />
      <Path path={rain} color="rgba(190,215,255,0.6)" style="stroke" strokeWidth={1.4} strokeCap="round" />
      <Path path={snowfall} color="rgba(255,255,255,0.9)" />
      <Path path={feverSparkles} color={feverColor} />
      <Path path={burst} color="#FFD84A" />
      <Path path={sweat} color="#8FD3FF" />
    </Group>
  );
});

/** Screen-space overlays: danger vignette, hit flash, sprint speed lines. */
export const ScreenEffectsRenderer: React.FC<Props> = React.memo(({ sim, cfg }) => {
  const { width, height } = cfg;
  const vignette = useDerivedValue(() => {
    const d = sim.value.danger;
    if (sim.value.mode !== MODE_PLAYING || d < 0.5) return 0;
    return Math.min(1, (d - 0.5) * 2) * (0.75 + 0.25 * Math.sin(sim.value.t * 14));
  });
  const flash = useDerivedValue(() => (sim.value.hitFlash / ANIM.HIT_FLASH) * 0.4);
  const fever = useDerivedValue(() => {
    const s = sim.value;
    if (s.feverT <= 0 || s.mode !== MODE_PLAYING) return 0;
    const fadeOut = Math.min(1, s.feverT / 0.6);
    return fadeOut * (0.65 + 0.35 * Math.sin(s.t * 10));
  });

  const speedLines = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    const k = (s.speedMod - 1.1) / 0.6;
    if (k <= 0) return;
    const span = width + 300;
    for (let i = 0; i < 12; i++) {
      const raw = hash(i, 21) * span - s.t * (900 + hash(i, 22) * 500);
      const x = ((raw % span) + span) % span - 150;
      const y = height * (0.08 + hash(i, 23) * 0.84);
      const len = (60 + hash(i, 24) * 90) * Math.min(1, k);
      p.moveTo(x, y);
      p.lineTo(x + len, y);
    }
  });
  const speedOpacity = useDerivedValue(() => Math.min(0.7, (sim.value.speedMod - 1.1) * 1.2));
  const slowOpacity = useDerivedValue(() => Math.max(0, (0.95 - sim.value.speedMod) * 0.5));

  const edge = width * 0.14;
  const vEdge = height * 0.16;
  return (
    <Group>
      <Group opacity={vignette}>
        <Rect x={0} y={0} width={edge} height={height}>
          <LinearGradient start={vec(0, 0)} end={vec(edge, 0)} colors={['rgba(255,40,60,0.55)', 'rgba(255,40,60,0)']} />
        </Rect>
        <Rect x={width - edge} y={0} width={edge} height={height}>
          <LinearGradient start={vec(width, 0)} end={vec(width - edge, 0)} colors={['rgba(255,40,60,0.55)', 'rgba(255,40,60,0)']} />
        </Rect>
        <Rect x={0} y={0} width={width} height={vEdge}>
          <LinearGradient start={vec(0, 0)} end={vec(0, vEdge)} colors={['rgba(255,40,60,0.45)', 'rgba(255,40,60,0)']} />
        </Rect>
        <Rect x={0} y={height - vEdge} width={width} height={vEdge}>
          <LinearGradient start={vec(0, height)} end={vec(0, height - vEdge)} colors={['rgba(255,40,60,0.45)', 'rgba(255,40,60,0)']} />
        </Rect>
      </Group>
      <Rect x={0} y={0} width={width} height={height} color="rgba(120,140,255,1)" opacity={slowOpacity} />
      <Path path={speedLines} color="#FFFFFF" style="stroke" strokeWidth={2} strokeCap="round" opacity={speedOpacity} />
      <Group opacity={fever}>
        <Rect x={0} y={0} width={edge * 0.7} height={height}>
          <LinearGradient start={vec(0, 0)} end={vec(edge * 0.7, 0)} colors={['rgba(255,200,40,0.55)', 'rgba(255,120,200,0)']} />
        </Rect>
        <Rect x={width - edge * 0.7} y={0} width={edge * 0.7} height={height}>
          <LinearGradient start={vec(width, 0)} end={vec(width - edge * 0.7, 0)} colors={['rgba(255,200,40,0.55)', 'rgba(255,120,200,0)']} />
        </Rect>
        <Rect x={0} y={0} width={width} height={vEdge * 0.7}>
          <LinearGradient start={vec(0, 0)} end={vec(0, vEdge * 0.7)} colors={['rgba(255,120,200,0.45)', 'rgba(255,200,40,0)']} />
        </Rect>
      </Group>
      <Rect x={0} y={0} width={width} height={height} color="#FFFFFF" opacity={flash} />
    </Group>
  );
});
