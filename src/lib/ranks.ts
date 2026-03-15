export interface Rank {
  emoji: string;
  name: string;
  minDistance: number;
}

const RANKS: Rank[] = [
  { emoji: '🥚', name: 'Egg', minDistance: 0 },
  { emoji: '🐣', name: 'Chick', minDistance: 10 },
  { emoji: '🐥', name: 'Fledgling', minDistance: 50 },
  { emoji: '🦩', name: 'Flamingo', minDistance: 100 },
  { emoji: '🦅', name: 'Eagle', minDistance: 200 },
  { emoji: '👑', name: 'King of Birds', minDistance: 500 },
  { emoji: '⭐', name: 'Legendary Bird', minDistance: 1000 },
];

export function getRank(distanceM: number): Rank {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (distanceM >= r.minDistance) rank = r;
  }
  return rank;
}
