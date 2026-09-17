import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SkinPalette {
  id: string;
  name: string;
  body: string;
  bodyLight: string;
  legs: string;
  legsDark: string;
  wing: string;
  neck: string;
  cheek: string;
  /** Signature accessory drawn on the character */
  accessory?: SkinAccessory;
}

export type SkinAccessory = 'crown' | 'scarf' | 'shades' | 'flower' | 'bow';

export const SKINS: SkinPalette[] = [
  { id: 'default',  name: 'Pink',     body: '#FF7A9A', bodyLight: '#FFA0B8', legs: '#E86A6A', legsDark: '#D05A5A', wing: '#E8658A', neck: '#FF7A9A', cheek: '#FF5070' },
  { id: 'golden',   name: 'Golden',   body: '#FFD700', bodyLight: '#FFE44D', legs: '#DAA520', legsDark: '#B8860B', wing: '#FFC107', neck: '#FFD700', cheek: '#FFB300', accessory: 'crown' },
  { id: 'arctic',   name: 'Arctic',   body: '#B3E5FC', bodyLight: '#E1F5FE', legs: '#81D4FA', legsDark: '#4FC3F7', wing: '#4FC3F7', neck: '#B3E5FC', cheek: '#29B6F6', accessory: 'scarf' },
  { id: 'midnight', name: 'Midnight', body: '#7C4DFF', bodyLight: '#B388FF', legs: '#6200EA', legsDark: '#4A148C', wing: '#B388FF', neck: '#7C4DFF', cheek: '#651FFF', accessory: 'shades' },
  { id: 'sunset',   name: 'Sunset',   body: '#FF6D00', bodyLight: '#FF9E40', legs: '#E65100', legsDark: '#BF360C', wing: '#FF9E40', neck: '#FF6D00', cheek: '#FF3D00', accessory: 'flower' },
  { id: 'cherry',   name: 'Cherry',   body: '#FF1744', bodyLight: '#FF5252', legs: '#D50000', legsDark: '#B71C1C', wing: '#FF5252', neck: '#FF1744', cheek: '#FF0000', accessory: 'bow' },
];

export const DEFAULT_SKIN = SKINS[0];

const STORAGE_KEY = '@flamingo_walk_active_skin';

interface StoredSkin {
  id: string;
  expiresAt: number;
}

export async function loadActiveSkin(): Promise<SkinPalette> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SKIN;

    const stored: StoredSkin = JSON.parse(raw);

    if (Date.now() > stored.expiresAt) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return DEFAULT_SKIN;
    }

    const found = SKINS.find((s) => s.id === stored.id);
    return found ?? DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

/** Coin price to own a skin forever (the default skin is free) */
export const SKIN_PRICES: Record<string, number> = {
  default: 0,
  arctic: 300,
  sunset: 350,
  cherry: 400,
  midnight: 450,
  golden: 600,
};

/** Wear a skin: rented for 24 hours (ad), or permanently when owned. */
export async function unlockSkin(skinId: string, permanent = false): Promise<SkinPalette> {
  const found = SKINS.find((s) => s.id === skinId) ?? DEFAULT_SKIN;

  const stored: StoredSkin = {
    id: found.id,
    expiresAt: permanent ? Number.MAX_SAFE_INTEGER : Date.now() + 24 * 60 * 60 * 1000,
  };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return found;
}
