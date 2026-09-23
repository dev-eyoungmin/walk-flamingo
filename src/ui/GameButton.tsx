import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { FONT_DISPLAY, UI } from './theme';
import { t } from '../i18n';
import { CoinGlyph } from './CoinGlyph';

interface GameButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
  shade?: string;
  size?: 'lg' | 'md' | 'sm';
  /** Shows a small "watch ad" badge so rewarded options are never a surprise */
  ad?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Small red dot: something new to do behind this button */
  badge?: boolean;
  /** Price button: a coin icon before the label (the label is just the number) */
  coin?: boolean;
}

const SIZES = {
  lg: { height: 58, font: 28, padX: 34, radius: 18, depth: 5 },
  md: { height: 44, font: 20, padX: 22, radius: 14, depth: 4 },
  sm: { height: 36, font: 15, padX: 14, radius: 11, depth: 3 },
};

export const GameButton: React.FC<GameButtonProps> = ({
  label,
  onPress,
  color = UI.pink,
  shade = UI.pinkDark,
  size = 'md',
  ad = false,
  style,
  disabled = false,
  badge = false,
  coin = false,
}) => {
  const s = SIZES[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={ad ? t('common.watchAd', { label }) : label}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.padX,
          borderRadius: s.radius,
          backgroundColor: color,
          borderBottomColor: shade,
          borderBottomWidth: pressed ? 1 : s.depth,
          marginTop: pressed ? s.depth - 1 : 0,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {ad && (
        <View style={[styles.adBadge, { height: s.font * 0.9, borderRadius: s.font * 0.45, paddingHorizontal: s.font * 0.3 }]}>
          <View style={[styles.play, { borderLeftWidth: s.font * 0.32, borderTopWidth: s.font * 0.2, borderBottomWidth: s.font * 0.2 }]} />
          {size !== 'sm' && <Text style={[styles.adText, { fontSize: s.font * 0.48 }]}>{t('common.ad')}</Text>}
        </View>
      )}
      {coin && (
        <View style={styles.coin}>
          <CoinGlyph size={s.font * 0.95} />
        </View>
      )}
      <Text style={[styles.label, { fontSize: s.font }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {label}
      </Text>
      {badge && <View style={styles.badge} />}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: UI.ink,
  },
  label: {
    fontFamily: FONT_DISPLAY,
    color: UI.text,
    textShadowColor: 'rgba(43,22,48,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
    letterSpacing: 0.5,
  },
  adBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(43,22,48,0.4)',
    marginRight: 7,
  },
  play: {
    width: 0,
    height: 0,
    borderLeftColor: UI.text,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginRight: 3,
  },
  coin: {
    marginRight: 5,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#FF3B55',
    borderWidth: 2,
    borderColor: UI.ink,
  },
  adText: {
    fontFamily: FONT_DISPLAY,
    color: UI.text,
  },
});
