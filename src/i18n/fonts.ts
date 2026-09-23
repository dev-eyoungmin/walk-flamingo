import { fontKey, FontKey } from './index';

/** Display font per script. Non-Latin fonts are subsets built by scripts/subset-fonts.py. */
const FONTS: Record<FontKey, { family: string; source: number }> = {
  latin: { family: 'LilitaOne', source: require('../../assets/fonts/LilitaOne-Regular.ttf') },
  round: { family: 'WobbyRound', source: require('../../assets/fonts/WobbyRound.ttf') },
  ja: { family: 'WobbyJA', source: require('../../assets/fonts/WobbyJA.ttf') },
  sc: { family: 'WobbySC', source: require('../../assets/fonts/WobbySC.ttf') },
  tc: { family: 'WobbyTC', source: require('../../assets/fonts/WobbyTC.ttf') },
  th: { family: 'WobbyThai', source: require('../../assets/fonts/WobbyThai.ttf') },
};

/** Font family for menus (registered with expo-font at startup). */
export const DISPLAY_FAMILY = FONTS[fontKey].family;
/** Font file for the Skia HUD, which draws with a single typeface and has no fallback. */
export const DISPLAY_SOURCE = FONTS[fontKey].source;
