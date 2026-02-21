/** Game screen states */
export type GameScreen = 'start' | 'playing' | 'gameover';

/** Input state from touch controls */
export interface InputState {
  left: boolean;
  right: boolean;
}

/** Core game state updated each frame */
export interface GameState {
  /** Tilt angle in radians (0 = upright, positive = right, negative = left) */
  angle: number;
  /** Angular velocity in rad/s */
  angularVelocity: number;
  /** Current wind force in rad/s^2 */
  windForce: number;
  /** Wind direction for display: -1 = left, 0 = none, 1 = right */
  windDirection: number;
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Distance walked (pixels) */
  distance: number;
  /** Current score */
  score: number;
  /** Walking speed (pixels/s) */
  walkSpeed: number;
  /** Sprite animation frame index */
  animFrame: number;
  /** Frame accumulator for sprite timing */
  animTimer: number;
  /** Whether game is over */
  isGameOver: boolean;
}

/** Difficulty parameters that change over time */
export interface DifficultyParams {
  gravityMultiplier: number;
  damping: number;
  jitterMultiplier: number;
  windStrength: number;
  windChangeInterval: number;
}

/** Physics constants */
export interface PhysicsConstants {
  gravityTorque: number;
  playerTorque: number;
  baseDamping: number;
  gameOverAngle: number;
  warningAngle: number;
  baseWalkSpeed: number;
  spriteFrameRate: number;
}

/** Screen dimensions for layout calculations */
export interface ScreenDimensions {
  width: number;
  height: number;
  scale: number;
}
