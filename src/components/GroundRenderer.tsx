import React, { useMemo } from 'react';
import {
  Rect,
  Group,
  Path,
  vec,
  LinearGradient,
  Skia,
} from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { TERRAIN_SEG_W_RATIO, type TerrainSegment } from '../game/constants';

const P_HILLS_NEAR = 1.2;

interface GroundRendererProps {
  width: number;
  height: number;
  distance: SharedValue<number>;
  skyPhase?: SharedValue<number>;
  terrainSegments: TerrainSegment[];
}

export const GroundRenderer: React.FC<GroundRendererProps> = ({
  width,
  height,
  distance,
  skyPhase,
  terrainSegments,
}) => {
  const groundY = height * 0.75;
  const hillH = height * 0.30;
  const baseY = groundY + height * 0.02;
  const dirtOffset = height * 0.06;
  const segW = width * TERRAIN_SEG_W_RATIO;

  // Compute total pattern width
  const totalPatternW = useMemo(() => {
    let total = 0;
    for (const seg of terrainSegments) {
      total += seg.widthRatio * segW;
    }
    return total;
  }, [segW, terrainSegments]);

  // Build terrain path from segments
  const greenHillPath = useMemo(() => {
    const p = Skia.Path.Make();
    let x = 0;
    p.moveTo(0, baseY);

    for (const seg of terrainSegments) {
      const w = seg.widthRatio * segW;
      if (seg.type === 'hill') {
        const h = hillH * (seg.heightRatio ?? 1.0);
        p.quadTo(x + w / 2, baseY - h, x + w, baseY);
      } else if (seg.type === 'valley') {
        const h = hillH * (seg.heightRatio ?? 0.3);
        p.quadTo(x + w / 2, baseY + h, x + w, baseY);
      } else {
        // flat
        p.lineTo(x + w, baseY);
      }
      x += w;
    }

    // Repeat pattern once more for seamless scrolling
    for (const seg of terrainSegments) {
      const w = seg.widthRatio * segW;
      if (seg.type === 'hill') {
        const h = hillH * (seg.heightRatio ?? 1.0);
        p.quadTo(x + w / 2, baseY - h, x + w, baseY);
      } else if (seg.type === 'valley') {
        const h = hillH * (seg.heightRatio ?? 0.3);
        p.quadTo(x + w / 2, baseY + h, x + w, baseY);
      } else {
        p.lineTo(x + w, baseY);
      }
      x += w;
    }

    p.lineTo(x, height);
    p.lineTo(0, height);
    p.close();
    return p;
  }, [width, height, baseY, segW, hillH, terrainSegments]);

  // Brown dirt path (same contour shifted down)
  const brownDirtPath = useMemo(() => {
    const p = Skia.Path.Make();
    const dirtBaseY = baseY + dirtOffset;
    let x = 0;
    p.moveTo(0, dirtBaseY);

    for (const seg of terrainSegments) {
      const w = seg.widthRatio * segW;
      if (seg.type === 'hill') {
        const h = hillH * (seg.heightRatio ?? 1.0);
        p.quadTo(x + w / 2, dirtBaseY - h, x + w, dirtBaseY);
      } else if (seg.type === 'valley') {
        const h = hillH * (seg.heightRatio ?? 0.3);
        p.quadTo(x + w / 2, dirtBaseY + h, x + w, dirtBaseY);
      } else {
        p.lineTo(x + w, dirtBaseY);
      }
      x += w;
    }

    for (const seg of terrainSegments) {
      const w = seg.widthRatio * segW;
      if (seg.type === 'hill') {
        const h = hillH * (seg.heightRatio ?? 1.0);
        p.quadTo(x + w / 2, dirtBaseY - h, x + w, dirtBaseY);
      } else if (seg.type === 'valley') {
        const h = hillH * (seg.heightRatio ?? 0.3);
        p.quadTo(x + w / 2, dirtBaseY + h, x + w, dirtBaseY);
      } else {
        p.lineTo(x + w, dirtBaseY);
      }
      x += w;
    }

    p.lineTo(x, height);
    p.lineTo(0, height);
    p.close();
    return p;
  }, [width, height, baseY, dirtOffset, segW, hillH, terrainSegments]);

  // Scroll transform - now wraps by totalPatternW
  const hillScrollTr = useDerivedValue(() => [
    { translateX: -(distance.value * P_HILLS_NEAR) % totalPatternW },
  ]);

  // Hill color with night transition
  const hillColor = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    if (phase < 1) return '#558B2F';
    const t = phase - 1;
    const r = Math.round(85 - t * 50);
    const g = Math.round(139 - t * 80);
    const b = Math.round(47 - t * 20);
    return `rgb(${r},${g},${b})`;
  });

  // Dirt color darkens at night
  const dirtColor = useDerivedValue(() => {
    const phase = skyPhase?.value ?? 0;
    if (phase < 1) return '#5D4037';
    const t = phase - 1;
    const r = Math.round(93 - t * 40);
    const g = Math.round(64 - t * 30);
    const b = Math.round(55 - t * 25);
    return `rgb(${r},${g},${b})`;
  });

  return (
    <Group>
      {/* 1. Green hill contour (base layer) */}
      <Group transform={hillScrollTr}>
        <Path path={greenHillPath} color={hillColor} />
      </Group>

      {/* 2. Brown dirt contour (same shape shifted down) */}
      <Group transform={hillScrollTr}>
        <Path path={brownDirtPath} color={dirtColor} />
      </Group>

      {/* 3. Brown flat rect at very bottom (safety fill for gaps) */}
      <Rect x={0} y={height * 0.92} width={width} height={height * 0.08}>
        <LinearGradient
          start={vec(0, height * 0.92)}
          end={vec(0, height)}
          colors={['#5D4037', '#3E2723']}
        />
      </Rect>
    </Group>
  );
};
