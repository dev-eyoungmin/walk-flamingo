import React, { useCallback, useMemo, useRef } from 'react';
import { View, Pressable, StyleSheet, Animated } from 'react-native';
import { Canvas, Path, Skia, LinearGradient, vec, RoundedRect } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';

interface TouchControlsProps {
  onLeftPress: () => void;
  onLeftRelease: () => void;
  onRightPress: () => void;
  onRightRelease: () => void;
  disabled?: boolean;
  safeLeft?: number;
  safeRight?: number;
}

const BUTTON_W = 160;
const BUTTON_H = 80;
const BORDER_R = 40;

// Custom arrow paths drawn with Skia
const makeLeftArrow = () => {
  const p = Skia.Path.Make();
  const cx = BUTTON_W / 2;
  const cy = BUTTON_H / 2;
  const sz = 16;
  p.moveTo(cx + sz * 0.5, cy - sz);
  p.lineTo(cx - sz * 0.7, cy);
  p.lineTo(cx + sz * 0.5, cy + sz);
  p.moveTo(cx - sz * 0.5, cy);
  p.lineTo(cx + sz, cy);
  return p;
};

const makeRightArrow = () => {
  const p = Skia.Path.Make();
  const cx = BUTTON_W / 2;
  const cy = BUTTON_H / 2;
  const sz = 16;
  p.moveTo(cx - sz * 0.5, cy - sz);
  p.lineTo(cx + sz * 0.7, cy);
  p.lineTo(cx - sz * 0.5, cy + sz);
  p.moveTo(cx + sz * 0.5, cy);
  p.lineTo(cx - sz, cy);
  return p;
};

export const TouchControls: React.FC<TouchControlsProps> = ({
  onLeftPress,
  onLeftRelease,
  onRightPress,
  onRightRelease,
  disabled = false,
  safeLeft = 0,
  safeRight = 0,
}) => {
  const leftArrowPath = useMemo(() => makeLeftArrow(), []);
  const rightArrowPath = useMemo(() => makeRightArrow(), []);

  const leftScale = useRef(new Animated.Value(1)).current;
  const rightScale = useRef(new Animated.Value(1)).current;
  const leftRipple = useRef(new Animated.Value(0)).current;
  const rightRipple = useRef(new Animated.Value(0)).current;

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        paddingLeft: safeLeft + 24,
        paddingRight: safeRight + 24,
      },
    ],
    [safeLeft, safeRight],
  );

  const handleLeftPress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Press animation
    Animated.spring(leftScale, { toValue: 0.92, friction: 8, tension: 200, useNativeDriver: true }).start();
    // Ripple effect
    leftRipple.setValue(0);
    Animated.timing(leftRipple, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    onLeftPress();
  }, [disabled, onLeftPress, leftScale, leftRipple]);

  const handleLeftRelease = useCallback(() => {
    Animated.spring(leftScale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }).start();
    onLeftRelease();
  }, [onLeftRelease, leftScale]);

  const handleRightPress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(rightScale, { toValue: 0.92, friction: 8, tension: 200, useNativeDriver: true }).start();
    rightRipple.setValue(0);
    Animated.timing(rightRipple, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    onRightPress();
  }, [disabled, onRightPress, rightScale, rightRipple]);

  const handleRightRelease = useCallback(() => {
    Animated.spring(rightScale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }).start();
    onRightRelease();
  }, [onRightRelease, rightScale]);

  const leftRippleOpacity = leftRipple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0],
  });
  const leftRippleScale = leftRipple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1.3],
  });
  const rightRippleOpacity = rightRipple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0],
  });
  const rightRippleScale = rightRipple.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1.3],
  });

  return (
    <View style={containerStyle} pointerEvents="box-none">
      {/* Left Button */}
      <Animated.View style={{ transform: [{ scale: leftScale }], opacity: disabled ? 0.3 : 1 }}>
        {/* Ripple effect */}
        <Animated.View
          style={[
            styles.ripple,
            {
              opacity: leftRippleOpacity,
              transform: [{ scale: leftRippleScale }],
            },
          ]}
        />
        <Pressable
          onPressIn={handleLeftPress}
          onPressOut={handleLeftRelease}
          disabled={disabled}
          style={styles.touchTarget}
        >
          <Canvas style={styles.buttonCanvas} pointerEvents="none">
            {/* Button background with gradient */}
            <RoundedRect x={1} y={1} width={BUTTON_W - 2} height={BUTTON_H - 2} r={BORDER_R}>
              <LinearGradient
                start={vec(0, BUTTON_H)}
                end={vec(0, 0)}
                colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']}
              />
            </RoundedRect>
            {/* Border */}
            <RoundedRect
              x={1} y={1} width={BUTTON_W - 2} height={BUTTON_H - 2} r={BORDER_R}
              color="transparent"
              style="stroke"
              strokeWidth={2}
            >
              <LinearGradient
                start={vec(0, BUTTON_H)}
                end={vec(0, 0)}
                colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.15)']}
              />
            </RoundedRect>
            {/* Custom arrow */}
            <Path
              path={leftArrowPath}
              color="rgba(255,255,255,0.9)"
              style="stroke"
              strokeWidth={3.5}
              strokeCap="round"
              strokeJoin="round"
            />
          </Canvas>
        </Pressable>
      </Animated.View>

      {/* Right Button */}
      <Animated.View style={{ transform: [{ scale: rightScale }], opacity: disabled ? 0.3 : 1 }}>
        <Animated.View
          style={[
            styles.ripple,
            {
              opacity: rightRippleOpacity,
              transform: [{ scale: rightRippleScale }],
            },
          ]}
        />
        <Pressable
          onPressIn={handleRightPress}
          onPressOut={handleRightRelease}
          disabled={disabled}
          style={styles.touchTarget}
        >
          <Canvas style={styles.buttonCanvas} pointerEvents="none">
            <RoundedRect x={1} y={1} width={BUTTON_W - 2} height={BUTTON_H - 2} r={BORDER_R}>
              <LinearGradient
                start={vec(0, BUTTON_H)}
                end={vec(0, 0)}
                colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.08)']}
              />
            </RoundedRect>
            <RoundedRect
              x={1} y={1} width={BUTTON_W - 2} height={BUTTON_H - 2} r={BORDER_R}
              color="transparent"
              style="stroke"
              strokeWidth={2}
            >
              <LinearGradient
                start={vec(0, BUTTON_H)}
                end={vec(0, 0)}
                colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.15)']}
              />
            </RoundedRect>
            <Path
              path={rightArrowPath}
              color="rgba(255,255,255,0.9)"
              style="stroke"
              strokeWidth={3.5}
              strokeCap="round"
              strokeJoin="round"
            />
          </Canvas>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  touchTarget: {
    width: BUTTON_W,
    height: BUTTON_H,
  },
  buttonCanvas: {
    width: BUTTON_W,
    height: BUTTON_H,
  },
  ripple: {
    position: 'absolute',
    width: BUTTON_W,
    height: BUTTON_H,
    borderRadius: BORDER_R,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});
