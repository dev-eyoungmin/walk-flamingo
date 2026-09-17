import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { GameStats } from '../game/GameCanvas';
import { getRank, getRankProgress } from '../lib/ranks';
import type { Mission } from '../lib/progress';
import { GameButton } from '../ui/GameButton';
import { CoinGlyph, MissionList } from '../ui/MissionList';
import { FONT_DISPLAY, titleShadow, UI } from '../ui/theme';

export interface RunSummary {
  coinsEarned: number;
  missionCoins: number;
  completedIds: string[];
  wallet: number;
  missions: Mission[];
  daily: { best: number; top: number[]; newBest: boolean; day: string } | null;
}

interface GameOverScreenProps {
  stats: GameStats;
  summary: RunSummary;
  bestScore: number;
  isNewBest: boolean;
  canContinue: boolean;
  onRetry: () => void;
  onHome: () => void;
  onContinue: () => void;
  onBoost: (type: 'shield' | 'slowmo') => void;
  onOpenSkins: () => void;
  onShare: () => void;
}

const StatChip: React.FC<{ icon: string; value: string; label: string }> = ({ icon, value, label }) => (
  <View style={styles.chip}>
    <Text style={styles.chipIcon}>{icon}</Text>
    <View>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  </View>
);

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  stats,
  summary,
  bestScore,
  isNewBest,
  canContinue,
  onRetry,
  onHome,
  onContinue,
  onBoost,
  onOpenSkins,
  onShare,
}) => {
  const daily = summary.daily;
  const { width, height } = useWindowDimensions();
  const compact = height < 360;
  const enter = useRef(new Animated.Value(0)).current;
  const countUp = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;
  const [shownScore, setShownScore] = useState(0);

  const rank = getRank(stats.meters);
  const progress = getRankProgress(stats.meters);

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start();
    const id = countUp.addListener(({ value }) => setShownScore(Math.round(value)));
    Animated.timing(countUp, {
      toValue: stats.score,
      duration: Math.min(1200, 300 + stats.score / 20),
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    let loop: Animated.CompositeAnimation | null = null;
    if (isNewBest) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(badge, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(badge, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      );
      loop.start();
    }
    return () => {
      countUp.removeListener(id);
      loop?.stop();
    };
  }, [enter, countUp, badge, stats.score, isNewBest]);

  const panelWidth = Math.min(width - 32, 640);

  return (
    <View style={styles.scrim}>
      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            maxHeight: height - 24,
            opacity: enter,
            transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          },
        ]}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
          {daily && <Text style={styles.dailyTag}>TODAY'S COURSE · {daily.day}</Text>}
          <View style={styles.header}>
            <Text style={[styles.headerText, compact && { fontSize: 24 }]}>
              {isNewBest ? 'NEW BEST!' : daily?.newBest ? "TODAY'S BEST!" : 'GAME OVER'}
            </Text>
            {isNewBest && (
              <Animated.Text style={[styles.headerStar, { transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] }]}>
                ★
              </Animated.Text>
            )}
          </View>

          <View style={styles.columns}>
            <View style={styles.left}>
              <Text style={styles.scoreLabel}>SCORE</Text>
              <Text style={[styles.score, compact && { fontSize: 40 }]}>{shownScore.toLocaleString('en-US')}</Text>
              <Text style={styles.best}>BEST {Math.max(bestScore, stats.score).toLocaleString('en-US')}</Text>

              <View style={styles.rankRow}>
                <Text style={styles.rankEmoji}>{rank.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rankName}>
                    {rank.name} · {stats.meters} m
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(progress.ratio * 100)}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>
                    {progress.next ? `${progress.next.minDistance - stats.meters} m to ${progress.next.name}` : 'Top rank reached!'}
                  </Text>
                </View>
              </View>

              <View style={styles.chips}>
                <StatChip icon="🔥" value={`x${stats.bestCombo}`} label="COMBO" />
                <StatChip icon="🌈" value={String(stats.fevers)} label="FEVER" />
                <StatChip icon="💨" value={String(stats.dodges)} label="DODGES" />
                <StatChip icon="🐣" value={String(stats.chicksMax)} label="BABIES" />
              </View>

              <View style={styles.coinsRow}>
                <CoinGlyph size={16} />
                <Text style={styles.coinsEarned}>+{summary.coinsEarned + summary.missionCoins}</Text>
                <Text style={styles.coinsWallet}>
                  {summary.missionCoins > 0 ? `(${summary.missionCoins} from missions) · ` : ''}
                  wallet {summary.wallet.toLocaleString('en-US')}
                </Text>
              </View>

              {daily && (
                <View style={styles.dailyBox}>
                  <Text style={styles.dailyBest}>TODAY'S BEST {daily.best.toLocaleString('en-US')}</Text>
                  <Text style={styles.dailyTop}>
                    Your top runs: {daily.top.map((v) => v.toLocaleString('en-US')).join(' · ')}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.right}>
              <GameButton label="RETRY" size="lg" onPress={onRetry} style={styles.fullWidth} />
              {daily && (
                <GameButton label="SHARE SCORE" size="sm" color={UI.sky} shade={UI.skyDark} onPress={onShare} style={[styles.fullWidth, styles.gap]} />
              )}
              <GameButton label="HOME" size="sm" color={UI.slate} shade={UI.slateDark} onPress={onHome} style={[styles.fullWidth, styles.gap]} />

              <Text style={styles.adHeading}>BONUS</Text>
              {canContinue && (
                <GameButton label="CONTINUE" ad size="md" color={UI.gold} shade={UI.goldDark} onPress={onContinue} style={styles.fullWidth} />
              )}
              <View style={[styles.row, styles.gap]}>
                <GameButton label="SHIELD" ad size="sm" color={UI.sky} shade={UI.skyDark} onPress={() => onBoost('shield')} style={styles.half} />
                <GameButton label="SLOW-MO" ad size="sm" color={UI.mint} shade={UI.mintDark} onPress={() => onBoost('slowmo')} style={styles.half} />
              </View>
              <GameButton label="SKINS" size="sm" color={UI.purple} shade={UI.purpleDark} onPress={onOpenSkins} style={[styles.fullWidth, styles.gap]} />
            </View>
          </View>

          <Text style={styles.missionsHeading}>
            TODAY'S MISSIONS {summary.completedIds.length > 0 ? `· ${summary.completedIds.length} COMPLETED!` : ''}
          </Text>
          <MissionList missions={summary.missions} justCompleted={summary.completedIds} compact />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: UI.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    backgroundColor: UI.panel,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: UI.panelBorder,
    overflow: 'hidden',
  },
  content: {
    padding: 14,
  },
  dailyTag: {
    alignSelf: 'center',
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    color: UI.gold,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  coinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
    flexWrap: 'wrap',
  },
  coinsEarned: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    color: UI.gold,
  },
  coinsWallet: {
    fontSize: 11,
    color: UI.textDim,
  },
  dailyBox: {
    marginTop: 8,
    backgroundColor: 'rgba(255,201,60,0.12)',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,201,60,0.5)',
    padding: 8,
  },
  dailyBest: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    color: UI.gold,
  },
  dailyTop: {
    fontSize: 11,
    color: UI.textDim,
    marginTop: 2,
  },
  missionsHeading: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    color: UI.gold,
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 30,
    color: UI.text,
    letterSpacing: 1,
    ...titleShadow,
  },
  headerStar: {
    fontSize: 26,
    color: UI.gold,
    marginLeft: 8,
  },
  columns: {
    flexDirection: 'row',
  },
  left: {
    flex: 1.15,
    paddingRight: 14,
  },
  right: {
    flex: 1,
    justifyContent: 'center',
  },
  scoreLabel: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    color: UI.textDim,
    letterSpacing: 2,
  },
  score: {
    fontFamily: FONT_DISPLAY,
    fontSize: 50,
    lineHeight: 56,
    color: UI.text,
    ...titleShadow,
  },
  best: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    color: UI.gold,
    marginBottom: 8,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  rankEmoji: {
    fontSize: 26,
    marginRight: 8,
  },
  rankName: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    color: UI.text,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 7,
    borderRadius: 4,
    backgroundColor: UI.pink,
  },
  progressLabel: {
    fontSize: 11,
    color: UI.textDim,
  },
  chips: {
    flexDirection: 'row',
    gap: 5,
  },
  chip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  chipIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  chipValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    color: UI.text,
  },
  chipLabel: {
    fontSize: 8,
    color: UI.textFaint,
    letterSpacing: 0.5,
  },
  adHeading: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    color: UI.textFaint,
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  gap: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
    paddingHorizontal: 6,
  },
});
