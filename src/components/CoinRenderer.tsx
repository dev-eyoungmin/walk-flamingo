import React from 'react';
import { Circle, Group } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface CoinRendererProps {
  coinX: SharedValue<number>;
  coinY: SharedValue<number>;
  coinVisible: SharedValue<boolean>;
  coinSpinAngle: SharedValue<number>;
  coinCollectAnim: SharedValue<number>;
  groundY: number;
}

export const CoinRenderer: React.FC<CoinRendererProps> = ({
  coinX,
  coinY,
  coinVisible,
  coinSpinAngle,
  coinCollectAnim,
  groundY,
}) => {
  const COIN_R = 14;

  const coinOpacity = useDerivedValue(() => (coinVisible.value ? 1 : 0));

  const coinScaleX = useDerivedValue(() =>
    Math.max(0.15, Math.abs(Math.cos(coinSpinAngle.value))),
  );

  const coinTransform = useDerivedValue(() => [
    { translateX: coinX.value },
    { translateY: coinY.value },
    { scaleX: coinScaleX.value },
  ]);

  // Shadow transform (on ground below coin)
  const shadowTransform = useDerivedValue(() => [
    { translateX: coinX.value },
    { translateY: groundY - 2 },
    { scaleX: 0.6 },
  ]);

  // Collect burst effect
  const burstOpacity = useDerivedValue(() =>
    coinCollectAnim.value > 0 ? coinCollectAnim.value / 0.4 : 0,
  );
  const burstScale = useDerivedValue(() => {
    if (coinCollectAnim.value <= 0) return [{ scale: 0 }];
    const progress = 1 - coinCollectAnim.value / 0.4;
    return [
      { translateX: coinX.value },
      { translateY: coinY.value },
      { scale: 1 + progress * 2 },
    ];
  });

  return (
    <Group>
      {/* Shadow */}
      <Group transform={shadowTransform} opacity={coinOpacity}>
        <Circle cx={0} cy={0} r={8} color="rgba(0,0,0,0.15)" />
      </Group>

      {/* Coin */}
      <Group transform={coinTransform} opacity={coinOpacity}>
        {/* Outer ring */}
        <Circle cx={0} cy={0} r={COIN_R} color="#DAA520" />
        {/* Inner fill */}
        <Circle cx={0} cy={0} r={COIN_R - 3} color="#FFD700" />
        {/* Shine highlight */}
        <Circle cx={-4} cy={-5} r={4} color="white" opacity={0.6} />
      </Group>

      {/* Collect burst */}
      <Group transform={burstScale} opacity={burstOpacity}>
        <Circle
          cx={0}
          cy={0}
          r={COIN_R}
          color="#FFD700"
          style="stroke"
          strokeWidth={3}
        />
      </Group>
    </Group>
  );
};
