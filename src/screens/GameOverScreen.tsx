import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';

interface GameOverScreenProps {
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  onRetry: () => void;
  onHome: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  score,
  highScore,
  isNewHighScore,
  onRetry,
  onHome,
}) => {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  const scoreScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideUp, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scoreScale, {
        toValue: 1,
        tension: 60,
        friction: 6,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeIn, slideUp, scoreScale]);

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeIn }]}>
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateY: slideUp }] },
        ]}
      >
        {/* Game Over Title */}
        <Text style={styles.gameOverText}>GAME OVER</Text>

        {/* Score Display */}
        <Animated.View
          style={[styles.scoreContainer, { transform: [{ scale: scoreScale }] }]}
        >
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score}</Text>
          {isNewHighScore && (
            <Text style={styles.newHighScore}>★ NEW BEST! ★</Text>
          )}
        </Animated.View>

        {/* High Score */}
        <View style={styles.highScoreRow}>
          <Text style={styles.highScoreLabel}>BEST: </Text>
          <Text style={styles.highScoreValue}>{highScore}</Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.retryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={onRetry}
          >
            <Text style={styles.buttonText}>↻ RETRY</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.homeButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={onHome}
          >
            <Text style={styles.buttonText}>⌂ HOME</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: 'rgba(20,20,40,0.95)',
    borderRadius: 20,
    paddingHorizontal: 48,
    paddingVertical: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: 300,
  },
  gameOverText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FF4444',
    letterSpacing: 4,
    marginBottom: 20,
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#AAAAAA',
    fontWeight: '600',
    letterSpacing: 2,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 4,
  },
  newHighScore: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '700',
    marginTop: 4,
  },
  highScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  highScoreLabel: {
    fontSize: 14,
    color: '#AAAAAA',
    fontWeight: '600',
  },
  highScoreValue: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    borderWidth: 2,
    borderColor: '#FF8C5A',
  },
  homeButton: {
    backgroundColor: '#4A90D9',
    borderWidth: 2,
    borderColor: '#6AADE9',
  },
  buttonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  buttonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 2,
  },
});
