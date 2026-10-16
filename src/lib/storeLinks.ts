import { Platform } from 'react-native';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.wobbly.flamingo.game';

/** Where a shared score sends friends: the store page of the platform the sharer plays on. */
export const STORE_URL = Platform.OS === 'ios' ? 'https://apps.apple.com/app/id6760018546' : PLAY_URL;

/** Opens the store straight on the review form (App Store "write a review", Play's reviews section). */
export const REVIEW_URL =
  Platform.OS === 'ios'
    ? `${STORE_URL}?action=write-review`
    : Platform.OS === 'android'
      ? 'market://details?id=com.wobbly.flamingo.game&showAllReviews=true'
      : null;
