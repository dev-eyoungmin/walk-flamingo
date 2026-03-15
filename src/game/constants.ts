import type { PhysicsConstants } from './types';

/** Core physics tuning constants */
export const PHYSICS: PhysicsConstants = {
  /** Base gravity torque in rad/s^2 */
  gravityTorque: 2.5,
  /** Player input torque in rad/s^2 */
  playerTorque: 6.0,
  /** Base angular velocity damping per frame */
  baseDamping: 0.92,
  /** Game over angle in radians (42 degrees) */
  gameOverAngle: (42 * Math.PI) / 180,
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

/** Terrain segment definitions (shared between renderer and physics) */
export type TerrainSegmentType = 'flat' | 'hill' | 'valley';
export interface TerrainSegment {
  type: TerrainSegmentType;
  /** Width as ratio of base segment width (segW) */
  widthRatio: number;
  /** Height as ratio of max hill height (only for hill/valley) */
  heightRatio?: number;
}

/**
 * Generate a random terrain pattern with hills, valleys, and flat sections.
 * Always starts and ends with flat for seamless tiling.
 * Returns 10-16 segments per pattern.
 */
export function generateTerrain(): TerrainSegment[] {
  const segments: TerrainSegment[] = [];
  const terrainCount = 5 + Math.floor(Math.random() * 4); // 5~8 terrain features

  // Always start with flat
  segments.push({ type: 'flat', widthRatio: 1.5 + Math.random() * 1.5 });

  for (let i = 0; i < terrainCount; i++) {
    // Pick hill or valley randomly (60% hill, 40% valley)
    const isHill = Math.random() < 0.6;
    if (isHill) {
      segments.push({
        type: 'hill',
        widthRatio: 0.8 + Math.random() * 0.8,
        heightRatio: 0.3 + Math.random() * 0.7,
      });
    } else {
      segments.push({
        type: 'valley',
        widthRatio: 0.7 + Math.random() * 0.7,
        heightRatio: 0.2 + Math.random() * 0.4,
      });
    }
    // Flat gap between features
    segments.push({ type: 'flat', widthRatio: 1.0 + Math.random() * 2.0 });
  }

  return segments;
}

/** Encode TerrainSegment[] to flat number array for worklet SharedValue.
 *  Each segment = [type(0=flat,1=hill,2=valley), widthRatio, heightRatio] */
export function encodeTerrainForWorklet(segments: TerrainSegment[]): number[] {
  const arr: number[] = [];
  for (const seg of segments) {
    const typeCode = seg.type === 'hill' ? 1 : seg.type === 'valley' ? 2 : 0;
    arr.push(typeCode, seg.widthRatio, seg.heightRatio ?? 0);
  }
  return arr;
}

/** Default terrain for initial render before first game start */
export const TERRAIN_SEGMENTS: TerrainSegment[] = generateTerrain();

/** Base segment width multiplier (ratio of screen width) */
export const TERRAIN_SEG_W_RATIO = 0.35;

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
