import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Font from 'expo-font';
import { AppNavigator } from './src/navigation/AppNavigator';
import { IS_EXPO_GO } from './src/lib/adConfig';

export default function App() {
  const [ready, setReady] = useState(false);

  const initialize = useCallback(async () => {
    // Lock to landscape (not supported everywhere, e.g. web)
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch (e) {
      console.warn('[Orientation] Lock failed:', e);
    }

    // Load the display font shared by menus (the in-game HUD loads it through Skia)
    try {
      await Font.loadAsync({
        LilitaOne: require('./assets/fonts/LilitaOne-Regular.ttf'),
      });
    } catch (e) {
      console.warn('[Font] Failed to load LilitaOne:', e);
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

    setReady(true);
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!ready) {
    return <View style={styles.loading} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <AppNavigator />
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
