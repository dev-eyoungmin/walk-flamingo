import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_SKIN, loadActiveSkin, unlockSkin, SkinPalette } from '../lib/skins';

interface UseSkinResult {
  activeSkin: SkinPalette;
  selectSkin: (skinId: string) => Promise<void>;
  loaded: boolean;
}

export function useSkin(): UseSkinResult {
  const [activeSkin, setActiveSkin] = useState<SkinPalette>(DEFAULT_SKIN);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadActiveSkin().then((skin) => {
      setActiveSkin(skin);
      setLoaded(true);
    });
  }, []);

  const selectSkin = useCallback(async (skinId: string): Promise<void> => {
    const skin = await unlockSkin(skinId);
    setActiveSkin(skin);
  }, []);

  return { activeSkin, selectSkin, loaded };
}
