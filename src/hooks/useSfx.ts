import { useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { SFX_URIS, SfxName } from '../lib/sfx';

export function useSfx() {
  const soundsRef = useRef<Map<SfxName, Audio.Sound>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function preload() {
      const entries = Object.entries(SFX_URIS) as [SfxName, string][];
      await Promise.all(
        entries.map(async ([name, uri]) => {
          try {
            const { sound } = await Audio.Sound.createAsync({ uri });
            if (!cancelled) {
              soundsRef.current.set(name, sound);
            } else {
              await sound.unloadAsync();
            }
          } catch {
            // SFX is non-critical; silently skip failed loads
          }
        }),
      );
    }

    preload();

    return () => {
      cancelled = true;
      soundsRef.current.forEach((sound) => {
        sound.unloadAsync().catch(() => undefined);
      });
      soundsRef.current.clear();
    };
  }, []);

  const play = useCallback((name: SfxName) => {
    const sound = soundsRef.current.get(name);
    if (!sound) return;
    sound
      .setPositionAsync(0)
      .then(() => sound.playAsync())
      .catch(() => undefined); // SFX is non-critical
  }, []);

  return { play };
}
