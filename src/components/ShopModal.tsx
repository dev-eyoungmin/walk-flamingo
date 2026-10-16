import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { formatNum, t } from '../i18n';
import { COIN_PACKS, REMOVE_ADS_ID } from '../lib/shop';
import { FREE_COINS } from '../lib/progress';
import type { PurchaseState, StoreProduct } from '../hooks/useStore';
import { GameButton } from '../ui/GameButton';
import { CoinGlyph } from '../ui/CoinGlyph';
import { WalletChip } from '../ui/WalletChip';
import { FONT_DISPLAY, titleShadow, UI } from '../ui/theme';

interface ShopModalProps {
  wallet: number;
  products: Record<string, StoreProduct>;
  adsRemoved: boolean;
  state: PurchaseState;
  /** Rewarded "free coins" left today */
  freeCoinsLeft: number;
  onBuy: (productId: string) => void;
  onFreeCoins: () => void;
  onRestore: () => void;
  onClose: () => void;
}

const CARD_W = 124;

const Coins: React.FC<{ n: number }> = ({ n }) => (
  <View style={styles.coinStack}>
    {Array.from({ length: n }, (_, i) => (
      <View key={i} style={{ marginLeft: i ? -9 : 0, marginTop: i % 2 ? -6 : 0 }}>
        <CoinGlyph size={22} />
      </View>
    ))}
  </View>
);

export const ShopModal: React.FC<ShopModalProps> = ({
  wallet,
  products,
  adsRemoved,
  state,
  freeCoinsLeft,
  onBuy,
  onFreeCoins,
  onRestore,
  onClose,
}) => {
  const { height } = useWindowDimensions();
  const busy = state !== 'idle';
  const noAds = products[REMOVE_ADS_ID];

  return (
    <View style={styles.scrim}>
      <View style={[styles.modal, { maxHeight: height - 16 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('shop.title')}</Text>
          <WalletChip wallet={wallet} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.cards}>
          <View style={[styles.card, styles.noAdsCard]}>
            <Text style={styles.icon}>🚫📺</Text>
            <Text style={[styles.name, { color: UI.pink }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
              {t('shop.noAds')}
            </Text>
            <Text style={styles.desc} numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.8}>
              {t('shop.noAdsDesc')}
            </Text>
            {adsRemoved ? (
              <View style={styles.owned}>
                <Text style={styles.ownedText}>✓ {t('shop.owned')}</Text>
              </View>
            ) : (
              <GameButton
                label={noAds?.price ?? '—'}
                size="sm"
                color={UI.pink}
                shade={UI.pinkDark}
                onPress={() => onBuy(REMOVE_ADS_ID)}
                disabled={!noAds || busy}
                style={styles.buy}
              />
            )}
          </View>

          {COIN_PACKS.map((pack, i) => {
            const product = products[pack.id];
            return (
              <View key={pack.id} style={styles.card}>
                {pack.bonusPct > 0 && (
                  <View style={[styles.tag, i === COIN_PACKS.length - 1 && { backgroundColor: UI.pink }]}>
                    <Text style={styles.tagText}>{i === COIN_PACKS.length - 1 ? t('shop.bestValue') : `+${pack.bonusPct}%`}</Text>
                  </View>
                )}
                <Coins n={i + 2} />
                <Text style={styles.amount}>{formatNum(pack.coins)}</Text>
                <Text style={styles.desc}>{t('shop.coins')}</Text>
                <GameButton
                  label={product?.price ?? '—'}
                  size="sm"
                  color={UI.gold}
                  shade={UI.goldDark}
                  onPress={() => onBuy(pack.id)}
                  disabled={!product || busy}
                  style={styles.buy}
                />
              </View>
            );
          })}

          <View style={[styles.card, styles.freeCard]}>
            <Coins n={1} />
            <Text style={styles.amount}>+{FREE_COINS.AMOUNT}</Text>
            <Text style={styles.desc}>{t('shop.freeLeft', { n: freeCoinsLeft })}</Text>
            <GameButton
              label={t('shop.free')}
              ad
              size="sm"
              color={UI.mint}
              shade={UI.mintDark}
              onPress={onFreeCoins}
              disabled={freeCoinsLeft <= 0}
              style={styles.buy}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {busy ? (
            <ActivityIndicator color={UI.gold} />
          ) : (
            <Pressable accessibilityRole="button" onPress={onRestore} hitSlop={8}>
              <Text style={styles.restore}>{t('shop.restore')}</Text>
            </Pressable>
          )}
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
    zIndex: 110,
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
    marginBottom: 8,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 26,
    color: UI.text,
    ...titleShadow,
  },
  scroller: {
    alignSelf: 'stretch',
    flexGrow: 0,
  },
  cards: {
    gap: 8,
    paddingHorizontal: 2,
    paddingTop: 8,
  },
  card: {
    width: CARD_W,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,201,60,0.55)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noAdsCard: {
    borderColor: UI.pink,
    backgroundColor: 'rgba(255,111,156,0.1)',
  },
  freeCard: {
    borderColor: UI.mint,
  },
  icon: {
    fontSize: 26,
  },
  coinStack: {
    flexDirection: 'row',
    height: 34,
    alignItems: 'center',
  },
  name: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 2,
  },
  amount: {
    fontFamily: FONT_DISPLAY,
    fontSize: 22,
    color: UI.gold,
    ...titleShadow,
    textShadowOffset: { width: 0, height: 2 },
  },
  desc: {
    fontSize: 10,
    color: UI.textDim,
    textAlign: 'center',
    marginVertical: 4,
  },
  tag: {
    position: 'absolute',
    top: -9,
    right: -4,
    backgroundColor: UI.mint,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '900',
    color: UI.ink,
  },
  buy: {
    alignSelf: 'stretch',
    paddingHorizontal: 6,
  },
  owned: {
    alignSelf: 'stretch',
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(94,230,201,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownedText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    color: UI.mint,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 10,
  },
  restore: {
    fontSize: 12,
    color: UI.textDim,
    textDecorationLine: 'underline',
  },
  close: {
    minWidth: 120,
  },
});
