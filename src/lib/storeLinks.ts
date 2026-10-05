import { Platform } from 'react-native';

/** Where a shared score sends friends. Android has no store page yet, so it gets the game's site. */
export const STORE_URL =
  Platform.OS === 'ios' ? 'https://apps.apple.com/app/id6760018546' : 'https://dev-eyoungmin.github.io/walk-flamingo/';
