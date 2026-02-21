import React from 'react';
import { Text, Group, Skia, Font } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { Platform } from 'react-native';

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
  fontSize = 30,
}) => {
  // Load system font (bold)
  const font = Skia.Font(undefined, fontSize); // Default system font
  
  // Format score text: "SCORE: 1234"
  const text = useDerivedValue(() => {
    return `SCORE: ${Math.floor(score.value)}`;
  }, [score]);

  if (!font) {
    return null;
  }

  return (
    <Group>
      {/* Shadow / Outline effect for readability */}
      <Text
        x={x + 1}
        y={y + fontSize + 1}
        text={text}
        font={font}
        color="rgba(0,0,0,0.5)"
      />
      {/* Main Text */}
      <Text
        x={x}
        y={y + fontSize}
        text={text}
        font={font}
        color="white"
        style="fill"
      />
    </Group>
  );
};
