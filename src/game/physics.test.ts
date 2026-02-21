import { createInitialState, updatePhysics, angleToDegrees, getBalanceRatio, isWarningZone } from './physics';
import { PHYSICS } from './constants';
import type { InputState } from './types';

const NO_INPUT: InputState = { left: false, right: false };
const LEFT_INPUT: InputState = { left: true, right: false };
const RIGHT_INPUT: InputState = { left: false, right: true };
const DT = 1 / 60; // 60fps frame

describe('createInitialState', () => {
  it('should return zeroed state', () => {
    const state = createInitialState();
    expect(state.angle).toBe(0);
    expect(state.angularVelocity).toBe(0);
    expect(state.windForce).toBe(0);
    expect(state.elapsedTime).toBe(0);
    expect(state.score).toBe(0);
    expect(state.isGameOver).toBe(false);
  });
});

describe('updatePhysics', () => {
  it('should not change a perfectly balanced state with no input (first frame)', () => {
    const state = createInitialState();
    updatePhysics(state, NO_INPUT, DT);
    // Angle should be very close to 0 (only jitter)
    expect(Math.abs(state.angle)).toBeLessThan(0.01);
  });

  it('should increase elapsed time', () => {
    const state = createInitialState();
    updatePhysics(state, NO_INPUT, DT);
    expect(state.elapsedTime).toBeCloseTo(DT, 5);
  });

  it('should increase score over time', () => {
    const state = createInitialState();
    for (let i = 0; i < 60; i++) {
      updatePhysics(state, NO_INPUT, DT);
    }
    expect(state.score).toBeGreaterThan(0);
  });

  it('should increase distance over time', () => {
    const state = createInitialState();
    for (let i = 0; i < 60; i++) {
      updatePhysics(state, NO_INPUT, DT);
    }
    expect(state.distance).toBeGreaterThan(0);
  });

  it('should apply left input torque', () => {
    const state = createInitialState();
    // Give it a slight right tilt first
    state.angle = 0.1;
    const angleBefore = state.angle;
    // Apply many frames of left input
    for (let i = 0; i < 30; i++) {
      updatePhysics(state, LEFT_INPUT, DT);
    }
    // Should have moved leftward (more negative) relative to gravity pull
    expect(state.angle).toBeLessThan(angleBefore);
  });

  it('should apply right input torque', () => {
    const state = createInitialState();
    // Give it a slight left tilt
    state.angle = -0.1;
    const angleBefore = state.angle;
    for (let i = 0; i < 30; i++) {
      updatePhysics(state, RIGHT_INPUT, DT);
    }
    expect(state.angle).toBeGreaterThan(angleBefore);
  });

  it('should trigger game over when angle exceeds threshold', () => {
    const state = createInitialState();
    // Push strongly to one side
    state.angle = PHYSICS.gameOverAngle - 0.01;
    state.angularVelocity = 2.0;
    updatePhysics(state, NO_INPUT, DT);
    expect(state.isGameOver).toBe(true);
  });

  it('should clamp angle at game over', () => {
    const state = createInitialState();
    state.angle = PHYSICS.gameOverAngle + 0.5;
    state.angularVelocity = 5.0;
    updatePhysics(state, NO_INPUT, DT);
    expect(Math.abs(state.angle)).toBeLessThanOrEqual(PHYSICS.gameOverAngle + 0.001);
  });

  it('should not update state after game over', () => {
    const state = createInitialState();
    state.isGameOver = true;
    const scoreBefore = state.score;
    updatePhysics(state, LEFT_INPUT, DT);
    expect(state.score).toBe(scoreBefore);
  });

  it('should clamp large dt values', () => {
    const state = createInitialState();
    // Even with a huge dt, should not explode
    updatePhysics(state, NO_INPUT, 1.0);
    expect(isFinite(state.angle)).toBe(true);
    expect(isFinite(state.angularVelocity)).toBe(true);
  });

  it('should increase walk speed over time', () => {
    const state = createInitialState();
    const initialSpeed = state.walkSpeed;
    for (let i = 0; i < 600; i++) {
      updatePhysics(state, NO_INPUT, DT);
      if (state.isGameOver) break;
    }
    if (!state.isGameOver) {
      expect(state.walkSpeed).toBeGreaterThan(initialSpeed);
    }
  });

  it('should cycle animation frames', () => {
    const state = createInitialState();
    const frames = new Set<number>();
    for (let i = 0; i < 120; i++) {
      updatePhysics(state, NO_INPUT, DT);
      frames.add(state.animFrame);
      if (state.isGameOver) break;
    }
    expect(frames.size).toBeGreaterThan(1);
  });
});

describe('angleToDegrees', () => {
  it('should convert 0 radians to 0 degrees', () => {
    expect(angleToDegrees(0)).toBe(0);
  });

  it('should convert PI to 180 degrees', () => {
    expect(angleToDegrees(Math.PI)).toBeCloseTo(180, 5);
  });

  it('should handle negative angles', () => {
    expect(angleToDegrees(-Math.PI / 2)).toBeCloseTo(-90, 5);
  });
});

describe('getBalanceRatio', () => {
  it('should return 0 for upright position', () => {
    expect(getBalanceRatio(0)).toBe(0);
  });

  it('should return 1 at game over angle', () => {
    expect(getBalanceRatio(PHYSICS.gameOverAngle)).toBeCloseTo(1, 5);
  });

  it('should return 0.5 at half game over angle', () => {
    expect(getBalanceRatio(PHYSICS.gameOverAngle / 2)).toBeCloseTo(0.5, 5);
  });

  it('should handle negative angles', () => {
    expect(getBalanceRatio(-PHYSICS.gameOverAngle)).toBeCloseTo(1, 5);
  });

  it('should cap at 1', () => {
    expect(getBalanceRatio(PHYSICS.gameOverAngle * 2)).toBe(1);
  });
});

describe('isWarningZone', () => {
  it('should return false for small angles', () => {
    expect(isWarningZone(0)).toBe(false);
    expect(isWarningZone(0.1)).toBe(false);
  });

  it('should return true at warning angle', () => {
    expect(isWarningZone(PHYSICS.warningAngle)).toBe(true);
  });

  it('should return true for negative warning angle', () => {
    expect(isWarningZone(-PHYSICS.warningAngle)).toBe(true);
  });
});
