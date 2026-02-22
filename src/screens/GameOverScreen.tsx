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
  distance: number;
  highScore: number;
  isNewHighScore: boolean;
  onRetry: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  score,
  distance,
  highScore,
  isNewHighScore,
  onRetry,
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
        {/* Star Badge (top-right, conditional) */}
        {isNewHighScore && (
          <View style={styles.starBadge}>
            <Text style={styles.starText}>★</Text>
          </View>
        )}

        {/* Game Over Title */}
        <Text style={styles.gameOverText}>GAME OVER</Text>

        {/* Distance Display (Primary) */}
        <Animated.View
          style={[styles.distanceContainer, { transform: [{ scale: scoreScale }] }]}
        >
          <Text style={styles.distanceLabel}>DISTANCE</Text>
          <Text style={styles.distanceValue}>{distance}m</Text>
        </Animated.View>

        {/* Gold divider line */}
        <View style={styles.divider} />

        {/* Best Score */}
        <View style={styles.bestRow}>
          <Text style={styles.bestLabel}>BEST: </Text>
          <Text style={styles.bestValue}>{highScore}m</Text>
        </View>

        {isNewHighScore && (
          <Text style={styles.newBestText}>NEW RECORD!</Text>
        )}

        {/* Retry Button */}
        <View style={styles.buttons}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.retryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={onRetry}
          >
            <Text style={styles.retryButtonText}>RETRY</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFF8F0',
    borderRadius: 24,
    paddingHorizontal: 48,
    paddingVertical: 36,
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FF7A9A',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  starBadge: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '15deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  starText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  gameOverText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FF7A9A',
    letterSpacing: 4,
    marginBottom: 24,
  },
  distanceContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  distanceLabel: {
    fontSize: 14,
    color: '#999',
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 4,
  },
  distanceValue: {
    fontSize: 52,
    fontWeight: '900',
    color: '#333',
  },
  divider: {
    width: 120,
    height: 2,
    backgroundColor: '#DAA520',
    marginBottom: 12,
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bestLabel: {
    fontSize: 16,
    color: '#888',
    fontWeight: '700',
  },
  bestValue: {
    fontSize: 20,
    color: '#333',
    fontWeight: '900',
  },
  newBestText: {
    fontSize: 14,
    color: '#DAA520',
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  buttons: {
    marginTop: 20,
    alignSelf: 'stretch',
  },
  button: {
    paddingHorizontal: 60,
    paddingVertical: 18,
    borderRadius: 40,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#FF7A9A',
  },
  buttonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  retryButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 2,
  },
});
