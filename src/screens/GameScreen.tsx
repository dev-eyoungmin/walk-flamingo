import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GameCanvas, GameStats, BoostType, RunMode } from '../game/GameCanvas';
import { IS_EXPO_GO, BANNER_AD_UNIT_ID } from '../lib/adConfig';
import type { SkinPalette } from '../lib/skins';

// Conditionally import BannerAd (not available in Expo Go)
let BannerAd: any = null;
let BannerAdSize: any = null;
if (!IS_EXPO_GO) {
  try {
    const ads = require('react-native-google-mobile-ads');
    BannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
  } catch {
    // Ads not available
  }
}

/** Space reserved at the bottom for the banner; the ground keeps drawing underneath it. */
export const BANNER_HEIGHT = 60;

interface GameScreenProps {
  width: number;
  height: number;
  showBanner: boolean;
  controlsEnabled: boolean;
  runId: number;
  runMode: RunMode;
  terrainKey: number;
  keepScroll: boolean;
  resumeId: number;
  boost: BoostType;
  bestScore: number;
  skin: SkinPalette;
  /** Seed of today's course, or null for a random course */
  courseSeed: number | null;
  showTutorial: boolean;
  onGameOver: (stats: GameStats) => void;
  onFx: (code: number, value: number) => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({ width, height, showBanner, ...canvasProps }) => {
  const bannerAvailable = showBanner && BannerAd && BANNER_AD_UNIT_ID;

  return (
    <View style={[styles.container, { width, height }]}>
      <GameCanvas width={width} height={height - BANNER_HEIGHT} canvasHeight={height} {...canvasProps} />

      {bannerAvailable ? (
        <View style={styles.banner}>
          <BannerAd
            unitId={BANNER_AD_UNIT_ID}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            onAdFailedToLoad={(error: any) => console.warn('[Banner] Ad failed to load:', error?.message, error?.code)}
          />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BANNER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,10,30,0.85)',
  },
});
