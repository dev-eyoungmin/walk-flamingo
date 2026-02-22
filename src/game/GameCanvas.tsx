import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Canvas, matchFont } from '@shopify/react-native-skia';
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

const GRAVITY_TORQUE = 2.5;
const PLAYER_TORQUE = 6.0;
const GAME_OVER_ANGLE = (60 * Math.PI) / 180;
const BASE_WALK_SPEED = 15;
const SPRITE_FRAME_RATE = 8;
const WALK_FRAMES = 4;
const POINTS_PER_SECOND = 10;

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
  const font = matchFont({ fontSize: 28 });
  const smallFont = matchFont({ fontSize: 20 });

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

  const inputLeft = useSharedValue(false);
  const inputRight = useSharedValue(false);

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
  }, [angle, angularVelocity, windForceVal, elapsedTime, distance, score, walkSpeed, animFrame, animTimer, isGameOver, inputLeft, inputRight]);

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

    const dt = frameInfo.timeSincePreviousFrame ? Math.min(frameInfo.timeSincePreviousFrame / 1000, 0.05) : 1 / 60;
    const t = elapsedTime.value;

    const wave = (Math.sin(t * 1.6) + 1) * 0.5;
    const surge = 1.0 + wave * 0.3;
    const gravityMult = (1.8 + t * 0.055) * surge;
    const damping = Math.max(0.74, 0.86 - t * 0.0025) - wave * 0.04;
    const windStr = Math.min((1.5 + t * 0.08) * surge, 5.0);
    const windChangeInt = Math.max(0.6, 3.5 - t * 0.25);

    // Wind Logic
    const windPhase = Math.floor(t / windChangeInt);
    const windRand = (Math.sin(windPhase * 3.7 * 12.9898 + 78.233) * 43758.5453) % 1;
    const gustRand = (Math.sin(windPhase * 9.1 * 12.9898 + 15.233) * 43758.5453) % 1;
    const currentStrength = windStr * (0.4 + Math.abs(gustRand));
    
    let dir = 0;
    if (Math.abs(windRand) < 0.4) dir = -1;
    else if (Math.abs(windRand) < 0.8) dir = 1;
    
    const targetWind = dir * currentStrength;
    windForceVal.value += (targetWind - windForceVal.value) * 0.02;

    const gravityAccel = GRAVITY_TORQUE * Math.sin(angle.value) * gravityMult;
    let playerAccel = 0;
    if (inputLeft.value) playerAccel -= PLAYER_TORQUE;
    if (inputRight.value) playerAccel += PLAYER_TORQUE;

    angularVelocity.value = (angularVelocity.value + (gravityAccel + playerAccel + windForceVal.value) * dt) * damping;
    angle.value += angularVelocity.value * dt;

    if (Math.abs(angle.value) >= GAME_OVER_ANGLE) {
      isGameOver.value = true;
      runOnJS(handleGameOver)(Math.floor(score.value), Math.floor(distance.value));
      return;
    }

    elapsedTime.value += dt;
    walkSpeed.value = BASE_WALK_SPEED * (1 + elapsedTime.value * 0.005);
    distance.value += walkSpeed.value * dt;
    score.value += POINTS_PER_SECOND * dt;
  }, isPlaying);

  // Bridge shared values to React state for HUD (throttled, every 200ms)
  const [displayScore, setDisplayScore] = useState(0);
  const [displayDist, setDisplayDist] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setDisplayScore(Math.floor(score.value));
      setDisplayDist(Math.floor(distance.value));
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, score, distance]);

  const onLeftPress = useCallback(() => { inputLeft.value = true; }, [inputLeft]);
  const onLeftRelease = useCallback(() => { inputLeft.value = false; }, [inputLeft]);
  const onRightPress = useCallback(() => { inputRight.value = true; }, [inputRight]);
  const onRightRelease = useCallback(() => { inputRight.value = false; }, [inputRight]);

  const canvasHeight = height - 60;

  return (
    <View style={styles.container}>
      <Canvas style={{ width, height: canvasHeight }}>
        <BackgroundRenderer width={width} height={canvasHeight} distance={distance} />
        <GroundRenderer width={width} height={canvasHeight} distance={distance} />
        <StorkRenderer width={width} height={canvasHeight} angle={angle} animFrame={animFrame} elapsedTime={elapsedTime} />
        
        {/* Score/Distance now rendered as RN overlay */}
        
        {/* Wind Indicator - Positioned below DIST on the right */}
        <WindIndicator 
          windForce={windForceVal} 
          x={width - SAFE_INSET - 200} 
          y={80} 
          font={smallFont} 
        />
      </Canvas>

      {/* HUD Overlay (React Native) */}
      {isPlaying && (
        <View style={styles.hud} pointerEvents="none">
          <View style={styles.hudLeft}>
            <Text style={styles.hudDist}>{displayDist}m</Text>
          </View>
        </View>
      )}

      <TouchControls
        onLeftPress={onLeftPress} onLeftRelease={onLeftRelease}
        onRightPress={onRightPress} onRightRelease={onRightRelease}
        disabled={!isPlaying} safeLeft={SAFE_INSET} safeRight={SAFE_INSET}
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
  hudScore: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
});
