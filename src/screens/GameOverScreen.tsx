import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { getRank } from '../lib/ranks';

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
  const { height } = useWindowDimensions();
  const rank = useMemo(() => getRank(distance), [distance]);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  const scoreScale = useRef(new Animated.Value(0.5)).current;

  // Scale factor based on available height (landscape)
  // Reference height: 400px. Below that, scale down proportionally.
  const scale = useMemo(() => Math.min(1, height / 400), [height]);
  const s = (v: number) => Math.round(v * scale);

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
          {
            paddingHorizontal: s(36),
            paddingVertical: s(24),
            borderRadius: s(24),
            maxHeight: height * 0.9,
            transform: [{ translateY: slideUp }],
          },
        ]}
      >
        {/* Star Badge (top-right, conditional) */}
        {isNewHighScore && (
          <View
            style={[
              styles.starBadge,
              {
                top: s(-16),
                right: s(-16),
                width: s(40),
                height: s(40),
                borderRadius: s(20),
              },
            ]}
          >
            <Text style={[styles.starText, { fontSize: s(20) }]}>★</Text>
          </View>
        )}

        {/* Game Over Title */}
        <Text
          style={[
            styles.gameOverText,
            { fontSize: s(28), letterSpacing: s(3), marginBottom: s(14) },
          ]}
        >
          GAME OVER
        </Text>

        {/* Distance Display (Primary) */}
        <Animated.View
          style={[
            styles.distanceContainer,
            { marginBottom: s(10), transform: [{ scale: scoreScale }] },
          ]}
        >
          <Text
            style={[
              styles.distanceLabel,
              { fontSize: s(12), letterSpacing: s(2), marginBottom: s(2) },
            ]}
          >
            DISTANCE
          </Text>
          <Text style={[styles.distanceValue, { fontSize: s(40) }]}>
            {distance}m
          </Text>
          <Text style={[styles.rankText, { fontSize: s(14), marginTop: s(4) }]}>
            {rank.emoji} {rank.name}
          </Text>
        </Animated.View>

        {/* Score */}
        <Text style={[styles.scoreText, { fontSize: s(16), marginBottom: s(6) }]}>
          SCORE: {score}
        </Text>

        {/* Gold divider line */}
        <View style={[styles.divider, { width: s(100), marginBottom: s(8) }]} />

        {/* Best Score */}
        <View style={[styles.bestRow, { marginBottom: s(2) }]}>
          <Text style={[styles.bestLabel, { fontSize: s(14) }]}>BEST: </Text>
          <Text style={[styles.bestValue, { fontSize: s(17) }]}>
            {highScore}m
          </Text>
        </View>

        {isNewHighScore && (
          <Text
            style={[
              styles.newBestText,
              { fontSize: s(12), letterSpacing: s(2), marginBottom: s(4) },
            ]}
          >
            NEW RECORD!
          </Text>
        )}

        {/* Retry Button */}
        <View style={[styles.buttons, { marginTop: s(14) }]}>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.retryButton,
              {
                paddingHorizontal: s(48),
                paddingVertical: s(14),
                borderRadius: s(32),
              },
              pressed && styles.buttonPressed,
            ]}
            onPress={onRetry}
          >
            <Text
              style={[
                styles.retryButtonText,
                { fontSize: s(16), letterSpacing: s(2) },
              ]}
            >
              RETRY
            </Text>
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
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FF7A9A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  starBadge: {
    position: 'absolute',
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
    color: '#FFFFFF',
  },
  gameOverText: {
    fontWeight: '900',
    color: '#FF7A9A',
  },
  distanceContainer: {
    alignItems: 'center',
  },
  distanceLabel: {
    color: '#999',
    fontWeight: '700',
  },
  distanceValue: {
    fontWeight: '900',
    color: '#333',
  },
  divider: {
    height: 2,
    backgroundColor: '#DAA520',
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bestLabel: {
    color: '#888',
    fontWeight: '700',
  },
  bestValue: {
    color: '#333',
    fontWeight: '900',
  },
  rankText: {
    color: '#FF7A9A',
    fontWeight: '800',
    letterSpacing: 1,
  },
  scoreText: {
    color: '#666',
    fontWeight: '700',
    letterSpacing: 1,
  },
  newBestText: {
    color: '#DAA520',
    fontWeight: '800',
  },
  buttons: {
    alignSelf: 'stretch',
  },
  button: {
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
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
