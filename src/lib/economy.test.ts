import type { GameStats } from '../game/GameCanvas';
import {
  addCoins,
  applyRun,
  balloonsLeft,
  claimStreak,
  doubleCoinsAmount,
  DOUBLE_COINS_MIN,
  emptyProgress,
  ensureDay,
  FREE_COINS,
  freeCoinsLeft,
  migrateProgress,
  takeFreeCoins,
  takeStarterBalloon,
} from './progress';
import { adSpinsLeft, nextSpin, pickSegment, SKIN_FALLBACK_COINS, SPINS, spinWheel, WHEEL } from './wheel';
import { achievementDef, ACHIEVEMENT_SKINS, allAchievements, claimableCount, claimAchievement } from './achievements';
import { COIN_PACKS, coinsForProduct, isConsumable, REMOVE_ADS_ID } from './shop';
import { SKIN_PRICES, SKINS } from './skins';

const stats = (o: Partial<GameStats> = {}): GameStats => ({
  score: 1000,
  meters: 120,
  coins: 20,
  bestCombo: 3,
  nearMisses: 2,
  clutches: 1,
  dodges: 3,
  challenges: 2,
  fevers: 1,
  items: 2,
  flaps: 4,
  chicksMax: 1,
  time: 60,
  zones: 0,
  fallEvent: -1,
  fallWeather: 0,
  fallBiome: 0,
  fallAfterHit: false,
  perfects: 2,
  golds: 1,
  rescued: 1,
  ...o,
});

const day1 = new Date(2026, 9, 16, 10);
const day2 = new Date(2026, 9, 17, 10);

describe('saved progress v3', () => {
  it('keeps v2 saves and fills the new fields', () => {
    const v2 = { ...emptyProgress(day1), version: 2, wallet: 500, runLog: [{ meters: 240 }, { meters: 90 }] } as Record<string, unknown>;
    delete v2.totals;
    delete v2.today;
    const data = migrateProgress(v2, day1);
    expect(data.version).toBe(3);
    expect(data.wallet).toBe(500);
    expect(data.totals.bestMeters).toBe(240);
    expect(data.today).toEqual({ freeSpinUsed: false, adSpins: 0, adCoins: 0, giftDoubled: false });
    expect(data.bonusBalloons).toBe(0);
  });

  it('adds run totals once, even across a continue', () => {
    const first = applyRun(emptyProgress(day1), stats(), { daily: true, now: day1 });
    expect(first.data.totals).toMatchObject({ meters: 120, bestMeters: 120, saves: 2, clutches: 1, dailyRuns: 1, perfects: 2 });
    const cont = applyRun(first.data, stats({ meters: 200, nearMisses: 5, clutches: 1 }), { daily: true, now: day1, previous: stats() });
    expect(cont.data.totals).toMatchObject({ meters: 200, bestMeters: 200, saves: 5, clutches: 1, dailyRuns: 1 });
  });

  it('daily counters reset with the day', () => {
    const used = { ...emptyProgress(day1), today: { freeSpinUsed: true, adSpins: 3, adCoins: 3, giftDoubled: true } };
    expect(ensureDay(used, day2).today).toEqual({ freeSpinUsed: false, adSpins: 0, adCoins: 0, giftDoubled: false });
  });
});

describe('coin bonuses', () => {
  it('free coins are capped per day', () => {
    let data = emptyProgress(day1);
    for (let i = 0; i < FREE_COINS.PER_DAY; i++) data = takeFreeCoins(data, day1)!;
    expect(data.wallet).toBe(FREE_COINS.AMOUNT * FREE_COINS.PER_DAY);
    expect(freeCoinsLeft(data)).toBe(0);
    expect(takeFreeCoins(data, day1)).toBeNull();
    expect(takeFreeCoins(data, day2)).not.toBeNull();
  });

  it('the game-over bonus repeats the run coins, with a floor', () => {
    expect(doubleCoinsAmount(64)).toBe(64);
    expect(doubleCoinsAmount(3)).toBe(DOUBLE_COINS_MIN);
  });

  it('the daily gift can be doubled and remembers the best streak', () => {
    const r = claimStreak(emptyProgress(day1), day1, 2)!;
    expect(r.reward).toBe(40);
    expect(r.data.wallet).toBe(40);
    expect(r.data.today.giftDoubled).toBe(true);
    expect(r.data.bestStreak).toBe(1);
    expect(claimStreak(r.data, day1, 2)).toBeNull();
    expect(claimStreak(r.data, day2)!.data.bestStreak).toBe(2);
  });

  it('won balloons are used after the daily starter balloons', () => {
    let data = { ...emptyProgress(day1), bonusBalloons: 1, upgrades: { magnet: 0, fever: 0, luck: 0, balloon: 1 } };
    expect(balloonsLeft(data)).toBe(2);
    data = takeStarterBalloon(data, day1)!;
    expect(data.balloonsUsed).toBe(1);
    expect(data.bonusBalloons).toBe(1);
    data = takeStarterBalloon(data, day1)!;
    expect(data.bonusBalloons).toBe(0);
    expect(takeStarterBalloon(data, day1)).toBeNull();
  });
});

describe('lucky wheel', () => {
  it('picks segments by weight', () => {
    const counts = WHEEL.map(() => 0);
    for (let i = 0; i < 10000; i++) counts[pickSegment(i / 10000)]++;
    const total = WHEEL.reduce((n, s) => n + s.weight, 0);
    WHEEL.forEach((s, i) => expect(Math.abs(counts[i] / 10000 - s.weight / total)).toBeLessThan(0.002));
    expect(pickSegment(0.9999999)).toBe(WHEEL.length - 1);
  });

  it('one free spin, then a few ad spins a day', () => {
    let data = emptyProgress(day1);
    expect(nextSpin(data)).toBe('free');
    expect(spinWheel(data, 'ad', 0, day1, true)).toBeNull();
    data = spinWheel(data, 'free', 0, day1, true)!.data;
    for (let i = 0; i < SPINS.AD_PER_DAY; i++) {
      expect(nextSpin(data)).toBe('ad');
      data = spinWheel(data, 'ad', 0.5, day1, true)!.data;
    }
    expect(nextSpin(data)).toBeNull();
    expect(adSpinsLeft(data)).toBe(0);
    expect(nextSpin(ensureDay(data, day2))).toBe('free');
  });

  it('pays coins and balloons, and coins instead of a skin when every skin is owned', () => {
    const at = (i: number) => {
      const total = WHEEL.reduce((n, s) => n + s.weight, 0);
      const before = WHEEL.slice(0, i).reduce((n, s) => n + s.weight, 0);
      return (before + WHEEL[i].weight / 2) / total;
    };
    const coinSeg = WHEEL.findIndex((s) => s.prize.kind === 'coins');
    const r = spinWheel(emptyProgress(day1), 'free', at(coinSeg), day1, true)!;
    expect(r.data.wallet).toBe((WHEEL[coinSeg].prize as { amount: number }).amount);

    const balloon = spinWheel(emptyProgress(day1), 'free', at(WHEEL.findIndex((s) => s.prize.kind === 'balloon')), day1, true)!;
    expect(balloon.data.bonusBalloons).toBe(1);

    const skin = WHEEL.findIndex((s) => s.prize.kind === 'skin');
    expect(spinWheel(emptyProgress(day1), 'free', at(skin), day1, true)!.prize.kind).toBe('skin');
    const fallback = spinWheel(emptyProgress(day1), 'free', at(skin), day1, false)!;
    expect(fallback.prize).toEqual({ kind: 'coins', amount: SKIN_FALLBACK_COINS });
    expect(fallback.data.wallet).toBe(SKIN_FALLBACK_COINS);
  });
});

describe('achievements', () => {
  it('tiers are claimed one at a time for coins', () => {
    const data = { ...emptyProgress(day1), totals: { ...emptyProgress(day1).totals, saves: 60 } };
    expect(claimableCount(data)).toBe(2);
    const one = claimAchievement(data, 'saver')!;
    expect(one.reward).toBe(80);
    expect(one.data.wallet).toBe(80);
    const two = claimAchievement(one.data, 'saver')!;
    expect(two.reward).toBe(200);
    expect(claimAchievement(two.data, 'saver')).toBeNull();
    expect(claimableCount(two.data)).toBe(0);
  });

  it('the last tier of a skin achievement unlocks a skin that is not for sale', () => {
    const def = achievementDef('runner');
    let data = { ...emptyProgress(day1), totals: { ...emptyProgress(day1).totals, bestMeters: 9999 } };
    let skin: string | null = null;
    for (let i = 0; i < def.targets.length; i++) {
      const r = claimAchievement(data, 'runner')!;
      data = r.data;
      skin = r.skin;
    }
    expect(skin).toBe('neon');
    expect(data.ownedSkins).toContain('neon');
    expect(SKIN_PRICES.neon).toBeUndefined();
    expect(ACHIEVEMENT_SKINS.neon).toBe('runner');
  });

  it('every achievement has rising targets, a reward per tier and existing skins', () => {
    const data = emptyProgress(day1);
    for (const a of allAchievements(data)) {
      expect(a.def.rewards).toHaveLength(a.def.targets.length);
      a.def.targets.forEach((t, i) => i > 0 && expect(t).toBeGreaterThan(a.def.targets[i - 1]));
      if (a.def.skin) expect(SKINS.some((s) => s.id === a.def.skin)).toBe(true);
      expect(a.claimable).toBe(false);
    }
  });

  it('coins from outside a run count as lifetime coins', () => {
    expect(addCoins(emptyProgress(day1), 25).lifetimeCoins).toBe(25);
  });
});

describe('store catalog', () => {
  it('coin packs are consumable and Remove Ads is not', () => {
    expect(isConsumable(REMOVE_ADS_ID)).toBe(false);
    for (const p of COIN_PACKS) {
      expect(isConsumable(p.id)).toBe(true);
      expect(coinsForProduct(p.id)).toBe(p.coins);
    }
    expect(coinsForProduct('unknown')).toBe(0);
  });
});
