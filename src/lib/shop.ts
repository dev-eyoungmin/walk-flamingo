/** In-app purchase catalog. Prices come from the App Store; this only knows ids and contents. */
export const REMOVE_ADS_ID = 'com.wobbly.flamingo.game.removeads';

export interface CoinPack {
  id: string;
  coins: number;
  /** Extra value compared with the smallest pack, for the badge (0 = none) */
  bonusPct: number;
}

export const COIN_PACKS: readonly CoinPack[] = [
  { id: 'com.wobbly.flamingo.game.coins1000', coins: 1000, bonusPct: 0 },
  { id: 'com.wobbly.flamingo.game.coins3500', coins: 3500, bonusPct: 15 },
  { id: 'com.wobbly.flamingo.game.coins8000', coins: 8000, bonusPct: 30 },
];

export const PRODUCT_IDS: readonly string[] = [REMOVE_ADS_ID, ...COIN_PACKS.map((p) => p.id)];

export function coinsForProduct(productId: string): number {
  return COIN_PACKS.find((p) => p.id === productId)?.coins ?? 0;
}

export function isConsumable(productId: string): boolean {
  return COIN_PACKS.some((p) => p.id === productId);
}
