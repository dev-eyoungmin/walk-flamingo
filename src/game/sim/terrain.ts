import { LAYOUT } from './constants';

export const TERRAIN_FLAT = 0;
export const TERRAIN_HILL = 1;
export const TERRAIN_VALLEY = 2;

/** Encoded terrain segment: [type, startX(px), width(px), height(px)] */
export const TERRAIN_SLOT = 4;

export interface SimConfig {
  width: number;
  height: number;
  /** Flat ground line (world Y) */
  groundY: number;
  /** Stork feet screen X */
  storkX: number;
  /** Stork unit (U) in px */
  unit: number;
  pxPerMeter: number;
  segW: number;
  hillMax: number;
  /** Flat encoded segments, see TERRAIN_SLOT */
  terrain: number[];
  /** Width of one terrain pattern (it repeats) */
  terrainW: number;
}

/** Generate a random terrain pattern as [type, widthRatio, heightRatio] triples. Starts flat. */
export function generateTerrainRatios(random: () => number = Math.random): number[] {
  const out: number[] = [];
  out.push(TERRAIN_FLAT, 1.8 + random() * 1.2, 0);
  const features = 5 + Math.floor(random() * 4);
  for (let i = 0; i < features; i++) {
    if (random() < 0.6) {
      out.push(TERRAIN_HILL, 0.9 + random() * 0.8, 0.55 + random() * 0.45);
    } else {
      out.push(TERRAIN_VALLEY, 0.8 + random() * 0.7, 0.45 + random() * 0.45);
    }
    out.push(TERRAIN_FLAT, 0.5 + random() * 1.0, 0);
  }
  return out;
}

export function makeSimConfig(width: number, height: number, terrainRatios: number[]): SimConfig {
  const unit = Math.min(width, height) * LAYOUT.UNIT_RATIO;
  const segW = width * LAYOUT.SEG_W_RATIO;
  const hillMax = height * LAYOUT.HILL_RATIO;
  const terrain: number[] = [];
  let x = 0;
  for (let i = 0; i < terrainRatios.length; i += 3) {
    const w = terrainRatios[i + 1] * segW;
    terrain.push(terrainRatios[i], x, w, terrainRatios[i + 2] * hillMax);
    x += w;
  }
  return {
    width,
    height,
    groundY: height * LAYOUT.GROUND_RATIO,
    storkX: width * LAYOUT.STORK_X_RATIO,
    unit,
    pxPerMeter: unit * LAYOUT.METER_IN_UNITS,
    segW,
    hillMax,
    terrain,
    terrainW: x,
  };
}

/** Terrain height offset (negative = above the flat ground line) at a world X. */
export function terrainOffsetAt(cfg: SimConfig, worldX: number): number {
  'worklet';
  const w = cfg.terrainW;
  const x = ((worldX % w) + w) % w;
  const td = cfg.terrain;
  for (let i = 0; i < td.length; i += TERRAIN_SLOT) {
    const start = td[i + 1];
    const segWidth = td[i + 2];
    if (x < start + segWidth || i + TERRAIN_SLOT >= td.length) {
      const type = td[i];
      if (type === TERRAIN_FLAT) return 0;
      const t = Math.min(1, Math.max(0, (x - start) / segWidth));
      const bump = (1 - Math.cos(t * Math.PI * 2)) * 0.5 * td[i + 3];
      return type === TERRAIN_HILL ? -bump : bump;
    }
  }
  return 0;
}

/** Terrain slope dy/dx at a world X (negative = uphill when walking right). */
export function terrainSlopeAt(cfg: SimConfig, worldX: number): number {
  'worklet';
  const w = cfg.terrainW;
  const x = ((worldX % w) + w) % w;
  const td = cfg.terrain;
  for (let i = 0; i < td.length; i += TERRAIN_SLOT) {
    const start = td[i + 1];
    const segWidth = td[i + 2];
    if (x < start + segWidth || i + TERRAIN_SLOT >= td.length) {
      const type = td[i];
      if (type === TERRAIN_FLAT) return 0;
      const t = Math.min(1, Math.max(0, (x - start) / segWidth));
      const d = (Math.PI * Math.sin(t * Math.PI * 2) * td[i + 3]) / segWidth;
      return type === TERRAIN_HILL ? -d : d;
    }
  }
  return 0;
}
