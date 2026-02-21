import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';

interface StartScreenProps {
  highScore: number;
  onPlay: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  highScore,
  onPlay,
}) => {
  const titleBounce = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Title bounce animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(titleBounce, {
          toValue: -10,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(titleBounce, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Fade in
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [titleBounce, fadeIn]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeIn }]}>
      {/* Sky background */}
      <View style={styles.background}>
        {/* Stork ASCII art title area */}
        <Animated.View
          style={[styles.titleContainer, { transform: [{ translateY: titleBounce }] }]}
        >
          <Text style={styles.titleEmoji}>🦩</Text>
          <Text style={styles.title}>Flamingo Walk</Text>
        </Animated.View>

        {/* High Score */}
        {highScore > 0 && (
          <View style={styles.highScoreContainer}>
            <Text style={styles.highScoreLabel}>BEST</Text>
            <Text style={styles.highScoreValue}>{highScore}</Text>
          </View>
        )}

        {/* Play Button */}
        <Pressable
          style={({ pressed }) => [
            styles.playButton,
            pressed && styles.playButtonPressed,
          ]}
          onPress={onPlay}
        >
          <Text style={styles.playButtonText}>▶ PLAY</Text>
        </Pressable>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            ◀ LEFT {'  '}|{'  '} RIGHT ▶
          </Text>
          <Text style={styles.instructionSubtext}>
            Keep balance as long as you can!
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: '#87CEEB',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  titleEmoji: {
    fontSize: 60,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
    letterSpacing: 2,
  },
  highScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  highScoreLabel: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '700',
    marginRight: 8,
  },
  highScoreValue: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  playButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 3,
    borderColor: '#FF8C5A',
  },
  playButtonPressed: {
    backgroundColor: '#E55A2A',
    transform: [{ scale: 0.95 }],
  },
  playButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 4,
  },
  instructions: {
    alignItems: 'center',
    opacity: 0.7,
  },
  instructionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 4,
  },
  instructionSubtext: {
    fontSize: 12,
    color: '#FFFFFF',
  },
});
