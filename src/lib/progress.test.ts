import type { GameStats } from '../game/GameCanvas';
import {
  applyRun,
  courseSeedForDay,
  dayKey,
  emptyProgress,
  ensureDay,
  missionsForDay,
  purchaseSkin,
  summarizeRunLog,
} from './progress';

const stats = (overrides: Partial<GameStats> = {}): GameStats => ({
  score: 1000,
  meters: 80,
  coins: 20,
  bestCombo: 3,
  nearMisses: 1,
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
  ...overrides,
});

const day1 = new Date(2026, 8, 17, 10);
const day2 = new Date(2026, 8, 18, 9);

describe('daily missions', () => {
  it('are deterministic per day, three distinct kinds with rising difficulty', () => {
    const a = missionsForDay('2026-09-17');
    const b = missionsForDay('2026-09-17');
    expect(a).toEqual(b);
    expect(new Set(a.map((m) => m.kind)).size).toBe(3);
    expect(a.map((m) => m.tier)).toEqual([0, 1, 2]);
    expect(a[2].reward).toBeGreaterThan(a[0].reward);
    expect(missionsForDay('2026-09-18')).not.toEqual(a);
  });

  it('pay out once when completed and roll over on a new day', () => {
    let data = emptyProgress(day1);
    data = {
      ...data,
      missions: [
        { id: 'x', kind: 'coins_day', tier: 0, target: 30, reward: 60, progress: 0, done: false },
        { id: 'y', kind: 'meters_run', tier: 1, target: 100, reward: 120, progress: 0, done: false },
        { id: 'z', kind: 'daily_play', tier: 2, target: 1, reward: 200, progress: 0, done: false },
      ],
    };
    const r1 = applyRun(data, stats({ coins: 20, meters: 80 }), { daily: false, now: day1 });
    expect(r1.completed).toHaveLength(0);
    expect(r1.data.wallet).toBe(20);

    const r2 = applyRun(r1.data, stats({ coins: 15, meters: 120 }), { daily: true, now: day1 });
    expect(r2.completed.map((m) => m.kind).sort()).toEqual(['coins_day', 'daily_play', 'meters_run']);
    expect(r2.missionCoins).toBe(380);
    expect(r2.data.wallet).toBe(20 + 15 + 380);

    const r3 = applyRun(r2.data, stats({ coins: 50, meters: 500 }), { daily: false, now: day1 });
    expect(r3.completed).toHaveLength(0);

    const rolled = ensureDay(r3.data, day2);
    expect(rolled.day).toBe(dayKey(day2));
    expect(rolled.missions.every((m) => !m.done)).toBe(true);
    expect(rolled.wallet).toBe(r3.data.wallet);
  });
});

describe("today's course", () => {
  it('uses the same seed for everyone on a day and tracks the best score', () => {
    expect(courseSeedForDay('2026-09-17')).toBe(courseSeedForDay('2026-09-17'));
    expect(courseSeedForDay('2026-09-17')).not.toBe(courseSeedForDay('2026-09-18'));

    let data = emptyProgress(day1);
    const r1 = applyRun(data, stats({ score: 900 }), { daily: true, now: day1 });
    expect(r1.newDailyBest).toBe(true);
    const r2 = applyRun(r1.data, stats({ score: 700 }), { daily: true, now: day1 });
    expect(r2.newDailyBest).toBe(false);
    data = r2.data;
    expect(data.daily.best).toBe(900);
    expect(data.daily.top).toEqual([900, 700]);
    expect(data.daily.attempts).toBe(2);
  });
});

describe('continued runs', () => {
  it('only add what was earned after the continue', () => {
    let data = emptyProgress(day1);
    data = {
      ...data,
      missions: [
        { id: 'a', kind: 'coins_day', tier: 0, target: 100, reward: 60, progress: 0, done: false },
        { id: 'b', kind: 'runs_day', tier: 1, target: 5, reward: 120, progress: 0, done: false },
        { id: 'c', kind: 'meters_run', tier: 2, target: 300, reward: 200, progress: 0, done: false },
      ],
    };
    const first = stats({ score: 800, coins: 20, meters: 90 });
    const r1 = applyRun(data, first, { daily: true, now: day1 });
    const second = stats({ score: 1500, coins: 32, meters: 170 });
    const r2 = applyRun(r1.data, second, { daily: true, now: day1, previous: first });
    expect(r2.coinsEarned).toBe(12);
    expect(r2.data.wallet).toBe(32);
    expect(r2.data.runs).toBe(1);
    expect(r2.data.runLog).toHaveLength(1);
    expect(r2.data.missions.map((m) => m.progress)).toEqual([32, 1, 170]);
    expect(r2.data.daily.top).toEqual([1500]);
    expect(r2.data.daily.attempts).toBe(1);
  });
});

describe('wallet and skins', () => {
  it('buys a skin only when affordable and not owned', () => {
    const data = { ...emptyProgress(day1), wallet: 500 };
    expect(purchaseSkin(data, 'golden', 600)).toBeNull();
    const bought = purchaseSkin(data, 'arctic', 300);
    expect(bought?.wallet).toBe(200);
    expect(bought?.ownedSkins).toContain('arctic');
    expect(purchaseSkin(bought!, 'arctic', 300)).toBeNull();
  });
});

describe('run log', () => {
  it('keeps the latest runs and summarizes what ends them', () => {
    let data = emptyProgress(day1);
    for (let i = 0; i < 45; i++) {
      data = applyRun(data, stats({ time: i, fallAfterHit: i % 3 === 0, fallEvent: i % 3 === 1 ? 10 : -1 }), {
        daily: false,
        now: day1,
      }).data;
    }
    expect(data.runLog).toHaveLength(40);
    const summary = summarizeRunLog(data.runLog);
    expect(summary.runs).toBe(40);
    expect(summary.causes[0].count).toBeGreaterThan(0);
  });
});
