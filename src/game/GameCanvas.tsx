import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated as RNAnimated } from 'react-native';
import { Canvas, Group } from '@shopify/react-native-skia';
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
import { TERRAIN_SEG_W_RATIO, generateTerrain, encodeTerrainForWorklet, type TerrainSegment } from './constants';

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
const GRACE_PERIOD = 1.5; // seconds before full physics/scoring kicks in

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
  onGameOver: (data: { score: number; distance: number }) => void;
  isPlaying: boolean;
  isResuming?: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  width,
  height,
  onGameOver,
  isPlaying,
  isResuming = false,
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
    // Generate new random terrain
    const newTerrain = generateTerrain();
    setTerrainSegments(newTerrain);
    terrainData.value = encodeTerrainForWorklet(newTerrain);
  }, [angle, angularVelocity, windForceVal, elapsedTime, distance, score, walkSpeed, animFrame, animTimer, isGameOver, inputLeft, inputRight, prevInputLeft, prevInputRight, tapBoost, comboMultiplier, comboTimer, comboLevelUpAnim, comboBrokenAnim, shakeX, shakeTimer, storkHillY, hillSlope, skyPhase, weatherType, weatherParticles, weatherCycleTimer, lastWeatherChange, resumeGraceEnd, lastMilestone, currentRankIdx, terrainData]);

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
    // Re-apply grace period from current elapsed time
    resumeGraceEnd.value = elapsedTime.value + GRACE_PERIOD;
  }, [angle, angularVelocity, windForceVal, isGameOver, inputLeft, inputRight, prevInputLeft, prevInputRight, tapBoost, shakeX, shakeTimer, resumeGraceEnd, elapsedTime]);

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
    (s: number, d: number) => onGameOver({ score: s, distance: d }),
    [onGameOver],
  );

  const showMilestone = useCallback((dist: number) => {
    setMilestoneText(`${dist}m!`);
    milestoneOpacity.setValue(0);
    RNAnimated.sequence([
      RNAnimated.timing(milestoneOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      RNAnimated.delay(1500),
      RNAnimated.timing(milestoneOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [milestoneOpacity]);

  const showRankUp = useCallback((emoji: string, name: string) => {
    setRankUpText(`${emoji} ${name}`);
    rankUpOpacity.setValue(0);
    RNAnimated.sequence([
      RNAnimated.timing(rankUpOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      RNAnimated.delay(2000),
      RNAnimated.timing(rankUpOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [rankUpOpacity]);

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

    // ──── Difficulty (balanced ramp) ────
    const effectiveT = Math.max(0, t - GRACE_PERIOD); // difficulty ramps from 0 after grace
    const wave = (Math.sin(effectiveT * 1.5) + 1) * 0.5;
    const surge = 1.0 + wave * 0.25;
    const gravityMult = (3.0 + effectiveT * 0.28) * surge * graceRatio;
    const damping = Math.max(0.48, 0.75 - effectiveT * 0.02) - wave * 0.10;
    const windStr = Math.min((3.8 + effectiveT * 0.35) * surge, 10.0) * graceRatio;
    const windChangeInt = Math.max(0.4, 1.0 - effectiveT * 0.30);

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
    const gravityAccel = GRAVITY_TORQUE * Math.sin(angle.value) * clampedGravityMult;
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
    const baseWobble = (wobble1 + wobble2 + wobble3 + wobble4) * (1.2 + effectiveT * 0.06);

    angularVelocity.value =
      (angularVelocity.value + (gravityAccel + playerAccel + windForceVal.value + baseWobble) * dt) * damping;
    angle.value += angularVelocity.value * dt;

    // ──── Game Over Check (skip during grace period) ────
    if (!inGrace && Math.abs(angle.value) >= GAME_OVER_ANGLE) {
      isGameOver.value = true;
      runOnJS(handleGameOver)(
        Math.floor(score.value),
        Math.floor(distance.value * PIXELS_TO_METERS),
      );
      return;
    }

    // ──── Time & Distance ────
    elapsedTime.value += dt;

    // Speed surge: ~12.6s cycle, 1.0x to 1.3x
    const speedWave = (Math.sin(elapsedTime.value * 0.5) + 1) * 0.5;
    const speedBurst = 1.0 + speedWave * 0.3;

    // Update distance FIRST, then detect hills using the same distance the renderer sees
    walkSpeed.value = BASE_WALK_SPEED * (1 + effectiveT * 0.005) * speedBurst;
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
        }
      }
    } else {
      if (comboMultiplier.value > 1) comboBrokenAnim.value = 0.3;
      comboMultiplier.value = 1;
      comboTimer.value = 0;
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
      const pts: number[] = [];
      for (let i = 0; i < count; i++) {
        pts.push(
          Math.abs(Math.sin(i * 73.7)) * width,
          Math.abs(Math.sin(i * 47.3)) * canvasHeight,
        );
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
      weatherParticles.value = [...pts];
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
      weatherParticles.value = [...pts];
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
  }, isPlaying);

  // Bridge shared values to React state for HUD
  const [displayDist, setDisplayDist] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayCombo, setDisplayCombo] = useState(1);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setDisplayDist(Math.floor(distance.value * PIXELS_TO_METERS));
      setDisplayScore(Math.floor(score.value));
      setDisplayCombo(comboMultiplier.value);
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, distance, score, comboMultiplier]);

  const onLeftPress = useCallback(() => { inputLeft.value = true; }, [inputLeft]);
  const onLeftRelease = useCallback(() => { inputLeft.value = false; }, [inputLeft]);
  const onRightPress = useCallback(() => { inputRight.value = true; }, [inputRight]);
  const onRightRelease = useCallback(() => { inputRight.value = false; }, [inputRight]);

  // Screen shake transform
  const shakeTransform = useDerivedValue(() => [{ translateX: shakeX.value }]);

  return (
    <View style={styles.container}>
      <Canvas style={{ width, height: canvasHeight }}>
        <Group>
          <BackgroundRenderer
            width={width}
            height={canvasHeight}
            distance={distance}
            skyPhase={skyPhase}
          />
          <GroundRenderer width={width} height={canvasHeight} distance={distance} skyPhase={skyPhase} terrainSegments={terrainSegments} />
          <StorkRenderer
            width={width}
            height={canvasHeight}
            angle={angle}
            animFrame={animFrame}
            elapsedTime={elapsedTime}
            hillY={storkHillY}
            hillSlope={hillSlope}
          />
          <WeatherRenderer
            weatherType={weatherType}
            particles={weatherParticles}
            width={width}
            height={canvasHeight}
          />
        </Group>
      </Canvas>

      {/* HUD Overlay */}
      {isPlaying && (
        <View style={styles.hud} pointerEvents="none">
          <View style={styles.hudLeft}>
            <Text style={styles.hudDist}>{displayDist}m</Text>
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
  hudDist: {
    fontFamily: 'pixel',
    fontSize: 20,
    color: '#FFD700',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 1,
  },
  hudRight: {
    alignItems: 'flex-end',
  },
  hudScore: {
    fontFamily: 'pixel',
    fontSize: 18,
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
