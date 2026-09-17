import { Skia, SkPath } from '@shopify/react-native-skia';
import { BIOMES, MODE_ATTRACT } from '../sim/constants';
import type { SimState } from '../sim/state';
import { SimConfig, terrainOffsetAt } from '../sim/terrain';
import { dayWeights } from './palette';

// ─── Colors ────────────────────────────────────────────────────────────────────

export const BIOME_COLOR_KEYS = [
  'grass',
  'grassLight',
  'dirt',
  'dirtDark',
  'tuft',
  'trunk',
  'canopy',
  'canopyLight',
  'rock',
  'rockLight',
  'accentA',
  'accentB',
  'accentC',
  'detail',
] as const;
export type BiomeColorKey = (typeof BIOME_COLOR_KEYS)[number];

// Daylight colors per biome, in BIOME_COLOR_KEYS order
const BIOME_HEX: readonly (readonly string[])[] = [
  // Meadow
  ['#5DB247', '#9BE071', '#9A6B45', '#6E4A31', '#9BE071', '#7A5236', '#3E9B4F', '#62C065', '#A7A39B', '#D2CEC6', '#FF6B8B', '#FFD447', '#FFF3B0', '#3B1F2B'],
  // Beach
  ['#F2D68A', '#FFF1BF', '#E0B465', '#BF8B45', '#8DBA55', '#A0703F', '#3DAE6B', '#7BD88F', '#FBEFE3', '#FFFFFF', '#FF9E8A', '#FF7F50', '#6B4A2B', '#3B1F2B'],
  // Snowy peaks
  ['#EEF6FF', '#FFFFFF', '#A9B9CC', '#7F90A8', '#D6E6F5', '#6B4A3A', '#2E7657', '#F8FCFF', '#F4F8FF', '#FFFFFF', '#FF8A3D', '#2B2230', '#E84A5F', '#3B1F2B'],
  // Autumn woods
  ['#A9933F', '#D8BC62', '#86593A', '#5C3B26', '#D2B25A', '#6A4631', '#E0782E', '#F4B64A', '#8E8A7E', '#F3E8D6', '#E2453C', '#F29B38', '#FFFFFF', '#3B1F2B'],
];

// Light multiplier per day phase (day, sunset, night, dawn)
const LIGHT: readonly number[] = [1, 1, 1, 0.97, 0.8, 0.74, 0.32, 0.38, 0.55, 0.96, 0.86, 0.9];

const hexToRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BIOME_RGB: number[] = [];
for (const biome of BIOME_HEX) for (const hex of biome) BIOME_RGB.push(...hexToRgb(hex));
const KEY_COUNT = BIOME_COLOR_KEYS.length;
const KEYS: readonly string[] = BIOME_COLOR_KEYS;

export type BiomeColors = Record<BiomeColorKey, string>;

/** Ground/scenery colors for one biome at a time of day, dimmed by rain. */
export function biomeColors(biome: number, dayT: number, rain: number): BiomeColors {
  'worklet';
  const w = [0, 0, 0, 0];
  dayWeights(dayT, w);
  let lr = 0;
  let lg = 0;
  let lb = 0;
  for (let v = 0; v < 4; v++) {
    lr += LIGHT[v * 3] * w[v];
    lg += LIGHT[v * 3 + 1] * w[v];
    lb += LIGHT[v * 3 + 2] * w[v];
  }
  const dim = 1 - 0.15 * rain;
  const out: Record<string, string> = {};
  for (let k = 0; k < KEY_COUNT; k++) {
    const i = (biome * KEY_COUNT + k) * 3;
    const r = Math.round(BIOME_RGB[i] * lr * dim);
    const g = Math.round(BIOME_RGB[i + 1] * lg * dim);
    const b = Math.round(BIOME_RGB[i + 2] * lb * dim);
    out[KEYS[k]] = `rgb(${r},${g},${b})`;
  }
  return out as BiomeColors;
}

/**
 * Horizontal screen span [x0, x1] where a biome is visible right now (empty when x1 <= x0).
 * Zones start at the flamingo's position when the run started, so a new area appears from the
 * right edge and scrolls in.
 */
export function biomeSpan(s: SimState, cfg: SimConfig, biome: number, out: number[]): void {
  'worklet';
  out[0] = 0;
  out[1] = 0;
  if (s.mode === MODE_ATTRACT) {
    if (biome === 0) out[1] = cfg.width;
    return;
  }
  const zonePx = BIOMES.LENGTH_M * cfg.pxPerMeter;
  const zone = Math.floor(s.meters / BIOMES.LENGTH_M);
  let x0 = cfg.width;
  let x1 = 0;
  for (let z = zone - 1; z <= zone + 1; z++) {
    if (z < 0 || z % BIOMES.COUNT !== biome) continue;
    let sx0 = s.scrollStart + cfg.storkX + z * zonePx - s.scrollX;
    const sx1 = sx0 + zonePx;
    if (z === 0) sx0 = -1e6; // the first zone also covers everything behind the start
    const a = Math.max(0, sx0);
    const b = Math.min(cfg.width, sx1);
    if (b > a) {
      x0 = Math.min(x0, a);
      x1 = Math.max(x1, b);
    }
  }
  if (x1 > x0) {
    out[0] = x0;
    out[1] = x1;
  }
}

// ─── Scenery ───────────────────────────────────────────────────────────────────

export interface SceneryLayer {
  key: BiomeColorKey;
  path: SkPath;
  /** Stroke width, or 0 for fill */
  stroke: number;
}

export interface Scenery {
  /** Plants that bend in the wind */
  sway: SceneryLayer[];
  /** Things that stay put (rocks, shells, snowmen) */
  still: SceneryLayer[];
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

type Placer = (bx: number, by: number, s: number, r: () => number) => void;

/** Scatter objects over one terrain pattern and duplicate them at +terrainW for a seamless wrap. */
function scatter(cfg: SimConfig, seed: number, pick: (r: () => number) => { place: Placer; gap: number }) {
  const surface = (x: number) => cfg.groundY + terrainOffsetAt(cfg, x);
  const rand = seeded(seed);
  const placements: { x: number; s: number; place: Placer; salt: number }[] = [];
  let x = 60;
  while (x < cfg.terrainW - 40) {
    const choice = pick(rand);
    placements.push({ x, s: 0.8 + rand() * 0.5, place: choice.place, salt: Math.floor(rand() * 1e6) });
    x += choice.gap * (0.7 + rand() * 0.6);
  }
  for (let copy = 0; copy < 2; copy++) {
    for (const p of placements) {
      const bx = copy * cfg.terrainW + p.x;
      p.place(bx, surface(bx) + 2, p.s * cfg.unit, seeded(p.salt));
    }
  }
}

function tuftsPath(cfg: SimConfig, seed: number, density: number, height: number): SkPath {
  const surface = (x: number) => cfg.groundY + terrainOffsetAt(cfg, x);
  const tufts = Skia.Path.Make();
  const r = seeded(seed);
  const count = Math.floor((cfg.terrainW / 22) * density);
  const xs: number[] = [];
  for (let i = 0; i < count; i++) xs.push(r() * cfg.terrainW);
  for (let copy = 0; copy < 2; copy++) {
    for (let i = 0; i < count; i++) {
      const x = copy * cfg.terrainW + xs[i];
      const y = surface(x) + 1;
      const h = (5 + ((i * 7) % 6)) * height;
      tufts.moveTo(x - 4, y);
      tufts.quadTo(x - 3, y - h * 0.6, x - 5, y - h);
      tufts.moveTo(x, y);
      tufts.lineTo(x + 0.5, y - h * 1.15);
      tufts.moveTo(x + 4, y);
      tufts.quadTo(x + 3, y - h * 0.6, x + 5.5, y - h * 0.9);
    }
  }
  return tufts;
}

function meadow(cfg: SimConfig): Scenery {
  const trunks = Skia.Path.Make();
  const canopy = Skia.Path.Make();
  const canopyLight = Skia.Path.Make();
  const stems = Skia.Path.Make();
  const petalsA = Skia.Path.Make();
  const petalsB = Skia.Path.Make();
  const centers = Skia.Path.Make();
  const rocks = Skia.Path.Make();
  const rockLight = Skia.Path.Make();

  const tree: Placer = (bx, by, s) => {
    const trunkW = 2.2 * s;
    const trunkH = 9 * s;
    trunks.addRRect(Skia.RRectXY(Skia.XYWHRect(bx - trunkW / 2, by - trunkH, trunkW, trunkH + 2), trunkW / 3, trunkW / 3));
    const cy = by - trunkH - 3 * s;
    canopy.addCircle(bx, cy, 5.2 * s);
    canopy.addCircle(bx - 4.2 * s, cy + 2 * s, 3.8 * s);
    canopy.addCircle(bx + 4.4 * s, cy + 1.6 * s, 3.9 * s);
    canopy.addCircle(bx + 0.5 * s, cy - 4 * s, 3.8 * s);
    canopyLight.addCircle(bx - 1.8 * s, cy - 2.6 * s, 2.2 * s);
    canopyLight.addCircle(bx - 4.8 * s, cy + 0.8 * s, 1.4 * s);
  };
  const bush: Placer = (bx, by, s) => {
    canopy.addCircle(bx - 2.6 * s, by - 2.2 * s, 2.8 * s);
    canopy.addCircle(bx + 0.4 * s, by - 3.4 * s, 3.4 * s);
    canopy.addCircle(bx + 3.2 * s, by - 2 * s, 2.6 * s);
    canopyLight.addCircle(bx - 0.6 * s, by - 4.4 * s, 1.3 * s);
  };
  const flower: Placer = (bx, by, s, r) => {
    const stemH = 4.5 * s;
    stems.moveTo(bx, by);
    stems.quadTo(bx - 0.8 * s, by - stemH * 0.5, bx, by - stemH);
    const pr = 1.05 * s;
    const petals = r() < 0.5 ? petalsA : petalsB;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      petals.addCircle(bx + Math.cos(a) * pr * 1.2, by - stemH + Math.sin(a) * pr * 1.2, pr);
    }
    centers.addCircle(bx, by - stemH, pr * 0.75);
  };
  const rock: Placer = (bx, by, s) => {
    const w = 5 * s;
    const h = 3.2 * s;
    rocks.addOval(Skia.XYWHRect(bx - w / 2, by - h + 1, w, h));
    rockLight.addOval(Skia.XYWHRect(bx - w * 0.3, by - h * 0.85, w * 0.35, h * 0.3));
  };

  scatter(cfg, Math.round(cfg.terrainW * 7) + 1, (r) => {
    const v = r();
    if (v < 0.28) return { place: tree, gap: 190 };
    if (v < 0.5) return { place: bush, gap: 110 };
    if (v < 0.82) return { place: flower, gap: 90 };
    return { place: rock, gap: 110 };
  });

  return {
    sway: [
      { key: 'tuft', path: tuftsPath(cfg, 11, 1, 1), stroke: 1.6 },
      { key: 'trunk', path: trunks, stroke: 0 },
      { key: 'canopy', path: canopy, stroke: 0 },
      { key: 'canopyLight', path: canopyLight, stroke: 0 },
      { key: 'grass', path: stems, stroke: 1.8 },
      { key: 'accentA', path: petalsA, stroke: 0 },
      { key: 'accentB', path: petalsB, stroke: 0 },
      { key: 'accentC', path: centers, stroke: 0 },
    ],
    still: [
      { key: 'rock', path: rocks, stroke: 0 },
      { key: 'rockLight', path: rockLight, stroke: 0 },
    ],
  };
}

function beach(cfg: SimConfig): Scenery {
  const trunks = Skia.Path.Make();
  const fronds = Skia.Path.Make();
  const frondLight = Skia.Path.Make();
  const coconuts = Skia.Path.Make();
  const shells = Skia.Path.Make();
  const shellLines = Skia.Path.Make();
  const starfish = Skia.Path.Make();
  const shellShine = Skia.Path.Make();

  const palm: Placer = (bx, by, s, r) => {
    const h = (15 + r() * 5) * s;
    const lean = (r() < 0.5 ? -1 : 1) * (2 + r() * 2) * s;
    const topX = bx + lean;
    const topY = by - h;
    // Tapered, slightly curved trunk
    const segs = 8;
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const k = i / segs;
      const cx = bx + lean * k * k;
      const cy = by - h * k;
      const w = (1.5 - 0.7 * k) * s;
      left.push(cx - w, cy);
      right.push(cx + w, cy);
    }
    trunks.moveTo(left[0], left[1]);
    for (let i = 1; i <= segs; i++) trunks.lineTo(left[i * 2], left[i * 2 + 1]);
    for (let i = segs; i >= 0; i--) trunks.lineTo(right[i * 2], right[i * 2 + 1]);
    trunks.close();
    // Fronds droop outward from the top
    for (let f = 0; f < 6; f++) {
      const a = -Math.PI / 2 + (f - 2.5) * 0.55;
      const len = (7 + (f % 2) * 1.5) * s;
      const tipX = topX + Math.cos(a) * len * 1.1;
      const tipY = topY + Math.sin(a) * len * 0.55 + len * 0.45;
      const nx = -Math.sin(a) * 1.6 * s;
      const ny = Math.cos(a) * 1.6 * s;
      const midX = (topX + tipX) / 2;
      const midY = (topY + tipY) / 2 - 2.5 * s;
      fronds.moveTo(topX, topY);
      fronds.quadTo(midX + nx, midY + ny, tipX, tipY);
      fronds.quadTo(midX - nx, midY - ny, topX, topY);
      fronds.close();
      frondLight.moveTo(topX, topY);
      frondLight.quadTo(midX, midY, tipX, tipY);
    }
    coconuts.addCircle(topX - 1 * s, topY + 1.2 * s, 1 * s);
    coconuts.addCircle(topX + 1.1 * s, topY + 1.4 * s, 1 * s);
  };
  const shell: Placer = (bx, by, s) => {
    const w = 2.6 * s;
    shells.moveTo(bx - w, by);
    shells.quadTo(bx - w, by - w * 1.1, bx, by - w * 1.2);
    shells.quadTo(bx + w, by - w * 1.1, bx + w, by);
    shells.close();
    for (let k = -1; k <= 1; k++) {
      shellLines.moveTo(bx + k * w * 0.2, by);
      shellLines.lineTo(bx + k * w * 0.55, by - w * 0.95);
    }
    shellShine.addCircle(bx - w * 0.35, by - w * 0.7, w * 0.18);
  };
  const star: Placer = (bx, by, s) => {
    const R = 2.2 * s;
    const r0 = 0.9 * s;
    const cy = by - 0.6 * s;
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
      const rad = k % 2 === 0 ? R : r0;
      const px = bx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad * 0.55;
      if (k === 0) starfish.moveTo(px, py);
      else starfish.lineTo(px, py);
    }
    starfish.close();
  };

  scatter(cfg, Math.round(cfg.terrainW * 5) + 2, (r) => {
    const v = r();
    if (v < 0.35) return { place: palm, gap: 230 };
    if (v < 0.7) return { place: shell, gap: 95 };
    return { place: star, gap: 110 };
  });

  return {
    sway: [
      { key: 'tuft', path: tuftsPath(cfg, 23, 0.45, 1.2), stroke: 1.6 },
      { key: 'trunk', path: trunks, stroke: 0 },
      { key: 'canopy', path: fronds, stroke: 0 },
      { key: 'canopyLight', path: frondLight, stroke: 1.2 },
      { key: 'accentC', path: coconuts, stroke: 0 },
    ],
    still: [
      { key: 'accentA', path: shells, stroke: 0 },
      { key: 'detail', path: shellLines, stroke: 0.9 },
      { key: 'rockLight', path: shellShine, stroke: 0 },
      { key: 'accentB', path: starfish, stroke: 0 },
    ],
  };
}

function snow(cfg: SimConfig): Scenery {
  const trunks = Skia.Path.Make();
  const pines = Skia.Path.Make();
  const caps = Skia.Path.Make();
  const snowmen = Skia.Path.Make();
  const coal = Skia.Path.Make();
  const carrots = Skia.Path.Make();
  const scarves = Skia.Path.Make();
  const mounds = Skia.Path.Make();

  const pine: Placer = (bx, by, s, r) => {
    const h = (15 + r() * 6) * s;
    trunks.addRect(Skia.XYWHRect(bx - 0.9 * s, by - 3 * s, 1.8 * s, 3.5 * s));
    for (let tier = 0; tier < 3; tier++) {
      const baseY = by - 2.5 * s - tier * h * 0.26;
      const w = (6.2 - tier * 1.6) * s;
      const topY = baseY - h * 0.42;
      pines.moveTo(bx - w, baseY);
      pines.lineTo(bx, topY);
      pines.lineTo(bx + w, baseY);
      pines.close();
      // Snow sits on top of each tier
      caps.moveTo(bx - w * 0.45, topY + (baseY - topY) * 0.45);
      caps.lineTo(bx, topY);
      caps.lineTo(bx + w * 0.45, topY + (baseY - topY) * 0.45);
      caps.quadTo(bx + w * 0.15, topY + (baseY - topY) * 0.55, bx, topY + (baseY - topY) * 0.42);
      caps.quadTo(bx - w * 0.15, topY + (baseY - topY) * 0.55, bx - w * 0.45, topY + (baseY - topY) * 0.45);
      caps.close();
    }
  };
  const snowman: Placer = (bx, by, s) => {
    snowmen.addCircle(bx, by - 2.8 * s, 3 * s);
    snowmen.addCircle(bx, by - 7.4 * s, 2.1 * s);
    coal.addCircle(bx - 0.7 * s, by - 7.8 * s, 0.28 * s);
    coal.addCircle(bx + 0.7 * s, by - 7.8 * s, 0.28 * s);
    coal.addCircle(bx, by - 3.6 * s, 0.3 * s);
    coal.addCircle(bx, by - 2.2 * s, 0.3 * s);
    carrots.moveTo(bx + 0.2 * s, by - 7.4 * s);
    carrots.lineTo(bx + 2.6 * s, by - 7.1 * s);
    carrots.lineTo(bx + 0.2 * s, by - 6.8 * s);
    carrots.close();
    scarves.addRRect(Skia.RRectXY(Skia.XYWHRect(bx - 2 * s, by - 5.8 * s, 4 * s, 0.9 * s), 0.4 * s, 0.4 * s));
  };
  const mound: Placer = (bx, by, s) => {
    mounds.addOval(Skia.XYWHRect(bx - 4 * s, by - 2 * s, 8 * s, 3.4 * s));
  };

  scatter(cfg, Math.round(cfg.terrainW * 3) + 3, (r) => {
    const v = r();
    if (v < 0.55) return { place: pine, gap: 150 };
    if (v < 0.72) return { place: snowman, gap: 200 };
    return { place: mound, gap: 90 };
  });

  return {
    sway: [
      { key: 'trunk', path: trunks, stroke: 0 },
      { key: 'canopy', path: pines, stroke: 0 },
      { key: 'canopyLight', path: caps, stroke: 0 },
    ],
    still: [
      { key: 'rock', path: mounds, stroke: 0 },
      { key: 'rock', path: snowmen, stroke: 0 },
      { key: 'accentC', path: scarves, stroke: 0 },
      { key: 'accentB', path: coal, stroke: 0 },
      { key: 'accentA', path: carrots, stroke: 0 },
    ],
  };
}

function autumn(cfg: SimConfig): Scenery {
  const trunks = Skia.Path.Make();
  const canopy = Skia.Path.Make();
  const canopyLight = Skia.Path.Make();
  const caps = Skia.Path.Make();
  const stalks = Skia.Path.Make();
  const dots = Skia.Path.Make();
  const leaves = Skia.Path.Make();
  const rocks = Skia.Path.Make();

  const tree: Placer = (bx, by, s) => {
    const trunkW = 2.2 * s;
    const trunkH = 10 * s;
    trunks.addRRect(Skia.RRectXY(Skia.XYWHRect(bx - trunkW / 2, by - trunkH, trunkW, trunkH + 2), trunkW / 3, trunkW / 3));
    const cy = by - trunkH - 3.5 * s;
    canopy.addOval(Skia.XYWHRect(bx - 6 * s, cy - 6.5 * s, 12 * s, 11 * s));
    canopy.addCircle(bx - 4.6 * s, cy + 1.6 * s, 3.4 * s);
    canopy.addCircle(bx + 4.6 * s, cy + 1.2 * s, 3.4 * s);
    canopyLight.addCircle(bx - 2 * s, cy - 3.2 * s, 2 * s);
    canopyLight.addCircle(bx + 2.8 * s, cy - 0.6 * s, 1.3 * s);
  };
  const mushroom: Placer = (bx, by, s) => {
    stalks.addRRect(Skia.RRectXY(Skia.XYWHRect(bx - 0.7 * s, by - 2.6 * s, 1.4 * s, 2.8 * s), 0.5 * s, 0.5 * s));
    caps.moveTo(bx - 2.3 * s, by - 2.4 * s);
    caps.quadTo(bx, by - 6 * s, bx + 2.3 * s, by - 2.4 * s);
    caps.close();
    dots.addCircle(bx - 0.8 * s, by - 3.6 * s, 0.35 * s);
    dots.addCircle(bx + 0.9 * s, by - 3.2 * s, 0.3 * s);
  };
  const leafPile: Placer = (bx, by, s, r) => {
    for (let k = 0; k < 4; k++) {
      const x = bx + (r() - 0.5) * 8 * s;
      const a = r() * Math.PI;
      const len = 1.1 * s;
      const c = Math.cos(a) * len;
      const d = Math.sin(a) * len * 0.5;
      leaves.moveTo(x - c, by - d);
      leaves.quadTo(x, by - 1 * s, x + c, by + d);
      leaves.quadTo(x, by + 0.6 * s, x - c, by - d);
      leaves.close();
    }
  };
  const rock: Placer = (bx, by, s) => {
    rocks.addOval(Skia.XYWHRect(bx - 2.5 * s, by - 2.8 * s, 5 * s, 3.2 * s));
  };

  scatter(cfg, Math.round(cfg.terrainW * 11) + 4, (r) => {
    const v = r();
    if (v < 0.35) return { place: tree, gap: 180 };
    if (v < 0.6) return { place: mushroom, gap: 100 };
    if (v < 0.85) return { place: leafPile, gap: 80 };
    return { place: rock, gap: 120 };
  });

  return {
    sway: [
      { key: 'tuft', path: tuftsPath(cfg, 37, 0.7, 0.9), stroke: 1.6 },
      { key: 'trunk', path: trunks, stroke: 0 },
      { key: 'canopy', path: canopy, stroke: 0 },
      { key: 'canopyLight', path: canopyLight, stroke: 0 },
    ],
    still: [
      { key: 'rock', path: rocks, stroke: 0 },
      { key: 'accentB', path: leaves, stroke: 0 },
      { key: 'rockLight', path: stalks, stroke: 0 },
      { key: 'accentA', path: caps, stroke: 0 },
      { key: 'accentC', path: dots, stroke: 0 },
    ],
  };
}

export function buildScenery(cfg: SimConfig): Scenery[] {
  return [meadow(cfg), beach(cfg), snow(cfg), autumn(cfg)];
}
