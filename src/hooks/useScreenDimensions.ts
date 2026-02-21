import { useEffect, useState } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

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

  return dimensions;
}
