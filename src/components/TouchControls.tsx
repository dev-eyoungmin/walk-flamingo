import React, { useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
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

export const TouchControls: React.FC<TouchControlsProps> = ({
  onLeftPress,
  onLeftRelease,
  onRightPress,
  onRightRelease,
  disabled = false,
  safeLeft = 0,
  safeRight = 0,
}) => {
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
    onLeftPress();
  }, [disabled, onLeftPress]);

  const handleRightPress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRightPress();
  }, [disabled, onRightPress]);

  return (
    <View style={containerStyle} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.leftButton,
          pressed && styles.buttonPressed,
          disabled && styles.buttonDisabled,
        ]}
        onPressIn={handleLeftPress}
        onPressOut={onLeftRelease}
        disabled={disabled}
      >
        <Text style={styles.buttonText}>{'◀'}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.rightButton,
          pressed && styles.buttonPressed,
          disabled && styles.buttonDisabled,
        ]}
        onPressIn={handleRightPress}
        onPressOut={onRightRelease}
        disabled={disabled}
      >
        <Text style={styles.buttonText}>{'▶'}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 70, // Above banner ad
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    // paddingLeft/paddingRight set dynamically via safeLeft/safeRight props
  },
  button: {
    width: 140,
    height: 70,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  leftButton: {},
  rightButton: {},
  buttonPressed: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    transform: [{ scale: 0.95 }],
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  buttonText: {
    fontSize: 28,
    color: '#FFFFFF',
  },
});
