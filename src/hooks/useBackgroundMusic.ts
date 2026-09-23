import { useCallback, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { Audio } from 'expo-av';

/**
 * Chiptune loop rendered offline by scripts/generate-music.js (edit the song there and re-run it).
 * A WAV file so the loop restarts without the gap compressed formats add.
 */
const BGM = require('../../assets/music/bgm.wav');
/** The track is mastered loud; keep it under the sound effects. */
const MUSIC_VOLUME = 0.16;

export function useBackgroundMusic() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const loadingRef = useRef<Promise<Audio.Sound | null> | null>(null);
  const wantPlayingRef = useRef(false);

  // Load the loop once, after startup work settles, so pressing PLAY never stalls
  const ensureLoaded = useCallback(() => {
    if (soundRef.current) return Promise.resolve(soundRef.current);
    if (!loadingRef.current) {
      loadingRef.current = Audio.Sound.createAsync(BGM, { shouldPlay: false, isLooping: true, volume: MUSIC_VOLUME })
        .then(({ sound }) => {
          soundRef.current = sound;
          return sound;
        })
        .catch(() => null);
    }
    return loadingRef.current;
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      ensureLoaded();
    });
    return () => {
      task.cancel();
      soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    };
  }, [ensureLoaded]);

  const startMusic = useCallback(async () => {
    wantPlayingRef.current = true;
    const sound = await ensureLoaded();
    if (!sound || !wantPlayingRef.current) return;
    try {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {
      // Music is non-critical; fail silently
    }
  }, [ensureLoaded]);

  const stopMusic = useCallback(async () => {
    wantPlayingRef.current = false;
    try {
      await soundRef.current?.pauseAsync();
    } catch {
      // fail silently
    }
  }, []);

  /** Speed the loop up for fever, back to 1 afterwards. */
  const setMusicRate = useCallback(async (rate: number) => {
    try {
      await soundRef.current?.setRateAsync(rate, true);
    } catch {
      // fail silently
    }
  }, []);

  return { startMusic, stopMusic, setMusicRate };
}
