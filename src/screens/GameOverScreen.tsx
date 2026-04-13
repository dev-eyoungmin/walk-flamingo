import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { getRank } from '../lib/ranks';
import { SkinPreview } from '../components/SkinPreview';

// Rank thresholds for progress bar
const RANK_THRESHOLDS = [
  { minDistance: 0, emoji: '\u{1F95A}', name: 'Egg' },
  { minDistance: 10, emoji: '\u{1F423}', name: 'Chick' },
  { minDistance: 50, emoji: '\u{1F425}', name: 'Fledgling' },
  { minDistance: 100, emoji: '\u{1F9A9}', name: 'Flamingo' },
  { minDistance: 200, emoji: '\u{1F985}', name: 'Eagle' },
  { minDistance: 500, emoji: '\u{1F451}', name: 'King of Birds' },
  { minDistance: 1000, emoji: '\u{2B50}', name: 'Legendary Bird' },
];

interface GameOverScreenProps {
  score: number;
  distance: number;
  coins?: number;
  highScore: number;
  isNewHighScore: boolean;
  onRetry: () => void;
  onHome: () => void;
  onContinue?: () => void;
  canContinue?: boolean;
  onBoost?: (type: 'shield' | 'slowmo') => void;
  onSkinUnlock?: (skinId: string) => void;
  activeSkinId?: string;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  score,
  distance,
  coins = 0,
  highScore,
  isNewHighScore,
  onRetry,
  onHome,
  onContinue,
  canContinue = false,
  onBoost,
  onSkinUnlock,
  activeSkinId,
}) => {
  const [showSkinPreview, setShowSkinPreview] = useState(false);
  const { height } = useWindowDimensions();
  const rank = useMemo(() => getRank(distance), [distance]);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  const scoreScale = useRef(new Animated.Value(0.5)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const starPulse = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Scale factor based on available height (landscape)
  const scale = useMemo(() => Math.min(1, height / 400), [height]);
  const s = (v: number) => Math.round(v * scale);

  // Calculate rank progress
  const rankProgress = useMemo(() => {
    let currentIdx = 0;
    for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
      if (distance >= RANK_THRESHOLDS[i].minDistance) currentIdx = i;
    }
    const nextIdx = Math.min(currentIdx + 1, RANK_THRESHOLDS.length - 1);
    if (currentIdx === nextIdx) return { ratio: 1, nextName: rank.name, nextDist: rank.minDistance };
    const currentMin = RANK_THRESHOLDS[currentIdx].minDistance;
    const nextMin = RANK_THRESHOLDS[nextIdx].minDistance;
    const ratio = (distance - currentMin) / (nextMin - currentMin);
    return {
      ratio: Math.min(1, Math.max(0, ratio)),
      nextName: RANK_THRESHOLDS[nextIdx].name,
      nextDist: nextMin,
    };
  }, [distance, rank]);

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
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]),
      // Animated progress bar
      Animated.timing(progressAnim, {
        toValue: rankProgress.ratio,
        duration: 800,
        delay: 400,
        useNativeDriver: false,
      }),
    ]).start();

    // Star pulse for new high score
    if (isNewHighScore) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(starPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(starPulse, { toValue: 0.5, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [fadeIn, slideUp, scoreScale, shakeAnim, progressAnim, starPulse, isNewHighScore, rankProgress.ratio]);

  // Determine flamingo mood based on distance
  const flamingoMood = useMemo(() => {
    if (distance < 10) return 'fallen';  // bad
    if (distance < 50) return 'neutral';
    return 'celebrate'; // good
  }, [distance]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeIn }]}>
      <Animated.View
        style={[
          styles.container,
          {
            borderRadius: s(24),
            maxHeight: height * 0.92,
            maxWidth: 420,
            transform: [{ translateY: slideUp }, { translateX: shakeAnim }],
          },
        ]}
      >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: s(28), paddingVertical: s(12), alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        {/* New High Score star particles */}
        {isNewHighScore && (
          <View style={styles.starParticles}>
            <Animated.Text style={[styles.starParticle, styles.star1, { opacity: starPulse }]}>
              *
            </Animated.Text>
            <Animated.Text style={[styles.starParticle, styles.star2, { opacity: starPulse }]}>
              *
            </Animated.Text>
            <Animated.Text style={[styles.starParticle, styles.star3, { opacity: starPulse }]}>
              *
            </Animated.Text>
            <Animated.Text style={[styles.starParticle, styles.star4, { opacity: starPulse }]}>
              *
            </Animated.Text>
          </View>
        )}

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
            <Text style={[styles.starText, { fontSize: s(20) }]}>*</Text>
          </View>
        )}

        {/* Gradient Header */}
        <View style={[styles.headerGradient, { paddingVertical: s(10), marginBottom: s(10), borderRadius: s(12) }]}>
          <Text
            style={[
              styles.gameOverText,
              { fontSize: s(26), letterSpacing: s(3) },
            ]}
          >
            GAME OVER
          </Text>
        </View>

        {/* Flamingo mood illustration */}
        <View style={[styles.flamingoMoodContainer, { height: s(36), marginBottom: s(6) }]}>
          {flamingoMood === 'fallen' && (
            <Text style={[styles.flamingoMoodText, { fontSize: s(28) }]}>
              (x_x)
            </Text>
          )}
          {flamingoMood === 'neutral' && (
            <Text style={[styles.flamingoMoodText, { fontSize: s(28) }]}>
              (^_^)
            </Text>
          )}
          {flamingoMood === 'celebrate' && (
            <Text style={[styles.flamingoMoodText, { fontSize: s(28) }]}>
              (*^*)!
            </Text>
          )}
        </View>

        {/* Distance Display (Primary) */}
        <Animated.View
          style={[
            styles.distanceContainer,
            { marginBottom: s(6), transform: [{ scale: scoreScale }] },
          ]}
        >
          <Text
            style={[
              styles.distanceLabel,
              { fontSize: s(11), letterSpacing: s(2), marginBottom: s(2) },
            ]}
          >
            DISTANCE
          </Text>
          <Text style={[styles.distanceValue, { fontSize: s(36) }]}>
            {distance}m
          </Text>
          <Text style={[styles.rankText, { fontSize: s(13), marginTop: s(2) }]}>
            {rank.emoji} {rank.name}
          </Text>
        </Animated.View>

        {/* Rank Progress Bar */}
        <View style={[styles.progressContainer, { marginBottom: s(8) }]}>
          <View style={[styles.progressTrack, { height: s(8), borderRadius: s(4) }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: progressWidth, height: s(8), borderRadius: s(4) },
              ]}
            />
          </View>
          <Text style={[styles.progressLabel, { fontSize: s(10), marginTop: s(2) }]}>
            {distance}m / {rankProgress.nextDist}m to {rankProgress.nextName}
          </Text>
        </View>

        {/* Score */}
        <Text style={[styles.scoreText, { fontSize: s(14), marginBottom: s(3) }]}>
          SCORE: {score}
        </Text>

        {/* Coins */}
        {coins > 0 && (
          <Text style={[styles.coinsText, { fontSize: s(13), marginBottom: s(4) }]}>
            🪙 {coins}
          </Text>
        )}

        {/* Gold divider line */}
        <View style={[styles.divider, { width: s(100), marginBottom: s(6) }]} />

        {/* Best Score */}
        <View style={[styles.bestRow, { marginBottom: s(2) }]}>
          <Text style={[styles.bestLabel, { fontSize: s(13) }]}>BEST: </Text>
          <Text style={[styles.bestValue, { fontSize: s(16) }]}>
            {highScore}m
          </Text>
        </View>

        {isNewHighScore && (
          <Text
            style={[
              styles.newBestText,
              { fontSize: s(11), letterSpacing: s(2), marginBottom: s(4) },
            ]}
          >
            NEW RECORD!
          </Text>
        )}

        {/* Action buttons — compact row layout for landscape */}
        <View style={[styles.actionRow, { marginTop: s(8), gap: s(6) }]}>
          {canContinue && onContinue && (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.continueButton,
                { paddingHorizontal: s(16), paddingVertical: s(8), borderRadius: s(20) },
                pressed && styles.buttonPressed,
              ]}
              onPress={onContinue}
            >
              <Text style={[styles.continueButtonText, { fontSize: s(11), letterSpacing: s(1) }]}>CONTINUE</Text>
            </Pressable>
          )}
          {onBoost && (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.button, styles.boostButton,
                  { paddingHorizontal: s(12), paddingVertical: s(8), borderRadius: s(20) },
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => onBoost('shield')}
              >
                <Text style={[styles.boostButtonText, { fontSize: s(10) }]}>SHIELD</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.button, styles.boostButton,
                  { paddingHorizontal: s(12), paddingVertical: s(8), borderRadius: s(20) },
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => onBoost('slowmo')}
              >
                <Text style={[styles.boostButtonText, { fontSize: s(10) }]}>SLOW-MO</Text>
              </Pressable>
            </>
          )}
          {onSkinUnlock && (
            <Pressable
              style={({ pressed }) => [
                styles.button, styles.skinButton,
                { paddingHorizontal: s(12), paddingVertical: s(8), borderRadius: s(20) },
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setShowSkinPreview(true)}
            >
              <Text style={[styles.skinButtonText, { fontSize: s(10) }]}>SKIN</Text>
            </Pressable>
          )}
        </View>

        {/* Home + Retry */}
        <View style={[styles.buttons, { marginTop: s(6), gap: s(10) }]}>
          <Pressable
            style={({ pressed }) => [
              styles.button, styles.homeButton,
              { paddingHorizontal: s(32), paddingVertical: s(10), borderRadius: s(24) },
              pressed && styles.buttonPressed,
            ]}
            onPress={onHome}
          >
            <Text style={[styles.homeButtonText, { fontSize: s(13), letterSpacing: s(1) }]}>HOME</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.button, styles.retryButton,
              { paddingHorizontal: s(40), paddingVertical: s(10), borderRadius: s(24) },
              pressed && styles.buttonPressed,
            ]}
            onPress={onRetry}
          >
            <Text style={[styles.retryButtonText, { fontSize: s(13), letterSpacing: s(1) }]}>RETRY</Text>
          </Pressable>
        </View>
      </ScrollView>
      </Animated.View>

      {showSkinPreview && onSkinUnlock && (
        <SkinPreview
          activeSkinId={activeSkinId ?? 'default'}
          onSelect={(skinId) => { onSkinUnlock(skinId); setShowSkinPreview(false); }}
          onClose={() => setShowSkinPreview(false)}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFF8F0',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF7A9A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'visible',
  },
  starParticles: {
    position: 'absolute',
    top: -30,
    left: -20,
    right: -20,
    bottom: -20,
  },
  starParticle: {
    position: 'absolute',
    color: '#FFD700',
    fontWeight: '900',
    textShadowColor: '#FFD700',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  star1: { top: 0, left: 10, fontSize: 20, transform: [{ rotate: '15deg' }] },
  star2: { top: -10, right: 20, fontSize: 16, transform: [{ rotate: '-20deg' }] },
  star3: { bottom: 10, left: 0, fontSize: 14, transform: [{ rotate: '30deg' }] },
  star4: { bottom: -5, right: 5, fontSize: 18, transform: [{ rotate: '-10deg' }] },
  starBadge: {
    position: 'absolute',
    backgroundColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '15deg' }],
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  starText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  headerGradient: {
    backgroundColor: '#FF7A9A',
    width: '100%',
    alignItems: 'center',
    marginTop: -4,
  },
  gameOverText: {
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  flamingoMoodContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  flamingoMoodText: {
    color: '#FF7A9A',
    fontWeight: '800',
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
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressTrack: {
    width: '85%',
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#FF7A9A',
  },
  progressLabel: {
    color: '#999',
    fontWeight: '600',
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
  coinsText: {
    color: '#DAA520',
    fontWeight: '800',
    letterSpacing: 1,
  },
  newBestText: {
    color: '#DAA520',
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
  },
  buttons: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  button: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    alignItems: 'center',
  },
  homeButton: {
    backgroundColor: '#7A8B99',
    borderWidth: 2,
    borderColor: '#8FA0AE',
  },
  homeButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  continueButton: {
    backgroundColor: '#DAA520',
    borderWidth: 2,
    borderColor: '#E6BE4D',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  continueSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: '#FF7A9A',
    borderWidth: 2,
    borderColor: '#FF9FB5',
  },
  buttonPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  boostRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  boostButton: {
    backgroundColor: '#4ECDC4',
    borderWidth: 2,
    borderColor: '#6EDDD6',
    alignItems: 'center',
  },
  boostButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  skinButton: {
    backgroundColor: '#9C27B0',
    borderWidth: 2,
    borderColor: '#BA68C8',
    alignItems: 'center',
  },
  skinButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  adSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginTop: 2,
  },
});
