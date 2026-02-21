import React from 'react';
import { Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { COLORS } from '../game/constants';

interface ScoreDisplayProps {
  score: SharedValue<number>;
  x: number;
  y: number;
  fontSize?: number;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  x,
  y,
  fontSize = 28,
}) => {
  const font = useFont(
    require('../../assets/fonts/pixel.ttf'),
    fontSize,
  );

  const scoreText = useDerivedValue(() => {
    return `${Math.floor(score.value)}m`;
  });

  if (!font) return null;

  return (
    <>
      {/* Shadow */}
      <SkiaText
        x={x + 2}
        y={y + 2}
        text={scoreText}
        font={font}
        color={COLORS.uiShadow}
        opacity={0.5}
      />
      {/* Main text */}
      <SkiaText
        x={x}
        y={y}
        text={scoreText}
        font={font}
        color={COLORS.uiText}
      />
    </>
  );
};
