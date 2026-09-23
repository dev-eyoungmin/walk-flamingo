/**
 * Persistent player progress: coin wallet, owned skins, daily missions, today's course record and
 * a small local run log for tuning. Pure functions only — storage lives in useProgress.
 */
import type { GameStats } from '../game/GameCanvas';
import { t, TKey } from '../i18n';
import { BEST } from '../game/sim/constants';
import { NO_UPGRADES, upgradeCost, UpgradeId, UpgradeLevels, upgradeValue } from './upgrades';

export type MissionKind =
  | 'coins_run'
  | 'coins_day'
  | 'meters_run'
  | 'dodges_run'
  | 'fever_run'
  | 'survive_run'
  | 'challenges_run'
  | 'runs_day'
  | 'flaps_day'
  | 'chicks_run'
  | 'zone_run'
  | 'daily_play'
  | 'items_run';

export interface Mission {
  id: string;
  kind: MissionKind;
  tier: 0 | 1 | 2;
  target: number;
  reward: number;
  progress: number;
  done: boolean;
}

export interface RunLogEntry {
  at: number;
  daily: boolean;
  score: number;
  meters: number;
  time: number;
  coins: number;
  fallEvent: number;
  fallWeather: number;
  fallBiome: number;
  fallAfterHit: boolean;
  fevers: number;
  flaps: number;
  items: number;
  chicksMax: number;
}

export interface DailyRecord {
  day: string;
  best: number;
  bestMeters: number;
  attempts: number;
  /** Best scores of today's course on this device, highest first */
  top: number[];
}

export interface StreakRecord {
  /** Day of the last claimed gift ('' = never) */
  lastDay: string;
  /** Consecutive days claimed, as of lastDay */
  count: number;
}

export interface ProgressData {
  version: 2;
  wallet: number;
  lifetimeCoins: number;
  ownedSkins: string[];
  runs: number;
  day: string;
  missions: Mission[];
  daily: DailyRecord;
  runLog: RunLogEntry[];
  /** Added in v2 */
  upgrades: UpgradeLevels;
  /** Starter balloons used today (reset daily) */
  balloonsUsed: number;
  streak: StreakRecord;
}

/** Daily gift coins for days 1..7 of a streak (then it starts over). */
export const STREAK_REWARDS: readonly number[] = [20, 30, 40, 60, 80, 100, 200];

export const MISSION_REWARDS = [60, 120, 200] as const;
const RUN_LOG_MAX = 40;
const DAILY_TOP_MAX = 5;

interface Template {
  kind: MissionKind;
  targets: readonly [number, number, number];
  perRun: boolean;
}

const TEMPLATES: readonly Template[] = [
  { kind: 'coins_run', targets: [15, 35, 70], perRun: true },
  { kind: 'coins_day', targets: [60, 150, 300], perRun: false },
  { kind: 'meters_run', targets: [60, 150, 300], perRun: true },
  { kind: 'dodges_run', targets: [2, 5, 10], perRun: true },
  { kind: 'fever_run', targets: [1, 1, 2], perRun: true },
  { kind: 'survive_run', targets: [45, 90, 150], perRun: true },
  { kind: 'challenges_run', targets: [2, 4, 7], perRun: true },
  { kind: 'runs_day', targets: [3, 5, 8], perRun: false },
  { kind: 'flaps_day', targets: [3, 8, 15], perRun: false },
  { kind: 'chicks_run', targets: [1, 2, 3], perRun: true },
  { kind: 'zone_run', targets: [1, 2, 3], perRun: true },
  { kind: 'daily_play', targets: [1, 1, 1], perRun: false },
  { kind: 'items_run', targets: [1, 2, 4], perRun: true },
];

export function missionLabel(m: Pick<Mission, 'kind' | 'target'>): string {
  const n = m.target;
  switch (m.kind) {
    case 'fever_run':
      return n > 1 ? t('mission.fever_run', { n }) : t('mission.fever_one');
    case 'chicks_run':
      return n > 1 ? t('mission.chicks_run', { n }) : t('mission.chicks_one');
    case 'items_run':
      return n > 1 ? t('mission.items_run', { n }) : t('mission.items_one');
    case 'zone_run':
      return t('mission.zone_run', { zone: t(`biome.${Math.min(n, 3)}` as TKey) });
    default:
      return t(`mission.${m.kind}` as TKey, { n });
  }
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Deterministic course seed shared by everyone on the same day. */
export function courseSeedForDay(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Three missions for a day: one easy, one medium, one hard, all different kinds. */
export function missionsForDay(day: string): Mission[] {
  const rand = seeded(courseSeedForDay(day) ^ 0x5bd1e995);
  const pool = [...TEMPLATES];
  const out: Mission[] = [];
  for (let tier = 0 as 0 | 1 | 2; out.length < 3; tier = (tier + 1) as 0 | 1 | 2) {
    const idx = Math.floor(rand() * pool.length);
    const t = pool.splice(idx, 1)[0];
    out.push({
      id: `${day}:${t.kind}:${tier}`,
      kind: t.kind,
      tier,
      target: t.targets[tier],
      reward: MISSION_REWARDS[tier],
      progress: 0,
      done: false,
    });
  }
  return out;
}

export function emptyProgress(now: Date): ProgressData {
  const day = dayKey(now);
  return {
    version: 2,
    wallet: 0,
    lifetimeCoins: 0,
    ownedSkins: ['default'],
    runs: 0,
    day,
    missions: missionsForDay(day),
    daily: { day, best: 0, bestMeters: 0, attempts: 0, top: [] },
    runLog: [],
    upgrades: { ...NO_UPGRADES },
    balloonsUsed: 0,
    streak: { lastDay: '', count: 0 },
  };
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Load saved progress from any version. v1 saves keep their wallet, skins, missions and today's
 * record and get the v2 defaults; anything unreadable starts fresh.
 */
export function migrateProgress(raw: unknown, now: Date): ProgressData {
  const fresh = emptyProgress(now);
  if (!raw || typeof raw !== 'object') return fresh;
  const d = raw as Partial<Omit<ProgressData, 'version'>> & { version?: number };
  if (d.version !== 1 && d.version !== 2) return fresh;
  const up = (d.upgrades ?? {}) as Partial<UpgradeLevels>;
  return {
    ...fresh,
    ...d,
    version: 2,
    wallet: num(d.wallet, 0),
    lifetimeCoins: num(d.lifetimeCoins, 0),
    ownedSkins: Array.isArray(d.ownedSkins) ? d.ownedSkins : fresh.ownedSkins,
    runs: num(d.runs, 0),
    missions: Array.isArray(d.missions) ? d.missions : fresh.missions,
    daily: d.daily && typeof d.daily === 'object' ? d.daily : fresh.daily,
    runLog: Array.isArray(d.runLog) ? d.runLog : [],
    upgrades: {
      magnet: num(up.magnet, 0),
      fever: num(up.fever, 0),
      luck: num(up.luck, 0),
      balloon: num(up.balloon, 0),
    },
    balloonsUsed: num(d.balloonsUsed, 0),
    streak:
      d.streak && typeof d.streak.lastDay === 'string'
        ? { lastDay: d.streak.lastDay, count: num(d.streak.count, 0) }
        : fresh.streak,
  };
}

/** Roll missions and today's course record over to a new day if needed. */
export function ensureDay(data: ProgressData, now: Date): ProgressData {
  const day = dayKey(now);
  if (data.day === day) return data;
  return {
    ...data,
    day,
    missions: missionsForDay(day),
    daily: { day, best: 0, bestMeters: 0, attempts: 0, top: [] },
    balloonsUsed: 0,
  };
}

function runValue(kind: MissionKind, stats: GameStats, daily: boolean): number {
  switch (kind) {
    case 'coins_run':
    case 'coins_day':
      return stats.coins;
    case 'meters_run':
      return stats.meters;
    case 'dodges_run':
      return stats.dodges;
    case 'fever_run':
      return stats.fevers;
    case 'survive_run':
      return stats.time;
    case 'challenges_run':
      return stats.challenges;
    case 'runs_day':
      return 1;
    case 'flaps_day':
      return stats.flaps;
    case 'chicks_run':
      return stats.chicksMax;
    case 'zone_run':
      return stats.zones;
    case 'daily_play':
      return daily ? 1 : 0;
    case 'items_run':
      return stats.items;
  }
}

export interface RunResult {
  data: ProgressData;
  coinsEarned: number;
  completed: Mission[];
  missionCoins: number;
  newDailyBest: boolean;
}

/**
 * Apply a finished run: wallet, missions (rewards are paid automatically), today's course, log.
 * `previous` is the already-recorded result of the same run before a continue; stats are cumulative,
 * so only the difference is added and the run isn't counted twice.
 */
export function applyRun(
  input: ProgressData,
  stats: GameStats,
  opts: { daily: boolean; now: Date; previous?: GameStats | null },
): RunResult {
  const data = ensureDay(input, opts.now);
  const prev = opts.previous ?? null;
  const completed: Mission[] = [];
  let missionCoins = 0;

  const missions = data.missions.map((m) => {
    if (m.done) return m;
    const template = TEMPLATES.find((t) => t.kind === m.kind);
    const value = runValue(m.kind, stats, opts.daily);
    const added = prev ? Math.max(0, value - runValue(m.kind, prev, opts.daily)) : value;
    const progress = template?.perRun ? Math.max(m.progress, value) : m.progress + added;
    const done = progress >= m.target;
    const next = { ...m, progress: Math.min(progress, m.target), done };
    if (done) {
      completed.push(next);
      missionCoins += m.reward;
    }
    return next;
  });

  let daily = data.daily;
  let newDailyBest = false;
  if (opts.daily) {
    newDailyBest = stats.score > daily.best;
    const earlier = [...daily.top];
    const replaced = prev ? earlier.indexOf(prev.score) : -1;
    if (replaced >= 0) earlier.splice(replaced, 1);
    const top = [...earlier, stats.score].sort((a, b) => b - a).slice(0, DAILY_TOP_MAX);
    daily = {
      ...daily,
      attempts: daily.attempts + (prev ? 0 : 1),
      best: Math.max(daily.best, stats.score),
      bestMeters: Math.max(daily.bestMeters, stats.meters),
      top,
    };
  }

  const entry: RunLogEntry = {
    at: opts.now.getTime(),
    daily: opts.daily,
    score: stats.score,
    meters: stats.meters,
    time: stats.time,
    coins: stats.coins,
    fallEvent: stats.fallEvent,
    fallWeather: stats.fallWeather,
    fallBiome: stats.fallBiome,
    fallAfterHit: stats.fallAfterHit,
    fevers: stats.fevers,
    flaps: stats.flaps,
    items: stats.items,
    chicksMax: stats.chicksMax,
  };

  const coinsEarned = Math.max(0, stats.coins - (prev?.coins ?? 0));
  const log = prev && data.runLog.length > 0 ? data.runLog.slice(0, -1) : data.runLog;
  return {
    data: {
      ...data,
      wallet: data.wallet + coinsEarned + missionCoins,
      lifetimeCoins: data.lifetimeCoins + coinsEarned + missionCoins,
      runs: data.runs + (prev ? 0 : 1),
      missions,
      daily,
      runLog: [...log, entry].slice(-RUN_LOG_MAX),
    },
    coinsEarned,
    completed,
    missionCoins,
    newDailyBest,
  };
}

/** Spend coins on a skin. Returns null when it's already owned or the player can't afford it. */
export function purchaseSkin(data: ProgressData, skinId: string, price: number): ProgressData | null {
  if (data.ownedSkins.includes(skinId) || data.wallet < price) return null;
  return { ...data, wallet: data.wallet - price, ownedSkins: [...data.ownedSkins, skinId] };
}

/** What tends to end runs, for tuning: fall causes sorted by frequency. */
export function summarizeRunLog(log: RunLogEntry[]): {
  runs: number;
  medianTime: number;
  causes: { cause: string; count: number }[];
} {
  if (log.length === 0) return { runs: 0, medianTime: 0, causes: [] };
  const times = log.map((r) => r.time).sort((a, b) => a - b);
  const counts = new Map<string, number>();
  for (const r of log) {
    const cause = r.fallAfterHit ? 'hit' : r.fallEvent >= 0 ? `event:${r.fallEvent}` : r.fallWeather > 0 ? `weather:${r.fallWeather}` : 'balance';
    counts.set(cause, (counts.get(cause) ?? 0) + 1);
  }
  return {
    runs: log.length,
    medianTime: times[Math.floor(times.length / 2)],
    causes: [...counts.entries()].map(([cause, count]) => ({ cause, count })).sort((a, b) => b.count - a.count),
  };
}

/** Spend coins on the next level of an upgrade. Returns null when maxed or unaffordable. */
export function purchaseUpgrade(data: ProgressData, id: UpgradeId): ProgressData | null {
  const level = data.upgrades[id] ?? 0;
  const cost = upgradeCost(id, level);
  if (cost === null || data.wallet < cost) return null;
  return { ...data, wallet: data.wallet - cost, upgrades: { ...data.upgrades, [id]: level + 1 } };
}

/** Starter balloons left today from the balloon upgrade. */
export function balloonsLeft(data: ProgressData): number {
  return Math.max(0, upgradeValue('balloon', data.upgrades.balloon) - data.balloonsUsed);
}

/** Use one starter balloon. Returns null when none are left today. */
export function takeStarterBalloon(data: ProgressData, now: Date): ProgressData | null {
  const current = ensureDay(data, now);
  if (balloonsLeft(current) <= 0) return null;
  return { ...current, balloonsUsed: current.balloonsUsed + 1 };
}

/** The calendar day before a YYYY-MM-DD key (built from the date parts, so DST shifts don't matter). */
export function prevDayKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

export interface StreakStatus {
  /** Streak day (1..7) that is claimable today, or was claimed today */
  day: number;
  reward: number;
  canClaim: boolean;
  /** Reward for tomorrow if the streak continues */
  nextReward: number;
}

export function streakStatus(data: ProgressData, now: Date): StreakStatus {
  const today = dayKey(now);
  const { lastDay, count } = data.streak;
  const n = STREAK_REWARDS.length;
  if (lastDay === today) {
    const day = ((Math.max(1, count) - 1) % n) + 1;
    return { day, reward: STREAK_REWARDS[day - 1], canClaim: false, nextReward: STREAK_REWARDS[day % n] };
  }
  const continues = lastDay !== '' && lastDay === prevDayKey(today);
  const day = continues ? (count % n) + 1 : 1;
  return { day, reward: STREAK_REWARDS[day - 1], canClaim: true, nextReward: STREAK_REWARDS[day % n] };
}

/** Claim today's gift. Returns null when it was already claimed today. */
export function claimStreak(data: ProgressData, now: Date): { data: ProgressData; reward: number } | null {
  const status = streakStatus(data, now);
  if (!status.canClaim) return null;
  const continues = data.streak.lastDay !== '' && data.streak.lastDay === prevDayKey(dayKey(now));
  return {
    reward: status.reward,
    data: {
      ...data,
      wallet: data.wallet + status.reward,
      lifetimeCoins: data.lifetimeCoins + status.reward,
      streak: { lastDay: dayKey(now), count: continues ? data.streak.count + 1 : 1 },
    },
  };
}

/**
 * "So close" check for the game-over screen: the run ended short of a meaningful best, but within
 * CLOSE_RATIO of it. Returns the meters missing, or 0 when it doesn't apply.
 */
export function metersShortOfBest(meters: number, best: number): number {
  if (best < BEST.MIN_M || meters >= best || meters < best * BEST.CLOSE_RATIO) return 0;
  return Math.max(1, Math.ceil(best - meters));
}
