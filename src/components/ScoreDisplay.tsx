import React from 'react';
import { Text, Group, matchFont, SkFont } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface ScoreDisplayProps {
  score: SharedValue<number>;
  distance: SharedValue<number>;
  x: number;
  y: number;
  width: number;
  font?: SkFont | null;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  distance,
  x,
  y,
  width,
  font,
}) => {
  const fallbackFont = matchFont({ fontSize: 28 });
  const distFont = matchFont({ fontSize: 24 });
  const displayFont = font || fallbackFont;

  const scoreText = useDerivedValue(() => {
    return `SCORE: ${Math.floor(score?.value ?? 0)}`;
  }, [score]);

  const distText = useDerivedValue(() => {
    return `${Math.floor(distance?.value ?? 0)}m`;
  }, [distance]);

  if (!displayFont) return null;

  const distY = y + 32;

  return (
    <Group>
      {/* Score (Left, white) */}
      <Text x={x + 1} y={y + 1} text={scoreText} font={displayFont} color="rgba(0,0,0,0.5)" />
      <Text x={x} y={y} text={scoreText} font={displayFont} color="white" />

      {/* Distance (Left, below score, gold) */}
      <Text x={x + 1} y={distY + 1} text={distText} font={distFont} color="rgba(0,0,0,0.5)" />
      <Text x={x} y={distY} text={distText} font={distFont} color="#FFD700" />
    </Group>
  );
};
