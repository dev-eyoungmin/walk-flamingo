import type { PhysicsConstants } from './types';

/** Core physics tuning constants (reference values — GameCanvas.tsx uses inline values for worklet compatibility) */
export const PHYSICS: PhysicsConstants = {
  /** Base gravity torque in rad/s^2 (GameCanvas uses 5.0 with soft-start ramp) */
  gravityTorque: 5.0,
  /** Player input torque in rad/s^2 (GameCanvas uses 10.0) */
  playerTorque: 10.0,
  /** Base angular velocity damping per frame */
  baseDamping: 0.82,
  /** Game over angle in radians (65 degrees) */
  gameOverAngle: (65 * Math.PI) / 180,
  /** Warning angle in radians (55 degrees) */
  warningAngle: (55 * Math.PI) / 180,
  /** Base walk speed in pixels/second */
  baseWalkSpeed: 8,
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
        heightRatio: 0.65 + Math.random() * 0.35,
      });
    } else {
      segments.push({
        type: 'valley',
        widthRatio: 0.7 + Math.random() * 0.7,
        heightRatio: 0.5 + Math.random() * 0.5,
      });
    }
    // Flat gap between features (shorter gaps)
    segments.push({ type: 'flat', widthRatio: 0.5 + Math.random() * 1.0 });
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

/** Coin & reward system constants */
export const COIN = {
  /** Distance interval between coin spawns (in internal distance units) */
  SPAWN_INTERVAL: 200,
  /** Base coin value */
  BASE_VALUE: 10,
  /** Collection hitbox radius (pixels) */
  COLLECT_RADIUS: 40,
  /** Max coins visible at once (ring buffer size) */
  MAX_VISIBLE: 5,
  /** Coin radius for rendering */
  RADIUS: 14,
  /** Min Y offset from ground (higher = more risk) */
  MIN_HEIGHT: 30,
  /** Max Y offset from ground */
  MAX_HEIGHT: 120,
  /** Spin speed (radians per second) */
  SPIN_SPEED: 4.0,
  /** Collect animation duration (seconds) */
  COLLECT_ANIM_DURATION: 0.4,
} as const;

/** Near-miss bonus constants */
export const NEAR_MISS = {
  /** Danger ratio threshold to trigger (must exceed this) */
  DANGER_ENTER: 0.75,
  /** Danger ratio to count as "saved" (must go below this) */
  DANGER_EXIT: 0.3,
  /** Bonus points for a near miss */
  BONUS_POINTS: 50,
} as const;

/** Floating text constants */
export const FLOATING_TEXT = {
  /** Duration of float animation (seconds) */
  DURATION: 0.8,
  /** Max simultaneous floating texts */
  MAX_COUNT: 3,
  /** Float distance in pixels (upward) */
  FLOAT_DISTANCE: 60,
  /** Slots: each slot = [active(0/1), timer, x, y, value, type(0=coin,1=bonus,2=combo)] */
  SLOT_SIZE: 6,
} as const;

/** Combo grace buffer constants */
export const COMBO_GRACE = {
  /** Grace period in seconds before combo breaks */
  BUFFER_TIME: 0.5,
} as const;

/** Event system constants */
export const EVENTS = {
  /** Minimum internal distance before first event can appear */
  FIRST_EVENT_DIST: 600,
  /** Base gap between events in internal distance units */
  BASE_GAP: 400,
  /** Minimum gap between events */
  MIN_GAP: 200,
  /** Gap shrink rate per second of elapsed time */
  GAP_SHRINK_RATE: 0.02,
  /** Max events in the pre-generated queue */
  QUEUE_SIZE: 30,

  /** Obstacle constants */
  OBSTACLE: {
    /** Warning time before obstacle arrives (seconds) */
    WARNING_TIME: 1.5,
    /** Angular velocity impulse on hit (rad/s) */
    HIT_IMPULSE: 8.0,
    /** Hitbox radius (pixels) */
    HITBOX_RADIUS: 35,
    /** Rock scroll speed multiplier (relative to walkSpeed) */
    SCROLL_SPEED: 1.5,
    /** Branch fall speed (pixels/second) */
    BRANCH_FALL_SPEED: 200,
  },

  /** Environment event constants */
  ENVIRONMENT: {
    /** Gust wind force */
    GUST_FORCE: 6.0,
    /** Gust duration (seconds) */
    GUST_DURATION: 3.5,
    /** Quake oscillation amplitude */
    QUAKE_AMPLITUDE: 4.0,
    /** Quake duration (seconds) */
    QUAKE_DURATION: 3.5,
    /** Ice damping override */
    ICE_DAMPING: 0.4,
    /** Ice duration (seconds) */
    ICE_DURATION: 4.5,
    /** Warning lead time (seconds) */
    WARNING_TIME: 2.0,
  },

  /** Challenge constants */
  CHALLENGE: {
    /** Stay centered duration (seconds) */
    CENTERED_DURATION: 3.0,
    /** Stay centered reward */
    CENTERED_REWARD: 100,
    /** Survive storm duration (seconds) */
    STORM_DURATION: 4.0,
    /** Survive storm reward */
    STORM_REWARD: 150,
    /** Lean direction duration (seconds) */
    LEAN_DURATION: 2.0,
    /** Lean direction reward */
    LEAN_REWARD: 80,
    /** Lean angle threshold (radians, ~20 degrees) */
    LEAN_THRESHOLD: (20 * Math.PI) / 180,
  },

  /** Speed change constants */
  SPEED: {
    /** Sprint multiplier */
    SPRINT_MULT: 2.0,
    /** Slowdown multiplier */
    SLOWDOWN_MULT: 0.5,
    /** Duration (seconds) */
    DURATION: 3.0,
    /** Warning lead time (seconds) */
    WARNING_TIME: 1.0,
  },
} as const;

/**
 * Event slot encoding for worklet SharedValue.
 * Each event = [type, subtype, triggerDist, param1, param2, param3, status]
 * type: 0=obstacle, 1=environment, 2=challenge, 3=speed
 * subtype: depends on type
 * status: 0=pending, 1=warning, 2=active, 3=done
 */
export const EVENT_SLOT_SIZE = 7;

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
