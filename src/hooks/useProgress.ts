import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameStats } from '../game/GameCanvas';
import {
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

  /** Claims today's daily gift; returns the coins received (0 if already claimed). */
  const claimDailyGift = useCallback((): number => {
    const result = claimStreak(dataRef.current, new Date());
    if (!result) return 0;
    commit(result.data);
    return result.reward;
  }, [commit]);

  const todaySeed = courseSeedForDay(data.day);

  return { progress: data, loaded, recordRun, buySkin, buyUpgrade, consumeBalloon, claimDailyGift, refreshDay, todaySeed };
}
