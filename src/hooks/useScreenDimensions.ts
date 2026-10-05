import { useEffect, useState } from 'react';
import { Dimensions, Platform, ScaledSize } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Android draws edge to edge, so the camera cutout and the navigation bar sit on top of the app.
 * The root view is padded by these on Android (iOS keeps its own fixed margins). Both sides get the
 * larger inset so nothing moves when the phone is flipped to the other landscape.
 */
export function useAndroidSafeInsets() {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'android') return { x: 0 };
  return { x: Math.max(insets.left, insets.right) };
}

/** Size of the area the app draws in (the window minus the Android safe-area padding). */
export function useScreenDimensions() {
  const [dimensions, setDimensions] = useState(() => {
    const { width, height, scale } = Dimensions.get('window');
    return { width, height, scale };
  });

  useEffect(() => {
    const handler = ({ window }: { window: ScaledSize }) => {
      setDimensions({
        width: window.width,
        height: window.height,
        scale: window.scale,
      });
    };
    const subscription = Dimensions.addEventListener('change', handler);
    return () => subscription.remove();
  }, []);

  const { x } = useAndroidSafeInsets();
  return { ...dimensions, width: dimensions.width - x * 2 };
}
