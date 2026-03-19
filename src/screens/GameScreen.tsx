import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GameCanvas } from '../game/GameCanvas';
import { IS_EXPO_GO, BANNER_AD_UNIT_ID } from '../lib/adConfig';

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

interface GameScreenProps {
  width: number;
  height: number;
  isPlaying: boolean;
  onGameOver: (data: { score: number; distance: number }) => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  width,
  height,
  isPlaying,
  onGameOver,
}) => {
  const showBanner = BannerAd && BANNER_AD_UNIT_ID;

  return (
    <View style={styles.container}>
      <GameCanvas
        width={width}
        height={height}
        onGameOver={onGameOver}
        isPlaying={isPlaying}
      />

      {showBanner ? (
        <View style={styles.bannerContainer}>
          <BannerAd
            unitId={BANNER_AD_UNIT_ID}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            onAdLoaded={() => console.log('[Banner] Ad loaded successfully')}
            onAdFailedToLoad={(error: any) => console.warn('[Banner] Ad failed to load:', error?.message, error?.code)}
          />
        </View>
      ) : (
        <View style={styles.bannerPlaceholder} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  bannerContainer: {
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  bannerPlaceholder: {
    height: 60,
    backgroundColor: '#111',
  },
});
