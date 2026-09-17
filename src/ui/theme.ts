/** Shared UI tokens so the menus match the in-game HUD. */
export const FONT_DISPLAY = 'LilitaOne';

export const UI = {
  ink: '#2B1630',
  panel: 'rgba(35,20,48,0.94)',
  panelBorder: '#FF7AA8',
  scrim: 'rgba(20,10,30,0.55)',
  pink: '#FF6F9C',
  pinkDark: '#C9446F',
  gold: '#FFC93C',
  goldDark: '#C98F14',
  mint: '#5EE6C9',
  mintDark: '#2FA78C',
  sky: '#7FDBFF',
  skyDark: '#3E9CC4',
  purple: '#9B6BFF',
  purpleDark: '#6B3FD0',
  slate: '#5E6A8A',
  slateDark: '#3F4863',
  text: '#FFFFFF',
  textDim: 'rgba(255,255,255,0.72)',
  textFaint: 'rgba(255,255,255,0.45)',
} as const;

/** Chunky outlined text shadow used for titles */
export const titleShadow = {
  textShadowColor: UI.ink,
  textShadowOffset: { width: 0, height: 3 },
  textShadowRadius: 0,
} as const;
