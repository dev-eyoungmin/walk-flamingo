import React, { useMemo } from 'react';
import { Group, Circle, Rect } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface EnvironmentRendererProps {
  width: number;
  height: number;
  distance: SharedValue<number>;
  skyPhase: SharedValue<number>;
}

const P_ENV = 2.5;
const OBJECT_SPACING = 180;
const PATTERN_LENGTH = 12;

type ObjectType = 'tree' | 'flower' | 'grass' | 'rock';

interface EnvObject {
  type: ObjectType;
  x: number;
  yOffset: number;
  variant: number; // 0..1 for size/color variation
  flowerColor: string;
}

const FLOWER_COLORS = ['#FF6B6B', '#FF69B4', '#FFD700', '#FF8C00', '#DA70D6'];

function seededRandom(seed: number): number {
  return Math.abs(Math.sin(seed * 127.1 + 311.7));
}

export const EnvironmentRenderer: React.FC<EnvironmentRendererProps> = ({
  width,
  height,
  distance,
  skyPhase,
}) => {
  const groundY = height * 0.65;
  const patternWidth = PATTERN_LENGTH * OBJECT_SPACING;

  // Generate 12 deterministic objects
  const objects = useMemo<EnvObject[]>(() => {
    const types: ObjectType[] = ['tree', 'flower', 'grass', 'rock'];
    return Array.from({ length: PATTERN_LENGTH }, (_, i) => {
      const xSeed = seededRandom(i * 3.7 + 1.0);
      const typeSeed = seededRandom(i * 5.1 + 2.0);
      const variantSeed = seededRandom(i * 7.3 + 3.0);
      const yOffsetSeed = seededRandom(i * 11.7 + 4.0);
      const colorSeed = seededRandom(i * 13.3 + 5.0);

      const baseX = i * OBJECT_SPACING;
      const xJitter = (xSeed - 0.5) * 60;

      return {
        type: types[Math.floor(typeSeed * types.length)],
        x: baseX + xJitter,
        yOffset: (yOffsetSeed - 0.5) * 10,
        variant: variantSeed,
        flowerColor: FLOWER_COLORS[Math.floor(colorSeed * FLOWER_COLORS.length)],
      };
    });
  }, []);

  // Scroll transform (parallax 2.5) with seamless wrap over 2x pattern
  const scrollX = useDerivedValue(() => {
    return -(distance.value * P_ENV) % patternWidth;
  });

  // Tree trunk color darkens at night
  const trunkColor = useDerivedValue(() => {
    const phase = skyPhase.value;
    if (phase < 1) return '#795548';
    const t = phase - 1;
    const r = Math.round(121 - t * 60);
    const g = Math.round(85 - t * 45);
    const b = Math.round(72 - t * 40);
    return `rgb(${r},${g},${b})`;
  });

  // Tree canopy color darkens at night
  const canopyColor = useDerivedValue(() => {
    const phase = skyPhase.value;
    if (phase < 1) return '#388E3C';
    const t = phase - 1;
    const r = Math.round(56 - t * 35);
    const g = Math.round(142 - t * 90);
    const b = Math.round(60 - t * 35);
    return `rgb(${r},${g},${b})`;
  });

  // Grass color darkens at night
  const grassColor = useDerivedValue(() => {
    const phase = skyPhase.value;
    if (phase < 1) return '#66BB6A';
    const t = phase - 1;
    const r = Math.round(102 - t * 60);
    const g = Math.round(187 - t * 110);
    const b = Math.round(106 - t * 60);
    return `rgb(${r},${g},${b})`;
  });

  // Stem color for flowers darkens at night
  const stemColor = useDerivedValue(() => {
    const phase = skyPhase.value;
    if (phase < 1) return '#4CAF50';
    const t = phase - 1;
    const r = Math.round(76 - t * 45);
    const g = Math.round(175 - t * 100);
    const b = Math.round(80 - t * 45);
    return `rgb(${r},${g},${b})`;
  });

  const renderObject = (obj: EnvObject, offsetX: number) => {
    const baseX = obj.x + offsetX;
    const baseY = groundY + obj.yOffset;
    const scale = 0.75 + obj.variant * 0.5;

    if (obj.type === 'tree') {
      const trunkW = 10 * scale;
      const trunkH = 40 * scale;
      const trunkX = baseX - trunkW / 2;
      const trunkY = baseY - trunkH;

      // 3 canopy circles
      const canopyR = 20 * scale;
      const canopyCx = baseX;
      const canopyCy = trunkY + 5;

      return (
        <Group key={`${obj.x}-${offsetX}`}>
          {/* Trunk */}
          <Rect
            x={trunkX}
            y={trunkY}
            width={trunkW}
            height={trunkH}
            color={trunkColor}
          />
          {/* Canopy - bottom circle */}
          <Circle cx={canopyCx} cy={canopyCy} r={canopyR} color={canopyColor} />
          {/* Canopy - upper left */}
          <Circle
            cx={canopyCx - canopyR * 0.6}
            cy={canopyCy - canopyR * 0.7}
            r={canopyR * 0.8}
            color={canopyColor}
          />
          {/* Canopy - upper right */}
          <Circle
            cx={canopyCx + canopyR * 0.6}
            cy={canopyCy - canopyR * 0.7}
            r={canopyR * 0.8}
            color={canopyColor}
          />
        </Group>
      );
    }

    if (obj.type === 'flower') {
      const stemH = 22 * scale;
      const stemW = 3 * scale;
      const stemX = baseX - stemW / 2;
      const stemY = baseY - stemH;
      const centerR = 6 * scale;
      const petalR = 5 * scale;
      const petalDist = centerR + petalR * 0.6;

      const petals = Array.from({ length: 6 }, (_, pi) => {
        const angle = (pi / 6) * Math.PI * 2;
        return {
          cx: baseX + Math.cos(angle) * petalDist,
          cy: stemY + Math.sin(angle) * petalDist,
        };
      });

      return (
        <Group key={`${obj.x}-${offsetX}`}>
          {/* Stem */}
          <Rect
            x={stemX}
            y={stemY}
            width={stemW}
            height={stemH}
            color={stemColor}
          />
          {/* Petals */}
          {petals.map((p, pi) => (
            <Circle
              key={pi}
              cx={p.cx}
              cy={p.cy}
              r={petalR}
              color={obj.flowerColor}
            />
          ))}
          {/* Center */}
          <Circle cx={baseX} cy={stemY} r={centerR} color="#FFD700" />
        </Group>
      );
    }

    if (obj.type === 'grass') {
      const bladeH = 16 * scale;
      const bladeW = 3 * scale;

      return (
        <Group key={`${obj.x}-${offsetX}`}>
          {/* Left blade */}
          <Rect
            x={baseX - 9 * scale}
            y={baseY - bladeH * 0.85}
            width={bladeW}
            height={bladeH * 0.85}
            color={grassColor}
            transform={[{ rotate: -0.2 }]}
          />
          {/* Center blade */}
          <Rect
            x={baseX - bladeW / 2}
            y={baseY - bladeH}
            width={bladeW}
            height={bladeH}
            color={grassColor}
          />
          {/* Right blade */}
          <Rect
            x={baseX + 6 * scale}
            y={baseY - bladeH * 0.9}
            width={bladeW}
            height={bladeH * 0.9}
            color={grassColor}
            transform={[{ rotate: 0.2 }]}
          />
        </Group>
      );
    }

    if (obj.type === 'rock') {
      const rockR = 12 * scale;
      return (
        <Group key={`${obj.x}-${offsetX}`}>
          {/* Main rock */}
          <Circle cx={baseX} cy={baseY - rockR * 0.6} r={rockR} color="#9E9E9E" />
          {/* Highlight */}
          <Circle
            cx={baseX - rockR * 0.3}
            cy={baseY - rockR * 0.9}
            r={rockR * 0.4}
            color="#BDBDBD"
          />
        </Group>
      );
    }

    return null;
  };

  const groupTransform = useDerivedValue(() => [{ translateX: scrollX.value }]);

  return (
    <Group>
      {/* Render objects twice for seamless wrap */}
      <Group transform={groupTransform}>
        {objects.map((obj) => renderObject(obj, 0))}
        {objects.map((obj) => renderObject(obj, patternWidth))}
      </Group>
    </Group>
  );
};
