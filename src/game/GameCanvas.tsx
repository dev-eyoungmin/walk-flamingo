import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated as RNAnimated } from 'react-native';
import { Canvas, Group, Rect, LinearGradient, vec } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import {
  useSharedValue,
  useFrameCallback,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';
import { BackgroundRenderer } from '../components/BackgroundRenderer';
import { GroundRenderer } from '../components/GroundRenderer';
import { StorkRenderer } from '../components/StorkRenderer';
import { TouchControls } from '../components/TouchControls';
import { WeatherRenderer } from '../components/WeatherRenderer';
import { EnvironmentRenderer } from '../components/EnvironmentRenderer';
import { ParticleRenderer } from '../components/ParticleRenderer';
import { TERRAIN_SEG_W_RATIO, generateTerrain, encodeTerrainForWorklet, type TerrainSegment, COIN, NEAR_MISS, FLOATING_TEXT, COMBO_GRACE, EVENTS, EVENT_SLOT_SIZE } from './constants';
import { CoinRenderer, COIN_SLOT_SIZE } from '../components/CoinRenderer';
import { FloatingTextRenderer } from '../components/FloatingTextRenderer';
import { NearMissRenderer } from '../components/NearMissRenderer';
import {
  generateEventQueue,
  EVT_OBSTACLE, EVT_ENVIRONMENT, EVT_CHALLENGE, EVT_SPEED,
  OBS_ROCK, OBS_BRANCH,
  ENV_GUST, ENV_QUAKE, ENV_ICE,
  CHL_CENTERED, CHL_STORM, CHL_LEAN,
  SPD_SPRINT, SPD_SLOWDOWN,
  STATUS_PENDING, STATUS_WARNING, STATUS_ACTIVE, STATUS_DONE,
} from './events';
import { ObstacleRenderer } from '../components/ObstacleRenderer';
import { EventWarningRenderer } from '../components/EventWarningRenderer';
import { SkinPalette } from '../lib/skins';

// Milestone thresholds (in displayed meters)
const MILESTONES = [50, 100, 200, 500, 1000];

// Rank thresholds (must match ranks.ts)
const RANK_THRESHOLDS = [
  { minDistance: 0, emoji: '🥚', name: 'Egg' },
  { minDistance: 10, emoji: '🐣', name: 'Chick' },
  { minDistance: 50, emoji: '🐥', name: 'Fledgling' },
  { minDistance: 100, emoji: '🦩', name: 'Flamingo' },
  { minDistance: 200, emoji: '🦅', name: 'Eagle' },
  { minDistance: 500, emoji: '👑', name: 'King of Birds' },
  { minDistance: 1000, emoji: '⭐', name: 'Legendary Bird' },
];

const SAFE_INSET = Platform.OS === 'ios' ? 44 : 0;

const GRAVITY_TORQUE = 5.0;
const PLAYER_TORQUE = 10.0;
const GAME_OVER_ANGLE = (65 * Math.PI) / 180;
const CENTER_THRESHOLD = (12 * Math.PI) / 180;
const BASE_WALK_SPEED = 8;
const POINTS_PER_SECOND = 10;
const PIXELS_TO_METERS = 0.04;
const GRACE_PERIOD = 3.0; // seconds before full physics/scoring kicks in (was 1.5)

// No-op function for safe runOnJS calls when onPlaySfx is not provided
const noop = (_name: string) => {};

// Near hill parallax must match BackgroundRenderer
const P_HILLS_NEAR = 2.5;

// Combo thresholds (seconds to reach next level)
// Inline in worklet: level 1→2: 3s, 2→3: 5s, 3→4: 8s
const COMBO_T1 = 3.0;
const COMBO_T2 = 5.0;
const COMBO_T3 = 8.0;

interface GameCanvasProps {
  width: number;
  height: number;
  onGameOver: (data: { score: number; distance: number; coins?: number }) => void;
  isPlaying: boolean;
  isResuming?: boolean;
  pendingBoost?: 'shield' | 'slowmo' | null;
  skinPalette?: SkinPalette;
  onPlaySfx?: (name: string) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  width,
  height,
  onGameOver,
  isPlaying,
  isResuming = false,
  pendingBoost,
  skinPalette,
  onPlaySfx,
}) => {
  const canvasHeight = height - 60;
  const groundY = canvasHeight * 0.65; // stork feet level

  // Track props as shared values for worklet access
  const isPlayingShared = useSharedValue(isPlaying);
  React.useEffect(() => {
    isPlayingShared.value = isPlaying;
  }, [isPlaying, isPlayingShared]);



  // === Core physics ===
  const angle = useSharedValue(0);
  const angularVelocity = useSharedValue(0);
  const windForceVal = useSharedValue(0);
  const elapsedTime = useSharedValue(0);
  const distance = useSharedValue(0);
  const score = useSharedValue(0);
  const walkSpeed = useSharedValue(BASE_WALK_SPEED);
  const animFrame = useSharedValue(0);
  const animTimer = useSharedValue(0);
  const isGameOver = useSharedValue(false);

  // === Input & tap boost ===
  const inputLeft = useSharedValue(false);
  const inputRight = useSharedValue(false);
  const prevInputLeft = useSharedValue(false);
  const prevInputRight = useSharedValue(false);
  const tapBoost = useSharedValue(0);

  // === Combo system ===
  const comboMultiplier = useSharedValue(1);
  const comboTimer = useSharedValue(0);
  const comboLevelUpAnim = useSharedValue(0);
  const comboBrokenAnim = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const shakeTimer = useSharedValue(0);

  // === Danger & game over animation ===
  const dangerRatioSV = useSharedValue(0);
  const gameOverTimer = useSharedValue(0);
  const gameOverSlowMo = useSharedValue(false);

  // === Terrain (random per game) ===
  const [terrainSegments, setTerrainSegments] = useState<TerrainSegment[]>(() => generateTerrain());
  const terrainData = useSharedValue<number[]>(encodeTerrainForWorklet(terrainSegments));

  // === Hill system (follows BackgroundRenderer near hills) ===
  const storkHillY = useSharedValue(0); // vertical offset for stork on hills
  const hillSlope = useSharedValue(0); // -1=uphill, +1=downhill, 0=flat

  // === Resume grace period ===
  const resumeGraceEnd = useSharedValue(0);

  // === Milestone & Rank system ===
  const lastMilestone = useSharedValue(0);
  const currentRankIdx = useSharedValue(0);
  const [milestoneText, setMilestoneText] = useState('');
  const [rankUpText, setRankUpText] = useState('');
  const milestoneOpacity = useRef(new RNAnimated.Value(0)).current;
  const rankUpOpacity = useRef(new RNAnimated.Value(0)).current;

  // === Environment ===
  const skyPhase = useSharedValue(0);
  const weatherType = useSharedValue(0); // 0=none, 1=rain, 2=snow
  const weatherParticles = useSharedValue<number[]>([]);
  const weatherCycleTimer = useSharedValue(0);
  const lastWeatherChange = useSharedValue(0); // distance at last weather change

  // === Coin System ===
  // Each coin slot: [screenX, screenY, active(0/1), collectAnim, value]
  const coinSlots = useSharedValue<number[]>(
    new Array(COIN.MAX_VISIBLE * COIN_SLOT_SIZE).fill(0),
  );
  const coinSpinAngle = useSharedValue(0);
  const nextCoinDist = useSharedValue(COIN.SPAWN_INTERVAL); // next spawn distance
  const coinCount = useSharedValue(0); // total coins collected this session
  const coinRingHead = useSharedValue(0); // ring buffer head index

  // === Floating Text System ===
  // Each slot: [active, timer, x, y, value, type]
  const floatingTexts = useSharedValue<number[]>(
    new Array(FLOATING_TEXT.MAX_COUNT * FLOATING_TEXT.SLOT_SIZE).fill(0),
  );

  // === Near-Miss System ===
  const nearMissAnim = useSharedValue(0); // countdown timer for popup
  const wasInDanger = useSharedValue(0); // 1 if dangerRatio was > DANGER_ENTER

  // === Combo Grace Buffer ===
  const comboGraceTimer = useSharedValue(0); // countdown; if >0, combo not yet broken

  // === Event System ===
  const eventQueue = useSharedValue<number[]>(generateEventQueue(Date.now(), width));
  const eventCursor = useSharedValue(0);
  const activeEventType = useSharedValue(-1);
  const activeEventSubtype = useSharedValue(0);
  const activeEventTimer = useSharedValue(0);
  const activeEventParam = useSharedValue(0);
  const warningTimer = useSharedValue(0);
  const warningEventType = useSharedValue(-1);
  const warningEventSubtype = useSharedValue(0);
  const warningEventParam = useSharedValue(0);

  // === Obstacle rendering data ===
  const obstacleData = useSharedValue<number[]>([0, 0, 0, 0, 0]);

  // === Challenge tracking ===
  const challengeActive = useSharedValue(0);
  const challengeSubtype = useSharedValue(0);
  const challengeTimer = useSharedValue(0);
  const challengeParam = useSharedValue(0);
  const challengeReward = useSharedValue(0);
  const challengeSuccess = useSharedValue(0);
  const challengeResultAnim = useSharedValue(0);

  // === Speed modifier ===
  const speedModifier = useSharedValue(1.0);

  // === Boost ===
  const boostType = useSharedValue(0); // 0=none, 1=shield, 2=slowmo
  const boostTimer = useSharedValue(0);

  // === Hit flash ===
  const hitFlashTimer = useSharedValue(0);

  const resetGame = useCallback(() => {
    angle.value = 0;
    angularVelocity.value = 0;
    windForceVal.value = 0;
    elapsedTime.value = 0;
    distance.value = 0;
    score.value = 0;
    walkSpeed.value = BASE_WALK_SPEED;
    animFrame.value = 0;
    animTimer.value = 0;
    isGameOver.value = false;
    inputLeft.value = false;
    inputRight.value = false;
    prevInputLeft.value = false;
    prevInputRight.value = false;
    tapBoost.value = 0;
    comboMultiplier.value = 1;
    comboTimer.value = 0;
    comboLevelUpAnim.value = 0;
    comboBrokenAnim.value = 0;
    shakeX.value = 0;
    shakeTimer.value = 0;
    storkHillY.value = 0;
    hillSlope.value = 0;
    skyPhase.value = 0;
    weatherType.value = 0;
    weatherParticles.value = [];
    weatherCycleTimer.value = 0;
    lastWeatherChange.value = 0;
    resumeGraceEnd.value = 0;
    lastMilestone.value = 0;
    currentRankIdx.value = 0;
    dangerRatioSV.value = 0;
    gameOverTimer.value = 0;
    gameOverSlowMo.value = false;
    // Reset coin system
    coinSlots.value = new Array(COIN.MAX_VISIBLE * COIN_SLOT_SIZE).fill(0);
    coinSpinAngle.value = 0;
    nextCoinDist.value = COIN.SPAWN_INTERVAL;
    coinCount.value = 0;
    coinRingHead.value = 0;
    floatingTexts.value = new Array(FLOATING_TEXT.MAX_COUNT * FLOATING_TEXT.SLOT_SIZE).fill(0);
    nearMissAnim.value = 0;
    wasInDanger.value = 0;
    comboGraceTimer.value = 0;
    // Reset event system
    eventQueue.value = generateEventQueue(Date.now(), width);
    eventCursor.value = 0;
    activeEventType.value = -1;
    activeEventSubtype.value = 0;
    activeEventTimer.value = 0;
    activeEventParam.value = 0;
    warningTimer.value = 0;
    warningEventType.value = -1;
    warningEventSubtype.value = 0;
    warningEventParam.value = 0;
    obstacleData.value = [0, 0, 0, 0, 0];
    challengeActive.value = 0;
    challengeSubtype.value = 0;
    challengeTimer.value = 0;
    challengeParam.value = 0;
    challengeReward.value = 0;
    challengeSuccess.value = 0;
    challengeResultAnim.value = 0;
    speedModifier.value = 1.0;
    hitFlashTimer.value = 0;
    // Apply pending boost
    if (pendingBoost === 'shield') { boostType.value = 1; boostTimer.value = 3.0; }
    else if (pendingBoost === 'slowmo') { boostType.value = 2; boostTimer.value = 3.0; }
    else { boostType.value = 0; boostTimer.value = 0; }
    // Generate new random terrain
    const newTerrain = generateTerrain();
    setTerrainSegments(newTerrain);
    terrainData.value = encodeTerrainForWorklet(newTerrain);
  }, [angle, angularVelocity, windForceVal, elapsedTime, distance, score, walkSpeed, animFrame, animTimer, isGameOver, inputLeft, inputRight, prevInputLeft, prevInputRight, tapBoost, comboMultiplier, comboTimer, comboLevelUpAnim, comboBrokenAnim, shakeX, shakeTimer, storkHillY, hillSlope, skyPhase, weatherType, weatherParticles, weatherCycleTimer, lastWeatherChange, resumeGraceEnd, lastMilestone, currentRankIdx, terrainData, dangerRatioSV, gameOverTimer, gameOverSlowMo, coinSlots, coinSpinAngle, nextCoinDist, coinCount, coinRingHead, floatingTexts, nearMissAnim, wasInDanger, comboGraceTimer, eventQueue, eventCursor, activeEventType, activeEventSubtype, activeEventTimer, activeEventParam, warningTimer, warningEventType, warningEventSubtype, warningEventParam, obstacleData, challengeActive, challengeSubtype, challengeTimer, challengeParam, challengeReward, challengeSuccess, challengeResultAnim, speedModifier, boostType, boostTimer, hitFlashTimer, pendingBoost, width]);

  const resumeGame = useCallback(() => {
    // Only reset physics state; keep score, distance, combo, terrain, weather, etc.
    angle.value = 0;
    angularVelocity.value = 0;
    windForceVal.value = 0;
    isGameOver.value = false;
    inputLeft.value = false;
    inputRight.value = false;
    prevInputLeft.value = false;
    prevInputRight.value = false;
    tapBoost.value = 0;
    shakeX.value = 0;
    shakeTimer.value = 0;
    dangerRatioSV.value = 0;
    gameOverTimer.value = 0;
    gameOverSlowMo.value = false;
    // Re-apply grace period from current elapsed time
    resumeGraceEnd.value = elapsedTime.value + GRACE_PERIOD;
  }, [angle, angularVelocity, windForceVal, isGameOver, inputLeft, inputRight, prevInputLeft, prevInputRight, tapBoost, shakeX, shakeTimer, resumeGraceEnd, elapsedTime, dangerRatioSV, gameOverTimer, gameOverSlowMo]);

  React.useEffect(() => {
    if (isPlaying) {
      if (isResuming) {
        resumeGame();
      } else {
        resetGame();
      }
    }
  }, [isPlaying, isResuming, resetGame, resumeGame]);

  const handleGameOver = useCallback(
    (s: number, d: number, c: number) => onGameOver({ score: s, distance: d, coins: c }),
    [onGameOver],
  );

  const showMilestone = useCallback((dist: number) => {
    setMilestoneText(`${dist}m!`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    milestoneOpacity.setValue(0);
    RNAnimated.sequence([
      RNAnimated.timing(milestoneOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      RNAnimated.delay(1500),
      RNAnimated.timing(milestoneOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [milestoneOpacity]);

  const hapticComboUp = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const hapticCoinCollect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const hapticNearMiss = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const showRankUp = useCallback((emoji: string, name: string) => {
    setRankUpText(`${emoji} ${name}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    rankUpOpacity.setValue(0);
    RNAnimated.sequence([
      RNAnimated.timing(rankUpOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      RNAnimated.delay(2000),
      RNAnimated.timing(rankUpOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [rankUpOpacity]);

  const hapticObstacleHit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);
  const hapticObstacleDodge = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  const hapticChallengeStart = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);
  const hapticChallengeSuccess = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  useFrameCallback((frameInfo) => {
    'worklet';
    if (!isPlayingShared.value || isGameOver.value) return;

    const dt = frameInfo.timeSincePreviousFrame
      ? Math.min(frameInfo.timeSincePreviousFrame / 1000, 0.05)
      : 1 / 60;
    const t = elapsedTime.value;

    // ──── Grace Period ────
    // Support both initial grace (t < GRACE_PERIOD) and resume grace (t < resumeGraceEnd)
    const initialGrace = t < GRACE_PERIOD;
    const resumeGrace = resumeGraceEnd.value > 0 && t < resumeGraceEnd.value;
    const inGrace = initialGrace || resumeGrace;
    let graceRatio = 1.0;
    if (initialGrace) {
      graceRatio = t / GRACE_PERIOD;
    } else if (resumeGrace) {
      const resumeStart = resumeGraceEnd.value - GRACE_PERIOD;
      graceRatio = (t - resumeStart) / GRACE_PERIOD;
    }

    // ──── Difficulty (soft start, then accelerating ramp) ────
    const effectiveT = Math.max(0, t - GRACE_PERIOD); // difficulty ramps from 0 after grace
    const wave = (Math.sin(effectiveT * 1.5) + 1) * 0.5;
    const surge = 1.0 + wave * 0.25;
    // Soft start: gravity ramps slowly for first 15s, then accelerates
    const earlyFactor = Math.min(1.0, effectiveT / 15.0); // 0->1 over 15s
    const gravityBase = 1.5 + earlyFactor * 1.5; // 1.5 -> 3.0 over 15s
    const gravityLate = Math.max(0, effectiveT - 15) * 0.20; // +0.20/s after 15s
    const gravityMult = (gravityBase + gravityLate) * surge * graceRatio;
    let effectiveDamping = Math.max(0.52, 0.82 - effectiveT * 0.012) - wave * 0.06;
    if (activeEventType.value === EVT_ENVIRONMENT && activeEventSubtype.value === ENV_ICE) {
      effectiveDamping = EVENTS.ENVIRONMENT.ICE_DAMPING;
    }
    const windBase = 1.5 + earlyFactor * 2.0; // 1.5 -> 3.5 over 15s
    const windLate = Math.max(0, effectiveT - 15) * 0.25;
    const windStr = Math.min((windBase + windLate) * surge, 10.0) * graceRatio;
    const windChangeInt = Math.max(0.4, 2.0 - effectiveT * 0.12);

    // ──── Wind ────
    const windPhase = Math.floor(t / windChangeInt);
    const windRand = (Math.sin(windPhase * 3.7 * 12.9898 + 78.233) * 43758.5453) % 1;
    const gustRand = (Math.sin(windPhase * 9.1 * 12.9898 + 15.233) * 43758.5453) % 1;
    const currentStrength = windStr * (0.4 + Math.abs(gustRand));
    let dir = 0;
    if (Math.abs(windRand) < 0.4) dir = -1;
    else if (Math.abs(windRand) < 0.8) dir = 1;
    const targetWind = dir * currentStrength;
    windForceVal.value += (targetWind - windForceVal.value) * 0.015;

    // ──── Tap Boost ────
    const leftJustPressed = inputLeft.value && !prevInputLeft.value;
    const rightJustPressed = inputRight.value && !prevInputRight.value;
    prevInputLeft.value = inputLeft.value;
    prevInputRight.value = inputRight.value;

    if (leftJustPressed || rightJustPressed) {
      tapBoost.value = Math.min(tapBoost.value + 0.25, 0.7);
    }
    tapBoost.value = Math.max(0, tapBoost.value - 2.0 * dt);

    // ──── Physics ────
    const clampedGravityMult = Math.min(gravityMult, 6.0);
    let finalGravityMult = clampedGravityMult;
    if (boostType.value === 2) finalGravityMult *= 0.5;
    const gravityAccel = GRAVITY_TORQUE * Math.sin(angle.value) * finalGravityMult;
    // Recovery assist: mild help when tilted (up to 1.5x at max tilt, was 2.2x)
    const angleRatio = Math.abs(angle.value) / GAME_OVER_ANGLE;
    const recoveryAssist = 1.0 + angleRatio * 0.5;
    const scaledPlayerTorque = PLAYER_TORQUE * (1.0 + tapBoost.value) * recoveryAssist;
    let playerAccel = 0;
    if (inputLeft.value) playerAccel -= scaledPlayerTorque;
    if (inputRight.value) playerAccel += scaledPlayerTorque;

    // Base wobble: constant random perturbation so stork never stands perfectly still
    const wobble1 = Math.sin(t * 7.3 + 1.2) * 1.8;
    const wobble2 = Math.sin(t * 13.1 + 3.7) * 1.2;
    const wobble3 = Math.sin(t * 3.9) * 0.8;
    const wobble4 = Math.sin(t * 19.7 + 5.1) * 0.6;
    const baseWobble = (wobble1 + wobble2 + wobble3 + wobble4) * (0.6 + effectiveT * 0.04);

    angularVelocity.value =
      (angularVelocity.value + (gravityAccel + playerAccel + windForceVal.value + baseWobble) * dt) * effectiveDamping;
    angle.value += angularVelocity.value * dt;

    // ──── Danger Ratio (for visual feedback) ────
    dangerRatioSV.value = Math.abs(angle.value) / GAME_OVER_ANGLE;

    // ──── Game Over Check (skip during grace period) ────
    // Slow-mo ragdoll: play 0.8s of falling animation before triggering game over
    if (!inGrace && Math.abs(angle.value) >= GAME_OVER_ANGLE && boostType.value !== 1) {
      if (!gameOverSlowMo.value) {
        gameOverSlowMo.value = true;
        gameOverTimer.value = 0;
      }
      gameOverTimer.value += dt;
      if (gameOverTimer.value > 0.8) {
        isGameOver.value = true;
        runOnJS(handleGameOver)(
          Math.floor(score.value),
          Math.floor(distance.value * PIXELS_TO_METERS),
          Math.floor(coinCount.value),
        );
      }
      return; // skip normal physics during ragdoll
    }
    // Shield auto-correct: gently pull back from edge when shield active
    if (boostType.value === 1 && Math.abs(angle.value) > GAME_OVER_ANGLE * 0.8) {
      angle.value *= 0.95;
    }

    // ──── Time & Distance ────
    elapsedTime.value += dt;

    // Speed surge: ~12.6s cycle, 1.0x to 1.3x
    const speedWave = (Math.sin(elapsedTime.value * 0.5) + 1) * 0.5;
    const speedBurst = 1.0 + speedWave * 0.3;

    // Update distance FIRST, then detect hills using the same distance the renderer sees
    walkSpeed.value = BASE_WALK_SPEED * (1 + effectiveT * 0.005) * speedBurst;
    walkSpeed.value *= speedModifier.value;
    // Grace period: walk slowly so background moves, full speed after grace
    const walkMult = inGrace ? graceRatio * 0.5 : 1.0;
    distance.value += walkSpeed.value * walkMult * dt;

    // Near-hill terrain following (segment-based, matches GroundRenderer)
    const nearHillH = canvasHeight * 0.35;
    const segW = width * TERRAIN_SEG_W_RATIO;

    // Decode terrain from shared flat array: [type, widthRatio, heightRatio, ...]
    const td = terrainData.value;
    const segCount = td.length / 3;

    // Compute total pattern width from segments
    let totalPatternW = 0;
    for (let si = 0; si < segCount; si++) {
      totalPatternW += td[si * 3 + 1] * segW;
    }

    // Group-local X for the stork (matching GroundRenderer hillScrollTr)
    const groupScrollX = -(distance.value * P_HILLS_NEAR) % totalPatternW;
    const groupX = width / 2 - groupScrollX;

    // Find which segment the stork is in
    const wrappedX = ((groupX % totalPatternW) + totalPatternW) % totalPatternW;
    let segStart = 0;
    let segIdx = 0;
    for (let si = 0; si < segCount; si++) {
      const sw = td[si * 3 + 1] * segW;
      if (wrappedX < segStart + sw) {
        segIdx = si;
        break;
      }
      segStart += sw;
      if (si === segCount - 1) segIdx = si;
    }

    const segType = td[segIdx * 3];      // 0=flat, 1=hill, 2=valley
    const segWidthR = td[segIdx * 3 + 1];
    const segHeightR = td[segIdx * 3 + 2];
    const currentSegW = segWidthR * segW;
    const localT = (wrappedX - segStart) / currentSegW; // 0..1 within segment

    let hillCurveHeight = 0;
    let rawSlope = 0;
    let hillPhaseVal = 0;

    if (segType === 1) { // hill
      const h = nearHillH * (segHeightR || 1.0);
      hillCurveHeight = 2 * localT * (1 - localT) * h;
      rawSlope = -(1 - 2 * localT);
      hillPhaseVal = hillCurveHeight / (0.5 * nearHillH);
    } else if (segType === 2) { // valley
      const h = nearHillH * (segHeightR || 0.3);
      hillCurveHeight = -(2 * localT * (1 - localT) * h);
      rawSlope = (1 - 2 * localT);
      hillPhaseVal = Math.abs(hillCurveHeight) / (0.5 * nearHillH);
    }
    // flat: hillCurveHeight = 0, rawSlope = 0, hillPhaseVal = 0

    const baseYOffset = canvasHeight * 0.02;
    if (segType === 0) { // flat
      storkHillY.value = 0;
    } else if (segType === 1) { // hill
      const hillYFromGround = baseYOffset - hillCurveHeight;
      storkHillY.value = Math.min(0, hillYFromGround);
    } else { // valley
      storkHillY.value = -hillCurveHeight;
    }

    hillSlope.value = rawSlope * hillPhaseVal;

    // Hill difficulty: slope push + instability when on a hill
    if (hillPhaseVal > 0.10) {
      const slopePush = hillSlope.value * 1.8;
      angularVelocity.value += slopePush * dt;

      // Speed: much slower uphill, faster downhill
      walkSpeed.value *= localT < 0.5 ? 0.88 : 1.12;

      // Steep hills add instability jitter (scales with hill height and time)
      const hillJitter = hillPhaseVal * (0.4 + effectiveT * 0.03);
      const jitterNoise = Math.sin(t * 17.3 + hillPhaseVal * 5.0) * hillJitter;
      angularVelocity.value += jitterNoise * dt;
    }

    // ──── Combo System ────
    const inCenter = Math.abs(angle.value) < CENTER_THRESHOLD;
    if (inCenter) {
      comboTimer.value += dt;
      const level = comboMultiplier.value;
      if (level < 4) {
        const required = level === 1 ? COMBO_T1 : level === 2 ? COMBO_T2 : COMBO_T3;
        if (comboTimer.value >= required) {
          comboMultiplier.value = level + 1;
          comboTimer.value = 0;
          comboLevelUpAnim.value = 0.6;
          shakeTimer.value = 0.25;
          runOnJS(hapticComboUp)();
          runOnJS(onPlaySfx ?? noop)('comboUp');
        }
      }
    } else {
      // Combo grace buffer: delay combo break by COMBO_GRACE.BUFFER_TIME
      if (comboMultiplier.value > 1) {
        if (comboGraceTimer.value <= 0) {
          // Start grace countdown
          comboGraceTimer.value = COMBO_GRACE.BUFFER_TIME;
        }
        comboGraceTimer.value -= dt;
        if (comboGraceTimer.value <= 0) {
          // Grace expired, break combo
          comboBrokenAnim.value = 0.3;
          comboMultiplier.value = 1;
          comboTimer.value = 0;
          comboGraceTimer.value = 0;
        }
        // While in grace, don't reset comboTimer so player keeps accumulated time
      } else {
        comboTimer.value = 0;
        comboGraceTimer.value = 0;
      }
    }

    // Reset grace timer when back in center
    if (inCenter && comboGraceTimer.value > 0) {
      comboGraceTimer.value = 0;
    }

    const centerBonus = inCenter ? 1.5 : 1.0;
    if (!inGrace) {
      score.value += POINTS_PER_SECOND * centerBonus * comboMultiplier.value * dt;
    }

    // Shake: combo level-up + danger zone continuous micro-shake
    const dangerRatio = Math.abs(angle.value) / GAME_OVER_ANGLE;
    if (shakeTimer.value > 0) {
      shakeTimer.value -= dt;
      const mag = (shakeTimer.value / 0.25) * 4.0;
      shakeX.value = (Math.sin(elapsedTime.value * 80) > 0 ? 1 : -1) * mag;
    } else if (dangerRatio > 0.7) {
      // Continuous micro-shake when dangerously tilted
      const dangerMag = (dangerRatio - 0.7) / 0.3 * 2.5;
      shakeX.value = Math.sin(elapsedTime.value * 60) * dangerMag;
    } else {
      shakeX.value = 0;
    }
    if (comboLevelUpAnim.value > 0) comboLevelUpAnim.value -= dt;
    if (comboBrokenAnim.value > 0) comboBrokenAnim.value -= dt;

    // ──── Coin Spin ────
    coinSpinAngle.value += COIN.SPIN_SPEED * dt;

    // ──── Coin Spawning (deterministic based on distance) ────
    const storkScreenX = width / 2;
    if (distance.value >= nextCoinDist.value) {
      // Deterministic height: use sine of spawn distance as seed
      const seed = nextCoinDist.value * 7.31;
      const heightFrac = (Math.sin(seed) + 1) * 0.5; // 0..1
      const coinH = COIN.MIN_HEIGHT + heightFrac * (COIN.MAX_HEIGHT - COIN.MIN_HEIGHT);
      const coinScreenY = groundY - coinH;

      // Deterministic value: higher coins are worth more
      const valueMult = 1 + Math.floor(heightFrac * 3); // 1x, 2x, 3x
      const coinValue = COIN.BASE_VALUE * valueMult;

      // Place in ring buffer
      const slotIdx = coinRingHead.value % COIN.MAX_VISIBLE;
      const slots = coinSlots.value;
      const bi = slotIdx * COIN_SLOT_SIZE;
      // coin world position: distance at spawn + screen offset ahead
      slots[bi] = width + 40; // spawn off-screen right
      slots[bi + 1] = coinScreenY;
      slots[bi + 2] = 1; // active
      slots[bi + 3] = 0; // collectAnim
      slots[bi + 4] = coinValue;
      // Store spawn distance in a helper way: use the screenX to track world position
      // We need to move coins with the world. Store world distance at spawn.
      coinSlots.value = slots;

      coinRingHead.value = coinRingHead.value + 1;

      // Deterministic interval: varies between 150-300 based on distance
      const intervalSeed = Math.sin(nextCoinDist.value * 3.17) * 0.5 + 0.5;
      nextCoinDist.value = distance.value + 150 + intervalSeed * 150;
    }

    // ──── Coin Movement & Collection ────
    {
      const slots = coinSlots.value;
      let changed = false;
      for (let ci = 0; ci < COIN.MAX_VISIBLE; ci++) {
        const bi = ci * COIN_SLOT_SIZE;
        // Update collect animation
        if (slots[bi + 3] > 0) {
          slots[bi + 3] -= dt;
          if (slots[bi + 3] < 0) slots[bi + 3] = 0;
          changed = true;
        }
        if (slots[bi + 2] < 0.5) continue; // not active

        // Move coin left with world scroll
        slots[bi] -= walkSpeed.value * walkMult * dt;
        changed = true;

        // Off-screen left: deactivate
        if (slots[bi] < -40) {
          slots[bi + 2] = 0;
          continue;
        }

        // Collision detection with stork
        const dx = slots[bi] - storkScreenX;
        const dy = slots[bi + 1] - (groundY + storkHillY.value);
        const distSq = dx * dx + dy * dy;
        if (distSq < COIN.COLLECT_RADIUS * COIN.COLLECT_RADIUS) {
          // Collect!
          const value = slots[bi + 4];
          slots[bi + 2] = 0; // deactivate
          slots[bi + 3] = COIN.COLLECT_ANIM_DURATION; // trigger burst
          coinCount.value = coinCount.value + value;
          score.value += value * comboMultiplier.value;

          // Spawn floating text
          const ftSlots = floatingTexts.value;
          for (let fi = 0; fi < FLOATING_TEXT.MAX_COUNT; fi++) {
            const fbi = fi * FLOATING_TEXT.SLOT_SIZE;
            if (ftSlots[fbi] < 0.5) {
              ftSlots[fbi] = 1; // active
              ftSlots[fbi + 1] = 0; // timer
              ftSlots[fbi + 2] = slots[bi]; // x
              ftSlots[fbi + 3] = slots[bi + 1]; // y
              ftSlots[fbi + 4] = value * comboMultiplier.value; // displayed value
              ftSlots[fbi + 5] = 0; // type: coin
              break;
            }
          }
          floatingTexts.value = ftSlots;

          runOnJS(hapticCoinCollect)();
          runOnJS(onPlaySfx ?? noop)('coinCollect');
          changed = true;
        }
      }
      if (changed) {
        coinSlots.value = slots;
      }
    }

    // ──── Near-Miss Detection ────
    {
      const dr = dangerRatio;
      if (dr > NEAR_MISS.DANGER_ENTER) {
        wasInDanger.value = 1;
      }
      if (wasInDanger.value > 0.5 && dr < NEAR_MISS.DANGER_EXIT) {
        // Near miss achieved!
        wasInDanger.value = 0;
        nearMissAnim.value = 1.0;
        score.value += NEAR_MISS.BONUS_POINTS;

        // Spawn floating text for near-miss bonus
        const ftSlots = floatingTexts.value;
        for (let fi = 0; fi < FLOATING_TEXT.MAX_COUNT; fi++) {
          const fbi = fi * FLOATING_TEXT.SLOT_SIZE;
          if (ftSlots[fbi] < 0.5) {
            ftSlots[fbi] = 1;
            ftSlots[fbi + 1] = 0;
            ftSlots[fbi + 2] = storkScreenX;
            ftSlots[fbi + 3] = groundY - 80;
            ftSlots[fbi + 4] = NEAR_MISS.BONUS_POINTS;
            ftSlots[fbi + 5] = 1; // type: bonus
            break;
          }
        }
        floatingTexts.value = ftSlots;

        runOnJS(hapticNearMiss)();
        runOnJS(onPlaySfx ?? noop)('nearMiss');
      }
    }

    // ──── Update Floating Texts ────
    {
      const ftSlots = floatingTexts.value;
      let ftChanged = false;
      for (let fi = 0; fi < FLOATING_TEXT.MAX_COUNT; fi++) {
        const fbi = fi * FLOATING_TEXT.SLOT_SIZE;
        if (ftSlots[fbi] < 0.5) continue;
        ftSlots[fbi + 1] += dt;
        if (ftSlots[fbi + 1] >= FLOATING_TEXT.DURATION) {
          ftSlots[fbi] = 0; // deactivate
        }
        ftChanged = true;
      }
      if (ftChanged) {
        floatingTexts.value = ftSlots;
      }
    }

    // ──── Update Near-Miss Animation ────
    if (nearMissAnim.value > 0) {
      nearMissAnim.value -= dt;
      if (nearMissAnim.value < 0) nearMissAnim.value = 0;
    }

    // ──── Environment: Sky Phase ────
    const d = distance.value;
    if (d < 1500) {
      skyPhase.value = 0;
    } else if (d < 3000) {
      skyPhase.value = (d - 1500) / 1500;
    } else if (d < 4500) {
      skyPhase.value = 1 + (d - 3000) / 1500;
    } else {
      skyPhase.value = 2;
    }

    // ──── Environment: Weather (cycling every ~50 displayed meters) ────
    // 50 displayed meters = 50 / PIXELS_TO_METERS(0.04) = 1250 internal distance
    const weatherInterval = 1250;
    const distSinceChange = d - lastWeatherChange.value;

    if (d > 1250 && distSinceChange > weatherInterval) {
      // Cycle: none → rain → snow → rain → snow → ...
      // After first activation, alternate between rain(1) and snow(2)
      const prev = weatherType.value;
      let next = 0;
      if (prev === 0) next = 1;        // first weather: rain
      else if (prev === 1) next = 2;   // rain → snow
      else next = 1;                    // snow → rain

      weatherType.value = next;
      lastWeatherChange.value = d;

      // Initialize particles for new weather
      const count = next === 1 ? 60 : 40;
      const pts: number[] = new Array(count * 2);
      for (let i = 0; i < count; i++) {
        pts[i * 2] = Math.abs(Math.sin(i * 73.7)) * width;
        pts[i * 2 + 1] = Math.abs(Math.sin(i * 47.3)) * canvasHeight;
      }
      weatherParticles.value = pts;
    }

    if (weatherType.value === 1) {
      const pts = weatherParticles.value;
      for (let i = 0; i < pts.length; i += 2) {
        pts[i] += 60 * dt;
        pts[i + 1] += 480 * dt;
        if (pts[i + 1] > canvasHeight) {
          pts[i] = Math.abs(Math.sin((t + i) * 73.7)) * width;
          pts[i + 1] = -10;
        }
      }
      const copy: number[] = new Array(pts.length);
      for (let ci = 0; ci < pts.length; ci++) { copy[ci] = pts[ci]; }
      weatherParticles.value = copy;
    } else if (weatherType.value === 2) {
      const pts = weatherParticles.value;
      for (let i = 0; i < pts.length; i += 2) {
        pts[i] += Math.sin(t * 1.5 + i) * 15 * dt;
        pts[i + 1] += 55 * dt;
        if (pts[i + 1] > canvasHeight) {
          pts[i] = Math.abs(Math.sin((t + i) * 73.7)) * width;
          pts[i + 1] = -8;
        }
      }
      const copy: number[] = new Array(pts.length);
      for (let ci = 0; ci < pts.length; ci++) { copy[ci] = pts[ci]; }
      weatherParticles.value = copy;
    }

    // ──── Weather Physics Effects ────
    if (weatherType.value === 1) {
      // Rain: slippery ground (reduce damping) + wind gusts
      angularVelocity.value *= 1.0 + 0.015 * dt * 60; // slight damping reduction per frame
      const rainGust = Math.sin(t * 3.7) * 1.2;
      angularVelocity.value += rainGust * dt;
    } else if (weatherType.value === 2) {
      // Snow: heavy wind bursts + reduced traction + visibility penalty (slower response)
      angularVelocity.value *= 1.0 + 0.025 * dt * 60; // more slippery than rain
      const snowGust = Math.sin(t * 2.1) * 1.8 + Math.cos(t * 5.3) * 0.8;
      angularVelocity.value += snowGust * dt;
      // Snow slows walk speed (trudging through snow)
      walkSpeed.value *= 0.90;
    }

    // ──── Milestone Check ────
    const displayedDist = distance.value * PIXELS_TO_METERS;
    // Check milestones: 50, 100, 200, 500, 1000
    const milestoneThresholds = [50, 100, 200, 500, 1000];
    for (let mi = 0; mi < milestoneThresholds.length; mi++) {
      const threshold = milestoneThresholds[mi];
      if (displayedDist >= threshold && lastMilestone.value < threshold) {
        lastMilestone.value = threshold;
        shakeTimer.value = 0.3;
        runOnJS(showMilestone)(threshold);
        break;
      }
    }

    // ──── Rank Check ────
    const rankThresholds = [0, 10, 50, 100, 200, 500, 1000];
    let newRankIdx = 0;
    for (let ri = 0; ri < rankThresholds.length; ri++) {
      if (displayedDist >= rankThresholds[ri]) newRankIdx = ri;
    }
    if (newRankIdx > currentRankIdx.value) {
      const prevIdx = currentRankIdx.value;
      currentRankIdx.value = newRankIdx;
      // Only show rank up for ranks > Egg (index 0)
      if (newRankIdx > 0 && newRankIdx > prevIdx) {
        const rankEmojis = ['🥚', '🐣', '🐥', '🦩', '🦅', '👑', '⭐'];
        const rankNames = ['Egg', 'Chick', 'Fledgling', 'Flamingo', 'Eagle', 'King of Birds', 'Legendary Bird'];
        shakeTimer.value = 0.4;
        runOnJS(showRankUp)(rankEmojis[newRankIdx], rankNames[newRankIdx]);
      }
    }

    // ──── Animation Frame ────
    animTimer.value += dt;
    const frameDuration = 1 / 8;
    if (animTimer.value >= frameDuration) {
      animTimer.value -= frameDuration;
      animFrame.value = (animFrame.value + 1) % 4;
    }

    // ──── Event System Processing ────
    const currentDist = distance.value;
    const eq = eventQueue.value;
    const cursor = eventCursor.value;

    // --- Scan event queue for next pending event ---
    if (cursor < EVENTS.QUEUE_SIZE && activeEventType.value < 0) {
      const off = cursor * EVENT_SLOT_SIZE;
      const evtType = eq[off];
      const evtSubtype = eq[off + 1];
      const triggerDist = eq[off + 2];
      const param1 = eq[off + 3];
      const param2 = eq[off + 4];
      const param3 = eq[off + 5];
      const status = eq[off + 6];

      // Determine warning lead distance
      let warningLeadDist = 0;
      if (evtType === EVT_OBSTACLE) {
        warningLeadDist = EVENTS.OBSTACLE.WARNING_TIME * walkSpeed.value;
      } else if (evtType === EVT_ENVIRONMENT) {
        warningLeadDist = EVENTS.ENVIRONMENT.WARNING_TIME * walkSpeed.value;
      } else if (evtType === EVT_SPEED) {
        warningLeadDist = EVENTS.SPEED.WARNING_TIME * walkSpeed.value;
      } else if (evtType === EVT_CHALLENGE) {
        warningLeadDist = EVENTS.ENVIRONMENT.WARNING_TIME * walkSpeed.value;
      }

      // Enter warning phase
      if (status === STATUS_PENDING && currentDist >= triggerDist - warningLeadDist) {
        eq[off + 6] = STATUS_WARNING;
        eventQueue.value = eq;
        warningEventType.value = evtType;
        warningEventSubtype.value = evtSubtype;
        warningEventParam.value = param1;
        if (evtType === EVT_OBSTACLE) {
          warningTimer.value = EVENTS.OBSTACLE.WARNING_TIME;
        } else if (evtType === EVT_ENVIRONMENT) {
          warningTimer.value = EVENTS.ENVIRONMENT.WARNING_TIME;
        } else if (evtType === EVT_SPEED) {
          warningTimer.value = EVENTS.SPEED.WARNING_TIME;
        } else {
          warningTimer.value = EVENTS.ENVIRONMENT.WARNING_TIME;
        }
        runOnJS(onPlaySfx ?? noop)('warningBeep');
      }

      // Enter active phase when distance reached
      if (eq[off + 6] === STATUS_WARNING && currentDist >= triggerDist) {
        eq[off + 6] = STATUS_ACTIVE;
        eventQueue.value = eq;
        warningTimer.value = 0;
        warningEventType.value = -1;
        activeEventType.value = evtType;
        activeEventSubtype.value = evtSubtype;
        activeEventParam.value = param1;

        if (evtType === EVT_OBSTACLE) {
          // Set obstacle data: [type, screenX, screenY, active, side]
          const side = param1;
          const startX = side > 0 ? width + 50 : -50;
          const startY = evtSubtype === OBS_ROCK ? groundY - 12 : 0;
          obstacleData.value = [evtSubtype, startX, startY, 1, side];
          activeEventTimer.value = 3.0; // max lifetime
          runOnJS(onPlaySfx ?? noop)('warningBeep');
        } else if (evtType === EVT_ENVIRONMENT) {
          activeEventTimer.value = param2; // duration
          if (evtSubtype === ENV_GUST) {
            runOnJS(onPlaySfx ?? noop)('gust');
          } else if (evtSubtype === ENV_QUAKE) {
            runOnJS(onPlaySfx ?? noop)('quake');
          } else if (evtSubtype === ENV_ICE) {
            runOnJS(onPlaySfx ?? noop)('warningBeep');
          }
        } else if (evtType === EVT_CHALLENGE) {
          challengeActive.value = 1;
          challengeSubtype.value = evtSubtype;
          challengeTimer.value = param2; // duration
          challengeParam.value = param1; // direction for lean
          challengeReward.value = param3;
          challengeSuccess.value = 1; // assume success, fail on violation
          activeEventTimer.value = param2;
          runOnJS(hapticChallengeStart)();
          runOnJS(onPlaySfx ?? noop)('challengeStart');
        } else if (evtType === EVT_SPEED) {
          speedModifier.value = param1; // multiplier
          activeEventTimer.value = param2; // duration
          runOnJS(onPlaySfx ?? noop)('speedChange');
        }
      }
    }

    // --- Warning timer countdown ---
    if (warningTimer.value > 0) {
      warningTimer.value -= dt;
      if (warningTimer.value < 0) warningTimer.value = 0;
    }

    // --- Active event tick ---
    if (activeEventType.value >= 0) {
      activeEventTimer.value -= dt;

      const aType = activeEventType.value;
      const aSub = activeEventSubtype.value;

      // --- Obstacle movement & collision ---
      if (aType === EVT_OBSTACLE) {
        const oData = obstacleData.value;
        if (oData[3] > 0.5) {
          const side = oData[4];
          const obstacleSpeed = walkSpeed.value * EVENTS.OBSTACLE.SCROLL_SPEED;

          if (aSub === OBS_ROCK) {
            // Rock scrolls horizontally
            oData[1] += (side > 0 ? -1 : 1) * obstacleSpeed * dt;
          } else {
            // Branch falls from top
            oData[1] = width / 2 + side * 40; // drift slightly from center
            oData[2] += EVENTS.OBSTACLE.BRANCH_FALL_SPEED * dt;
          }

          // Collision check with stork (center of screen at groundY)
          const storkX = width / 2;
          const storkY = groundY + storkHillY.value;
          const dx = oData[1] - storkX;
          const dy = oData[2] - storkY;
          const distToStork = Math.sqrt(dx * dx + dy * dy);

          if (distToStork < EVENTS.OBSTACLE.HITBOX_RADIUS) {
            if (boostType.value === 1) {
              // Shield absorbs hit
              boostType.value = 0;
              boostTimer.value = 0;
              hitFlashTimer.value = 0.3;
              oData[3] = 0; // deactivate obstacle
              runOnJS(onPlaySfx ?? noop)('obstacleHit');
            } else {
              // Hit! Apply impulse
              const impulseDir = angle.value >= 0 ? 1 : -1;
              angularVelocity.value += EVENTS.OBSTACLE.HIT_IMPULSE * impulseDir;
              hitFlashTimer.value = 0.3;
              oData[3] = 0; // deactivate obstacle
              shakeTimer.value = 0.35;
              runOnJS(hapticObstacleHit)();
              runOnJS(onPlaySfx ?? noop)('obstacleHit');
            }
          }

          // Off-screen check: deactivate if gone past
          if (oData[1] < -80 || oData[1] > width + 80 || oData[2] > canvasHeight + 40) {
            if (oData[3] > 0.5) {
              oData[3] = 0; // deactivate (dodged)
              runOnJS(hapticObstacleDodge)();
              runOnJS(onPlaySfx ?? noop)('obstacleSwipe');
            }
          }

          obstacleData.value = oData;
        }
      }

      // --- Environment physics ---
      if (aType === EVT_ENVIRONMENT) {
        if (aSub === ENV_GUST) {
          const gustDir = activeEventParam.value; // -1 or 1
          angularVelocity.value += EVENTS.ENVIRONMENT.GUST_FORCE * gustDir * dt;
        } else if (aSub === ENV_QUAKE) {
          const quakeOsc = Math.sin(t * 25) * EVENTS.ENVIRONMENT.QUAKE_AMPLITUDE;
          angularVelocity.value += quakeOsc * dt;
          // Also add screen shake during quake
          shakeX.value = Math.sin(t * 40) * 3.0;
        }
        // ICE handled above in effectiveDamping
      }

      // --- Challenge tracking ---
      if (aType === EVT_CHALLENGE) {
        challengeTimer.value -= dt;

        // Check if player meets challenge requirement
        if (aSub === CHL_CENTERED) {
          // Must stay within center threshold
          if (Math.abs(angle.value) > CENTER_THRESHOLD * 2) {
            challengeSuccess.value = 0;
          }
        } else if (aSub === CHL_STORM) {
          // Just survive — success stays 1 as long as not game over
        } else if (aSub === CHL_LEAN) {
          // Must lean in the required direction past threshold
          const leanDir = challengeParam.value;
          const leanAngle = angle.value * leanDir;
          if (leanAngle < EVENTS.CHALLENGE.LEAN_THRESHOLD * 0.5) {
            challengeSuccess.value = 0;
          }
        }

        // Challenge completed
        if (challengeTimer.value <= 0) {
          challengeActive.value = 0;
          if (challengeSuccess.value > 0.5) {
            // Reward
            score.value += challengeReward.value * comboMultiplier.value;
            challengeResultAnim.value = 1.0; // positive = success
            runOnJS(hapticChallengeSuccess)();
            runOnJS(onPlaySfx ?? noop)('challengeSuccess');

            // Spawn floating text for challenge reward
            const ftSlots = floatingTexts.value;
            for (let fi = 0; fi < FLOATING_TEXT.MAX_COUNT; fi++) {
              const fbi = fi * FLOATING_TEXT.SLOT_SIZE;
              if (ftSlots[fbi] < 0.5) {
                ftSlots[fbi] = 1;
                ftSlots[fbi + 1] = 0;
                ftSlots[fbi + 2] = width / 2;
                ftSlots[fbi + 3] = canvasHeight * 0.2;
                ftSlots[fbi + 4] = challengeReward.value;
                ftSlots[fbi + 5] = 1; // type: bonus
                break;
              }
            }
            floatingTexts.value = ftSlots;
          } else {
            challengeResultAnim.value = -1.0; // negative = fail
            runOnJS(onPlaySfx ?? noop)('challengeFail');
          }
        }
      }

      // --- Event finished ---
      if (activeEventTimer.value <= 0) {
        // Mark as done and advance cursor
        const off = cursor * EVENT_SLOT_SIZE;
        eq[off + 6] = STATUS_DONE;
        eventQueue.value = eq;
        eventCursor.value = cursor + 1;

        // Reset active event state
        activeEventType.value = -1;
        activeEventSubtype.value = 0;
        activeEventTimer.value = 0;
        activeEventParam.value = 0;

        // Reset obstacle data
        obstacleData.value = [0, 0, 0, 0, 0];

        // Reset speed modifier
        if (aType === EVT_SPEED) {
          speedModifier.value = 1.0;
        }
      }
    }

    // --- Boost timer countdown ---
    if (boostTimer.value > 0) {
      boostTimer.value -= dt;
      if (boostTimer.value <= 0) {
        boostTimer.value = 0;
        boostType.value = 0;
        runOnJS(onPlaySfx ?? noop)('speedChange');
      }
    }

    // --- Hit flash timer countdown ---
    if (hitFlashTimer.value > 0) {
      hitFlashTimer.value -= dt;
      if (hitFlashTimer.value < 0) hitFlashTimer.value = 0;
    }

    // --- Challenge result animation countdown ---
    if (challengeResultAnim.value !== 0) {
      const sign = challengeResultAnim.value > 0 ? 1 : -1;
      const absVal = Math.abs(challengeResultAnim.value) - dt;
      if (absVal <= 0) {
        challengeResultAnim.value = 0;
      } else {
        challengeResultAnim.value = absVal * sign;
      }
    }
  }, isPlaying);

  // Bridge shared values to React state for HUD
  const [displayDist, setDisplayDist] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayCombo, setDisplayCombo] = useState(1);
  const [displayWind, setDisplayWind] = useState(0);
  const [displayCoins, setDisplayCoins] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setDisplayDist(Math.floor(distance.value * PIXELS_TO_METERS));
      setDisplayScore(Math.floor(score.value));
      setDisplayCombo(comboMultiplier.value);
      setDisplayWind(windForceVal.value);
      setDisplayCoins(Math.floor(coinCount.value));
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, distance, score, comboMultiplier, windForceVal, coinCount]);

  const onLeftPress = useCallback(() => { inputLeft.value = true; }, [inputLeft]);
  const onLeftRelease = useCallback(() => { inputLeft.value = false; }, [inputLeft]);
  const onRightPress = useCallback(() => { inputRight.value = true; }, [inputRight]);
  const onRightRelease = useCallback(() => { inputRight.value = false; }, [inputRight]);

  // Screen shake transform
  const shakeTransform = useDerivedValue(() => [{ translateX: shakeX.value }]);

  // Hit flash opacity
  const hitFlashOpacity = useDerivedValue(() => hitFlashTimer.value > 0 ? 0.4 : 0);

  // Danger vignette opacity
  const dangerVignetteOpacity = useDerivedValue(() => {
    const d = dangerRatioSV.value;
    if (d < 0.5) return 0;
    return (d - 0.5) * 0.6; // max 0.3 opacity at full danger
  });

  return (
    <View style={styles.container}>
      <Canvas style={{ width, height: canvasHeight }}>
        <Group transform={shakeTransform}>
          <BackgroundRenderer
            width={width}
            height={canvasHeight}
            distance={distance}
            skyPhase={skyPhase}
          />
          <GroundRenderer width={width} height={canvasHeight} distance={distance} skyPhase={skyPhase} terrainSegments={terrainSegments} />
          <EnvironmentRenderer
            width={width}
            height={canvasHeight}
            distance={distance}
            skyPhase={skyPhase}
          />
          <StorkRenderer
            width={width}
            height={canvasHeight}
            angle={angle}
            angularVelocity={angularVelocity}
            animFrame={animFrame}
            elapsedTime={elapsedTime}
            hillY={storkHillY}
            hillSlope={hillSlope}
            dangerRatio={dangerRatioSV}
            isGameOver={gameOverSlowMo}
            gameOverTimer={gameOverTimer}
            skinPalette={skinPalette}
          />
          <CoinRenderer
            coinSlots={coinSlots}
            coinSpinAngle={coinSpinAngle}
            groundY={groundY}
            maxCoins={COIN.MAX_VISIBLE}
          />
          <ParticleRenderer
            width={width}
            height={canvasHeight}
            comboLevelUpAnim={comboLevelUpAnim}
            dangerRatio={dangerRatioSV}
            elapsedTime={elapsedTime}
            distance={distance}
            angle={angle}
            isGameOver={gameOverSlowMo}
          />
          <FloatingTextRenderer
            floatingTexts={floatingTexts}
            width={width}
            height={canvasHeight}
          />
          <NearMissRenderer
            nearMissAnim={nearMissAnim}
            width={width}
            height={canvasHeight}
          />
          <ObstacleRenderer
            obstacleData={obstacleData}
            groundY={groundY}
            width={width}
            height={canvasHeight}
          />
          <EventWarningRenderer
            warningTimer={warningTimer}
            warningEventType={warningEventType}
            warningEventSubtype={warningEventSubtype}
            warningEventParam={warningEventParam}
            challengeActive={challengeActive}
            challengeSubtype={challengeSubtype}
            challengeTimer={challengeTimer}
            challengeParam={challengeParam}
            challengeResultAnim={challengeResultAnim}
            activeEventType={activeEventType}
            activeEventSubtype={activeEventSubtype}
            boostType={boostType}
            boostTimer={boostTimer}
            speedModifier={speedModifier}
            width={width}
            height={canvasHeight}
          />
          <WeatherRenderer
            weatherType={weatherType}
            particles={weatherParticles}
            width={width}
            height={canvasHeight}
          />
          {/* Danger vignette - red edges when close to falling */}
          <Rect x={0} y={0} width={width * 0.15} height={canvasHeight}
            opacity={dangerVignetteOpacity}>
            <LinearGradient start={vec(0, 0)} end={vec(width * 0.15, 0)} colors={['rgba(255,30,30,0.5)', 'transparent']} />
          </Rect>
          <Rect x={width * 0.85} y={0} width={width * 0.15} height={canvasHeight}
            opacity={dangerVignetteOpacity}>
            <LinearGradient start={vec(width * 0.85 + width * 0.15, 0)} end={vec(width * 0.85, 0)} colors={['rgba(255,30,30,0.5)', 'transparent']} />
          </Rect>
          <Rect x={0} y={0} width={width} height={canvasHeight * 0.12}
            opacity={dangerVignetteOpacity}>
            <LinearGradient start={vec(0, 0)} end={vec(0, canvasHeight * 0.12)} colors={['rgba(255,30,30,0.4)', 'transparent']} />
          </Rect>
          <Rect x={0} y={canvasHeight * 0.88} width={width} height={canvasHeight * 0.12}
            opacity={dangerVignetteOpacity}>
            <LinearGradient start={vec(0, canvasHeight)} end={vec(0, canvasHeight * 0.88)} colors={['rgba(255,30,30,0.4)', 'transparent']} />
          </Rect>
          {/* Hit flash overlay */}
          <Rect x={0} y={0} width={width} height={canvasHeight}
            color="white"
            opacity={hitFlashOpacity}
          />
        </Group>
      </Canvas>

      {/* HUD Overlay */}
      {isPlaying && (
        <View style={styles.hud} pointerEvents="none">
          <View style={styles.hudLeft}>
            <View style={styles.hudDistPill}>
              <Text style={styles.hudDist}>{displayDist}m</Text>
            </View>
            {displayCoins > 0 && (
              <Text style={styles.hudCoins}>🪙 {displayCoins}</Text>
            )}
          </View>
          <View style={styles.hudCenter}>
            {displayCombo > 1 && (
              <View style={styles.hudComboContainer}>
                <Text style={[styles.hudCombo, displayCombo >= 4 ? styles.hudComboMax : displayCombo >= 3 ? styles.hudComboHigh : null]}>
                  x{displayCombo}
                </Text>
                <View style={styles.hudComboProgressTrack}>
                  <View style={[styles.hudComboProgressFill, { width: displayCombo >= 4 ? '100%' : '50%' }]} />
                </View>
              </View>
            )}
          </View>
          <View style={styles.hudRight}>
            <Text style={styles.hudWind}>
              {displayWind < -1 ? 'WIND' : displayWind > 1 ? 'WIND' : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Milestone Popup */}
      {isPlaying && milestoneText !== '' && (
        <RNAnimated.View style={[styles.milestoneOverlay, { opacity: milestoneOpacity }]} pointerEvents="none">
          <Text style={styles.milestoneText}>{milestoneText}</Text>
        </RNAnimated.View>
      )}

      {/* Rank Up Popup */}
      {isPlaying && rankUpText !== '' && (
        <RNAnimated.View style={[styles.rankUpOverlay, { opacity: rankUpOpacity }]} pointerEvents="none">
          <Text style={styles.rankUpText}>{rankUpText}</Text>
        </RNAnimated.View>
      )}

      <TouchControls
        onLeftPress={onLeftPress}
        onLeftRelease={onLeftRelease}
        onRightPress={onRightPress}
        onRightRelease={onRightRelease}
        disabled={!isPlaying}
        safeLeft={SAFE_INSET}
        safeRight={SAFE_INSET}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: SAFE_INSET + 8,
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudLeft: {
    alignItems: 'flex-start',
  },
  hudDistPill: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
  },
  hudDist: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFD700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 1,
  },
  hudCoins: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 1,
    opacity: 0.9,
  },
  hudCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudComboContainer: {
    alignItems: 'center',
  },
  hudCombo: {
    fontSize: 22,
    color: '#4ECDC4',
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 2,
  },
  hudComboHigh: {
    color: '#FFD700',
    fontSize: 24,
  },
  hudComboMax: {
    color: '#FF6B8A',
    fontSize: 26,
  },
  hudComboProgressTrack: {
    width: 50,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginTop: 3,
    overflow: 'hidden',
  },
  hudComboProgressFill: {
    height: 3,
    backgroundColor: '#4ECDC4',
    borderRadius: 2,
  },
  hudRight: {
    alignItems: 'flex-end',
  },
  hudWind: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 1,
    opacity: 0.8,
  },
  hudScore: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 1,
  },
  milestoneOverlay: {
    position: 'absolute',
    top: '35%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  milestoneText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFD700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
    letterSpacing: 4,
  },
  rankUpOverlay: {
    position: 'absolute',
    top: '20%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rankUpText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
});
