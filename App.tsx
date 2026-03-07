import React, { useCallback, useEffect, useState } from 'react';
import { Platform, View, StyleSheet, StatusBar } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Font from 'expo-font';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { AppNavigator } from './src/navigation/AppNavigator';
import { IS_EXPO_GO } from './src/lib/adConfig';

export default function App() {
  const [ready, setReady] = useState(false);

  const initialize = useCallback(async () => {
    // Lock to landscape
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );

    // Load fonts
    await Font.loadAsync({
      'pixel': require('./assets/fonts/pixel.ttf'),
    });

    // Request ATT permission (iOS 14.5+) before initializing ads
    if (Platform.OS === 'ios') {
      try {
        await requestTrackingPermissionsAsync();
      } catch {
        // ATT not available on this iOS version; continue
      }
    }

    // Initialize AdMob SDK (required for production builds)
    if (!IS_EXPO_GO) {
      try {
        const { default: mobileAds } = require('react-native-google-mobile-ads');
        await mobileAds().initialize();
      } catch {
        // Ads initialization failed; non-critical
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
    backgroundColor: '#87CEEB',
  },
});
