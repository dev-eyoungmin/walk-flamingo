import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_SKIN, loadActiveSkin, unlockSkin, SkinPalette } from '../lib/skins';

interface UseSkinResult {
  activeSkin: SkinPalette;
  /** Wear a skin; `permanent` for owned skins, otherwise a 24h rental */
  selectSkin: (skinId: string, permanent?: boolean) => Promise<void>;
  loaded: boolean;
}

export function useSkin(ownedSkins?: string[]): UseSkinResult {
  const [activeSkin, setActiveSkin] = useState<SkinPalette>(DEFAULT_SKIN);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadActiveSkin().then((skin) => {
      setActiveSkin(skin);
      setLoaded(true);
    });
  }, []);

  // A skin bought after it was rented should not expire
  useEffect(() => {
    if (loaded && ownedSkins?.includes(activeSkin.id) && activeSkin.id !== DEFAULT_SKIN.id) {
      unlockSkin(activeSkin.id, true).catch(() => undefined);
    }
  }, [loaded, ownedSkins, activeSkin.id]);

  const selectSkin = useCallback(async (skinId: string, permanent = false): Promise<void> => {
    const skin = await unlockSkin(skinId, permanent);
    setActiveSkin(skin);
  }, []);

  return { activeSkin, selectSkin, loaded };
}
