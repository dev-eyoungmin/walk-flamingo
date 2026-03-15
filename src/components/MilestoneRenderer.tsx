import React, { useMemo } from 'react';
import {
  Rect,
  RoundedRect,
  Group,
  Text,
  matchFont,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface MilestoneRendererProps {
  milestoneAnim: SharedValue<number>;
  milestoneFlash: SharedValue<number>;
  milestoneIndex: SharedValue<number>;
  particleData: SharedValue<number[]>;
  elapsedTime: SharedValue<number>;
  width: number;
  height: number;
}

const CONFETTI_COLORS = ['#FF4136', '#2ECC40', '#0074D9', '#FFDC00'];

export const MilestoneRenderer: React.FC<MilestoneRendererProps> = ({
  milestoneAnim,
  milestoneFlash,
  milestoneIndex,
  particleData,
  elapsedTime,
  width,
  height,
}) => {
  const bigFont = matchFont({ fontSize: 36, fontWeight: 'bold' });
  const smallFont = matchFont({ fontSize: 18, fontWeight: 'bold' });

  const cx = width / 2;
  const cy = height / 2 - 20;
  const badgeW = 220;
  const badgeH = 72;

  // Screen flash
  const flashOpacity = useDerivedValue(() => milestoneFlash.value * 0.7);

  // Badge visibility & pulse
  const badgeOpacity = useDerivedValue(() => {
    if (milestoneAnim.value <= 0) return 0;
    return Math.min(1, milestoneAnim.value / 0.5);
  });

  const badgeScale = useDerivedValue(() => {
    if (milestoneAnim.value <= 0) return [{ scale: 0 }];
    const pulse = 1 + Math.sin(elapsedTime.value * 7) * 0.04;
    return [
      { translateX: cx },
      { translateY: cy },
      { scale: pulse },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });

  const labelText = useDerivedValue(() => 'NEW RECORD!');

  // Confetti particles - draw as small rects
  // particleData layout: [x0, y0, life0, x1, y1, life1, ...] 32 particles × 3 values
  const confettiRects = useMemo(() => {
    const rects: { colorIdx: number; particleIdx: number }[] = [];
    for (let i = 0; i < 32; i++) {
      rects.push({ colorIdx: Math.floor(i / 8), particleIdx: i });
    }
    return rects;
  }, []);

  return (
    <Group>
      {/* White flash */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        color="white"
        opacity={flashOpacity}
      />

      {/* Confetti particles */}
      {confettiRects.map(({ colorIdx, particleIdx }) => {
        const particleOpacity = useDerivedValue(() => {
          if (milestoneAnim.value <= 0) return 0;
          const baseIdx = particleIdx * 3;
          const life = particleData.value[baseIdx + 2] ?? 0;
          return Math.max(0, life);
        });
        const particleTransform = useDerivedValue(() => {
          const baseIdx = particleIdx * 3;
          const px = particleData.value[baseIdx] ?? -100;
          const py = particleData.value[baseIdx + 1] ?? -100;
          return [{ translateX: px - 3 }, { translateY: py - 3 }];
        });
        return (
          <Rect
            key={particleIdx}
            x={0}
            y={0}
            width={6}
            height={6}
            color={CONFETTI_COLORS[colorIdx]}
            opacity={particleOpacity}
            transform={particleTransform}
          />
        );
      })}

      {/* Badge */}
      <Group transform={badgeScale} opacity={badgeOpacity}>
        {/* Dark backing */}
        <RoundedRect
          x={cx - badgeW / 2}
          y={cy - badgeH / 2}
          width={badgeW}
          height={badgeH}
          r={28}
          color="rgba(0,0,0,0.7)"
        />
        {/* Gold accent line */}
        <RoundedRect
          x={cx - badgeW / 2 + 10}
          y={cy + badgeH / 2 - 8}
          width={badgeW - 20}
          height={4}
          r={2}
          color="#FFD700"
        />
        {/* Record label */}
        <Text
          x={cx - 80}
          y={cy + 8}
          text={labelText}
          font={bigFont}
          color="#FFD700"
        />
        {/* Sub-label */}
        <Text
          x={cx - 62}
          y={cy + 30}
          text="BEST RECORD!"
          font={smallFont}
          color="#FFFFFF"
        />
      </Group>
    </Group>
  );
};
