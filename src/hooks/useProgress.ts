import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameStats } from '../game/GameCanvas';
import { AchievementId, ACHIEVEMENTS, claimAchievement } from '../lib/achievements';
import { SpinKind, spinWheel, WheelPrize } from '../lib/wheel';
import {
  addCoins,
  applyRun,
  claimStreak,
  courseSeedForDay,
  emptyProgress,
  ensureDay,
  migrateProgress,
  ProgressData,
  purchaseSkin,
  purchaseUpgrade,
  RunResult,
  summarizeRunLog,
  takeFreeCoins,
  takeStarterBalloon,
} from '../lib/progress';
import type { UpgradeId } from '../lib/upgrades';

const STORAGE_KEY = '@wobby_progress_v1';

export function useProgress() {
  const [data, setData] = useState<ProgressData>(() => emptyProgress(new Date()));
  const [loaded, setLoaded] = useState(false);
  const dataRef = useRef(data);

  const commit = useCallback((next: ProgressData) => {
    dataRef.current = next;
    setData(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const now = new Date();
        // Older saves are upgraded in place (the key keeps its v1 name so nobody loses coins)
        const next = ensureDay(migrateProgress(raw ? JSON.parse(raw) : null, now), now);
        dataRef.current = next;
        setData(next);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  /** Refresh missions/today's course if the date changed while the app was open. */
  const refreshDay = useCallback(() => {
    const next = ensureDay(dataRef.current, new Date());
    if (next !== dataRef.current) commit(next);
    return next;
  }, [commit]);

  const recordRun = useCallback(
    (stats: GameStats, daily: boolean, previous: GameStats | null = null): RunResult => {
      const result = applyRun(dataRef.current, stats, { daily, now: new Date(), previous });
      commit(result.data);
      if (__DEV__) {
        const summary = summarizeRunLog(result.data.runLog);
        console.log('[Progress] run', { score: stats.score, time: stats.time, fall: stats.fallEvent }, 'recent', summary);
      }
      return result;
    },
    [commit],
  );

  const buySkin = useCallback(
    (skinId: string, price: number): boolean => {
      const next = purchaseSkin(dataRef.current, skinId, price);
      if (!next) return false;
      commit(next);
      return true;
    },
    [commit],
  );

  const buyUpgrade = useCallback(
    (id: UpgradeId): boolean => {
      const next = purchaseUpgrade(dataRef.current, id);
      if (!next) return false;
      commit(next);
      return true;
    },
    [commit],
  );

  /** Uses a starter balloon if one is left today. */
  const consumeBalloon = useCallback((): boolean => {
    const next = takeStarterBalloon(dataRef.current, new Date());
    if (!next) return false;
    commit(next);
    return true;
  }, [commit]);

  /** Claims today's daily gift (`mult` 2 after an ad); returns the coins received (0 if already claimed). */
  const claimDailyGift = useCallback((mult = 1): number => {
    const result = claimStreak(dataRef.current, new Date(), mult);
    if (!result) return 0;
    commit(result.data);
    return result.reward;
  }, [commit]);

  /** Coins from outside a run: ad bonuses, purchases. */
  const grantCoins = useCallback((amount: number) => {
    if (amount > 0) commit(addCoins(dataRef.current, amount));
  }, [commit]);

  /** Rewarded free coins (capped per day); returns false when none are left. */
  const collectFreeCoins = useCallback((): boolean => {
    const next = takeFreeCoins(dataRef.current, new Date());
    if (!next) return false;
    commit(next);
    return true;
  }, [commit]);

  const spin = useCallback(
    (kind: SpinKind, canRentSkin: boolean): { segment: number; prize: WheelPrize } | null => {
      const result = spinWheel(dataRef.current, kind, Math.random(), new Date(), canRentSkin);
      if (!result) return null;
      commit(result.data);
      return { segment: result.segment, prize: result.prize };
    },
    [commit],
  );

  /** Claim one achievement tier, or every ready tier with no id. Returns coins and unlocked skins. */
  const claimAchievements = useCallback(
    (id?: AchievementId): { coins: number; skins: string[] } => {
      let data = dataRef.current;
      let coins = 0;
      const skins: string[] = [];
      const ids = id ? [id] : ACHIEVEMENTS.map((a) => a.id);
      for (const a of ids) {
        // Claim-all takes every ready tier; a single tap takes one
        for (let r = claimAchievement(data, a); r; r = id ? null : claimAchievement(data, a)) {
          data = r.data;
          coins += r.reward;
          if (r.skin) skins.push(r.skin);
        }
      }
      if (coins > 0) commit(data);
      return { coins, skins };
    },
    [commit],
  );

  const todaySeed = courseSeedForDay(data.day);

  return {
    progress: data,
    loaded,
    recordRun,
    buySkin,
    buyUpgrade,
    consumeBalloon,
    claimDailyGift,
    grantCoins,
    collectFreeCoins,
    spin,
    claimAchievements,
    refreshDay,
    todaySeed,
  };
}
