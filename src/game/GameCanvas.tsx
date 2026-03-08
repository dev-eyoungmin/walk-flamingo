import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Canvas, Group, matchFont } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useFrameCallback,
  useDerivedValue,
  runOnJS,
} from 'react-native-reanimated';
import { BackgroundRenderer } from '../components/BackgroundRenderer';
import { GroundRenderer } from '../components/GroundRenderer';
import { StorkRenderer } from '../components/StorkRenderer';
import { WindIndicator } from '../components/WindIndicator';
import { TouchControls } from '../components/TouchControls';
import { ComboDisplay } from '../components/ComboDisplay';
import { CoinRenderer } from '../components/CoinRenderer';
import { MilestoneRenderer } from '../components/MilestoneRenderer';
import { WeatherRenderer } from '../components/WeatherRenderer';

const SAFE_INSET = Platform.OS === 'ios' ? 44 : 0;

const GRAVITY_TORQUE = 4.2;
const PLAYER_TORQUE = 9.0;
const GAME_OVER_ANGLE = (42 * Math.PI) / 180;
const CENTER_THRESHOLD = (10 * Math.PI) / 180;
const BASE_WALK_SPEED = 8;
const POINTS_PER_SECOND = 10;
const PIXELS_TO_METERS = 0.1;

// Combo thresholds (seconds to reach next level)
const COMBO_THRESHOLDS = [3.0, 5.0, 8.0];

// Coin constants
const COIN_HITBOX_R = 44;
const COIN_SCORE = 25;

// Milestone thresholds (raw pixel distances)
const MILESTONES = [1000, 5000, 10000]; // 100m, 500m, 1km

interface GameCanvasProps {
  width: number;
  height: number;
  onGameOver: (data: { score: number; distance: number }) => void;
  isPlaying: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  width,
  height,
  onGameOver,
  isPlaying,
}) => {
  const smallFont = matchFont({ fontSize: 20 });
  const canvasHeight = height - 60;
  const groundY = canvasHeight * 0.75; // stork feet level

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

  // === Coin system ===
  const coinX = useSharedValue(0);
  const coinY = useSharedValue(0);
  const coinVisible = useSharedValue(false);
  const coinSpinAngle = useSharedValue(0);
  const coinCollectAnim = useSharedValue(0);
  const lastCoinSpawnDist = useSharedValue(0);
  const coinTotalCollected = useSharedValue(0);

  // === Milestone system ===
  const milestoneAnim = useSharedValue(0);
  const milestoneFlash = useSharedValue(0);
  const milestoneStabilize = useSharedValue(0);
  const lastMilestoneDist = useSharedValue(0);
  const milestoneIndex = useSharedValue(0);
  const particleData = useSharedValue<number[]>([]); // [x,y,life, x,y,life, ...] × 32

  // === Hill system ===
  const hillPhase = useSharedValue(0); // 0=flat, 0~1=uphill, 1~2=downhill

  // === Environment ===
  const skyPhase = useSharedValue(0);
  const weatherType = useSharedValue(0); // 0=none, 1=rain, 2=snow
  const weatherParticles = useSharedValue<number[]>([]);

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
    coinX.value = 0;
    coinY.value = 0;
    coinVisible.value = false;
    coinSpinAngle.value = 0;
    coinCollectAnim.value = 0;
    lastCoinSpawnDist.value = 0;
    coinTotalCollected.value = 0;
    milestoneAnim.value = 0;
    milestoneFlash.value = 0;
    milestoneStabilize.value = 0;
    lastMilestoneDist.value = 0;
    milestoneIndex.value = 0;
    particleData.value = [];
    hillPhase.value = 0;
    skyPhase.value = 0;
    weatherType.value = 0;
    weatherParticles.value = [];
  }, [angle, angularVelocity, windForceVal, elapsedTime, distance, score, walkSpeed, animFrame, animTimer, isGameOver, inputLeft, inputRight, prevInputLeft, prevInputRight, tapBoost, comboMultiplier, comboTimer, comboLevelUpAnim, comboBrokenAnim, shakeX, shakeTimer, coinX, coinY, coinVisible, coinSpinAngle, coinCollectAnim, lastCoinSpawnDist, coinTotalCollected, milestoneAnim, milestoneFlash, milestoneStabilize, lastMilestoneDist, milestoneIndex, particleData, hillPhase, skyPhase, weatherType, weatherParticles]);

  React.useEffect(() => {
    if (isPlaying) resetGame();
  }, [isPlaying, resetGame]);

  const handleGameOver = useCallback(
    (s: number, d: number) => onGameOver({ score: s, distance: d }),
    [onGameOver],
  );

  useFrameCallback((frameInfo) => {
    'worklet';
    if (!isPlaying || isGameOver.value) return;

    const dt = frameInfo.timeSincePreviousFrame
      ? Math.min(frameInfo.timeSincePreviousFrame / 1000, 0.05)
      : 1 / 60;
    const t = elapsedTime.value;

    // ──── Difficulty ────
    const wave = (Math.sin(t * 2.2) + 1) * 0.5;
    const surge = 1.0 + wave * 0.45;
    const gravityMult = (2.6 + t * 0.12) * surge;
    const damping = Math.max(0.65, 0.80 - t * 0.006) - wave * 0.06;
    const windStr = Math.min((2.5 + t * 0.15) * surge, 8.0);
    const windChangeInt = Math.max(0.35, 2.0 - t * 0.35);

    // ──── Wind ────
    const windPhase = Math.floor(t / windChangeInt);
    const windRand = (Math.sin(windPhase * 3.7 * 12.9898 + 78.233) * 43758.5453) % 1;
    const gustRand = (Math.sin(windPhase * 9.1 * 12.9898 + 15.233) * 43758.5453) % 1;
    const currentStrength = windStr * (0.4 + Math.abs(gustRand));
    let dir = 0;
    if (Math.abs(windRand) < 0.4) dir = -1;
    else if (Math.abs(windRand) < 0.8) dir = 1;
    const targetWind = dir * currentStrength;
    windForceVal.value += (targetWind - windForceVal.value) * 0.02;

    // ──── Tap Boost ────
    const leftJustPressed = inputLeft.value && !prevInputLeft.value;
    const rightJustPressed = inputRight.value && !prevInputRight.value;
    prevInputLeft.value = inputLeft.value;
    prevInputRight.value = inputRight.value;

    if (leftJustPressed || rightJustPressed) {
      tapBoost.value = Math.min(tapBoost.value + 0.25, 0.8);
    }
    tapBoost.value = Math.max(0, tapBoost.value - 2.0 * dt);

    // ──── Physics ────
    const clampedGravityMult = Math.min(gravityMult, 4.0);
    // Milestone stabilization: reduce gravity 75% for 2s
    if (milestoneStabilize.value > 0) milestoneStabilize.value -= dt;
    const stabilizeFactor = milestoneStabilize.value > 0 ? 0.25 : 1.0;
    const gravityAccel = GRAVITY_TORQUE * Math.sin(angle.value) * clampedGravityMult * stabilizeFactor;
    const scaledPlayerTorque = PLAYER_TORQUE * (1.0 + tapBoost.value);
    let playerAccel = 0;
    if (inputLeft.value) playerAccel -= scaledPlayerTorque;
    if (inputRight.value) playerAccel += scaledPlayerTorque;

    angularVelocity.value =
      (angularVelocity.value + (gravityAccel + playerAccel + windForceVal.value) * dt) * damping;
    angle.value += angularVelocity.value * dt;

    // ──── Game Over Check ────
    if (Math.abs(angle.value) >= GAME_OVER_ANGLE) {
      isGameOver.value = true;
      runOnJS(handleGameOver)(
        Math.floor(score.value),
        Math.floor(distance.value * PIXELS_TO_METERS),
      );
      return;
    }

    // ──── Time & Distance ────
    elapsedTime.value += dt;

    // Speed surge: ~8s cycle, 1.0x to 1.6x
    const speedWave = (Math.sin(elapsedTime.value * 0.8) + 1) * 0.5;
    const speedBurst = 1.0 + speedWave * 0.6;

    // Hill system: hills appear every 300-600px based on seeded distance
    const HILL_PERIOD = 400; // base period
    const hillProgress = (distance.value % HILL_PERIOD) / HILL_PERIOD; // 0→1 cycle
    const isOnHill = hillProgress > 0.6 && hillProgress < 0.95; // 35% of cycle is hill
    if (isOnHill) {
      const hillLocal = (hillProgress - 0.6) / 0.35; // 0→1 within hill
      hillPhase.value = hillLocal < 0.5 ? hillLocal * 2 : 2 - hillLocal * 2; // 0→1→0 (peak at middle)
    } else {
      hillPhase.value = 0;
    }

    // Hill modifies walk speed and adds jitter
    const hillSpeedMod = isOnHill
      ? (hillPhase.value > 0.5 ? 0.7 : 1.3) // uphill slower, downhill faster
      : 1.0;
    walkSpeed.value = BASE_WALK_SPEED * (1 + elapsedTime.value * 0.003) * speedBurst * hillSpeedMod;
    distance.value += walkSpeed.value * dt;

    // Hill adds extra gravity destabilization
    if (isOnHill) {
      const hillJitter = Math.sin(elapsedTime.value * 15) * 0.3 * hillPhase.value;
      angularVelocity.value += hillJitter * dt;
    }

    // ──── Combo System ────
    const inCenter = Math.abs(angle.value) < CENTER_THRESHOLD;
    if (inCenter) {
      comboTimer.value += dt;
      const level = comboMultiplier.value;
      if (level < 4) {
        const required = COMBO_THRESHOLDS[level - 1];
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
    score.value += POINTS_PER_SECOND * centerBonus * comboMultiplier.value * dt;

    // Shake
    if (shakeTimer.value > 0) {
      shakeTimer.value -= dt;
      const mag = (shakeTimer.value / 0.25) * 4.0;
      shakeX.value = (Math.sin(elapsedTime.value * 80) > 0 ? 1 : -1) * mag;
    } else {
      shakeX.value = 0;
    }
    if (comboLevelUpAnim.value > 0) comboLevelUpAnim.value -= dt;
    if (comboBrokenAnim.value > 0) comboBrokenAnim.value -= dt;

    // ──── Coin System ────
    const storkCX = width / 2;
    const storkCY = groundY - 80;

    if (!coinVisible.value) {
      const hashIdx = Math.floor(lastCoinSpawnDist.value / 100);
      const rng = Math.abs(Math.sin(hashIdx * 137.508 + 42.0));
      const interval = 80 + rng * 70;
      if (distance.value - lastCoinSpawnDist.value > interval) {
        const heightRng = Math.abs(Math.sin(hashIdx * 9.3));
        coinX.value = width + 50;
        coinY.value = groundY - 30 - heightRng * 55;
        coinVisible.value = true;
        lastCoinSpawnDist.value = distance.value;
      }
    }

    if (coinVisible.value) {
      coinX.value -= walkSpeed.value * 1.5 * dt;
      coinSpinAngle.value += 3.0 * dt;

      const dx = coinX.value - storkCX;
      const dy = coinY.value - storkCY;
      if (dx * dx + dy * dy < COIN_HITBOX_R * COIN_HITBOX_R) {
        score.value += COIN_SCORE * comboMultiplier.value;
        coinTotalCollected.value += 1;
        coinCollectAnim.value = 0.4;
        coinVisible.value = false;
      }
      if (coinX.value < -50) coinVisible.value = false;
    }
    if (coinCollectAnim.value > 0) coinCollectAnim.value -= dt;

    // ──── Milestone Events ────
    const d = distance.value;
    for (let mi = 0; mi < 3; mi++) {
      const threshold = MILESTONES[mi];
      if (d >= threshold && lastMilestoneDist.value < threshold) {
        lastMilestoneDist.value = threshold;
        milestoneAnim.value = 2.5;
        milestoneFlash.value = 1.0;
        milestoneStabilize.value = 2.0;
        milestoneIndex.value = mi;

        // Burst particles: 32 particles × 3 values (x, y, life)
        const cx = width / 2;
        const cy = canvasHeight / 2;
        const pts: number[] = [];
        for (let p = 0; p < 32; p++) {
          const a = (p / 32) * Math.PI * 2;
          pts.push(cx, cy, 1.0); // x, y, life
        }
        particleData.value = pts;
        break;
      }
    }

    if (milestoneAnim.value > 0) {
      milestoneAnim.value -= dt;
      milestoneFlash.value = Math.max(0, milestoneFlash.value - dt * 4);

      const pts = particleData.value;
      if (pts.length > 0) {
        for (let p = 0; p < 32; p++) {
          const bi = p * 3;
          if ((pts[bi + 2] ?? 0) > 0) {
            const a = (p / 32) * Math.PI * 2;
            const spd = 120 + (p % 7) * 15;
            pts[bi] += Math.cos(a) * spd * dt;
            pts[bi + 1] += (Math.sin(a) * spd - 80) * dt + 200 * dt * dt;
            pts[bi + 2] -= dt * 0.55;
          }
        }
        particleData.value = [...pts];
      }
    }

    // ──── Environment: Sky Phase ────
    if (d < 1500) {
      skyPhase.value = 0;
    } else if (d < 3000) {
      skyPhase.value = (d - 1500) / 1500;
    } else if (d < 4500) {
      skyPhase.value = 1 + (d - 3000) / 1500;
    } else {
      skyPhase.value = 2;
    }

    // ──── Environment: Weather ────
    if (d > 5000 && weatherType.value !== 2) {
      weatherType.value = 2;
      const pts: number[] = [];
      for (let i = 0; i < 40; i++) {
        pts.push(
          Math.abs(Math.sin(i * 73.7)) * width,
          Math.abs(Math.sin(i * 47.3)) * canvasHeight,
        );
      }
      weatherParticles.value = pts;
    } else if (d > 2000 && weatherType.value === 0) {
      weatherType.value = 1;
      const pts: number[] = [];
      for (let i = 0; i < 60; i++) {
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
  const [displayCombo, setDisplayCombo] = useState(1);
  const [displayCoins, setDisplayCoins] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setDisplayDist(Math.floor(distance.value * PIXELS_TO_METERS));
      setDisplayCombo(comboMultiplier.value);
      setDisplayCoins(coinTotalCollected.value);
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, distance, comboMultiplier, coinTotalCollected]);

  const onLeftPress = useCallback(() => { inputLeft.value = true; }, [inputLeft]);
  const onLeftRelease = useCallback(() => { inputLeft.value = false; }, [inputLeft]);
  const onRightPress = useCallback(() => { inputRight.value = true; }, [inputRight]);
  const onRightRelease = useCallback(() => { inputRight.value = false; }, [inputRight]);

  // Screen shake transform
  const shakeTransform = useDerivedValue(() => [{ translateX: shakeX.value }]);

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
          <GroundRenderer width={width} height={canvasHeight} distance={distance} hillPhase={hillPhase} />
          <CoinRenderer
            coinX={coinX}
            coinY={coinY}
            coinVisible={coinVisible}
            coinSpinAngle={coinSpinAngle}
            coinCollectAnim={coinCollectAnim}
            groundY={groundY}
          />
          <StorkRenderer
            width={width}
            height={canvasHeight}
            angle={angle}
            animFrame={animFrame}
            elapsedTime={elapsedTime}
          />
          <WeatherRenderer
            weatherType={weatherType}
            particles={weatherParticles}
            width={width}
            height={canvasHeight}
          />
          <ComboDisplay
            comboMultiplier={comboMultiplier}
            comboLevelUpAnim={comboLevelUpAnim}
            comboBrokenAnim={comboBrokenAnim}
            elapsedTime={elapsedTime}
            x={width / 2}
            y={40}
          />
          <WindIndicator
            windForce={windForceVal}
            x={width - SAFE_INSET - 200}
            y={80}
            font={smallFont}
          />
        </Group>
        <MilestoneRenderer
          milestoneAnim={milestoneAnim}
          milestoneFlash={milestoneFlash}
          milestoneIndex={milestoneIndex}
          particleData={particleData}
          elapsedTime={elapsedTime}
          width={width}
          height={canvasHeight}
        />
      </Canvas>

      {/* HUD Overlay */}
      {isPlaying && (
        <View style={styles.hud} pointerEvents="none">
          <View style={styles.hudLeft}>
            <Text style={styles.hudDist}>{displayDist}m</Text>
            {displayCoins > 0 && (
              <Text style={styles.hudCoins}>🪙 {displayCoins}</Text>
            )}
          </View>
        </View>
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
  hudCoins: {
    fontFamily: 'pixel',
    fontSize: 16,
    color: '#FFD700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
