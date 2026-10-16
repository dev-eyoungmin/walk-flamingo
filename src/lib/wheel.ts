/**
 * Lucky wheel: one free spin a day, more for rewarded ads. Pure data + helpers; progress.ts keeps
 * the daily counters and the navigator hands out prizes that live elsewhere (skin rentals).
 */
import { addCoins, ensureDay, ProgressData } from './progress';

export type WheelPrize =
  | { kind: 'coins'; amount: number }
  /** A rescue balloon for an upcoming run */
  | { kind: 'balloon' }
  /** A 24-hour skin rental (a skin the player doesn't own) */
  | { kind: 'skin' };

export interface WheelSegment {
  prize: WheelPrize;
  weight: number;
  color: string;
}

/** Clockwise from the pointer at the top. */
export const WHEEL: readonly WheelSegment[] = [
  { prize: { kind: 'coins', amount: 25 }, weight: 22, color: '#FF6F9C' },
  { prize: { kind: 'balloon' }, weight: 12, color: '#7FDBFF' },
  { prize: { kind: 'coins', amount: 50 }, weight: 18, color: '#FFC93C' },
  { prize: { kind: 'skin' }, weight: 8, color: '#9B6BFF' },
  { prize: { kind: 'coins', amount: 100 }, weight: 10, color: '#5EE6C9' },
  { prize: { kind: 'coins', amount: 35 }, weight: 18, color: '#FF9E6B' },
  { prize: { kind: 'coins', amount: 200 }, weight: 4, color: '#FFB3D1' },
  { prize: { kind: 'coins', amount: 500 }, weight: 1, color: '#FFE14D' },
];

export const SPINS = { AD_PER_DAY: 3 } as const;

/** Coins given instead of a skin rental once every shop skin is owned. */
export const SKIN_FALLBACK_COINS = 100;

/** Weighted pick; `rand` is in [0, 1). */
export function pickSegment(rand: number): number {
  const total = WHEEL.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.min(Math.max(rand, 0), 0.999999) * total;
  for (let i = 0; i < WHEEL.length; i++) {
    r -= WHEEL[i].weight;
    if (r < 0) return i;
  }
  return WHEEL.length - 1;
}

export type SpinKind = 'free' | 'ad';

/** Which spin the player has next today, or null when all are used. */
export function nextSpin(data: ProgressData): SpinKind | null {
  if (!data.today.freeSpinUsed) return 'free';
  return data.today.adSpins < SPINS.AD_PER_DAY ? 'ad' : null;
}

export function adSpinsLeft(data: ProgressData): number {
  return Math.max(0, SPINS.AD_PER_DAY - data.today.adSpins);
}

/**
 * Spend a spin and apply the prizes that live in progress (coins, balloons). Skin prizes are
 * returned for the caller to apply; with every shop skin owned they become coins instead.
 */
export function spinWheel(
  input: ProgressData,
  kind: SpinKind,
  rand: number,
  now: Date,
  canRentSkin: boolean,
): { data: ProgressData; segment: number; prize: WheelPrize } | null {
  const data = ensureDay(input, now);
  if (nextSpin(data) !== kind) return null;
  const today = kind === 'free' ? { ...data.today, freeSpinUsed: true } : { ...data.today, adSpins: data.today.adSpins + 1 };
  const segment = pickSegment(rand);
  let prize = WHEEL[segment].prize;
  if (prize.kind === 'skin' && !canRentSkin) prize = { kind: 'coins', amount: SKIN_FALLBACK_COINS };
  let next: ProgressData = { ...data, today };
  if (prize.kind === 'coins') next = addCoins(next, prize.amount);
  else if (prize.kind === 'balloon') next = { ...next, bonusBalloons: next.bonusBalloons + 1 };
  return { data: next, segment, prize };
}
