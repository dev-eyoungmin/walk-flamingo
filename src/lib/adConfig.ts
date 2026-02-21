import { Platform } from 'react-native';
import Constants from 'expo-constants';

/** Check if running in Expo Go (ads not supported) */
export const IS_EXPO_GO = Constants.appOwnership === 'expo';

const IS_TEST = __DEV__;

// Only import ad IDs when not in Expo Go
let BANNER_ID = '';
let INTERSTITIAL_ID = '';

if (!IS_EXPO_GO) {
  try {
    const { TestIds } = require('react-native-google-mobile-ads');
    BANNER_ID = IS_TEST
      ? TestIds.ADAPTIVE_BANNER
      : Platform.select({
          ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/bbbbbbbbbb',
          android: 'ca-app-pub-xxxxxxxxxxxxxxxx/bbbbbbbbbb',
        }) ?? TestIds.ADAPTIVE_BANNER;

    INTERSTITIAL_ID = IS_TEST
      ? TestIds.INTERSTITIAL
      : Platform.select({
          ios: 'ca-app-pub-xxxxxxxxxxxxxxxx/iiiiiiiiii',
          android: 'ca-app-pub-xxxxxxxxxxxxxxxx/iiiiiiiiii',
        }) ?? TestIds.INTERSTITIAL;
  } catch {
    // Ads module not available
  }
}

export const BANNER_AD_UNIT_ID = BANNER_ID;
export const INTERSTITIAL_AD_UNIT_ID = INTERSTITIAL_ID;
