import React, { useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { formatNum, t, TKey } from '../i18n';
import { maxLevel, upgradeCost, UpgradeId, UpgradeLevels, UPGRADES, upgradeValue } from '../lib/upgrades';
import { GameButton } from '../ui/GameButton';
import { CoinGlyph } from '../ui/MissionList';
import { FONT_DISPLAY, titleShadow, UI } from '../ui/theme';

interface UpgradeShopProps {
  levels: UpgradeLevels;
  wallet: number;
  /** Returns true when the purchase went through */
  onBuy: (id: UpgradeId) => boolean;
  onClose: () => void;
}

const CARD_W = 128;

const ICONS: Record<UpgradeId, string> = { magnet: '🧲', fever: '🌈', luck: '🍀', balloon: '🎈' };
const COLORS: Record<UpgradeId, string> = { magnet: '#FF6F9C', fever: '#FFB3D1', luck: '#5EE6C9', balloon: '#7FDBFF' };

/** "8s → 10s", "+14%", "1/day → 2/day" */
function effectText(id: UpgradeId, level: number): string {
  const fmt = (lv: number) => {
    const v = upgradeValue(id, lv);
    if (id === 'luck') return `+${Math.round((1 / v - 1) * 100)}%`;
    return id === 'balloon' ? String(v) : `${v}s`;
  };
  // Balloons: "0 → 1/day" keeps the unit once so it fits in every language
  const unit = (text: string) => (id === 'balloon' ? t('up.perDay', { n: text }) : text);
  const max = maxLevel(id);
  return level >= max ? unit(fmt(level)) : `${fmt(level)} → ${unit(fmt(level + 1))}`;
}

const UpgradeCard: React.FC<{ id: UpgradeId; level: number; wallet: number; onBuy: (id: UpgradeId) => boolean }> = ({
  id,
  level,
  wallet,
  onBuy,
}) => {
  const bounce = useRef(new Animated.Value(1)).current;
  const cost = upgradeCost(id, level);
  const max = maxLevel(id);

  const buy = () => {
    if (!onBuy(id)) return;
    bounce.setValue(0.9);
    Animated.spring(bounce, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[styles.card, { borderColor: COLORS[id], transform: [{ scale: bounce }] }]}>
      <Text style={styles.icon}>{ICONS[id]}</Text>
      <Text style={[styles.name, { color: COLORS[id] }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
        {t(`up.${id}` as TKey)}
      </Text>
      <Text style={styles.desc} numberOfLines={2}>
        {t(`up.${id}Desc` as TKey)}
      </Text>
      <View style={styles.pips}>
        {Array.from({ length: max }, (_, i) => (
          <View key={i} style={[styles.pip, i < level && { backgroundColor: COLORS[id], borderColor: COLORS[id] }]} />
        ))}
      </View>
      <Text style={styles.effect} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {effectText(id, level)}
      </Text>
      {cost === null ? (
        <View style={styles.maxBadge}>
          <Text style={styles.maxText}>{t('up.max')}</Text>
        </View>
      ) : (
        <GameButton
          label={formatNum(cost)}
          coin
          size="sm"
          color={UI.gold}
          shade={UI.goldDark}
          onPress={buy}
          disabled={wallet < cost}
          style={styles.buy}
        />
      )}
    </Animated.View>
  );
};

export const UpgradeShop: React.FC<UpgradeShopProps> = ({ levels, wallet, onBuy, onClose }) => {
  const { height } = useWindowDimensions();
  return (
    <View style={styles.scrim}>
      <View style={[styles.modal, { maxHeight: height - 16 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('common.upgrades')}</Text>
          <View style={styles.wallet}>
            <CoinGlyph size={15} />
            <Text style={styles.walletText}>{formatNum(wallet)}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{t('up.subtitle')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.cards}>
          {UPGRADES.map((u) => (
            <UpgradeCard key={u.id} id={u.id} level={levels[u.id] ?? 0} wallet={wallet} onBuy={onBuy} />
          ))}
        </ScrollView>
        <GameButton label={t('common.close')} size="sm" color={UI.slate} shade={UI.slateDark} onPress={onClose} style={styles.close} />
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
    paddingHorizontal: 14,
    alignItems: 'center',
    maxWidth: '96%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 26,
    color: UI.text,
    ...titleShadow,
  },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  walletText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    color: UI.gold,
  },
  subtitle: {
    fontSize: 11,
    color: UI.textDim,
    marginBottom: 8,
  },
  scroller: {
    alignSelf: 'stretch',
    flexGrow: 0,
  },
  cards: {
    gap: 8,
    paddingHorizontal: 2,
  },
  card: {
    width: CARD_W,
    borderRadius: 14,
    borderWidth: 2.5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 7,
  },
  icon: {
    fontSize: 26,
  },
  name: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    lineHeight: 17,
    minHeight: 34,
    marginTop: 2,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  desc: {
    fontSize: 10,
    color: UI.textDim,
    textAlign: 'center',
    minHeight: 26,
    marginTop: 2,
  },
  pips: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  pip: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: UI.textFaint,
  },
  effect: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    color: UI.text,
    marginTop: 5,
  },
  buy: {
    alignSelf: 'stretch',
    marginTop: 6,
    paddingHorizontal: 6,
  },
  maxBadge: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 6,
    height: 36,
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: UI.mint,
  },
  maxText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    color: UI.ink,
  },
  close: {
    marginTop: 8,
    minWidth: 120,
  },
});
