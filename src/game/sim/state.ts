import {
  COIN,
  ENVIRONMENT,
  EVT_NONE,
  FLOAT_TEXT,
  MODE_ATTRACT,
  MODE_PLAYING,
  PHYSICS,
  POPUP_NONE,
  STAGE_IDLE,
  WEATHER_CLEAR,
  EVENTS,
  BOOST,
  ITEMS,
} from './constants';
import type { SimConfig } from './terrain';

/**
 * Entire game state as a flat, serializable object so it can live in one SharedValue and be
 * mutated in place on the UI thread. Numbers only (plus number arrays) — no classes.
 */
export interface SimState {
  mode: number;
  /** Seconds since the run started (includes grace) */
  t: number;
  acc: number;
  rng: number;
  gameOverSent: number;

  // Input bitmask: 1 = left, 2 = right
  input: number;

  // Balance
  angle: number;
  omega: number;
  wind: number;
  windTarget: number;
  windHold: number;
  graceEnd: number;
  invulnT: number;
  fallT: number;
  danger: number;

  // World
  meters: number;
  speed: number;
  speedMod: number;
  speedModTarget: number;
  walkPhase: number;
  scrollX: number;
  feetY: number;
  camY: number;
  slope: number;

  // Score
  score: number;
  combo: number;
  comboT: number;
  comboGrace: number;
  comboPulse: number;
  comboBreak: number;
  bestCombo: number;
  wasDanger: number;
  nearMissT: number;
  nearMissCooldown: number;
  nearMisses: number;
  dodges: number;
  coins: number;
  shakeT: number;
  shakeMag: number;
  hitFlash: number;

  // Coins: COIN.MAX * COIN.SLOT, see constants
  coinSlots: number[];
  nextCoinAt: number;

  // Floating texts: FLOAT_TEXT.MAX * FLOAT_TEXT.SLOT
  texts: number[];

  // Events
  evStage: number;
  evType: number;
  evSub: number;
  evDir: number;
  evTimer: number;
  evDuration: number;
  evNextAt: number;
  evCount: number;
  evLastType: number;
  // Obstacle: [active, kind, worldX, worldY, screenVx, vy, rot, resolved(0 no/1 hit/2 dodged), side]
  obs: number[];
  chProgress: number;
  chNeed: number;
  chResultT: number;
  gustForce: number;
  quakeAmp: number;
  iceAmt: number;

  // Environment
  dayT: number;
  weather: number;
  weatherAmt: number;
  weatherEnd: number;
  nextWeatherAt: number;

  // Progression popups
  lastMilestone: number;
  rankIdx: number;
  popKind: number;
  popValue: number;
  popT: number;

  // Boosts
  shield: number;
  slowT: number;

  // Character animation (visual only): expression timers and where the eyes look (-1..1)
  happyT: number;
  hurtT: number;
  cheerT: number;
  lookX: number;
  lookY: number;

  // Independent random streams so the course (events, weather) doesn't change with how the player plays
  rngEvents: number;
  rngCoins: number;
  rngWind: number;
  prevInput: number;

  // Fever
  feverCharge: number;
  feverT: number;
  fevers: number;

  // Course items: ITEMS.MAX * ITEMS.SLOT
  items: number[];
  nextItemAt: number;
  magnetT: number;
  featherT: number;
  itemsCollected: number;

  // Flap
  flapCooldown: number;
  flapAnim: number;
  flaps: number;

  // Baby flamingos
  chicks: number;
  chickTimer: number;
  chicksMax: number;
  /** Per chick: join animation countdown */
  chickJoin: number[];
  /** Per chick: tilt that lags behind the parent */
  chickAngles: number[];
  chickLeaveT: number;

  // Zones
  biome: number;
  scrollStart: number;

  // Run summary (missions and analytics)
  challengesDone: number;
  /** What was going on when the fall started */
  fallEvent: number;
  fallWeather: number;
  fallBiome: number;
  fallAfterHit: number;

  // Effects outbox drained by the frame callback: pairs of [code, value]
  fx: number[];
  fxLen: number;
}

/** [active, kind, worldX, worldY, screenVx, vy, rot, resolved, side, biome] */
export const OBS_SLOT = 10;
export const FX_CAPACITY = 32;

export function createSimState(
  cfg: SimConfig,
  mode: number,
  seed: number,
  options?: { shield?: boolean; slowmo?: boolean; scrollX?: number },
): SimState {
  'worklet';
  const coinSlots: number[] = [];
  for (let i = 0; i < COIN.MAX * COIN.SLOT; i++) coinSlots.push(0);
  const texts: number[] = [];
  for (let i = 0; i < FLOAT_TEXT.MAX * FLOAT_TEXT.SLOT; i++) texts.push(0);
  const obs: number[] = [];
  for (let i = 0; i < OBS_SLOT; i++) obs.push(0);
  const fx: number[] = [];
  for (let i = 0; i < FX_CAPACITY * 2; i++) fx.push(0);
  const seedFrac = (((seed >>> 0) * 9301 + 49297) % 233280) / 233280;
  const items: number[] = [];
  for (let i = 0; i < ITEMS.MAX * ITEMS.SLOT; i++) items.push(0);
  const base = seed >>> 0;

  return {
    mode,
    t: 0,
    acc: 0,
    rng: (seed >>> 0) || 1,
    gameOverSent: 0,
    input: 0,

    angle: 0,
    omega: 0,
    wind: 0,
    windTarget: 0,
    windHold: 1.5,
    graceEnd: mode === MODE_PLAYING ? PHYSICS.GRACE_PERIOD : 0,
    invulnT: 0,
    fallT: 0,
    danger: 0,

    meters: 0,
    speed: 0,
    speedMod: 1,
    speedModTarget: 1,
    walkPhase: 0,
    scrollX: options?.scrollX ?? 0,
    feetY: cfg.groundY,
    camY: 0,
    slope: 0,

    score: 0,
    combo: 1,
    comboT: 0,
    comboGrace: 0,
    comboPulse: 0,
    comboBreak: 0,
    bestCombo: 1,
    wasDanger: 0,
    nearMissT: 0,
    nearMissCooldown: 0,
    nearMisses: 0,
    dodges: 0,
    coins: 0,
    shakeT: 0,
    shakeMag: 0,
    hitFlash: 0,

    coinSlots,
    nextCoinAt: 6,

    texts,

    evStage: STAGE_IDLE,
    evType: EVT_NONE,
    evSub: 0,
    evDir: 1,
    evTimer: 0,
    evDuration: 0,
    evNextAt: PHYSICS.GRACE_PERIOD + EVENTS.FIRST_DELAY,
    evCount: 0,
    evLastType: EVT_NONE,
    obs,
    chProgress: 0,
    chNeed: 0,
    chResultT: 0,
    gustForce: 0,
    quakeAmp: 0,
    iceAmt: 0,

    dayT: mode === MODE_ATTRACT ? ENVIRONMENT.ATTRACT_DAY_T : 0,
    weather: WEATHER_CLEAR,
    weatherAmt: 0,
    weatherEnd: 0,
    nextWeatherAt: ENVIRONMENT.WEATHER_FIRST_MIN + seedFrac * ENVIRONMENT.WEATHER_FIRST_RANGE,

    lastMilestone: 0,
    rankIdx: 0,
    popKind: POPUP_NONE,
    popValue: 0,
    popT: 0,

    shield: options?.shield ? 1 : 0,
    slowT: options?.slowmo ? BOOST.SLOWMO_DURATION : 0,

    happyT: 0,
    hurtT: 0,
    cheerT: 0,
    lookX: 0.4,
    lookY: 0,

    rngEvents: (base ^ 0x9e3779b9) | 0 || 1,
    rngCoins: (base ^ 0x85ebca6b) | 0 || 2,
    rngWind: (base ^ 0xc2b2ae35) | 0 || 3,
    prevInput: 0,

    feverCharge: 0,
    feverT: 0,
    fevers: 0,

    items,
    nextItemAt: ITEMS.FIRST_M,
    magnetT: 0,
    featherT: 0,
    itemsCollected: 0,

    flapCooldown: 0,
    flapAnim: 0,
    flaps: 0,

    chicks: 0,
    chickTimer: 0,
    chicksMax: 0,
    chickJoin: [0, 0, 0],
    chickAngles: [0, 0, 0],
    chickLeaveT: 0,

    biome: 0,
    scrollStart: options?.scrollX ?? 0,

    challengesDone: 0,
    fallEvent: -1,
    fallWeather: 0,
    fallBiome: 0,
    fallAfterHit: 0,

    fx,
    fxLen: 0,
  };
}
