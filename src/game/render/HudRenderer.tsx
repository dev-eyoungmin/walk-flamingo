import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import {
  Circle,
  Group,
  LinearGradient,
  Path,
  Rect,
  RoundedRect,
  Skia,
  SkFont,
  Text,
  useTypeface,
  vec,
} from '@shopify/react-native-skia';
import { DerivedValue, SharedValue, useDerivedValue } from 'react-native-reanimated';
import {
  ANIM,
  CHL_CENTERED,
  CHL_LEAN,
  ENV_GUST,
  ENV_ICE,
  EVENTS,
  EVT_CHALLENGE,
  EVT_ENVIRONMENT,
  EVT_NONE,
  EVT_OBSTACLE,
  EVT_SPEED,
  FLOAT_TEXT,
  MODE_PLAYING,
  OBS_BRANCH,
  OBS_ROCK,
  PHYSICS,
  POPUP_BIOME,
  POPUP_CHICK,
  POPUP_FEVER,
  POPUP_ITEM,
  POPUP_MILESTONE,
  POPUP_RANK,
  POPUP_SHIELD,
  BIOME_NAMES,
  CHICKS,
  ITEM_FEATHER,
  ITEM_MAGNET,
  SCORE,
  SPD_SPRINT,
  STAGE_ACTIVE,
  STAGE_IDLE,
  STAGE_WARNING,
  TEXT_KIND_BONK,
  TEXT_KIND_BONUS,
  TEXT_KIND_BRACE,
  TEXT_KIND_COIN,
  TEXT_KIND_DODGE,
} from '../sim/constants';
import type { SimState } from '../sim/state';
import { STORK } from '../sim/storkGeometry';
import type { SimConfig } from '../sim/terrain';
import { RANK_NAMES } from '../../lib/ranks';
import { FeatureHud, TUTORIAL_Y_RATIO, tutorialTextX } from './FeatureHud';

interface Props {
  sim: SharedValue<SimState>;
  cfg: SimConfig;
  bestScore: number;
  /** Show onboarding hints (first few runs) */
  showTutorial?: boolean;
}

const FONT_SOURCE = require('../../../assets/fonts/LilitaOne-Regular.ttf');
const INK = '#2B1630';
const PAD_X = Platform.OS === 'ios' ? 50 : 18;

export function formatNumber(n: number): string {
  'worklet';
  const v = Math.floor(Math.max(0, n));
  const str = String(v);
  let out = '';
  for (let i = 0; i < str.length; i++) {
    if (i > 0 && (str.length - i) % 3 === 0) out += ',';
    out += str[i];
  }
  return out;
}

function textWidth(font: SkFont, text: string): number {
  'worklet';
  return font.getTextWidth(text);
}

/** Text with a chunky dark outline, readable over any sky. */
const OutlinedText: React.FC<{
  x: number | DerivedValue<number>;
  y: number | DerivedValue<number>;
  text: string | DerivedValue<string>;
  font: SkFont;
  color: string | DerivedValue<string>;
  stroke?: number;
}> = ({ x, y, text, font, color, stroke = 4 }) => (
  <>
    <Text x={x} y={y} text={text} font={font} color={INK} style="stroke" strokeWidth={stroke} strokeJoin="round" />
    <Text x={x} y={y} text={text} font={font} color={color} />
  </>
);

function arrowPath(size: number) {
  const p = Skia.Path.Make();
  // Points right; flip with scaleX
  p.moveTo(-size * 0.9, -size * 0.32);
  p.lineTo(size * 0.05, -size * 0.32);
  p.lineTo(size * 0.05, -size * 0.75);
  p.lineTo(size, 0);
  p.lineTo(size * 0.05, size * 0.75);
  p.lineTo(size * 0.05, size * 0.32);
  p.lineTo(-size * 0.9, size * 0.32);
  p.close();
  return p;
}


function bannerInfo(s: SimState): { text: string; color: string; arrow: number } {
  'worklet';
  const t = s.evType;
  const sub = s.evSub;
  if (t === EVT_OBSTACLE) {
    return { text: sub === OBS_ROCK ? 'ROCK! LEAN' : 'HEADS UP! LEAN', color: '#E8475F', arrow: -s.evDir };
  }
  if (t === EVT_ENVIRONMENT) {
    if (sub === ENV_GUST) return { text: 'GUST! PUSH BACK', color: '#3D8BFF', arrow: -s.evDir };
    if (sub === ENV_ICE) return { text: 'ICE! SLIPPERY', color: '#35B4E6', arrow: 0 };
    return { text: 'QUAKE!', color: '#C98A3D', arrow: 0 };
  }
  if (t === EVT_CHALLENGE) {
    if (sub === CHL_CENTERED) return { text: 'STAY CENTERED', color: '#F29C1F', arrow: 0 };
    if (sub === CHL_LEAN) return { text: 'LEAN AND HOLD', color: '#F29C1F', arrow: s.evDir };
    return { text: 'SURVIVE THE STORM', color: '#F29C1F', arrow: 0 };
  }
  if (t === EVT_SPEED) {
    return sub === SPD_SPRINT
      ? { text: 'SPRINT! x1.5 POINTS', color: '#8E5BFF', arrow: 0 }
      : { text: 'SLOW DOWN', color: '#6C7BD9', arrow: 0 };
  }
  return { text: '', color: '#000000', arrow: 0 };
}

export const HudRenderer: React.FC<Props> = React.memo(({ sim, cfg, bestScore, showTutorial = false }) => {
  const typeface = useTypeface(FONT_SOURCE);
  const fonts = useMemo(() => {
    if (!typeface) return null;
    return {
      xs: Skia.Font(typeface, 12),
      sm: Skia.Font(typeface, 15),
      md: Skia.Font(typeface, 19),
      lg: Skia.Font(typeface, 26),
      xl: Skia.Font(typeface, 34),
    };
  }, [typeface]);

  const { width: W, height: H, unit: U, storkX } = cfg;
  const arrow = useMemo(() => arrowPath(11), []);
  const bigArrow = useMemo(() => arrowPath(U * 3), [U]);

  const playing = useDerivedValue(() => (sim.value.mode === MODE_PLAYING ? 1 : 0));
  const visible = useDerivedValue(() => (sim.value.mode === 0 ? 0 : 1));

  // ── Score (top-left) ──
  const scoreText = useDerivedValue<string>(() => formatNumber(sim.value.score));
  const isNewBest = useDerivedValue(() => (bestScore > 0 && sim.value.score > bestScore ? 1 : 0));
  const bestText = useDerivedValue<string>(() =>
    isNewBest.value ? 'NEW BEST!' : bestScore > 0 ? `BEST ${formatNumber(bestScore)}` : '',
  );
  const bestColor = useDerivedValue<string>(() =>
    isNewBest.value ? (Math.sin(sim.value.t * 8) > 0 ? '#FFE14D' : '#FFB020') : 'rgba(255,255,255,0.9)',
  );

  // ── Combo ──
  const comboScale = useDerivedValue(() => {
    const p = sim.value.comboPulse / ANIM.COMBO_PULSE;
    const b = sim.value.comboBreak / ANIM.COMBO_BREAK;
    const scale = 1 + p * 0.35;
    const cx = PAD_X + 30;
    const cy = 104;
    return [
      { translateX: cx + Math.sin(b * 30) * b * 4 },
      { translateY: cy },
      { scale },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });
  const comboText = useDerivedValue<string>(() => `x${sim.value.combo}`);
  const comboColor = useDerivedValue<string>(() => {
    const s = sim.value;
    if (s.comboBreak > 0) return '#FF5A6E';
    return s.combo >= 4 ? '#FF6FA8' : s.combo === 3 ? '#FFC93C' : s.combo === 2 ? '#5EE6C9' : 'rgba(255,255,255,0.85)';
  });
  const comboProgress = useDerivedValue(() => {
    const s = sim.value;
    if (s.combo >= SCORE.COMBO_MAX) return 52;
    return 52 * Math.min(1, s.comboT / SCORE.COMBO_THRESHOLDS[s.combo - 1]);
  });
  const centeredGlow = useDerivedValue(() =>
    Math.abs(sim.value.angle) < PHYSICS.CENTER_ANGLE && sim.value.mode === MODE_PLAYING ? 1 : 0.35,
  );

  // ── Distance & coins (top-right) ──
  const distText = useDerivedValue<string>(() => `${Math.floor(sim.value.meters)} m`);
  const distX = useDerivedValue(() => (fonts ? W - PAD_X - textWidth(fonts.lg, distText.value) : 0));
  const coinText = useDerivedValue<string>(() => formatNumber(sim.value.coins));
  const coinTextX = useDerivedValue(() => (fonts ? W - PAD_X - textWidth(fonts.md, coinText.value) : 0));
  const coinIconX = useDerivedValue(() => coinTextX.value - 13);

  const slowText = useDerivedValue<string>(() => (sim.value.slowT > 0 ? `SLOW-MO ${Math.ceil(sim.value.slowT)}` : ''));
  const slowX = useDerivedValue(() => (fonts ? W - PAD_X - textWidth(fonts.sm, slowText.value) : 0));

  // ── Balance meter (bottom-center) ──
  const meterW = Math.min(240, W * 0.3);
  const meterX = W / 2 - meterW / 2;
  const meterY = H - 16;
  const markerX = useDerivedValue(() => {
    const r = Math.max(-1, Math.min(1, sim.value.angle / PHYSICS.GAME_OVER_ANGLE));
    return W / 2 + r * (meterW / 2);
  });
  const markerTransform = useDerivedValue(() => [{ translateX: markerX.value }, { translateY: meterY - 2 }]);
  const markerColor = useDerivedValue(() => {
    const d = sim.value.danger;
    return d > 0.75 ? '#FF4D5E' : d > 0.45 ? '#FFC93C' : '#5EE6C9';
  });
  const centerZone = (PHYSICS.CENTER_ANGLE / PHYSICS.GAME_OVER_ANGLE) * meterW;
  const markerPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(0, 6);
    p.lineTo(-7, -6);
    p.lineTo(7, -6);
    p.close();
    return p;
  }, []);

  // ── Wind indicator ──
  const windTransform = useDerivedValue(() => {
    const w = sim.value.wind;
    const dir = w >= 0 ? 1 : -1;
    const mag = Math.min(1, Math.abs(w) / 4);
    return [{ translateX: W / 2 }, { translateY: meterY - 22 }, { scaleX: dir * (0.6 + mag * 0.6) }, { scaleY: 0.6 + mag * 0.4 }];
  });
  const windOpacity = useDerivedValue(() => (Math.abs(sim.value.wind) < 0.4 ? 0.15 : Math.min(1, Math.abs(sim.value.wind) / 2.5)));

  // ── Event banner (top-center) ──
  const banner = useDerivedValue(() => bannerInfo(sim.value));
  const bannerOpacity = useDerivedValue(() => {
    const s = sim.value;
    if (s.mode !== MODE_PLAYING || s.evStage === STAGE_IDLE || s.evType === EVT_NONE) return 0;
    if (s.evStage === STAGE_ACTIVE && s.evType === EVT_OBSTACLE) return 0;
    return 1;
  });
  const bannerW = useDerivedValue(() => {
    if (!fonts) return 200;
    return textWidth(fonts.md, banner.value.text) + (banner.value.arrow !== 0 ? 44 : 24) + 12;
  });
  // Sits right of the stork's head so falling branches and their markers stay visible
  const bannerX = useDerivedValue(() => Math.max(W * 0.66 - bannerW.value / 2, storkX + 11 * U));
  const bannerTextX = useDerivedValue(() => bannerX.value + 18);
  const bannerArrowTransform = useDerivedValue(() => {
    const dir = banner.value.arrow;
    const pulse = 1 + 0.15 * Math.sin(sim.value.t * 12);
    return [
      { translateX: bannerX.value + bannerW.value - 24 },
      { translateY: 30 },
      { scaleX: (dir >= 0 ? 1 : -1) * pulse },
      { scaleY: pulse },
    ];
  });
  const bannerArrowOpacity = useDerivedValue(() => (banner.value.arrow !== 0 ? 1 : 0));
  const bannerColor = useDerivedValue<string>(() => banner.value.color);
  const bannerText = useDerivedValue<string>(() => banner.value.text);
  const timerW = useDerivedValue(() => {
    const s = sim.value;
    const k = s.evDuration > 0 ? Math.max(0, s.evTimer) / s.evDuration : 0;
    return (bannerW.value - 16) * k;
  });
  const challengeOpacity = useDerivedValue(() =>
    sim.value.evType === EVT_CHALLENGE && sim.value.evStage === STAGE_ACTIVE ? 1 : 0,
  );
  const challengeFill = useDerivedValue(() => {
    const s = sim.value;
    return (bannerW.value - 16) * Math.min(1, s.chNeed > 0 ? s.chProgress / s.chNeed : 0);
  });
  const resultOpacity = useDerivedValue(() => Math.min(1, Math.abs(sim.value.chResultT) / 0.4));
  const resultText = useDerivedValue<string>(() => (sim.value.chResultT >= 0 ? 'CHALLENGE CLEAR!' : 'MISSED IT'));
  const resultColor = useDerivedValue<string>(() => (sim.value.chResultT >= 0 ? '#7CFF8A' : '#FF8A96'));
  const resultX = useDerivedValue(() =>
    fonts ? Math.max(W * 0.66, storkX + 11 * U + 100) - textWidth(fonts.md, resultText.value) / 2 : 0,
  );

  // ── Obstacle guidance near the stork ──
  const leanHintOpacity = useDerivedValue(() => {
    const s = sim.value;
    if (s.mode !== MODE_PLAYING || s.evType !== EVT_OBSTACLE || s.evStage === STAGE_IDLE) return 0;
    if (s.evStage === STAGE_ACTIVE && s.obs[7] > 0.5) return 0;
    return 0.55 + 0.45 * Math.sin(s.t * 14);
  });
  const leanHintTransform = useDerivedValue(() => {
    const s = sim.value;
    const dir = -s.evDir;
    return [
      { translateX: storkX + dir * U * (dir > 0 ? 17 : 12) },
      { translateY: s.feetY - s.camY - 20 * U },
      { scaleX: dir },
    ];
  });
  const rockEdgeOpacity = useDerivedValue(() => {
    const s = sim.value;
    return s.evType === EVT_OBSTACLE && s.evSub === OBS_ROCK && s.evStage === STAGE_WARNING
      ? 0.5 + 0.5 * Math.sin(s.t * 16)
      : 0;
  });
  const rockEdgeTransform = useDerivedValue(() => {
    const s = sim.value;
    const right = s.evDir > 0;
    return [{ translateX: right ? W - 14 : 14 }, { translateY: s.feetY - s.camY - 2.2 * U }, { scaleX: right ? -1 : 1 }];
  });
  const branchMarkOpacity = useDerivedValue(() => {
    const s = sim.value;
    return s.evType === EVT_OBSTACLE && s.evSub === OBS_BRANCH && s.evStage === STAGE_WARNING
      ? 0.5 + 0.5 * Math.sin(s.t * 16)
      : 0;
  });
  const branchMarkX = useDerivedValue(() => storkX + (STORK.HEAD_X + sim.value.evDir * EVENTS.BRANCH_OFFSET_U) * U);
  const branchMarkRectX = useDerivedValue(() => branchMarkX.value - EVENTS.BRANCH_HALF_W_U * U);

  // ── Popups ──
  const popOpacity = useDerivedValue(() => Math.min(1, sim.value.popT / 0.35));
  const popText = useDerivedValue<string>(() => {
    const s = sim.value;
    const k = s.popKind;
    if (k === POPUP_MILESTONE) return `${s.popValue} m!`;
    if (k === POPUP_RANK) return RANK_NAMES[s.popValue] ?? '';
    if (k === POPUP_BIOME) return BIOME_NAMES[s.popValue] ?? '';
    if (k === POPUP_FEVER) return 'x2 POINTS!';
    if (k === POPUP_ITEM) return s.popValue === ITEM_MAGNET ? 'MAGNET!' : s.popValue === ITEM_FEATHER ? 'FEATHER CALM!' : 'BALLOON!';
    if (k === POPUP_CHICK) return `+${Math.round(s.popValue * CHICKS.SCORE_BONUS * 100)}% POINTS`;
    return 'SHIELD SAVE!';
  });
  const popLabel = useDerivedValue<string>(() => {
    const k = sim.value.popKind;
    if (k === POPUP_RANK) return 'RANK UP';
    if (k === POPUP_MILESTONE) return 'MILESTONE';
    if (k === POPUP_BIOME) return 'NEW AREA';
    if (k === POPUP_FEVER) return 'COMBO FEVER';
    if (k === POPUP_ITEM) return 'ITEM';
    if (k === POPUP_CHICK) return 'A BABY JOINED YOU';
    return 'SAVED';
  });
  const popCx = W * 0.74;
  const popCy = H * 0.36;
  const popTransform = useDerivedValue(() => {
    const s = sim.value;
    const k0 = s.popKind;
    const total =
      k0 === POPUP_ITEM ? ANIM.POPUP * 0.7 : k0 === POPUP_CHICK ? ANIM.POPUP * 0.8 : k0 === POPUP_SHIELD ? ANIM.SHIELD_SAVE : ANIM.POPUP;
    const k = 1 - s.popT / total;
    const scale = k < 0.12 ? 0.4 + (k / 0.12) * 0.75 : k < 0.2 ? 1.15 - ((k - 0.12) / 0.08) * 0.15 : 1;
    return [{ translateX: popCx }, { translateY: popCy }, { scale }, { translateX: -popCx }, { translateY: -popCy }];
  });
  const popTextX = useDerivedValue(() => (fonts ? popCx - textWidth(fonts.xl, popText.value) / 2 : 0));
  const popLabelX = useDerivedValue(() => (fonts ? popCx - textWidth(fonts.sm, popLabel.value) / 2 : 0));
  const popColor = useDerivedValue<string>(() => {
    const k = sim.value.popKind;
    if (k === POPUP_RANK || k === POPUP_FEVER) return '#FFB3D1';
    if (k === POPUP_MILESTONE || k === POPUP_ITEM) return '#FFE14D';
    if (k === POPUP_BIOME) return '#9EE7FF';
    if (k === POPUP_CHICK) return '#FFFFFF';
    return '#7FDBFF';
  });

  const nearMissOpacity = useDerivedValue(() => Math.min(1, sim.value.nearMissT / 0.3));
  const nearMissTransform = useDerivedValue(() => {
    const s = sim.value;
    const k = 1 - s.nearMissT / ANIM.NEAR_MISS;
    return [{ translateX: storkX + U * 12 }, { translateY: s.feetY - s.camY - 26 * U - k * 12 }, { scale: k < 0.15 ? 0.6 + k * 2.7 : 1 }];
  });

  // ── Tutorial ──
  const tutorialOpacity = useDerivedValue(() => {
    const s = sim.value;
    if (!showTutorial || s.mode !== MODE_PLAYING || s.t > 4.5) return 0;
    return Math.min(1, (4.5 - s.t) / 0.6);
  });
  const tutorialText = 'HOLD LEFT OR RIGHT SIDE TO BALANCE';
  const tutorialX = useDerivedValue(() => (fonts ? tutorialTextX(cfg, textWidth(fonts.md, tutorialText), PAD_X) : 0));
  const tutorialBoxX = useDerivedValue(() => tutorialX.value - 14);
  const bannerInnerX = useDerivedValue(() => bannerX.value + 8);
  const bannerInnerW = useDerivedValue(() => bannerW.value - 16);
  const branchBangX = useDerivedValue(() => branchMarkX.value - 5);

  if (!fonts) return null;

  return (
    <Group opacity={visible}>
      {/* Score */}
      <OutlinedText x={PAD_X} y={22} text="SCORE" font={fonts.xs} color="rgba(255,255,255,0.9)" stroke={3} />
      <OutlinedText x={PAD_X} y={56} text={scoreText} font={fonts.xl} color="#FFFFFF" stroke={5} />
      <OutlinedText x={PAD_X} y={76} text={bestText} font={fonts.sm} color={bestColor} stroke={3} />

      {/* Combo */}
      <Group transform={comboScale}>
        <RoundedRect x={PAD_X} y={88} width={62} height={30} r={10} color="rgba(43,22,48,0.55)" />
        <OutlinedText x={PAD_X + 8} y={110} text={comboText} font={fonts.lg} color={comboColor} stroke={3} />
        <Circle cx={PAD_X + 52} cy={100} r={4} color="#5EE6C9" opacity={centeredGlow} />
        <RoundedRect x={PAD_X + 5} y={121} width={52} height={5} r={2.5} color="rgba(43,22,48,0.5)" />
        <RoundedRect x={PAD_X + 5} y={121} width={comboProgress} height={5} r={2.5} color={comboColor} />
      </Group>

      {/* Distance / coins / boosts */}
      <OutlinedText x={distX} y={38} text={distText} font={fonts.lg} color="#FFFFFF" stroke={4} />
      <Circle cx={coinIconX} cy={57} r={7.5} color="#D08A12" />
      <Circle cx={coinIconX} cy={57} r={5} color="#FFD23F" />
      <OutlinedText x={coinTextX} y={64} text={coinText} font={fonts.md} color="#FFE14D" stroke={3} />
      <OutlinedText x={slowX} y={164} text={slowText} font={fonts.sm} color="#C9A8FF" stroke={3} />

      <FeatureHud
        sim={sim}
        cfg={cfg}
        fonts={fonts}
        padX={PAD_X}
        meterX={meterX}
        meterY={meterY}
        showTutorial={showTutorial}
      />

      {/* Balance meter + wind */}
      <Group opacity={playing}>
        <RoundedRect x={meterX - 3} y={meterY - 7} width={meterW + 6} height={14} r={7} color="rgba(43,22,48,0.55)" />
        <RoundedRect x={meterX} y={meterY - 4} width={meterW} height={8} r={4}>
          <LinearGradient
            start={vec(meterX, 0)}
            end={vec(meterX + meterW, 0)}
            colors={['#FF4D5E', '#FFC93C', '#5EE6C9', '#FFC93C', '#FF4D5E']}
          />
        </RoundedRect>
        <Rect x={W / 2 - centerZone} y={meterY - 5} width={centerZone * 2} height={10} color="rgba(255,255,255,0.35)" />
        <Group transform={markerTransform}>
          <Path path={markerPath} color={markerColor} />
          <Path path={markerPath} color={INK} style="stroke" strokeWidth={2.5} strokeJoin="round" />
        </Group>
        <Group transform={windTransform} opacity={windOpacity}>
          <Path path={arrow} color="#FFFFFF" />
          <Path path={arrow} color={INK} style="stroke" strokeWidth={2.5} strokeJoin="round" />
        </Group>
      </Group>

      {/* Event banner / challenge */}
      <Group opacity={bannerOpacity}>
        <RoundedRect x={bannerX} y={10} width={bannerW} height={40} r={12} color={bannerColor} />
        <RoundedRect x={bannerX} y={10} width={bannerW} height={40} r={12} color={INK} style="stroke" strokeWidth={3} />
        <OutlinedText x={bannerTextX} y={37} text={bannerText} font={fonts.md} color="#FFFFFF" stroke={3} />
        <Group transform={bannerArrowTransform} opacity={bannerArrowOpacity}>
          <Path path={arrow} color="#FFFFFF" />
          <Path path={arrow} color={INK} style="stroke" strokeWidth={2.5} strokeJoin="round" />
        </Group>
        <RoundedRect x={bannerInnerX} y={54} width={timerW} height={4} r={2} color="rgba(255,255,255,0.85)" />
        <Group opacity={challengeOpacity}>
          <RoundedRect x={bannerInnerX} y={61} width={bannerInnerW} height={9} r={4.5} color="rgba(43,22,48,0.6)" />
          <RoundedRect x={bannerInnerX} y={61} width={challengeFill} height={9} r={4.5} color="#7CFF8A" />
        </Group>
      </Group>
      <Group opacity={resultOpacity}>
        <OutlinedText x={resultX} y={86} text={resultText} font={fonts.md} color={resultColor} stroke={4} />
      </Group>

      {/* Obstacle guidance */}
      <Group transform={leanHintTransform} opacity={leanHintOpacity}>
        <Path path={bigArrow} color="rgba(255,255,255,0.9)" />
          <Path path={bigArrow} color={INK} style="stroke" strokeWidth={3} strokeJoin="round" />
      </Group>
      <Group transform={rockEdgeTransform} opacity={rockEdgeOpacity}>
        <Path path={arrow} color="#FF4D5E" transform={[{ scale: 1.6 }]} />
          <Path path={arrow} color={INK} style="stroke" strokeWidth={2.5} strokeJoin="round" transform={[{ scale: 1.6 }]} />
      </Group>
      <Group opacity={branchMarkOpacity}>
        <RoundedRect x={branchMarkRectX} y={2} width={EVENTS.BRANCH_HALF_W_U * U * 2} height={6} r={3} color="#FF4D5E" />
        <OutlinedText x={branchBangX} y={32} text="!" font={fonts.xl} color="#FF4D5E" stroke={4} />
      </Group>

      {/* Floating texts */}
      {Array.from({ length: FLOAT_TEXT.MAX }, (_, i) => (
        <FloatingText key={i} sim={sim} index={i} font={fonts.md} />
      ))}

      {/* Near miss */}
      <Group transform={nearMissTransform} opacity={nearMissOpacity}>
        <RoundedRect x={-4} y={-22} width={textWidthStatic(fonts.md, 'NICE SAVE!') + 12} height={30} r={10} color="rgba(43,22,48,0.7)" />
        <OutlinedText x={2} y={0} text="NICE SAVE!" font={fonts.md} color="#5EE6C9" stroke={3} />
      </Group>

      {/* Milestone / rank / shield popups */}
      <Group transform={popTransform} opacity={popOpacity}>
        <OutlinedText x={popLabelX} y={popCy - 30} text={popLabel} font={fonts.sm} color="#FFFFFF" stroke={3} />
        <OutlinedText x={popTextX} y={popCy + 4} text={popText} font={fonts.xl} color={popColor} stroke={5} />
      </Group>

      {/* Tutorial */}
      <Group opacity={tutorialOpacity}>
        <RoundedRect
          x={tutorialBoxX}
          y={H * TUTORIAL_Y_RATIO - 26}
          width={textWidthStatic(fonts.md, tutorialText) + 28}
          height={36}
          r={12}
          color="rgba(43,22,48,0.6)"
        />
        <Text x={tutorialX} y={H * TUTORIAL_Y_RATIO} text={tutorialText} font={fonts.md} color="#FFFFFF" />
      </Group>
    </Group>
  );
});

function textWidthStatic(font: SkFont, text: string) {
  return font.getTextWidth(text);
}


const FloatingText: React.FC<{ sim: SharedValue<SimState>; index: number; font: SkFont }> = ({ sim, index, font }) => {
  const b = index * FLOAT_TEXT.SLOT;
  const opacity = useDerivedValue(() => {
    const tx = sim.value.texts;
    if (tx[b] < 0.5) return 0;
    const k = tx[b + 1] / FLOAT_TEXT.DURATION;
    return k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
  });
  const text = useDerivedValue<string>(() => {
    const tx = sim.value.texts;
    if (tx[b] < 0.5) return '';
    const kind = tx[b + 5];
    const v = Math.floor(tx[b + 4]);
    if (kind === TEXT_KIND_DODGE) return `DODGE +${v}`;
    if (kind === TEXT_KIND_BRACE) return `STEADY +${v}`;
    if (kind === TEXT_KIND_BONK) return 'BONK!';
    return `+${v}`;
  });
  const color = useDerivedValue<string>(() => {
    const kind = sim.value.texts[b + 5];
    if (kind === TEXT_KIND_COIN) return '#FFE14D';
    if (kind === TEXT_KIND_BONUS) return '#5EE6C9';
    if (kind === TEXT_KIND_BONK) return '#FF6B7E';
    return '#B8F27A';
  });
  const transform = useDerivedValue(() => {
    const tx = sim.value.texts;
    const k = tx[b + 1] / FLOAT_TEXT.DURATION;
    const w = font.getTextWidth(text.value);
    const scale = k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1;
    return [
      { translateX: tx[b + 2] - (w * scale) / 2 },
      { translateY: tx[b + 3] - k * FLOAT_TEXT.RISE },
      { scale },
    ];
  });
  return (
    <Group transform={transform} opacity={opacity}>
      <OutlinedText x={0} y={0} text={text} font={font} color={color} stroke={3} />
    </Group>
  );
};
