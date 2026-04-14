import React from 'react';
import { Group, Text, RoundedRect, matchFont } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface NearMissRendererProps {
  /** Animation timer: starts at 1.0, counts down to 0 */
  nearMissAnim: SharedValue<number>;
  width: number;
  height: number;
}

export const NearMissRenderer: React.FC<NearMissRendererProps> = ({
  nearMissAnim,
  width,
  height,
}) => {
  const font = matchFont({ fontSize: 22 });
  const subFont = matchFont({ fontSize: 14 });

  const cx = width / 2;
  const cy = height * 0.3;
  const badgeW = 160;
  const badgeH = 48;

  const opacity = useDerivedValue(() => {
    const v = nearMissAnim.value;
    if (v <= 0) return 0;
    // Fade in fast, then fade out in last 30%
    if (v > 0.7) return 1;
    return v / 0.7;
  });

  const transform = useDerivedValue(() => {
    const v = nearMissAnim.value;
    if (v <= 0) return [{ scale: 0 }];
    // Pop in effect
    const popProgress = 1 - v;
    const scale = popProgress < 0.15 ? 0.5 + (popProgress / 0.15) * 0.7 : 1.2 - popProgress * 0.2;
    return [
      { translateX: cx },
      { translateY: cy },
      { scale: Math.max(0.8, scale) },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });

  const labelText = useDerivedValue(() => 'NICE SAVE!');
  const subText = useDerivedValue(() => '+50');

  return (
    <Group transform={transform} opacity={opacity}>
      {/* Background pill */}
      <RoundedRect
        x={cx - badgeW / 2}
        y={cy - badgeH / 2}
        width={badgeW}
        height={badgeH}
        r={24}
        color="rgba(0,0,0,0.7)"
      />
      {/* Cyan accent border */}
      <RoundedRect
        x={cx - badgeW / 2 + 2}
        y={cy - badgeH / 2 + 2}
        width={badgeW - 4}
        height={badgeH - 4}
        r={22}
        color="#4ECDC4"
        style="stroke"
        strokeWidth={2}
      />
      {/* Main text */}
      <Text
        x={cx - 62}
        y={cy + 4}
        text={labelText}
        font={font}
        color="#4ECDC4"
      />
      {/* Bonus text */}
      <Text
        x={cx + 48}
        y={cy + 2}
        text={subText}
        font={subFont}
        color="#FFD700"
      />
    </Group>
  );
};
