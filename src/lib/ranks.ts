export interface Rank {
  emoji: string;
  name: string;
  nameKo: string;
  minDistance: number;
}

const RANKS: Rank[] = [
  { emoji: '🥚', name: 'Egg', nameKo: '알', minDistance: 0 },
  { emoji: '🐣', name: 'Chick', nameKo: '병아리', minDistance: 10 },
  { emoji: '🐥', name: 'Fledgling', nameKo: '아기새', minDistance: 50 },
  { emoji: '🦩', name: 'Flamingo', nameKo: '플라밍고', minDistance: 100 },
  { emoji: '🦅', name: 'Eagle', nameKo: '독수리', minDistance: 200 },
  { emoji: '👑', name: 'King of Birds', nameKo: '새들의 왕', minDistance: 500 },
  { emoji: '⭐', name: 'Legendary Bird', nameKo: '전설의 새', minDistance: 1000 },
];

export function getRank(distanceM: number): Rank {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (distanceM >= r.minDistance) rank = r;
  }
  return rank;
}
