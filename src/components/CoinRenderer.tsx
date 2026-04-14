import React from 'react';
import { Circle, Group } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

/**
 * Coin data is stored in a flat SharedValue<number[]> for worklet compatibility.
 * Each coin slot = [screenX, screenY, active(0/1), collectAnim, value]
 * COIN_SLOT_SIZE = 5
 */
export const COIN_SLOT_SIZE = 5;

interface CoinRendererProps {
  /**
   * Flat array: [x, y, active, collectAnim, value, x, y, active, collectAnim, value, ...]
   * Up to MAX_VISIBLE coins.
   */
  coinSlots: SharedValue<number[]>;
  coinSpinAngle: SharedValue<number>;
  groundY: number;
  maxCoins: number;
}

/** Render a single coin slot */
const CoinSlot: React.FC<{
  slotIndex: number;
  coinSlots: SharedValue<number[]>;
  coinSpinAngle: SharedValue<number>;
  groundY: number;
}> = ({ slotIndex, coinSlots, coinSpinAngle, groundY }) => {
  const COIN_R = 14;
  const baseIdx = slotIndex * COIN_SLOT_SIZE;

  const coinOpacity = useDerivedValue(() => {
    const data = coinSlots.value;
    return data[baseIdx + 2] > 0.5 ? 1 : 0;
  });

  const coinScaleX = useDerivedValue(() =>
    Math.max(0.15, Math.abs(Math.cos(coinSpinAngle.value))),
  );

  const coinTransform = useDerivedValue(() => {
    const data = coinSlots.value;
    return [
      { translateX: data[baseIdx] || 0 },
      { translateY: data[baseIdx + 1] || 0 },
      { scaleX: coinScaleX.value },
    ];
  });

  const shadowTransform = useDerivedValue(() => {
    const data = coinSlots.value;
    return [
      { translateX: data[baseIdx] || 0 },
      { translateY: groundY - 2 },
      { scaleX: 0.6 },
    ];
  });

  // Collect burst effect
  const burstOpacity = useDerivedValue(() => {
    const data = coinSlots.value;
    const anim = data[baseIdx + 3] || 0;
    return anim > 0 ? anim / 0.4 : 0;
  });

  const burstScale = useDerivedValue(() => {
    const data = coinSlots.value;
    const anim = data[baseIdx + 3] || 0;
    if (anim <= 0) return [{ scale: 0 }];
    const progress = 1 - anim / 0.4;
    return [
      { translateX: data[baseIdx] || 0 },
      { translateY: data[baseIdx + 1] || 0 },
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
        <Circle cx={0} cy={0} r={COIN_R} color="#DAA520" />
        <Circle cx={0} cy={0} r={COIN_R - 3} color="#FFD700" />
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

export const CoinRenderer: React.FC<CoinRendererProps> = ({
  coinSlots,
  coinSpinAngle,
  groundY,
  maxCoins,
}) => {
  // Render fixed number of slots (React requires stable component tree)
  return (
    <Group>
      {maxCoins >= 1 && <CoinSlot slotIndex={0} coinSlots={coinSlots} coinSpinAngle={coinSpinAngle} groundY={groundY} />}
      {maxCoins >= 2 && <CoinSlot slotIndex={1} coinSlots={coinSlots} coinSpinAngle={coinSpinAngle} groundY={groundY} />}
      {maxCoins >= 3 && <CoinSlot slotIndex={2} coinSlots={coinSlots} coinSpinAngle={coinSpinAngle} groundY={groundY} />}
      {maxCoins >= 4 && <CoinSlot slotIndex={3} coinSlots={coinSlots} coinSpinAngle={coinSpinAngle} groundY={groundY} />}
      {maxCoins >= 5 && <CoinSlot slotIndex={4} coinSlots={coinSlots} coinSpinAngle={coinSpinAngle} groundY={groundY} />}
    </Group>
  );
};
