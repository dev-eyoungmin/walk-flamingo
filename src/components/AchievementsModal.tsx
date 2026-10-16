import React from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { formatNum, t, TKey } from '../i18n';
import { achievementDesc, achievementName, AchievementId, AchievementStatus } from '../lib/achievements';
import { GameButton } from '../ui/GameButton';
import { CoinGlyph } from '../ui/CoinGlyph';
import { FONT_DISPLAY, titleShadow, UI } from '../ui/theme';

interface AchievementsModalProps {
  list: AchievementStatus[];
  onClaim: (id: AchievementId) => void;
  onClaimAll: () => void;
  onClose: () => void;
}

const Row: React.FC<{ a: AchievementStatus; onClaim: (id: AchievementId) => void }> = ({ a, onClaim }) => {
  const tiers = a.def.targets.length;
  const done = a.target === null;
  const goal = a.target ?? a.def.targets[tiers - 1];
  const ratio = done ? 1 : Math.min(1, a.value / goal);
  return (
    <View style={[styles.row, a.claimable && styles.rowReady]}>
      <Text style={styles.icon}>{a.def.icon}</Text>
      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {t(achievementName(a.def.id))}
          </Text>
          <Text style={styles.stars}>
            {'★'.repeat(a.claimed)}
            <Text style={styles.starsOff}>{'★'.repeat(tiers - a.claimed)}</Text>
          </Text>
        </View>
        <Text style={styles.desc} numberOfLines={1}>
          {t(achievementDesc(a.def.id), { n: formatNum(goal) })}
          {a.def.skin && !done ? `  ·  ${t('ach.skinReward', { name: t(`skin.${a.def.skin}` as TKey) })}` : ''}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }, a.claimable && { backgroundColor: UI.gold }]} />
        </View>
        <Text style={styles.count}>
          {formatNum(Math.min(a.value, goal))} / {formatNum(goal)}
        </Text>
      </View>
      <View style={styles.right}>
        {done ? (
          <Text style={styles.complete}>✓</Text>
        ) : a.claimable ? (
          <GameButton label={`+${a.reward}`} size="sm" color={UI.gold} shade={UI.goldDark} onPress={() => onClaim(a.def.id)} style={styles.claim} />
        ) : (
          <View style={styles.reward}>
            <CoinGlyph size={12} />
            <Text style={styles.rewardText}>{a.reward}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export const AchievementsModal: React.FC<AchievementsModalProps> = ({ list, onClaim, onClaimAll, onClose }) => {
  const { height, width } = useWindowDimensions();
  // Ready ones first, finished ones last
  const sorted = [...list].sort((a, b) => Number(b.claimable) - Number(a.claimable) || Number(a.target === null) - Number(b.target === null));
  const ready = list.reduce((n, a) => n + a.ready, 0);
  const stars = list.reduce((n, a) => n + a.claimed, 0);
  const maxStars = list.reduce((n, a) => n + a.def.targets.length, 0);
  return (
    <View style={styles.scrim}>
      <View style={[styles.modal, { maxHeight: height - 16, width: Math.min(width - 32, 560) }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('ach.title')}</Text>
          <Text style={styles.total}>
            ★ {stars}/{maxStars}
          </Text>
        </View>
        <ScrollView style={styles.list} contentContainerStyle={{ gap: 6 }}>
          {sorted.map((a) => (
            <Row key={a.def.id} a={a} onClaim={onClaim} />
          ))}
        </ScrollView>
        <View style={styles.footer}>
          {ready > 1 && <GameButton label={t('ach.claimAll', { n: ready })} size="sm" color={UI.gold} shade={UI.goldDark} onPress={onClaimAll} />}
          <GameButton label={t('common.close')} size="sm" color={UI.slate} shade={UI.slateDark} onPress={onClose} style={styles.close} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,10,30,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modal: {
    backgroundColor: UI.panel,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: UI.gold,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 6,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 24,
    color: UI.text,
    ...titleShadow,
  },
  total: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    color: UI.gold,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
  },
  rowReady: {
    backgroundColor: 'rgba(255,201,60,0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,201,60,0.6)',
  },
  icon: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    color: UI.text,
    flexShrink: 1,
  },
  stars: {
    fontSize: 11,
    color: UI.gold,
  },
  starsOff: {
    color: 'rgba(255,255,255,0.2)',
  },
  desc: {
    fontSize: 10,
    color: UI.textDim,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: UI.pink,
  },
  count: {
    fontSize: 9,
    color: UI.textFaint,
    marginTop: 1,
  },
  right: {
    width: 74,
    alignItems: 'center',
  },
  claim: {
    alignSelf: 'stretch',
    paddingHorizontal: 4,
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rewardText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    color: UI.textDim,
  },
  complete: {
    fontSize: 20,
    color: UI.mint,
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  close: {
    minWidth: 120,
  },
});
