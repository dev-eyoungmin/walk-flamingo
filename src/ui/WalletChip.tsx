import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatNum, t } from '../i18n';
import { CoinGlyph } from './CoinGlyph';
import { FONT_DISPLAY, UI } from './theme';

/** Coin balance; with `onPress` it shows a "+" and opens the coin shop. */
export const WalletChip: React.FC<{ wallet: number; onPress?: () => void; size?: 'sm' | 'md' }> = ({ wallet, onPress, size = 'sm' }) => {
  const md = size === 'md';
  const body = (
    <>
      <CoinGlyph size={md ? 16 : 15} />
      <Text style={[styles.text, md && styles.textMd]}>{formatNum(wallet)}</Text>
      {onPress && (
        <View style={styles.plus}>
          <Text style={styles.plusText}>+</Text>
        </View>
      )}
    </>
  );
  if (!onPress) return <View style={[styles.chip, md && styles.chipMd]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('shop.title')}
      hitSlop={8}
      style={({ pressed }) => [styles.chip, md && styles.chipMd, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipMd: {
    gap: 6,
    backgroundColor: 'rgba(43,22,48,0.6)',
    borderRadius: 14,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 5,
  },
  text: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    color: UI.gold,
  },
  textMd: {
    fontSize: 17,
  },
  plus: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: UI.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  plusText: {
    color: UI.ink,
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '900',
  },
});
