import { t, TKey } from '../i18n';

export interface Rank {
  emoji: string;
  /** Localized name */
  name: string;
  minDistance: number;
}

/** Single source of truth for ranks (distance in meters). The simulation reads RANK_THRESHOLDS_M. */
export const RANKS: readonly Rank[] = [
  { emoji: '🥚', name: t('rank.0' as TKey), minDistance: 0 },
  { emoji: '🐣', name: t('rank.1' as TKey), minDistance: 25 },
  { emoji: '🐥', name: t('rank.2' as TKey), minDistance: 75 },
  { emoji: '🦩', name: t('rank.3' as TKey), minDistance: 150 },
  { emoji: '🦅', name: t('rank.4' as TKey), minDistance: 300 },
  { emoji: '👑', name: t('rank.5' as TKey), minDistance: 600 },
  { emoji: '⭐', name: t('rank.6' as TKey), minDistance: 1000 },
];

export const RANK_THRESHOLDS_M: readonly number[] = RANKS.map((r) => r.minDistance);
/** Localized, upper-cased for the HUD rank-up popup */
export const RANK_NAMES: readonly string[] = RANKS.map((r) => r.name.toUpperCase());

export function getRankIndex(distanceM: number): number {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (distanceM >= RANKS[i].minDistance) idx = i;
  }
  return idx;
}

export function getRank(distanceM: number): Rank {
  return RANKS[getRankIndex(distanceM)];
}

/** Progress toward the next rank: ratio 0..1 plus the next rank (or null at max). */
export function getRankProgress(distanceM: number): { ratio: number; next: Rank | null } {
  const idx = getRankIndex(distanceM);
  if (idx >= RANKS.length - 1) return { ratio: 1, next: null };
  const cur = RANKS[idx].minDistance;
  const next = RANKS[idx + 1];
  return { ratio: Math.min(1, Math.max(0, (distanceM - cur) / (next.minDistance - cur))), next };
}
