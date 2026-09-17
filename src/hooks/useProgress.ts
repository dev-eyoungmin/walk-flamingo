import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameStats } from '../game/GameCanvas';
import {
  applyRun,
  courseSeedForDay,
  emptyProgress,
  ensureDay,
  ProgressData,
  purchaseSkin,
  RunResult,
  summarizeRunLog,
} from '../lib/progress';

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
        const parsed: ProgressData | null = raw ? JSON.parse(raw) : null;
        const next = ensureDay(parsed?.version === 1 ? parsed : emptyProgress(now), now);
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

  const todaySeed = courseSeedForDay(data.day);

  return { progress: data, loaded, recordRun, buySkin, refreshDay, todaySeed };
}
