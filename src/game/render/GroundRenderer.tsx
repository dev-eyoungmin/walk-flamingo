import React, { useMemo } from 'react';
import { DisplacementMap, Group, LinearGradient, Paint, Path, Shader, Skia, SkPath, usePathValue, vec } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { ENV_GUST, EVT_ENVIRONMENT, STAGE_ACTIVE, WEATHER_RAIN, WEATHER_WINDY } from '../sim/constants';
import type { SimState } from '../sim/state';
import { SimConfig, terrainOffsetAt } from '../sim/terrain';
import { biomeColors, BiomeColors, biomeSpan, buildScenery, Scenery } from './biomes';
import { FOLIAGE_GROUND_SAMPLES, FOLIAGE_SWAY_ENABLED, FOLIAGE_SWAY_SCALE, foliageEffect } from './foliageShader';
import type { Palette } from './palette';

interface Props {
  sim: SharedValue<SimState>;
  palette: SharedValue<Palette>;
  cfg: SimConfig;
}

type GroupTransform = React.ComponentProps<typeof Group>['transform'];

interface BasePaths {
  grass: SkPath;
  iceBand: SkPath;
  dirt: SkPath;
  edge: SkPath;
  highlight: SkPath;
  pebbles: SkPath;
  sparkles: SkPath;
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBase(cfg: SimConfig): BasePaths {
  const { terrainW, groundY, height } = cfg;
  const total = terrainW * 2;
  const bottom = height + cfg.hillMax + 80;
  const grassDepth = height * 0.035;
  const surface = (x: number) => groundY + terrainOffsetAt(cfg, x);
  const step = 5;

  const grass = Skia.Path.Make();
  const dirt = Skia.Path.Make();
  const highlight = Skia.Path.Make();
  grass.moveTo(0, bottom);
  dirt.moveTo(0, bottom);
  for (let x = 0; x <= total + step; x += step) {
    const y = surface(x);
    grass.lineTo(x, y);
    dirt.lineTo(x, y + grassDepth);
    if (x === 0) highlight.moveTo(x, y + 1.5);
    else highlight.lineTo(x, y + 1.5);
  }
  grass.lineTo(total + step, bottom);
  grass.close();
  dirt.lineTo(total + step, bottom);
  dirt.close();

  // Ice only frosts the grass band, not the dirt
  const iceBand = Skia.Path.Make();
  iceBand.moveTo(0, surface(0) - 1);
  for (let x = step; x <= total + step; x += step) iceBand.lineTo(x, surface(x) - 1);
  for (let x = total + step; x >= 0; x -= step) iceBand.lineTo(x, surface(x) + grassDepth + 4);
  iceBand.close();

  const edge = Skia.Path.Make();
  const pebbles = Skia.Path.Make();
  const sparkles = Skia.Path.Make();
  for (let copy = 0; copy < 2; copy++) {
    const ox = copy * terrainW;
    const r = seeded(Math.round(terrainW));
    for (let x = 0; x < terrainW; x += 9) {
      edge.addCircle(ox + x, surface(ox + x) + grassDepth - 1, 5.5);
    }
    for (let i = 0; i < terrainW / 26; i++) {
      const x = r() * terrainW;
      const depth = grassDepth + 8 + r() * height * 0.12;
      const w = 3 + r() * 5;
      pebbles.addOval(Skia.XYWHRect(ox + x, surface(ox + x) + depth, w, w * 0.6));
    }
    for (let i = 0; i < terrainW / 30; i++) {
      const x = ox + r() * terrainW;
      sparkles.addCircle(x, surface(x) + 2 + r() * grassDepth, 1 + r() * 1.5);
    }
  }
  return { grass, iceBand, dirt, edge, highlight, pebbles, sparkles };
}

/** Clip rectangle covering the part of the screen where this biome is visible. */
/** Horizontal offset of a zone border at screen height y; neighbours share it so the edges interlock. */
function borderWave(y: number): number {
  'worklet';
  return Math.sin(y * 0.11) * 7 + Math.sin(y * 0.31 + 1.3) * 3;
}

const BORDER_STEP = 10;

function useBiomeClip(sim: SharedValue<SimState>, cfg: SimConfig, biome: number) {
  return usePathValue((p) => {
    'worklet';
    const out = [0, 0];
    biomeSpan(sim.value, cfg, biome, out);
    if (out[1] <= out[0]) return;
    const top = -cfg.height;
    const bottom = cfg.height * 3;
    // Borders at the screen edges stay straight and just past the edge
    const left = out[0] > 0 ? out[0] : -40;
    const right = out[1] < cfg.width ? out[1] : cfg.width + 40;
    const wavyLeft = out[0] > 0;
    const wavyRight = out[1] < cfg.width;
    p.moveTo(left, top);
    p.lineTo(right, top);
    for (let y = -20; wavyRight && y <= cfg.height + 80; y += BORDER_STEP) p.lineTo(right + borderWave(y), y);
    p.lineTo(right, bottom);
    p.lineTo(left, bottom);
    for (let y = cfg.height + 80; wavyLeft && y >= -20; y -= BORDER_STEP) p.lineTo(left + borderWave(y), y);
    p.close();
  });
}

const SceneryPaths: React.FC<{
  layers: Scenery['sway'];
  colors: SharedValue<BiomeColors>;
}> = ({ layers, colors }) => (
  <>
    {layers.map((layer, i) => (
      <SceneryPath key={i} layer={layer} colors={colors} />
    ))}
  </>
);

const SceneryPath: React.FC<{ layer: Scenery['sway'][number]; colors: SharedValue<BiomeColors> }> = ({ layer, colors }) => {
  const color = useDerivedValue(() => colors.value[layer.key]);
  return layer.stroke > 0 ? (
    <Path path={layer.path} color={color} style="stroke" strokeWidth={layer.stroke} strokeCap="round" />
  ) : (
    <Path path={layer.path} color={color} />
  );
};

/** Ground, dirt and non-swaying scenery of one biome, clipped to where that biome is on screen. */
const BiomeGround: React.FC<{
  sim: SharedValue<SimState>;
  cfg: SimConfig;
  biome: number;
  base: BasePaths;
  scenery: Scenery;
  transform: GroupTransform;
  colors: SharedValue<BiomeColors>;
}> = ({ sim, cfg, biome, base, scenery, transform, colors }) => {
  const clip = useBiomeClip(sim, cfg, biome);
  const grass = useDerivedValue(() => colors.value.grass);
  const grassLight = useDerivedValue(() => colors.value.grassLight);
  const dirtDark = useDerivedValue(() => colors.value.dirtDark);
  const dirtColors = useDerivedValue(() => [colors.value.dirt, colors.value.dirtDark]);
  return (
    <Group clip={clip}>
      <Group transform={transform}>
        <Path path={base.grass} color={grass} />
        <Path path={base.dirt}>
          <LinearGradient start={vec(0, cfg.groundY)} end={vec(0, cfg.height + cfg.hillMax)} colors={dirtColors} />
        </Path>
        <Path path={base.pebbles} color={dirtDark} />
        <Path path={base.edge} color={grass} />
        <Path path={base.highlight} color={grassLight} style="stroke" strokeWidth={3} strokeCap="round" />
        <SceneryPaths layers={scenery.still} colors={colors} />
      </Group>
    </Group>
  );
};

const BiomeFoliage: React.FC<{
  sim: SharedValue<SimState>;
  cfg: SimConfig;
  biome: number;
  scenery: Scenery;
  transform: GroupTransform;
  colors: SharedValue<BiomeColors>;
}> = ({ sim, cfg, biome, scenery, transform, colors }) => {
  const clip = useBiomeClip(sim, cfg, biome);
  return (
    <Group clip={clip}>
      <Group transform={transform}>
        <SceneryPaths layers={scenery.sway} colors={colors} />
      </Group>
    </Group>
  );
};

export const GroundRenderer: React.FC<Props> = React.memo(({ sim, cfg }) => {
  const base = useMemo(() => buildBase(cfg), [cfg]);
  const scenery = useMemo(() => buildScenery(cfg), [cfg]);
  const { terrainW, groundY, height } = cfg;

  const transform = useDerivedValue(() => {
    const s = sim.value;
    return [{ translateX: -(s.scrollX % terrainW) }, { translateY: -s.camY }];
  });

  const rain = useDerivedValue(() => (sim.value.weather === WEATHER_RAIN ? sim.value.weatherAmt : 0));
  const colors0 = useDerivedValue(() => biomeColors(0, sim.value.dayT, rain.value));
  const colors1 = useDerivedValue(() => biomeColors(1, sim.value.dayT, rain.value));
  const colors2 = useDerivedValue(() => biomeColors(2, sim.value.dayT, rain.value));
  const colors3 = useDerivedValue(() => biomeColors(3, sim.value.dayT, rain.value));
  const colors = [colors0, colors1, colors2, colors3];

  const ice = useDerivedValue(() => sim.value.iceAmt * 0.8);
  const iceSparkle = useDerivedValue(() => sim.value.iceAmt * (0.6 + 0.4 * Math.sin(sim.value.t * 9)));

  // Wind field for the foliage shader: ground height under the screen, wind lean and gust flutter
  const foliageUniforms = useDerivedValue(() => {
    const s = sim.value;
    const ground: number[] = [];
    for (let i = 0; i < FOLIAGE_GROUND_SAMPLES; i++) {
      const x = (i / (FOLIAGE_GROUND_SAMPLES - 1)) * cfg.width;
      ground.push(groundY + terrainOffsetAt(cfg, s.scrollX + x) - s.camY);
    }
    const gustActive = s.evStage === STAGE_ACTIVE && s.evType === EVT_ENVIRONMENT && s.evSub === ENV_GUST;
    const windy = s.weather === WEATHER_WINDY ? s.weatherAmt : 0;
    const wind = Math.max(-1, Math.min(1, s.wind / 4 + (gustActive ? s.evDir * 0.8 : 0)));
    return {
      resolution: [cfg.width, height],
      time: s.t,
      scroll: s.scrollX,
      wind,
      gust: Math.max(gustActive ? 1 : 0, windy * 0.6),
      tallHeight: cfg.unit * 22,
      ground,
    };
  });

  const foliage = scenery.map((sc, b) => (
    <BiomeFoliage key={b} sim={sim} cfg={cfg} biome={b} scenery={sc} transform={transform} colors={colors[b]} />
  ));

  return (
    <Group>
      {scenery.map((sc, b) => (
        <BiomeGround
          key={b}
          sim={sim}
          cfg={cfg}
          biome={b}
          base={base}
          scenery={sc}
          transform={transform}
          colors={colors[b]}
        />
      ))}

      <Group transform={transform}>
        <Path path={base.iceBand} color="#E8F7FF" opacity={ice} />
        <Path path={base.sparkles} color="#FFFFFF" opacity={iceSparkle} />
      </Group>

      {foliageEffect && FOLIAGE_SWAY_ENABLED ? (
        // The foliage is rendered into a layer, then bent by the GPU wind field
        <Group
          layer={
            <Paint>
              <DisplacementMap channelX="r" channelY="g" scale={FOLIAGE_SWAY_SCALE}>
                <Shader source={foliageEffect} uniforms={foliageUniforms} />
              </DisplacementMap>
            </Paint>
          }
        >
          {foliage}
        </Group>
      ) : (
        foliage
      )}
    </Group>
  );
});
