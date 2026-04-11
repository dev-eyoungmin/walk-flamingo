import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@flamingo_walk_first_played';

export function useFirstPlay() {
  const [isFirstPlay, setIsFirstPlay] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      setIsFirstPlay(value !== 'true');
      setLoaded(true);
    });
  }, []);

  const consumeFirstPlay = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setIsFirstPlay(false);
  }, []);

  return { isFirstPlay, consumeFirstPlay, loaded };
}
