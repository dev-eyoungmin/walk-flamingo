import { PHYSICS, SCORING, STORK } from './constants';
import { getDifficulty } from './difficulty';
import type { GameState, InputState } from './types';

/** Create initial game state */
export function createInitialState(): GameState {
  return {
    angle: 0,
    angularVelocity: 0,
    windForce: 0,
    windDirection: 0,
    elapsedTime: 0,
    distance: 0,
    score: 0,
    walkSpeed: PHYSICS.baseWalkSpeed,
    animFrame: 0,
    animTimer: 0,
    isGameOver: false,
  };
}

/** Pseudo-random number from a seed-like value (deterministic jitter) */
function seededRandom(t: number): number {
  const x = Math.sin(t * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Update game state for one frame.
 * Core inverted pendulum physics model.
 *
 * @param state - Current game state (mutated in place for performance)
 * @param input - Player input state
 * @param dt - Delta time in seconds
 * @returns The updated game state
 */
export function updatePhysics(
  state: GameState,
  input: InputState,
  dt: number,
): GameState {
  if (state.isGameOver) return state;

  // Clamp dt to prevent physics explosion on frame drops
  const clampedDt = Math.min(dt, 0.05);

  // Get difficulty params for current time
  const diff = getDifficulty(state.elapsedTime);

  // 1. Gravity acceleration (inverted pendulum: sin(angle) pulls further from center)
  const gravityAccel =
    PHYSICS.gravityTorque * Math.sin(state.angle) * diff.gravityMultiplier;

  // 2. Player input torque
  let playerAccel = 0;
  if (input.left) playerAccel -= PHYSICS.playerTorque;
  if (input.right) playerAccel += PHYSICS.playerTorque;

  // 3. Wind force (smoothly changing external force)
  const windAccel = state.windForce;

  // 4. Random jitter (small perturbations)
  const jitter =
    (seededRandom(state.elapsedTime * 7.1) - 0.5) *
    0.5 *
    diff.jitterMultiplier;

  // 5. Update angular velocity
  state.angularVelocity +=
    (gravityAccel + playerAccel + windAccel + jitter) * clampedDt;

  // 6. Apply damping
  state.angularVelocity *= diff.damping;

  // 7. Update angle
  state.angle += state.angularVelocity * clampedDt;

  // 8. Update wind (change direction periodically)
  updateWind(state, diff.windStrength, diff.windChangeInterval);

  // 9. Check game over
  if (Math.abs(state.angle) >= PHYSICS.gameOverAngle) {
    state.isGameOver = true;
    // Clamp angle at game over position
    state.angle = Math.sign(state.angle) * PHYSICS.gameOverAngle;
    state.angularVelocity = 0;
    return state;
  }

  // 10. Update time and distance
  state.elapsedTime += clampedDt;
  state.walkSpeed = PHYSICS.baseWalkSpeed * (1 + state.elapsedTime * 0.005);
  state.distance += state.walkSpeed * clampedDt;

  // 11. Update score
  const isNearCenter = Math.abs(state.angle) < SCORING.centerThreshold;
  const scoreRate = SCORING.pointsPerSecond * (isNearCenter ? SCORING.centerBonus : 1.0);
  state.score += scoreRate * clampedDt;

  // 12. Update animation frame
  state.animTimer += clampedDt;
  const frameDuration = 1 / PHYSICS.spriteFrameRate;
  if (state.animTimer >= frameDuration) {
    state.animTimer -= frameDuration;
    state.animFrame = (state.animFrame + 1) % STORK.walkFrames;
  }

  return state;
}

/** Update wind force with periodic direction changes */
function updateWind(
  state: GameState,
  strength: number,
  changeInterval: number,
): void {
  if (strength <= 0) {
    state.windForce = 0;
    state.windDirection = 0;
    return;
  }

  // Use time-based cycling for wind changes
  const windPhase = Math.floor(state.elapsedTime / changeInterval);
  const windRand = seededRandom(windPhase * 3.7);
  // Second random seed for intensity variation
  const gustRand = seededRandom(windPhase * 9.1 + 1.5);

  // Randomize wind intensity (Gust Factor): 0.4x to 1.4x of base strength
  // This makes some winds gentle and others sudden strong gusts
  const gustFactor = 0.4 + gustRand; 
  const currentStrength = strength * gustFactor;

  // Wind direction: -1 (Left), 0 (Calm), 1 (Right)
  // Adjusted probabilities: 40% Left, 40% Right, 20% Calm
  if (windRand < 0.4) {
    state.windDirection = -1;
  } else if (windRand < 0.8) {
    state.windDirection = 1;
  } else {
    state.windDirection = 0;
  }

  // Target wind force
  const targetWind = state.windDirection * currentStrength;
  
  // Lerp toward target wind (smooth transition)
  state.windForce += (targetWind - state.windForce) * 0.02;
}

/** Get the angle in degrees for display */
export function angleToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Get balance ratio: 0 = upright, 1 = game over angle */
export function getBalanceRatio(angle: number): number {
  return Math.min(1, Math.abs(angle) / PHYSICS.gameOverAngle);
}

/** Check if angle is in warning zone */
export function isWarningZone(angle: number): boolean {
  return Math.abs(angle) >= PHYSICS.warningAngle;
}
