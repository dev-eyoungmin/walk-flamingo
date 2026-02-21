import React, { useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useFrameCallback,
  runOnJS,
} from 'react-native-reanimated';
import { BackgroundRenderer } from '../components/BackgroundRenderer';
import { GroundRenderer } from '../components/GroundRenderer';
import { StorkRenderer } from '../components/StorkRenderer';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { WindIndicator } from '../components/WindIndicator';
import { TouchControls } from '../components/TouchControls';

const SAFE_INSET = Platform.OS === 'ios' ? 44 : 0;

// Inline constants for worklet access (worklets can't import from modules)
const GRAVITY_TORQUE = 2.5;
const PLAYER_TORQUE = 6.0;
const GAME_OVER_ANGLE = (60 * Math.PI) / 180;
const WARNING_ANGLE = (45 * Math.PI) / 180;
const BASE_WALK_SPEED = 80;
const SPRITE_FRAME_RATE = 8;
const WALK_FRAMES = 4;
const POINTS_PER_SECOND = 10;
const CENTER_BONUS = 1.5;
const CENTER_THRESHOLD = (10 * Math.PI) / 180;

interface GameCanvasProps {
  width: number;
  height: number;
  onGameOver: (score: number) => void;
  isPlaying: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  width,
  height,
  onGameOver,
  isPlaying,
}) => {
  // All game state as shared values (worklet-accessible)
  const angle = useSharedValue(0);
  const angularVelocity = useSharedValue(0);
  const windForceVal = useSharedValue(0);
  const windDirectionVal = useSharedValue(0);
  const elapsedTime = useSharedValue(0);
  const distance = useSharedValue(0);
  const score = useSharedValue(0);
  const walkSpeed = useSharedValue(BASE_WALK_SPEED);
  const animFrame = useSharedValue(0);
  const animTimer = useSharedValue(0);
  const isGameOver = useSharedValue(false);

  // Input state as shared values
  const inputLeft = useSharedValue(false);
  const inputRight = useSharedValue(false);

  // Reset game state
  const resetGame = useCallback(() => {
    angle.value = 0;
    angularVelocity.value = 0;
    windForceVal.value = 0;
    windDirectionVal.value = 0;
    elapsedTime.value = 0;
    distance.value = 0;
    score.value = 0;
    walkSpeed.value = BASE_WALK_SPEED;
    animFrame.value = 0;
    animTimer.value = 0;
    isGameOver.value = false;
    inputLeft.value = false;
    inputRight.value = false;
  }, [angle, angularVelocity, windForceVal, windDirectionVal, elapsedTime,
      distance, score, walkSpeed, animFrame, animTimer, isGameOver,
      inputLeft, inputRight]);

  // Reset when starting a new game
  React.useEffect(() => {
    if (isPlaying) {
      resetGame();
    }
  }, [isPlaying, resetGame]);

  // Handle game over callback on JS thread
  const handleGameOver = useCallback(
    (finalScore: number) => {
      onGameOver(finalScore);
    },
    [onGameOver],
  );

  // Main game loop - runs entirely as worklet on UI thread
  useFrameCallback((frameInfo) => {
    'worklet';
    if (!isPlaying) return;
    if (isGameOver.value) return;

    // Calculate dt
    const dt = frameInfo.timeSincePreviousFrame
      ? Math.min(frameInfo.timeSincePreviousFrame / 1000, 0.05)
      : 1 / 60;

    const t = elapsedTime.value;

    // --- Difficulty calculation (wave pattern: hard → ease → harder) ---
    // Wave oscillates 0‥1 with ~4s period, adds up to 30% on top of base
    const wave = (Math.sin(t * 1.6) + 1) * 0.5;  // 0‥1
    const surge = 1.0 + wave * 0.3;               // 1.0‥1.3

    const gravityMult = (1.8 + t * 0.055) * surge;
    const dampBase = Math.max(0.74, 0.86 - t * 0.0025);
    const damping = dampBase - wave * 0.04;        // dips lower during surge
    const jitterMult = (1.8 + Math.min(t * 0.07, 1.8)) * surge;
    const windStr = Math.min((0.8 + t * 0.045) * surge, 2.8);
    const windChangeInt = Math.max(0.8, 4 - t * 0.18);

    // --- Physics update (inline worklet) ---

    // 1. Gravity (inverted pendulum)
    const gravityAccel = GRAVITY_TORQUE * Math.sin(angle.value) * gravityMult;

    // 2. Player input
    let playerAccel = 0;
    if (inputLeft.value) playerAccel -= PLAYER_TORQUE;
    if (inputRight.value) playerAccel += PLAYER_TORQUE;

    // 3. Wind
    if (windStr > 0) {
      const windPhase = Math.floor(t / windChangeInt);
      const wr = Math.sin(windPhase * 12.9898 + 78.233) * 43758.5453;
      const windRand = wr - Math.floor(wr);
      let dir = 0;
      if (windRand < 0.33) dir = -1;
      else if (windRand < 0.66) dir = 1;
      windDirectionVal.value = dir;
      const targetWind = dir * windStr;
      windForceVal.value += (targetWind - windForceVal.value) * 0.02;
    } else {
      windForceVal.value = 0;
      windDirectionVal.value = 0;
    }

    // 4. Jitter
    const jSeed = t * 7.1;
    const jx = Math.sin(jSeed * 12.9898 + 78.233) * 43758.5453;
    const jitter = ((jx - Math.floor(jx)) - 0.5) * 0.5 * jitterMult;

    // 5. Update angular velocity
    angularVelocity.value +=
      (gravityAccel + playerAccel + windForceVal.value + jitter) * dt;

    // 6. Apply damping
    angularVelocity.value *= damping;

    // 7. Update angle
    angle.value += angularVelocity.value * dt;

    // 8. Check game over
    if (Math.abs(angle.value) >= GAME_OVER_ANGLE) {
      isGameOver.value = true;
      angle.value = angle.value > 0 ? GAME_OVER_ANGLE : -GAME_OVER_ANGLE;
      angularVelocity.value = 0;
      runOnJS(handleGameOver)(Math.floor(score.value));
      return;
    }

    // 9. Update time and distance
    elapsedTime.value += dt;
    walkSpeed.value = BASE_WALK_SPEED * (1 + elapsedTime.value * 0.005);
    distance.value += walkSpeed.value * dt;

    // 10. Update score
    const isNearCenter = Math.abs(angle.value) < CENTER_THRESHOLD;
    const scoreRate = POINTS_PER_SECOND * (isNearCenter ? CENTER_BONUS : 1.0);
    score.value += scoreRate * dt;

    // 11. Update animation frame
    animTimer.value += dt;
    const frameDuration = 1 / SPRITE_FRAME_RATE;
    if (animTimer.value >= frameDuration) {
      animTimer.value -= frameDuration;
      animFrame.value = (animFrame.value + 1) % WALK_FRAMES;
    }
  }, isPlaying);

  // Touch handlers - update shared values
  const onLeftPress = useCallback(() => {
    inputLeft.value = true;
  }, [inputLeft]);
  const onLeftRelease = useCallback(() => {
    inputLeft.value = false;
  }, [inputLeft]);
  const onRightPress = useCallback(() => {
    inputRight.value = true;
  }, [inputRight]);
  const onRightRelease = useCallback(() => {
    inputRight.value = false;
  }, [inputRight]);

  const canvasHeight = height - 60;

  return (
    <View style={styles.container}>
      <Canvas style={{ width, height: canvasHeight }}>
        <BackgroundRenderer
          width={width}
          height={canvasHeight}
          distance={distance}
        />
        <GroundRenderer
          width={width}
          height={canvasHeight}
          distance={distance}
        />
        <StorkRenderer
          width={width}
          height={canvasHeight}
          angle={angle}
          animFrame={animFrame}
          elapsedTime={elapsedTime}
        />
        <ScoreDisplay score={score} x={SAFE_INSET + 24} y={36} fontSize={28} />
        <WindIndicator
          windDirection={windDirectionVal}
          windForce={windForceVal}
          x={width - SAFE_INSET - 160}
          y={36}
        />
      </Canvas>

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
  container: {
    flex: 1,
  },
});
