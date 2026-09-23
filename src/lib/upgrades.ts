/**
 * Permanent upgrades bought with coins. Pure data + helpers; progress.ts stores the levels and the
 * navigator turns them into per-run simulation parameters.
 */
import { FEVER, ITEMS } from '../game/sim/constants';

export type UpgradeId = 'magnet' | 'fever' | 'luck' | 'balloon';

export interface UpgradeDef {
  id: UpgradeId;
  /** Cost of each next level (length = max level) */
  costs: readonly number[];
  /** Effect value at each level, index 0 = not upgraded */
  values: readonly number[];
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'magnet', costs: [120, 250, 450, 700], values: [ITEMS.MAGNET_TIME, 10, 12, 14, 16] },
  { id: 'fever', costs: [150, 300, 550, 850], values: [FEVER.DURATION, 9.5, 11, 12.5, 14] },
  // Multiplier on the distance between course items
  { id: 'luck', costs: [200, 400, 750], values: [1, 0.88, 0.77, 0.67] },
  // Runs per day that start with a rescue balloon
  { id: 'balloon', costs: [300, 600, 1000], values: [0, 1, 2, 3] },
];

export type UpgradeLevels = Record<UpgradeId, number>;

export const NO_UPGRADES: UpgradeLevels = { magnet: 0, fever: 0, luck: 0, balloon: 0 };

export function upgradeDef(id: UpgradeId): UpgradeDef {
  return UPGRADES.find((u) => u.id === id)!;
}

export function maxLevel(id: UpgradeId): number {
  return upgradeDef(id).costs.length;
}

/** Price of the next level, or null when maxed. */
export function upgradeCost(id: UpgradeId, level: number): number | null {
  const costs = upgradeDef(id).costs;
  return level < costs.length ? costs[level] : null;
}

export function upgradeValue(id: UpgradeId, level: number): number {
  const values = upgradeDef(id).values;
  return values[Math.max(0, Math.min(level, values.length - 1))];
}

/** Simulation parameters from upgrade levels. */
export function runParamsFor(levels: UpgradeLevels): { magnetTime: number; feverDuration: number; itemGapMult: number } {
  return {
    magnetTime: upgradeValue('magnet', levels.magnet),
    feverDuration: upgradeValue('fever', levels.fever),
    itemGapMult: upgradeValue('luck', levels.luck),
  };
}

/** True when the player can buy at least one upgrade right now (for the menu badge). */
export function anyUpgradeAffordable(levels: UpgradeLevels, wallet: number): boolean {
  return UPGRADES.some((u) => {
    const cost = upgradeCost(u.id, levels[u.id]);
    return cost !== null && wallet >= cost;
  });
}
