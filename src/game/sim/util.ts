import { FX_CAPACITY, SimState } from './state';

function mulberry(state: number): number {
  'worklet';
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** mulberry32 PRNG stored on the state so runs are reproducible from a seed. */
export function rand(s: SimState): number {
  'worklet';
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  return mulberry(s.rng);
}

/** Course randomness: event types/order and weather. Independent of player actions. */
export function randEvent(s: SimState): number {
  'worklet';
  s.rngEvents = (s.rngEvents + 0x6d2b79f5) | 0;
  return mulberry(s.rngEvents);
}

/** Coin and item patterns (spawn by distance, so they depend on the run). */
export function randCoin(s: SimState): number {
  'worklet';
  s.rngCoins = (s.rngCoins + 0x6d2b79f5) | 0;
  return mulberry(s.rngCoins);
}

/** Ambient wind changes (time-based). */
export function randWind(s: SimState): number {
  'worklet';
  s.rngWind = (s.rngWind + 0x6d2b79f5) | 0;
  return mulberry(s.rngWind);
}

export function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/** Smoothstep 0..1 */
export function smooth01(x: number): number {
  'worklet';
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential approach factor for a time constant tau. */
export function approach(dt: number, tau: number): number {
  'worklet';
  return 1 - Math.exp(-dt / tau);
}

export function pushFx(s: SimState, code: number, value: number): void {
  'worklet';
  if (s.fxLen >= FX_CAPACITY) return;
  s.fx[s.fxLen * 2] = code;
  s.fx[s.fxLen * 2 + 1] = value;
  s.fxLen++;
}
