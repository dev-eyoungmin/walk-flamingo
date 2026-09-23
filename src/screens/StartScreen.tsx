import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { CoinGlyph, MissionList } from '../ui/MissionList';
import { FONT_DISPLAY, titleShadow, UI } from '../ui/theme';
import { getRank } from '../lib/ranks';
import type { Mission, StreakStatus } from '../lib/progress';
import { formatNum, t } from '../i18n';

interface StartScreenProps {
  bestScore: number;
  bestDistance: number;
  wallet: number;
  missions: Mission[];
  dailyBest: number;
  onPlay: () => void;
  onDaily: () => void;
  onOpenSkins: () => void;
  onOpenUpgrades: () => void;
  onOpenLanguage: () => void;
  /** Show a dot on UPGRADES when something is affordable */
  upgradeBadge: boolean;
  streak: StreakStatus;
  onClaimStreak: () => void;
}

/** Daily login gift: seven days, a bigger gift on day 7. */
const StreakCard: React.FC<{ streak: StreakStatus; onClaim: () => void }> = ({ streak, onClaim }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!streak.canClaim) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [streak.canClaim, pulse]);

  return (
    <View style={styles.streak}>
      <View style={styles.missionsHeader}>
        <Text style={styles.missionsTitle}>{t('streak.title')}</Text>
        <Text style={styles.missionsCount}>{t('streak.day', { n: streak.day })}</Text>
      </View>
      <View style={styles.streakDots}>
        {Array.from({ length: 7 }, (_, i) => {
          const day = i + 1;
          const claimed = day < streak.day || (day === streak.day && !streak.canClaim);
          const today = day === streak.day && streak.canClaim;
          const dot = (
            <View
              style={[
                styles.streakDot,
                day === 7 && styles.streakDotBig,
                claimed && styles.streakDotClaimed,
                today && styles.streakDotToday,
              ]}
            >
              <Text style={styles.streakDotText}>{claimed ? '✓' : day === 7 ? '🎁' : day}</Text>
            </View>
          );
          return today ? (
            <Animated.View key={i} style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }}>
              {dot}
            </Animated.View>
          ) : (
            <View key={i}>{dot}</View>
          );
        })}
      </View>
      {streak.canClaim ? (
        <GameButton
          label={t('streak.claim', { n: streak.reward })}
          size="sm"
          color={UI.gold}
          shade={UI.goldDark}
          onPress={onClaim}
          style={styles.streakButton}
        />
      ) : (
        <Text style={styles.streakNote}>{t('streak.claimed', { n: streak.nextReward })}</Text>
      )}
    </View>
  );
};

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
  onOpenUpgrades,
  onOpenLanguage,
  upgradeBadge,
  streak,
  onClaimStreak,
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
          <Text style={styles.missionsTitle}>{t('start.missions')}</Text>
          <Text style={styles.missionsCount}>
            {doneCount}/{missions.length}
          </Text>
        </View>
        <MissionList missions={missions} compact />
        <StreakCard streak={streak} onClaim={onClaimStreak} />
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
        <View style={styles.topRight}>
          <Pressable
            onPress={onOpenLanguage}
            accessibilityRole="button"
            accessibilityLabel={t('lang.title')}
            hitSlop={8}
            style={({ pressed }) => [styles.langButton, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.langIcon}>🌐</Text>
          </Pressable>
          <View style={styles.wallet}>
            <CoinGlyph size={16} />
            <Text style={styles.walletText}>{formatNum(wallet)}</Text>
          </View>
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
        <Text style={styles.subtitle}>{t('start.subtitle')}</Text>

        {bestScore > 0 && (
          <View style={styles.bestRow}>
            <Text style={styles.bestLabel}>{t('start.best')}</Text>
            <Text style={styles.bestValue}>{formatNum(bestScore)}</Text>
            <View style={styles.dot} />
            <Text style={styles.bestRank}>
              {rank.emoji} {bestDistance} m
            </Text>
          </View>
        )}

        <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
          <GameButton label={t('start.play')} size="lg" onPress={onPlay} style={styles.play} />
        </Animated.View>

        <View style={styles.row}>
          <GameButton label={t('start.daily')} size="sm" color={UI.gold} shade={UI.goldDark} onPress={onDaily} />
          <GameButton label={t('common.upgrades')} size="sm" color={UI.mint} shade={UI.mintDark} onPress={onOpenUpgrades} badge={upgradeBadge} />
          <GameButton label={t('common.skins')} size="sm" color={UI.purple} shade={UI.purpleDark} onPress={onOpenSkins} />
        </View>
        <Text style={styles.dailyNote}>
          {dailyBest > 0 ? t('start.dailyNoteBest', { n: formatNum(dailyBest) }) : t('start.dailyNote')}
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
  topRight: {
    position: 'absolute',
    // Above the title, whose box reaches this corner on short screens
    zIndex: 10,
    top: 12,
    right: SAFE_X - 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(43,22,48,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langIcon: {
    fontSize: 18,
  },
  wallet: {
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
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  streak: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  streakDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: UI.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDotBig: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  streakDotClaimed: {
    backgroundColor: UI.gold,
    borderColor: UI.gold,
  },
  streakDotToday: {
    borderColor: UI.gold,
    backgroundColor: 'rgba(255,201,60,0.25)',
  },
  streakDotText: {
    fontSize: 11,
    fontWeight: '800',
    color: UI.text,
  },
  streakButton: {
    marginTop: 7,
    alignSelf: 'stretch',
  },
  streakNote: {
    marginTop: 6,
    fontSize: 11,
    color: UI.textDim,
    textAlign: 'center',
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
