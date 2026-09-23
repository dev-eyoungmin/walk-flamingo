import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { GameStats } from '../game/GameCanvas';
import { getRank, getRankProgress } from '../lib/ranks';
import type { Mission } from '../lib/progress';
import { formatNum, t } from '../i18n';
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
  onOpenUpgrades: () => void;
  upgradeBadge: boolean;
  onShare: () => void;
  /** Meters short of the personal best when the run ended close to it (0 = not close) */
  metersShort: number;
  /** The best distance this run was chasing */
  bestMeters: number;
}

const INPUT_LOCK_MS = 700;

const StatChip: React.FC<{ icon: string; value: string; label: string }> = ({ icon, value, label }) => (
  <View style={styles.chip}>
    <Text style={styles.chipIcon}>{icon}</Text>
    <View style={styles.chipBody}>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
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
  onOpenUpgrades,
  upgradeBadge,
  onShare,
  metersShort,
  bestMeters,
}) => {
  const close = metersShort > 0 && !isNewBest;
  const daily = summary.daily;
  const { width, height } = useWindowDimensions();
  const compact = height < 360;
  const enter = useRef(new Animated.Value(0)).current;
  const countUp = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;
  const [shownScore, setShownScore] = useState(0);
  // Players are still tapping frantically when they fall; ignore touches briefly so a late tap
  // doesn't hit RETRY or start a CONTINUE ad by accident.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setArmed(true), INPUT_LOCK_MS);
    return () => clearTimeout(id);
  }, []);

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
    if (isNewBest || close) {
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
  }, [enter, countUp, badge, stats.score, isNewBest, close]);

  const panelWidth = Math.min(width - 32, 640);

  return (
    <View style={styles.scrim} pointerEvents={armed ? 'auto' : 'none'}>
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
          {daily && <Text style={styles.dailyTag}>{t('over.dailyTag', { day: daily.day })}</Text>}
          <View style={styles.header}>
            <Text style={[styles.headerText, compact && { fontSize: 24 }, close && { color: UI.pink }]}>
              {isNewBest ? t('over.newBest') : close ? t('over.soClose') : daily?.newBest ? t('over.dailyBest') : t('over.gameOver')}
            </Text>
            {isNewBest && (
              <Animated.Text style={[styles.headerStar, { transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] }]}>
                ★
              </Animated.Text>
            )}
          </View>

          <View style={styles.columns}>
            <View style={styles.left}>
              <Text style={styles.scoreLabel}>{t('over.score')}</Text>
              <Text style={[styles.score, compact && { fontSize: 40 }]}>{formatNum(shownScore)}</Text>
              {close ? (
                <View style={styles.closeBox}>
                  <Text style={styles.closeText}>{t('over.metersShort', { n: metersShort })}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.closeFill, { width: `${Math.round((stats.meters / Math.max(1, bestMeters)) * 100)}%` }]} />
                  </View>
                </View>
              ) : (
                <Text style={styles.best}>{t('over.best', { n: formatNum(Math.max(bestScore, stats.score)) })}</Text>
              )}

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
                    {progress.next ? t('over.toNextRank', { n: progress.next.minDistance - stats.meters, name: progress.next.name }) : t('over.topRank')}
                  </Text>
                </View>
              </View>

              <View style={styles.chips}>
                <StatChip icon="🔥" value={`x${stats.bestCombo}`} label={t('over.combo')} />
                <StatChip icon="🌈" value={String(stats.fevers)} label={t('over.fever')} />
                <StatChip icon="💨" value={String(stats.dodges)} label={t('over.dodges')} />
                <StatChip icon="🐣" value={String(stats.chicksMax)} label={t('over.babies')} />
              </View>

              <View style={styles.coinsRow}>
                <CoinGlyph size={16} />
                <Text style={styles.coinsEarned}>+{summary.coinsEarned + summary.missionCoins}</Text>
                <Text style={styles.coinsWallet}>
                  {summary.missionCoins > 0 ? `${t('over.fromMissions', { n: summary.missionCoins })} · ` : ''}
                  {t('over.wallet', { n: formatNum(summary.wallet) })}
                </Text>
              </View>

              {daily && (
                <View style={styles.dailyBox}>
                  <Text style={styles.dailyBest}>{t('over.todaysBest', { n: formatNum(daily.best) })}</Text>
                  <Text style={styles.dailyTop}>
                    {t('over.topRuns', { list: daily.top.map(formatNum).join(' · ') })}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.right}>
              <Animated.View
                style={[
                  styles.fullWidth,
                  close && { transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] },
                ]}
              >
                <GameButton label={t('over.retry')} size="lg" onPress={onRetry} style={styles.fullWidth} />
              </Animated.View>
              {daily && (
                <GameButton label={t('over.share')} size="sm" color={UI.sky} shade={UI.skyDark} onPress={onShare} style={[styles.fullWidth, styles.gap]} />
              )}
              <GameButton label={t('over.home')} size="sm" color={UI.slate} shade={UI.slateDark} onPress={onHome} style={[styles.fullWidth, styles.gap]} />

              <Text style={styles.adHeading}>{t('over.bonus')}</Text>
              {canContinue && (
                <GameButton label={t('over.continue')} ad size="md" color={UI.gold} shade={UI.goldDark} onPress={onContinue} style={styles.fullWidth} />
              )}
              <View style={[styles.row, styles.gap]}>
                <GameButton label={t('over.shield')} ad size="sm" color={UI.sky} shade={UI.skyDark} onPress={() => onBoost('shield')} style={styles.half} />
                <GameButton label={t('over.slowmo')} ad size="sm" color={UI.mint} shade={UI.mintDark} onPress={() => onBoost('slowmo')} style={styles.half} />
              </View>
              <View style={[styles.row, styles.gap]}>
                <GameButton
                  label={t('common.upgrades')}
                  size="sm"
                  color={UI.mint}
                  shade={UI.mintDark}
                  onPress={onOpenUpgrades}
                  badge={upgradeBadge}
                  style={styles.half}
                />
                <GameButton label={t('common.skins')} size="sm" color={UI.purple} shade={UI.purpleDark} onPress={onOpenSkins} style={styles.half} />
              </View>
            </View>
          </View>

          <Text style={styles.missionsHeading}>
            {t('over.missions')}
            {summary.completedIds.length > 0 ? ` · ${t('over.completed', { n: summary.completedIds.length })}` : ''}
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
  closeBox: {
    marginBottom: 8,
  },
  closeText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    color: UI.pink,
  },
  closeFill: {
    height: 7,
    borderRadius: 4,
    backgroundColor: UI.gold,
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
  chipBody: {
    flexShrink: 1,
    minWidth: 0,
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
