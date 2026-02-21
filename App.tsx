import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Font from 'expo-font';
import { AppNavigator } from './src/navigation/AppNavigator';

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
