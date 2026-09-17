import { WEATHER_RAIN } from '../sim/constants';

/**
 * Environment colors for the day cycle. Each key has 4 variants: day, sunset, night, dawn.
 * Colors are [r, g, b, a] so they can be mixed cheaply inside worklets.
 */
type RGBA = readonly [number, number, number, number];

const hex = (h: string, a = 1): RGBA => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
  a,
];

export const PALETTE_KEYS = [
  'skyTop',
  'skyMid',
  'skyBottom',
  'cloud',
  'mountainFar',
  'mountainNear',
  'hill',
  'hillShade',
  'grass',
  'grassLight',
  'dirt',
  'dirtDark',
  'trunk',
  'canopy',
  'canopyLight',
  'rock',
  'overlay',
  'sunGlow',
] as const;

export type PaletteKey = (typeof PALETTE_KEYS)[number];
export type Palette = Record<PaletteKey, string> & {
  /** Sky gradient stops as 0..1 floats [top rgb, mid rgb, bottom rgb] for the sky shader */
  sky: number[];
};

// Order: day, sunset, night, dawn
const TABLE: Record<PaletteKey, readonly RGBA[]> = {
  skyTop: [hex('#4FA9E8'), hex('#46407E'), hex('#0A0F2C'), hex('#5C6BB5')],
  skyMid: [hex('#94D2F3'), hex('#D9697A'), hex('#18214D'), hex('#E6A0B8')],
  skyBottom: [hex('#E2F5FB'), hex('#FFB36B'), hex('#2E3A70'), hex('#FFD9B0')],
  cloud: [hex('#FFFFFF', 0.95), hex('#FFD3C4', 0.9), hex('#3A4575', 0.8), hex('#FFE3E0', 0.9)],
  mountainFar: [hex('#9CC7DE'), hex('#A0729A'), hex('#1E2A55'), hex('#B69BC0')],
  mountainNear: [hex('#79B28A'), hex('#8A5E78'), hex('#172446'), hex('#8F8DA8')],
  hill: [hex('#6DBE55'), hex('#8E9A4C'), hex('#1F3B37'), hex('#86AE6B')],
  hillShade: [hex('#58A546'), hex('#78823F'), hex('#19312E'), hex('#6F9A58')],
  grass: [hex('#5DB247'), hex('#7C8F42'), hex('#1D3A30'), hex('#77A45A')],
  grassLight: [hex('#9BE071'), hex('#C8B063'), hex('#2F5446'), hex('#B7D58A')],
  dirt: [hex('#9A6B45'), hex('#8A5343'), hex('#2B2230'), hex('#8F6A57')],
  dirtDark: [hex('#6E4A31'), hex('#5E3934'), hex('#1C1724'), hex('#654A44')],
  trunk: [hex('#7A5236'), hex('#6A4034'), hex('#231C27'), hex('#6E5046')],
  canopy: [hex('#3E9B4F'), hex('#6A7B3E'), hex('#163029'), hex('#5E8E5A')],
  canopyLight: [hex('#62C065'), hex('#9A9A52'), hex('#22443A'), hex('#83B07A')],
  rock: [hex('#A7A39B'), hex('#9C7F7C'), hex('#3A3A4E'), hex('#A5989E')],
  overlay: [hex('#000000', 0), hex('#FF7A3C', 0.1), hex('#0A1040', 0.34), hex('#FF9E9E', 0.06)],
  sunGlow: [hex('#FFF4B8', 0.55), hex('#FFB35C', 0.7), hex('#FFFFFF', 0), hex('#FFD1A1', 0.6)],
};

// Flattened for worklet access: KEY_COUNT * 4 variants * 4 channels
const FLAT: number[] = [];
for (const key of PALETTE_KEYS) {
  for (const c of TABLE[key]) FLAT.push(c[0], c[1], c[2], c[3]);
}
const KEY_COUNT = PALETTE_KEYS.length;
const KEYS: readonly string[] = PALETTE_KEYS;

/**
 * Weights for [day, sunset, night, dawn] at a position in the day cycle (0..1).
 * Day → sunset around 0.3, night 0.5–0.78, dawn around 0.86, back to day.
 */
export function dayWeights(dayT: number, out: number[]): void {
  'worklet';
  const t = ((dayT % 1) + 1) % 1;
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  const seg = (a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  if (t < 0.28) out[0] = 1;
  else if (t < 0.36) {
    const k = seg(0.28, 0.36);
    out[0] = 1 - k;
    out[1] = k;
  } else if (t < 0.42) out[1] = 1;
  else if (t < 0.5) {
    const k = seg(0.42, 0.5);
    out[1] = 1 - k;
    out[2] = k;
  } else if (t < 0.78) out[2] = 1;
  else if (t < 0.86) {
    const k = seg(0.78, 0.86);
    out[2] = 1 - k;
    out[3] = k;
  } else if (t < 0.9) out[3] = 1;
  else {
    const k = seg(0.9, 1);
    out[3] = 1 - k;
    out[0] = k;
  }
}

function toCss(r: number, g: number, b: number, a: number): string {
  'worklet';
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.round(a * 1000) / 1000})`;
}

/** Compute the full palette for a day position, darkened by rain. */
export function computePalette(dayT: number, weather: number, weatherAmt: number): Palette {
  'worklet';
  const w = [0, 0, 0, 0];
  dayWeights(dayT, w);
  const rain = weather === WEATHER_RAIN ? weatherAmt : 0;
  const out: Record<string, string | number[]> = {};
  const sky: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let k = 0; k < KEY_COUNT; k++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let v = 0; v < 4; v++) {
      const i = (k * 4 + v) * 4;
      r += FLAT[i] * w[v];
      g += FLAT[i + 1] * w[v];
      b += FLAT[i + 2] * w[v];
      a += FLAT[i + 3] * w[v];
    }
    const key = KEYS[k];
    if (rain > 0) {
      if (key === 'overlay') {
        // Blend a gray storm tint into the lighting overlay
        const ra = 0.22 * rain;
        const na = a + ra * (1 - a);
        r = (r * a + 60 * ra * (1 - a)) / Math.max(na, 1e-4);
        g = (g * a + 70 * ra * (1 - a)) / Math.max(na, 1e-4);
        b = (b * a + 90 * ra * (1 - a)) / Math.max(na, 1e-4);
        a = na;
      } else if (key === 'skyTop' || key === 'skyMid' || key === 'skyBottom' || key === 'cloud') {
        const gray = (r + g + b) / 3;
        const k2 = 0.55 * rain;
        r = r + (gray * 0.8 - r) * k2;
        g = g + (gray * 0.82 - g) * k2;
        b = b + (gray * 0.9 - b) * k2;
      }
    }
    out[key] = toCss(r, g, b, a);
    const skyIndex = key === 'skyTop' ? 0 : key === 'skyMid' ? 1 : key === 'skyBottom' ? 2 : -1;
    if (skyIndex >= 0) {
      sky[skyIndex * 3] = r / 255;
      sky[skyIndex * 3 + 1] = g / 255;
      sky[skyIndex * 3 + 2] = b / 255;
    }
  }
  out.sky = sky;
  return out as unknown as Palette;
}

/** Night amount 0..1 for stars/moon. */
export function nightAmount(dayT: number): number {
  'worklet';
  const w = [0, 0, 0, 0];
  dayWeights(dayT, w);
  return w[2];
}

/** Sun visibility 0..1 and its height ratio (0 = high, 1 = at horizon). */
export function sunState(dayT: number, out: number[]): void {
  'worklet';
  const w = [0, 0, 0, 0];
  dayWeights(dayT, w);
  const t = ((dayT % 1) + 1) % 1;
  // Sun rises during dawn→day (0.86..1.0 and 0..0.1), sets during day→sunset (0.2..0.46)
  let height = 0;
  if (t < 0.2) height = 0;
  else if (t < 0.46) height = (t - 0.2) / 0.26;
  else if (t < 0.84) height = 1.2;
  else height = 1 - (t - 0.84) / 0.16;
  out[0] = Math.min(1, w[0] + w[1] + w[3]);
  out[1] = Math.max(0, Math.min(1.2, height));
}
