import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@walk_the_stork_free_play_date';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useDailyFreePlay() {
  const [freePlayUsed, setFreePlayUsed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      setFreePlayUsed(value === todayKey());
      setLoaded(true);
    });
  }, []);

  /** Mark today's free play as consumed. */
  const consumeFreePlay = useCallback(async () => {
    const key = todayKey();
    await AsyncStorage.setItem(STORAGE_KEY, key);
    setFreePlayUsed(true);
  }, []);

  /** True when the user still has a free game today. */
  const isFreePlay = __DEV__ || (loaded && !freePlayUsed);

  return { isFreePlay, consumeFreePlay, loaded };
}
