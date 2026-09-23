import {
  balloonsLeft,
  claimStreak,
  dayKey,
  emptyProgress,
  ensureDay,
  metersShortOfBest,
  migrateProgress,
  prevDayKey,
  purchaseUpgrade,
  STREAK_REWARDS,
  streakStatus,
  takeStarterBalloon,
} from './progress';
import { anyUpgradeAffordable, NO_UPGRADES, runParamsFor, upgradeCost } from './upgrades';

const day1 = new Date(2026, 8, 17, 10);
const day2 = new Date(2026, 8, 18, 9);
const day4 = new Date(2026, 8, 20, 9);

describe('saved progress migration', () => {
  it('keeps a v1 wallet, skins and missions and adds the v2 defaults', () => {
    const v1 = { ...emptyProgress(day1), version: 1, wallet: 777, lifetimeCoins: 900, ownedSkins: ['default', 'arctic'], runs: 12 } as unknown;
    delete (v1 as Record<string, unknown>).upgrades;
    delete (v1 as Record<string, unknown>).streak;
    delete (v1 as Record<string, unknown>).balloonsUsed;
    const data = migrateProgress(JSON.parse(JSON.stringify(v1)), day1);
    expect(data.version).toBe(2);
    expect(data.wallet).toBe(777);
    expect(data.ownedSkins).toEqual(['default', 'arctic']);
    expect(data.runs).toBe(12);
    expect(data.missions).toHaveLength(3);
    expect(data.upgrades).toEqual(NO_UPGRADES);
    expect(data.streak).toEqual({ lastDay: '', count: 0 });
    expect(data.balloonsUsed).toBe(0);
  });

  it('round-trips v2 and starts fresh on garbage', () => {
    const v2 = { ...emptyProgress(day1), wallet: 50, upgrades: { magnet: 2, fever: 1, luck: 0, balloon: 3 } };
    expect(migrateProgress(JSON.parse(JSON.stringify(v2)), day1)).toEqual(v2);
    expect(migrateProgress(null, day1).wallet).toBe(0);
    expect(migrateProgress('nope', day1).wallet).toBe(0);
    expect(migrateProgress({ version: 99, wallet: 5 }, day1).wallet).toBe(0);
  });
});

describe('upgrades', () => {
  it('buying deducts the cost and raises the level until max', () => {
    let data = { ...emptyProgress(day1), wallet: 10_000 };
    for (let i = 0; i < 4; i++) {
      const cost = upgradeCost('magnet', data.upgrades.magnet)!;
      const next = purchaseUpgrade(data, 'magnet')!;
      expect(next.wallet).toBe(data.wallet - cost);
      expect(next.upgrades.magnet).toBe(i + 1);
      data = next;
    }
    expect(upgradeCost('magnet', 4)).toBeNull();
    expect(purchaseUpgrade(data, 'magnet')).toBeNull();
  });

  it("can't be bought without enough coins", () => {
    const data = { ...emptyProgress(day1), wallet: 100 };
    expect(purchaseUpgrade(data, 'magnet')).toBeNull();
    expect(anyUpgradeAffordable(data.upgrades, 100)).toBe(false);
    expect(anyUpgradeAffordable(data.upgrades, 120)).toBe(true);
  });

  it('turns levels into simulation parameters', () => {
    expect(runParamsFor(NO_UPGRADES)).toEqual({ magnetTime: 8, feverDuration: 8, itemGapMult: 1 });
    expect(runParamsFor({ magnet: 4, fever: 2, luck: 3, balloon: 0 })).toEqual({ magnetTime: 16, feverDuration: 11, itemGapMult: 0.67 });
  });

  it('starter balloons are limited per day and refill tomorrow', () => {
    let data = { ...emptyProgress(day1), upgrades: { ...NO_UPGRADES, balloon: 2 } };
    expect(balloonsLeft(data)).toBe(2);
    data = takeStarterBalloon(data, day1)!;
    data = takeStarterBalloon(data, day1)!;
    expect(balloonsLeft(data)).toBe(0);
    expect(takeStarterBalloon(data, day1)).toBeNull();
    expect(balloonsLeft(ensureDay(data, day2))).toBe(2);
    expect(balloonsLeft(emptyProgress(day1))).toBe(0);
  });
});

describe('daily gift streak', () => {
  it('counts consecutive days and pays the reward once a day', () => {
    let data = emptyProgress(day1);
    expect(streakStatus(data, day1)).toMatchObject({ day: 1, canClaim: true, reward: STREAK_REWARDS[0] });
    const first = claimStreak(data, day1)!;
    expect(first.reward).toBe(STREAK_REWARDS[0]);
    expect(first.data.wallet).toBe(STREAK_REWARDS[0]);
    data = first.data;
    expect(claimStreak(data, day1)).toBeNull();
    expect(streakStatus(data, day1)).toMatchObject({ day: 1, canClaim: false, nextReward: STREAK_REWARDS[1] });

    const second = claimStreak(data, day2)!;
    expect(second.reward).toBe(STREAK_REWARDS[1]);
    expect(second.data.streak.count).toBe(2);
  });

  it('a missed day starts over, and day 7 wraps to day 1', () => {
    const claimed = claimStreak(claimStreak(emptyProgress(day1), day1)!.data, day2)!.data;
    expect(streakStatus(claimed, day4).day).toBe(1);

    let data = emptyProgress(day1);
    for (let i = 0; i < 7; i++) data = claimStreak(data, new Date(2026, 8, 17 + i, 12))!.data;
    expect(data.wallet).toBe(STREAK_REWARDS.reduce((a, b) => a + b, 0));
    expect(streakStatus(data, new Date(2026, 8, 24, 12)).day).toBe(1);
  });

  it('finds the previous day across months and daylight-saving changes', () => {
    expect(prevDayKey('2026-03-01')).toBe('2026-02-28');
    expect(prevDayKey('2026-01-01')).toBe('2025-12-31');
    // US/EU DST switches happen in late March / early November
    expect(prevDayKey('2026-03-30')).toBe('2026-03-29');
    expect(prevDayKey('2026-11-02')).toBe('2026-11-01');
    expect(prevDayKey(dayKey(day2))).toBe(dayKey(day1));
  });
});

describe('so close', () => {
  it('only counts runs just short of a meaningful best', () => {
    expect(metersShortOfBest(90, 100)).toBe(10);
    expect(metersShortOfBest(85, 100)).toBe(15);
    expect(metersShortOfBest(84, 100)).toBe(0);
    expect(metersShortOfBest(100, 100)).toBe(0);
    expect(metersShortOfBest(110, 100)).toBe(0);
    expect(metersShortOfBest(18, 19)).toBe(0);
    expect(metersShortOfBest(99.6, 100)).toBe(1);
  });
});
