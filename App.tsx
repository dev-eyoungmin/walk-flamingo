import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Font from 'expo-font';
import { IS_EXPO_GO } from './src/lib/adConfig';
import { initLocale } from './src/i18n';
import { loadLanguageChoice } from './src/i18n/preference';

export default function App() {
  // Screens are loaded only after the language is known: their labels, fonts and HUD text are
  // fixed when their modules first load (changing language restarts the app).
  const [Root, setRoot] = useState<React.ComponentType | null>(null);

  const initialize = useCallback(async () => {
    // Lock to landscape (not supported everywhere, e.g. web)
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch (e) {
      console.warn('[Orientation] Lock failed:', e);
    }

    initLocale(await loadLanguageChoice());

    // Load the display font shared by menus for this language (the in-game HUD loads it through Skia)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DISPLAY_FAMILY, DISPLAY_SOURCE } = require('./src/i18n/fonts');
    try {
      await Font.loadAsync({ [DISPLAY_FAMILY]: DISPLAY_SOURCE });
    } catch (e) {
      console.warn(`[Font] Failed to load ${DISPLAY_FAMILY}:`, e);
    }

    // Initialize AdMob SDK (required for production builds)
    if (!IS_EXPO_GO) {
      try {
        const { default: mobileAds } = require('react-native-google-mobile-ads');
        const adapterStatuses = await mobileAds().initialize();
        console.log('[AdMob] Initialized:', JSON.stringify(adapterStatuses));
      } catch (e) {
        console.warn('[AdMob] Initialization failed:', e);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { AppNavigator } = require('./src/navigation/AppNavigator');
    setRoot(() => AppNavigator);
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!Root) {
    return <View style={styles.loading} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Root />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loading: {
    flex: 1,
    backgroundColor: '#94D2F3',
  },
});
