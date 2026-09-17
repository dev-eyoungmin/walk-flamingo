import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { CoinGlyph, MissionList } from '../ui/MissionList';
import { FONT_DISPLAY, titleShadow, UI } from '../ui/theme';
import { getRank } from '../lib/ranks';
import type { Mission } from '../lib/progress';

interface StartScreenProps {
  bestScore: number;
  bestDistance: number;
  wallet: number;
  missions: Mission[];
  dailyBest: number;
  onPlay: () => void;
  onDaily: () => void;
  onOpenSkins: () => void;
}

const SAFE_X = Platform.OS === 'ios' ? 48 : 16;

export const StartScreen: React.FC<StartScreenProps> = ({
  bestScore,
  bestDistance,
  wallet,
  missions,
  dailyBest,
  onPlay,
  onDaily,
  onOpenSkins,
}) => {
  const enter = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    bobLoop.start();
    pulseLoop.start();
    return () => {
      bobLoop.stop();
      pulseLoop.stop();
    };
  }, [enter, bob, pulse]);

  const rank = getRank(bestDistance);
  const doneCount = missions.filter((m) => m.done).length;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Daily missions */}
      <Animated.View style={[styles.missions, { opacity: enter }]}>
        <View style={styles.missionsHeader}>
          <Text style={styles.missionsTitle}>TODAY'S MISSIONS</Text>
          <Text style={styles.missionsCount}>
            {doneCount}/{missions.length}
          </Text>
        </View>
        <MissionList missions={missions} compact />
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.panel,
          {
            opacity: enter,
            transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
          },
        ]}
      >
        <View style={styles.wallet}>
          <CoinGlyph size={16} />
          <Text style={styles.walletText}>{wallet.toLocaleString('en-US')}</Text>
        </View>

        <Animated.View
          style={{
            transform: [
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
              { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] }) },
            ],
          }}
        >
          <Text style={styles.title}>Wobby</Text>
        </Animated.View>
        <Text style={styles.subtitle}>THE WOBBLY FLAMINGO</Text>

        {bestScore > 0 && (
          <View style={styles.bestRow}>
            <Text style={styles.bestLabel}>BEST</Text>
            <Text style={styles.bestValue}>{bestScore.toLocaleString('en-US')}</Text>
            <View style={styles.dot} />
            <Text style={styles.bestRank}>
              {rank.emoji} {bestDistance} m
            </Text>
          </View>
        )}

        <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
          <GameButton label="PLAY" size="lg" onPress={onPlay} style={styles.play} />
        </Animated.View>

        <View style={styles.row}>
          <GameButton label="TODAY'S COURSE" size="sm" color={UI.gold} shade={UI.goldDark} onPress={onDaily} style={styles.daily} />
          <GameButton label="SKINS" size="sm" color={UI.purple} shade={UI.purpleDark} onPress={onOpenSkins} />
        </View>
        <Text style={styles.dailyNote}>
          {dailyBest > 0 ? `Today's best ${dailyBest.toLocaleString('en-US')} · same course for everyone` : 'Same course for everyone today'}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  missions: {
    position: 'absolute',
    left: SAFE_X,
    top: 12,
    width: 250,
    backgroundColor: 'rgba(35,20,48,0.78)',
    borderRadius: 14,
    padding: 9,
  },
  missionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  missionsTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    color: UI.gold,
    letterSpacing: 1,
  },
  missionsCount: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    color: UI.textDim,
  },
  panel: {
    position: 'absolute',
    right: '4%',
    top: 0,
    bottom: 0,
    width: '46%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wallet: {
    position: 'absolute',
    top: 12,
    right: SAFE_X - 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(43,22,48,0.6)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  walletText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 17,
    color: UI.gold,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 66,
    color: UI.text,
    ...titleShadow,
    textShadowOffset: { width: 0, height: 5 },
  },
  subtitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    letterSpacing: 3,
    color: UI.text,
    marginTop: -4,
    marginBottom: 10,
    ...titleShadow,
    textShadowOffset: { width: 0, height: 2 },
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(43,22,48,0.55)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 10,
  },
  bestLabel: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    color: UI.gold,
    marginRight: 6,
  },
  bestValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    color: UI.text,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: UI.textFaint,
    marginHorizontal: 8,
  },
  bestRank: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    color: UI.textDim,
  },
  play: {
    minWidth: 190,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  daily: {
    minWidth: 150,
  },
  dailyNote: {
    marginTop: 8,
    fontSize: 11,
    color: UI.text,
    textAlign: 'center',
    textShadowColor: 'rgba(43,22,48,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
