import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Canvas, Group } from '@shopify/react-native-skia';
import { runOnJS, runOnUI, useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { BackgroundRenderer } from './render/BackgroundRenderer';
import { GroundRenderer } from './render/GroundRenderer';
import { StorkRenderer } from './render/StorkRenderer';
import { BestFlagRenderer, CoinRenderer, GullRenderer, ItemsRenderer, ObstacleRenderer } from './render/WorldObjectsRenderer';
import { HUD } from './render/hudStrings';
import { ChicksRenderer, StorkExtrasRenderer } from './render/CompanionRenderer';
import { ScreenEffectsRenderer, WorldEffectsRenderer } from './render/EffectsRenderer';
import { HudRenderer } from './render/HudRenderer';
import { computePalette } from './render/palette';
import { TouchControls } from '../components/TouchControls';
import {
  BIOMES,
  ENV_QUAKE,
  EVT_ENVIRONMENT,
  MODE_ATTRACT,
  MODE_OVER,
  MODE_PLAYING,
  STAGE_ACTIVE,
} from './sim/constants';
import { FX_CHICK_JOIN } from './sim/fx';
import { createSimState, RunParams, SimState } from './sim/state';
import { advanceSim, resumeSim } from './sim/step';
import { generateTerrainRatios, makeSimConfig, SimConfig } from './sim/terrain';
import type { SkinPalette } from '../lib/skins';

export type RunMode = 'attract' | 'playing';
export type BoostType = 'shield' | 'slowmo' | null;

export interface GameStats {
  score: number;
  meters: number;
  coins: number;
  bestCombo: number;
  nearMisses: number;
  dodges: number;
  challenges: number;
  fevers: number;
  items: number;
  flaps: number;
  chicksMax: number;
  /** Seconds survived */
  time: number;
  /** Zones entered after the first (0 = meadow only) */
  zones: number;
  /** Event active at the fall (type * 10 + subtype), -1 if none */
  fallEvent: number;
  fallWeather: number;
  fallBiome: number;
  fallAfterHit: boolean;
}

interface GameCanvasProps {
  width: number;
  /** Play area height (layout, HUD and physics use this) */
  height: number;
  /** Full canvas height; the ground keeps drawing below the play area (under the banner) */
  canvasHeight?: number;
  /** Changing this starts a new run in `runMode` */
  runId: number;
  runMode: RunMode;
  /** Changing this generates new terrain */
  terrainKey: number;
  /** Keep the current scroll position when starting the run (seamless start from the title screen) */
  keepScroll: boolean;
  /** Changing this resumes the current run (continue after a rewarded ad) */
  resumeId: number;
  boost: BoostType;
  bestScore: number;
  skin: SkinPalette;
  controlsEnabled: boolean;
  /** When set, terrain and the event sequence come from this seed (today's course) */
  courseSeed?: number | null;
  showTutorial?: boolean;
  /** Upgrades, onboarding and the best-distance flag for the next run */
  runParams?: Omit<RunParams, 'shield' | 'slowmo' | 'scrollX'>;
  onGameOver: (stats: GameStats) => void;
  onFx: (code: number, value: number) => void;
}

function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  width,
  height,
  canvasHeight = height,
  runId,
  runMode,
  terrainKey,
  keepScroll,
  resumeId,
  boost,
  bestScore,
  skin,
  controlsEnabled,
  courseSeed = null,
  showTutorial = false,
  runParams,
  onGameOver,
  onFx,
}) => {
  const terrainRatios = useMemo(
    () => generateTerrainRatios(courseSeed ? seededRandom(courseSeed) : Math.random),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [terrainKey, courseSeed],
  );
  const cfg = useMemo(() => makeSimConfig(width, height, terrainRatios), [width, height, terrainRatios]);
  const [initialState] = useState(() => createSimState(cfg, MODE_ATTRACT, Date.now() & 0x7fffffff));

  const cfgSV = useSharedValue<SimConfig>(cfg);
  const sim = useSharedValue<SimState>(initialState);
  const input = useSharedValue(0);

  // Baby flamingo renderers are mounted only once a chick has joined this run
  const [chicksMounted, setChicksMounted] = useState(0);

  // Callbacks from the UI thread go through refs so the frame callback never needs re-creating
  const onFxRef = useRef(onFx);
  const onGameOverRef = useRef(onGameOver);
  onFxRef.current = onFx;
  onGameOverRef.current = onGameOver;

  const handleFxBatch = useCallback((batch: number[]) => {
    for (let i = 0; i < batch.length; i += 2) {
      if (batch[i] === FX_CHICK_JOIN) setChicksMounted((n) => Math.max(n, batch[i + 1]));
      onFxRef.current(batch[i], batch[i + 1]);
    }
  }, []);
  const handleGameOver = useCallback((stats: GameStats) => onGameOverRef.current(stats), []);

  useFrameCallback((info) => {
    'worklet';
    const dt = info.timeSincePreviousFrame == null ? 1 / 60 : info.timeSincePreviousFrame / 1000;
    const s = sim.value;
    s.input = input.value;
    advanceSim(s, cfgSV.value, dt);
    let fx: number[] | null = null;
    if (s.fxLen > 0) {
      fx = s.fx.slice(0, s.fxLen * 2);
      s.fxLen = 0;
    }
    let over: GameStats | null = null;
    if (s.mode === MODE_OVER && s.gameOverSent === 0) {
      s.gameOverSent = 1;
      over = {
        score: Math.floor(s.score),
        meters: Math.floor(s.meters),
        coins: s.coins,
        bestCombo: s.bestCombo,
        nearMisses: s.nearMisses,
        dodges: s.dodges,
        challenges: s.challengesDone,
        fevers: s.fevers,
        items: s.itemsCollected,
        flaps: s.flaps,
        chicksMax: s.chicksMax,
        time: Math.floor(s.t - s.playStart),
        zones: Math.floor(s.meters / BIOMES.LENGTH_M),
        fallEvent: s.fallEvent,
        fallWeather: s.fallWeather,
        fallBiome: s.fallBiome,
        fallAfterHit: s.fallAfterHit > 0,
      };
    }
    sim.modify(undefined, true);
    if (fx) runOnJS(handleFxBatch)(fx);
    if (over) runOnJS(handleGameOver)(over);
  });

  // Start a new run whenever runId changes (terrain for that run is already in cfg)
  const lastRunId = useRef<number | null>(null);
  useEffect(() => {
    cfgSV.value = cfg;
    if (lastRunId.current === runId) return;
    const first = lastRunId.current === null;
    lastRunId.current = runId;
    setChicksMounted(0);
    if (first && runMode === 'attract') return;
    const mode = runMode === 'playing' ? MODE_PLAYING : MODE_ATTRACT;
    const seed = courseSeed ? courseSeed >>> 0 : (Date.now() ^ Math.imul(runId + 1, 2654435761)) >>> 0;
    const params: RunParams = {
      ...(mode === MODE_PLAYING ? runParams : null),
      shield: boost === 'shield',
      slowmo: boost === 'slowmo',
    };
    runOnUI((c: SimConfig, m: number, sd: number, keep: boolean, p: RunParams) => {
      'worklet';
      const prevScroll = sim.value.scrollX;
      sim.value = createSimState(c, m, sd, { ...p, scrollX: keep ? prevScroll : 0 });
    })(cfg, mode, seed, keepScroll, params);
    // Only runId and cfg drive restarts; the other props are read at the moment of the restart
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, runId]);

  const lastResumeId = useRef(resumeId);
  useEffect(() => {
    if (lastResumeId.current === resumeId) return;
    lastResumeId.current = resumeId;
    runOnUI(() => {
      'worklet';
      resumeSim(sim.value);
      sim.modify(undefined, true);
    })();
  }, [resumeId, sim]);

  // Touch + keyboard input share one bitmask: 1 left, 2 right, 4 flap
  const touchMask = useRef(0);
  const keyMask = useRef(0);
  const setTouch = useCallback(
    (mask: number) => {
      touchMask.current = mask;
      input.value = mask | keyMask.current;
    },
    [input],
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const bit = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') return 1;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') return 2;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') return 4;
      return 0;
    };
    const down = (e: KeyboardEvent) => {
      const b = bit(e);
      if (!b || !controlsEnabled) return;
      keyMask.current |= b;
      input.value = touchMask.current | keyMask.current;
    };
    const up = (e: KeyboardEvent) => {
      const b = bit(e);
      if (!b) return;
      keyMask.current &= ~b;
      input.value = touchMask.current | keyMask.current;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [controlsEnabled, input]);

  const palette = useDerivedValue(() => {
    const s = sim.value;
    return computePalette(s.dayT, s.weather, s.weatherAmt);
  });

  const shake = useDerivedValue(() => {
    const s = sim.value;
    let x = 0;
    let y = 0;
    if (s.shakeT > 0) {
      const m = s.shakeMag * Math.min(1, s.shakeT / 0.25);
      x += Math.sin(s.t * 71) * m;
      y += Math.cos(s.t * 53) * m * 0.5;
    }
    if (s.mode === MODE_PLAYING && s.danger > 0.72) {
      x += Math.sin(s.t * 60) * ((s.danger - 0.72) / 0.28) * 2;
    }
    if (s.evStage === STAGE_ACTIVE && s.evType === EVT_ENVIRONMENT && s.evSub === ENV_QUAKE) {
      x += Math.sin(s.t * 45) * 3.5;
      y += Math.cos(s.t * 38) * 2.5;
    }
    return [{ translateX: x }, { translateY: y }];
  });

  return (
    <View style={{ width, height: canvasHeight }}>
      <Canvas style={{ width, height: canvasHeight }}>
        <Group transform={shake}>
          <BackgroundRenderer sim={sim} palette={palette} width={width} height={height} />
          <GroundRenderer sim={sim} palette={palette} cfg={cfg} />
          <BestFlagRenderer sim={sim} cfg={cfg} label={HUD.flag} />
          <ObstacleRenderer sim={sim} cfg={cfg} />
          <CoinRenderer sim={sim} cfg={cfg} />
          <ItemsRenderer sim={sim} cfg={cfg} />
          <ChicksRenderer sim={sim} cfg={cfg} count={chicksMounted} />
          <StorkExtrasRenderer sim={sim} cfg={cfg} layer="back" />
          <StorkRenderer pose={sim} unit={cfg.unit} x={cfg.storkX} skin={skin} />
          <StorkExtrasRenderer sim={sim} cfg={cfg} layer="front" />
          <GullRenderer sim={sim} cfg={cfg} />
          <WorldEffectsRenderer sim={sim} palette={palette} cfg={cfg} featherColor={skin.bodyLight} />
        </Group>
        <ScreenEffectsRenderer sim={sim} palette={palette} cfg={cfg} />
        <HudRenderer sim={sim} cfg={cfg} bestScore={bestScore} showTutorial={showTutorial} />
      </Canvas>
      <TouchControls width={width} height={height} onInputChange={setTouch} enabled={controlsEnabled} />
    </View>
  );
};
