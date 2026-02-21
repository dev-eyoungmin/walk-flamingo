import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGH_SCORE_KEY = '@walk_the_stork_high_score';

export function useHighScore() {
  const [highScore, setHighScore] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(HIGH_SCORE_KEY).then((value) => {
      if (value !== null) {
        setHighScore(parseInt(value, 10));
      }
      setLoaded(true);
    });
  }, []);

  const submitScore = useCallback(
    async (score: number) => {
      const rounded = Math.floor(score);
      if (rounded > highScore) {
        setHighScore(rounded);
        await AsyncStorage.setItem(HIGH_SCORE_KEY, String(rounded));
        return true; // new high score
      }
      return false;
    },
    [highScore],
  );

  return { highScore, submitScore, loaded };
}
