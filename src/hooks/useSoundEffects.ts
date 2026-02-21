import { useCallback, useEffect, useRef } from 'react';
import { Audio, AVPlaybackSource } from 'expo-av';

type SoundName = 'footstep' | 'wind' | 'fall' | 'button';

// We'll use programmatic sound generation since we don't have asset files
// For production, replace with actual sound assets
const SOUND_ENABLED = false; // Set true when sound assets are added

export function useSoundEffects() {
  const sounds = useRef<Map<SoundName, Audio.Sound>>(new Map());

  useEffect(() => {
    // Configure audio mode for game
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    return () => {
      // Unload all sounds on cleanup
      sounds.current.forEach((sound) => {
        sound.unloadAsync();
      });
    };
  }, []);

  const play = useCallback(async (name: SoundName) => {
    if (!SOUND_ENABLED) return;
    try {
      const sound = sounds.current.get(name);
      if (sound) {
        await sound.replayAsync();
      }
    } catch {
      // Silently fail - sound is non-critical
    }
  }, []);

  return { play };
}
