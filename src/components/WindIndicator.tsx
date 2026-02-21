import React from 'react';
import {
  Group,
  Path,
  Skia,
  Text as SkiaText,
  useFont,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { COLORS } from '../game/constants';

interface WindIndicatorProps {
  windDirection: SharedValue<number>;
  windForce: SharedValue<number>;
  x: number;
  y: number;
}

export const WindIndicator: React.FC<WindIndicatorProps> = ({
  windDirection,
  windForce,
  x,
  y,
}) => {
  const font = useFont(
    require('../../assets/fonts/pixel.ttf'),
    16,
  );

  const ARROW_W = 22;
  const GAP = 6;
  const textX = x + ARROW_W + GAP;

  // Wind arrow path (pointing right, will be mirrored for left)
  const arrowPath = React.useMemo(() => {
    const path = Skia.Path.Make();
    path.moveTo(0, 0);
    path.lineTo(20, 0);
    path.lineTo(16, -5);
    path.moveTo(20, 0);
    path.lineTo(16, 5);
    return path;
  }, []);

  const arrowTransform = useDerivedValue(() => {
    const dir = windDirection.value;
    const ay = y - 6;
    if (dir === 0) return [{ translateX: x }, { translateY: ay }];
    const scaleX = dir > 0 ? 1 : -1;
    return [
      { translateX: dir > 0 ? x : x + ARROW_W },
      { translateY: ay },
      { scaleX },
    ];
  });

  const arrowOpacity = useDerivedValue(() => {
    return Math.min(1, Math.abs(windForce.value) * 2);
  });

  const windText = useDerivedValue(() => {
    const dir = windDirection.value;
    const speed = Math.abs(windForce.value);
    if (dir === 0) return 'Wind: -';
    return `Wind: ${speed.toFixed(1)}`;
  });

  if (!font) return null;

  return (
    <Group>
      <Group transform={arrowTransform} opacity={arrowOpacity}>
        <Path
          path={arrowPath}
          color={COLORS.windArrow}
          style="stroke"
          strokeWidth={2}
          strokeCap="round"
        />
      </Group>
      <SkiaText
        x={textX}
        y={y}
        text={windText}
        font={font}
        color={COLORS.uiText}
        opacity={0.8}
      />
    </Group>
  );
};
