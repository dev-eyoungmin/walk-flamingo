import type { PhysicsConstants } from './types';

/** Core physics tuning constants */
export const PHYSICS: PhysicsConstants = {
  /** Base gravity torque in rad/s^2 */
  gravityTorque: 2.5,
  /** Player input torque in rad/s^2 */
  playerTorque: 6.0,
  /** Base angular velocity damping per frame */
  baseDamping: 0.92,
  /** Game over angle in radians (60 degrees) */
  gameOverAngle: (60 * Math.PI) / 180,
  /** Warning angle in radians (45 degrees) */
  warningAngle: (45 * Math.PI) / 180,
  /** Base walk speed in pixels/second */
  baseWalkSpeed: 80,
  /** Sprite animation frames per second */
  spriteFrameRate: 8,
};

/** Stork sprite configuration */
export const STORK = {
  /** Number of frames in walk cycle */
  walkFrames: 4,
  /** Sprite width in pixels (source) */
  spriteWidth: 32,
  /** Sprite height in pixels (source) */
  spriteHeight: 48,
  /** Display scale factor - controls overall character size */
  displayScale: 3,
  /** Pivot point Y offset ratio (feet position) */
  pivotY: 0.85,
};

/** Background parallax layer speeds (ratio of walk speed) */
export const PARALLAX = {
  sky: 0,
  farHills: 0.15,
  nearHills: 0.35,
  ground: 1.0,
};

/** Color palette */
export const COLORS = {
  sky: '#87CEEB',
  skyHorizon: '#E0F0FF',
  farHills: '#7BA886',
  nearHills: '#5A9060',
  ground: '#8B7355',
  groundDark: '#6B5335',
  groundLine: '#A08B6B',
  storkBody: '#FFFFFF',
  storkBeak: '#FF6B35',
  storkLegs: '#FF8C5A',
  storkWing: '#E8E8E8',
  storkEye: '#000000',
  uiText: '#FFFFFF',
  uiShadow: '#000000',
  warningRed: '#FF4444',
  gaugeGreen: '#44FF44',
  gaugeYellow: '#FFFF44',
  gaugeRed: '#FF4444',
  windArrow: '#FFFFFF',
};

/** Score configuration */
export const SCORING = {
  /** Points per second survived */
  pointsPerSecond: 10,
  /** Bonus multiplier for staying near center */
  centerBonus: 1.5,
  /** Center bonus angle threshold in radians (10 degrees) */
  centerThreshold: (10 * Math.PI) / 180,
};

/** UI layout constants (ratios of screen dimensions) */
export const LAYOUT = {
  /** Ground level from bottom (ratio of height) */
  groundLevel: 0.35,
  /** Touch button width ratio */
  buttonWidth: 0.15,
  /** Touch button height ratio */
  buttonHeight: 0.2,
  /** Button margin from edge */
  buttonMargin: 0.03,
  /** Banner ad height in pixels */
  bannerAdHeight: 60,
  /** HUD top margin */
  hudMargin: 0.02,
};
