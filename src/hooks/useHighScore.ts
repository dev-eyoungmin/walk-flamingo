import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Score became the main record in v1.2 (distance units also changed), so these are new keys.
const BEST_SCORE_KEY = '@wobby_best_score_v2';
const BEST_DISTANCE_KEY = '@wobby_best_distance_v2';

export interface RunRecord {
  score: number;
  meters: number;
}

export function useHighScore() {
  const [bestScore, setBestScore] = useState(0);
  const [bestDistance, setBestDistance] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const bestRef = useRef({ score: 0, meters: 0 });

  useEffect(() => {
    AsyncStorage.multiGet([BEST_SCORE_KEY, BEST_DISTANCE_KEY])
      .then(([[, score], [, meters]]) => {
        const s = score ? parseInt(score, 10) || 0 : 0;
        const m = meters ? parseInt(meters, 10) || 0 : 0;
        bestRef.current = { score: s, meters: m };
        setBestScore(s);
        setBestDistance(m);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  /** Saves the run and returns whether it set a new best score. */
  const submitRun = useCallback(async (run: RunRecord): Promise<boolean> => {
    const score = Math.floor(run.score);
    const meters = Math.floor(run.meters);
    const isNewScore = score > bestRef.current.score;
    const isNewDistance = meters > bestRef.current.meters;
    if (isNewScore) {
      bestRef.current.score = score;
      setBestScore(score);
    }
    if (isNewDistance) {
      bestRef.current.meters = meters;
      setBestDistance(meters);
    }
    try {
      const writes: [string, string][] = [];
      if (isNewScore) writes.push([BEST_SCORE_KEY, String(score)]);
      if (isNewDistance) writes.push([BEST_DISTANCE_KEY, String(meters)]);
      if (writes.length) await AsyncStorage.multiSet(writes);
    } catch {
      // Keep the in-memory record even if storage fails
    }
    return isNewScore;
  }, []);

  return { bestScore, bestDistance, submitRun, loaded };
}
