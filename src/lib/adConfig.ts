import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** Check if running in Expo Go (ads not supported) */
export const IS_EXPO_GO = Constants.appOwnership === 'expo';

/**
 * Use test ads until AdMob app review is complete.
 * Change to false once AdMob dashboard shows app status as "Ready".
 */
const USE_TEST_ADS = false;

// Only import ad IDs when not in Expo Go
let BANNER_ID = '';
let REWARDED_ID = '';
let INTERSTITIAL_ID = '';

if (!IS_EXPO_GO) {
  try {
    const { TestIds } = require('react-native-google-mobile-ads');
    BANNER_ID = USE_TEST_ADS
      ? TestIds.ADAPTIVE_BANNER
      : Platform.select({
          ios: 'ca-app-pub-7783064858826225/4010246083',
          android: 'ca-app-pub-xxxxxxxxxxxxxxxx/bbbbbbbbbb',
        }) ?? TestIds.ADAPTIVE_BANNER;

    REWARDED_ID = USE_TEST_ADS
      ? TestIds.REWARDED
      : Platform.select({
          ios: 'ca-app-pub-7783064858826225/8245004569',
          android: 'ca-app-pub-xxxxxxxxxxxxxxxx/rrrrrrrrrr',
        }) ?? TestIds.REWARDED;

    INTERSTITIAL_ID = USE_TEST_ADS
      ? TestIds.INTERSTITIAL
      : Platform.select({
          ios: '', // TODO: create interstitial ad unit in AdMob console
          android: '',
        }) ?? TestIds.INTERSTITIAL;
  } catch (e) {
    console.warn('[AdConfig] Ads module not available:', e);
  }
}

export const BANNER_AD_UNIT_ID = BANNER_ID;
export const REWARDED_AD_UNIT_ID = REWARDED_ID;
export const INTERSTITIAL_AD_UNIT_ID = INTERSTITIAL_ID;
