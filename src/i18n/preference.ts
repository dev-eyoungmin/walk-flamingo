import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { reloadAppAsync } from 'expo';
import { isLocale, LanguageChoice } from './index';

const STORAGE_KEY = '@wobby_language';

/** The language picked in-game ('auto' = follow the device). */
export async function loadLanguageChoice(): Promise<LanguageChoice> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    return isLocale(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * Saves the choice and restarts the app so every screen, font and HUD label picks it up.
 * Progress is already persisted, so nothing is lost.
 */
export async function changeLanguage(choice: LanguageChoice): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Without storage the choice can't survive a restart; keep going with the reload anyway
  }
  if (Platform.OS === 'web') {
    // Drop a ?lang= override so the saved choice applies
    const w = globalThis as unknown as { location: { pathname: string; assign: (url: string) => void } };
    w.location.assign(w.location.pathname);
    return;
  }
  await reloadAppAsync('Language changed');
}
