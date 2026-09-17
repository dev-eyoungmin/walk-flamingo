export interface Rank {
  emoji: string;
  name: string;
  minDistance: number;
}

/** Single source of truth for ranks (distance in meters). The simulation reads RANK_THRESHOLDS_M. */
export const RANKS: readonly Rank[] = [
  { emoji: '🥚', name: 'Egg', minDistance: 0 },
  { emoji: '🐣', name: 'Chick', minDistance: 25 },
  { emoji: '🐥', name: 'Fledgling', minDistance: 75 },
  { emoji: '🦩', name: 'Flamingo', minDistance: 150 },
  { emoji: '🦅', name: 'Eagle', minDistance: 300 },
  { emoji: '👑', name: 'King of Birds', minDistance: 600 },
  { emoji: '⭐', name: 'Legendary Bird', minDistance: 1000 },
];

export const RANK_THRESHOLDS_M: readonly number[] = RANKS.map((r) => r.minDistance);
export const RANK_NAMES: readonly string[] = RANKS.map((r) => r.name);

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
