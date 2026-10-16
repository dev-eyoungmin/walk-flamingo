/**
 * Long-term goals with tiers. Progress comes from the lifetime totals in progress.ts; each tier is
 * claimed by hand for its coins, and a few final tiers unlock a skin that can't be bought.
 */
import type { TKey } from '../i18n';
import { addCoins, ProgressData } from './progress';

export type AchievementId =
  | 'walker'
  | 'runner'
  | 'saver'
  | 'clutch'
  | 'fever'
  | 'dodger'
  | 'family'
  | 'gold'
  | 'perfect'
  | 'collector'
  | 'daily'
  | 'loyal'
  | 'missions'
  | 'wardrobe';

export interface AchievementDef {
  id: AchievementId;
  icon: string;
  targets: readonly number[];
  rewards: readonly number[];
  /** Skin unlocked by the last tier */
  skin?: string;
  value: (d: ProgressData) => number;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'runner', icon: '🏁', targets: [100, 200, 350, 500], rewards: [80, 150, 300, 600], skin: 'neon', value: (d) => d.totals.bestMeters },
  { id: 'walker', icon: '👣', targets: [1000, 5000, 20000, 50000], rewards: [100, 200, 400, 800], skin: 'shadow', value: (d) => d.totals.meters },
  { id: 'saver', icon: '😅', targets: [10, 50, 200], rewards: [80, 200, 400], value: (d) => d.totals.saves },
  { id: 'clutch', icon: '⚡', targets: [3, 20, 75], rewards: [100, 250, 500], value: (d) => d.totals.clutches },
  { id: 'fever', icon: '🌈', targets: [5, 25, 100], rewards: [80, 200, 400], value: (d) => d.totals.fevers },
  { id: 'dodger', icon: '💨', targets: [20, 100, 400], rewards: [80, 200, 400], value: (d) => d.totals.dodges },
  { id: 'family', icon: '🐣', targets: [3, 15, 50], rewards: [80, 200, 400], value: (d) => d.totals.rescued },
  { id: 'gold', icon: '⭐', targets: [10, 50, 200], rewards: [80, 200, 400], value: (d) => d.totals.golds },
  { id: 'perfect', icon: '✨', targets: [10, 50, 200], rewards: [80, 200, 400], value: (d) => d.totals.perfects },
  { id: 'collector', icon: '💰', targets: [1000, 5000, 20000], rewards: [100, 250, 500], value: (d) => d.lifetimeCoins },
  { id: 'daily', icon: '📅', targets: [3, 15, 50], rewards: [80, 200, 400], value: (d) => d.totals.dailyRuns },
  { id: 'loyal', icon: '🎁', targets: [3, 7, 30], rewards: [100, 250, 600], value: (d) => d.bestStreak },
  { id: 'missions', icon: '📜', targets: [10, 40, 120], rewards: [100, 250, 500], value: (d) => d.totals.missions },
  { id: 'wardrobe', icon: '👗', targets: [2, 4, 6], rewards: [100, 200, 400], value: (d) => d.ownedSkins.length },
];

export function achievementName(id: AchievementId): TKey {
  return `ach.${id}` as TKey;
}

export function achievementDesc(id: AchievementId): TKey {
  return `ach.${id}Desc` as TKey;
}

export function achievementDef(id: AchievementId): AchievementDef {
  return ACHIEVEMENTS.find((a) => a.id === id)!;
}

export interface AchievementStatus {
  def: AchievementDef;
  value: number;
  /** Tiers already claimed */
  claimed: number;
  /** The tier being worked on (= claimed), or null when all are claimed */
  target: number | null;
  reward: number | null;
  claimable: boolean;
  /** Tiers reached but not yet claimed */
  ready: number;
}

export function achievementStatus(data: ProgressData, def: AchievementDef): AchievementStatus {
  const value = def.value(data);
  const claimed = Math.min(data.achievements[def.id] ?? 0, def.targets.length);
  const target = claimed < def.targets.length ? def.targets[claimed] : null;
  const ready = def.targets.filter((t, i) => i >= claimed && value >= t).length;
  return { def, value, claimed, target, reward: target === null ? null : def.rewards[claimed], claimable: ready > 0, ready };
}

export function allAchievements(data: ProgressData): AchievementStatus[] {
  return ACHIEVEMENTS.map((def) => achievementStatus(data, def));
}

/** Number of tiers waiting to be claimed (for the menu badge). */
export function claimableCount(data: ProgressData): number {
  return allAchievements(data).reduce((n, a) => n + a.ready, 0);
}

/**
 * Claim the next tier of an achievement. Returns null when nothing is ready. The final tier of an
 * achievement with a skin also adds that skin to the owned ones.
 */
export function claimAchievement(
  data: ProgressData,
  id: AchievementId,
): { data: ProgressData; reward: number; skin: string | null } | null {
  const status = achievementStatus(data, achievementDef(id));
  if (!status.claimable || status.reward === null) return null;
  const tier = status.claimed + 1;
  const last = tier === status.def.targets.length;
  const skin = last && status.def.skin && !data.ownedSkins.includes(status.def.skin) ? status.def.skin : null;
  const next = addCoins({ ...data, achievements: { ...data.achievements, [id]: tier } }, status.reward);
  return { data: skin ? { ...next, ownedSkins: [...next.ownedSkins, skin] } : next, reward: status.reward, skin };
}

/** Skins that only come from achievements, with the achievement that unlocks them. */
export const ACHIEVEMENT_SKINS: Readonly<Record<string, AchievementId>> = Object.fromEntries(
  ACHIEVEMENTS.filter((a) => a.skin).map((a) => [a.skin!, a.id]),
);
