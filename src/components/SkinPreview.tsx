import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { SKIN_PRICES, SKINS, SkinPalette } from '../lib/skins';
import { StorkPose, StorkRenderer } from '../game/render/StorkRenderer';
import { GameButton } from '../ui/GameButton';
import { CoinGlyph } from '../ui/MissionList';
import { FONT_DISPLAY, titleShadow, UI } from '../ui/theme';
import { formatNum, t, TKey } from '../i18n';

interface SkinPreviewProps {
  activeSkinId: string;
  ownedSkins: string[];
  wallet: number;
  /** Buy a skin forever with coins */
  onBuy: (skinId: string) => void;
  /** Wear an owned skin */
  onEquip: (skinId: string) => void;
  /** Wear a skin for 24 hours (rewarded ad) */
  onRent: (skinId: string) => void;
  onClose: () => void;
}

const CARD_W = 112;
const STORK_CANVAS_H = 92;

/** Small idle-walking stork for the skin cards. */
const MiniStork: React.FC<{ skin: SkinPalette; active: boolean }> = ({ skin, active }) => {
  const unit = 2.6;
  const pose = useSharedValue<StorkPose>({
    mode: 1,
    // Start past the first blink so idle previews have open eyes
    t: 1,
    angle: 0,
    omega: 0,
    walkPhase: 0,
    danger: 0,
    fallT: 0,
    feetY: STORK_CANVAS_H - 6,
    camY: 0,
    slope: 0,
    invulnT: 0,
    happyT: 0,
    hurtT: 0,
    cheerT: 0,
    lookX: 0.4,
    lookY: 0,
  });
  const frame = useFrameCallback((info) => {
    'worklet';
    const dt = (info.timeSincePreviousFrame ?? 16) / 1000;
    pose.modify((p) => {
      'worklet';
      const beat = Math.floor((p.t + dt) / 2.6) > Math.floor(p.t / 2.6);
      p.t += dt;
      p.walkPhase += dt * 1.1;
      p.angle = Math.sin(p.t * 1.7) * 0.08;
      // Show off the skin with a happy wing wave now and then
      if (beat) {
        p.happyT = 1.0;
        p.cheerT = 0.7;
      }
      p.happyT = Math.max(0, p.happyT - dt);
      p.cheerT = Math.max(0, p.cheerT - dt);
      p.lookX = Math.sin(p.t * 0.9) * 0.6;
      return p;
    }, true);
  }, false);
  useEffect(() => {
    frame.setActive(active);
  }, [active, frame]);

  return (
    <Canvas style={{ width: CARD_W - 12, height: STORK_CANVAS_H }} pointerEvents="none">
      <StorkRenderer pose={pose} unit={unit} x={(CARD_W - 12) / 2 - unit * 1.5} skin={skin} />
    </Canvas>
  );
};

export const SkinPreview: React.FC<SkinPreviewProps> = ({
  activeSkinId,
  ownedSkins,
  wallet,
  onBuy,
  onEquip,
  onRent,
  onClose,
}) => {
  const { height } = useWindowDimensions();

  return (
    <View style={styles.scrim}>
      <View style={[styles.modal, { maxHeight: height - 16 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t('common.skins')}</Text>
          <View style={styles.wallet}>
            <CoinGlyph size={15} />
            <Text style={styles.walletText}>{formatNum(wallet)}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{t('skins.subtitle')}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller} contentContainerStyle={styles.cards}>
          {SKINS.map((skin) => {
            const isActive = skin.id === activeSkinId;
            const owned = ownedSkins.includes(skin.id) || skin.id === 'default';
            const price = SKIN_PRICES[skin.id] ?? 0;
            const affordable = wallet >= price;
            return (
              <View key={skin.id} style={[styles.card, isActive && { borderColor: skin.body, backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                <MiniStork skin={skin} active={isActive} />
                <Text style={[styles.name, { color: skin.bodyLight }]} numberOfLines={1}>
                  {t(`skin.${skin.id}` as TKey).toUpperCase()}
                </Text>
                {isActive ? (
                  <View style={[styles.badge, { backgroundColor: skin.body }]}>
                    <Text style={styles.badgeText}>{t('skins.wearing')}</Text>
                  </View>
                ) : owned ? (
                  <GameButton label={t('skins.wear')} size="sm" color={UI.mint} shade={UI.mintDark} onPress={() => onEquip(skin.id)} style={styles.cardButton} />
                ) : (
                  <View style={styles.buyOptions}>
                    <GameButton
                      label={formatNum(price)}
                      coin
                      size="sm"
                      color={UI.gold}
                      shade={UI.goldDark}
                      onPress={() => onBuy(skin.id)}
                      disabled={!affordable}
                      style={styles.cardButton}
                    />
                    <GameButton label={t('skins.rent')} ad size="sm" color={UI.slate} shade={UI.slateDark} onPress={() => onRent(skin.id)} style={styles.cardButton} />
                  </View>
                )}
              </View>
            );
          })}
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
    borderColor: UI.purple,
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
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 8,
    paddingHorizontal: 6,
  },
  name: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
  },
  badge: {
    marginTop: 6,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 12,
    color: UI.text,
  },
  buyOptions: {
    gap: 4,
    marginTop: 4,
    alignSelf: 'stretch',
  },
  cardButton: {
    alignSelf: 'stretch',
    marginTop: 4,
    paddingHorizontal: 6,
  },
  close: {
    marginTop: 8,
    minWidth: 120,
  },
});
