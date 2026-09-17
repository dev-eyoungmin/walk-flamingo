import {
  CHL_CENTERED,
  ENVIRONMENT,
  EVT_CHALLENGE,
  EVT_OBSTACLE,
  MODE_FALLING,
  MODE_OVER,
  MODE_PLAYING,
  OBS_BRANCH,
  OBS_ROCK,
  PHYSICS,
  STAGE_ACTIVE,
  STAGE_IDLE,
  STAGE_WARNING,
  COIN,
} from './constants';
import { FX_BRANCH_DODGED, FX_BRANCH_HIT, FX_COIN, FX_GAME_OVER, FX_ROCK_BRACED, FX_ROCK_TRIP, FX_SHIELD_SAVE } from './fx';
import { createSimState, SimState } from './state';
import { advanceSim, dampingAt, gravityMultAt, resumeSim, stepSim } from './step';
import { makeSimConfig, SimConfig, terrainOffsetAt, TERRAIN_FLAT } from './terrain';

const FLAT = [TERRAIN_FLAT, 20, 0];

function flatConfig(): SimConfig {
  return makeSimConfig(844, 330, FLAT);
}

function collectFx(s: SimState, into: number[]): void {
  for (let i = 0; i < s.fxLen; i++) into.push(s.fx[i * 2]);
  s.fxLen = 0;
}

/** Run with a balancing autopilot so the stork stays up while we observe other systems. */
function runBalanced(s: SimState, cfg: SimConfig, seconds: number, fx: number[] = [], lean = 0): void {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const predicted = s.angle - lean + s.omega * 0.25;
    s.input = predicted > 0.02 ? 1 : predicted < -0.02 ? 2 : 0;
    advanceSim(s, cfg, dt);
    collectFx(s, fx);
    if (s.mode !== MODE_PLAYING) break;
  }
}

describe('fixed-step physics', () => {
  it('produces the same trajectory at 30, 60 and 144 fps', () => {
    const cfg = flatConfig();
    const results = [30, 60, 144].map((fps) => {
      const s = createSimState(cfg, MODE_PLAYING, 42);
      const dt = 1 / fps;
      for (let frame = 0; frame < fps * 6; frame++) {
        const second = Math.floor(frame / fps);
        s.input = second % 2 === 0 ? 2 : 1;
        advanceSim(s, cfg, dt);
      }
      return s;
    });
    for (const r of results.slice(1)) {
      expect(r.angle).toBeCloseTo(results[0].angle, 1);
      expect(r.meters).toBeCloseTo(results[0].meters, 1);
    }
  });

  it('holding a direction responds identically regardless of refresh rate', () => {
    const cfg = flatConfig();
    const angleAfterHold = (fps: number) => {
      const s = createSimState(cfg, MODE_PLAYING, 1);
      for (let i = 0; i < fps * 0.5; i++) {
        s.input = 2;
        advanceSim(s, cfg, 1 / fps);
      }
      return s.angle;
    };
    expect(angleAfterHold(120)).toBeCloseTo(angleAfterHold(60), 2);
  });
});

describe('difficulty', () => {
  it('reduces damping over time (more momentum = harder)', () => {
    expect(dampingAt(0)).toBeGreaterThan(dampingAt(60));
    expect(dampingAt(60)).toBeGreaterThan(dampingAt(200));
  });

  it('keeps increasing gravity after the early ramp instead of plateauing immediately', () => {
    expect(gravityMultAt(60)).toBeGreaterThan(gravityMultAt(40));
    expect(gravityMultAt(120)).toBeGreaterThan(gravityMultAt(60));
  });

  it('ice makes the stork slide further, not less', () => {
    const cfg = flatConfig();
    const drift = (ice: number) => {
      const s = createSimState(cfg, MODE_PLAYING, 3);
      s.t = 20;
      s.graceEnd = 0;
      s.iceAmt = ice;
      s.omega = 1.5;
      // stepSim directly so iceAmt isn't eased back to 0 by the event system
      for (let i = 0; i < 30; i++) {
        stepSim(s, cfg, 1 / 120);
        s.iceAmt = ice;
      }
      return Math.abs(s.angle);
    };
    expect(drift(1)).toBeGreaterThan(drift(0) * 1.5);
  });
});

describe('grace period', () => {
  it('never lets the angle run away while game over is disabled, and does not kill at the end', () => {
    const cfg = flatConfig();
    const s = createSimState(cfg, MODE_PLAYING, 5);
    for (let i = 0; i < 60 * PHYSICS.GRACE_PERIOD; i++) {
      s.input = 2;
      advanceSim(s, cfg, 1 / 60);
      expect(Math.abs(s.angle)).toBeLessThanOrEqual(PHYSICS.GRACE_MAX_ANGLE + 1e-9);
    }
    s.input = 1;
    advanceSim(s, cfg, 1 / 60);
    expect(s.mode).toBe(MODE_PLAYING);
  });
});

describe('falling', () => {
  it('cannot be recovered once it starts and ends the run exactly once', () => {
    const cfg = flatConfig();
    const s = createSimState(cfg, MODE_PLAYING, 9);
    s.t = 30;
    s.graceEnd = 0;
    s.angle = PHYSICS.GAME_OVER_ANGLE + 0.01;
    stepSim(s, cfg, 1 / 120);
    expect(s.mode).toBe(MODE_FALLING);
    const fx: number[] = [];
    for (let i = 0; i < 240; i++) {
      s.input = 1; // pushing back does nothing now
      advanceSim(s, cfg, 1 / 60);
      collectFx(s, fx);
    }
    expect(s.mode).toBe(MODE_OVER);
    expect(fx.filter((c) => c === FX_GAME_OVER)).toHaveLength(1);
  });

  it('shield saves a fall once', () => {
    const cfg = flatConfig();
    const s = createSimState(cfg, MODE_PLAYING, 9, { shield: true });
    s.t = 30;
    s.graceEnd = 0;
    s.angle = PHYSICS.GAME_OVER_ANGLE + 0.01;
    const fx: number[] = [];
    stepSim(s, cfg, 1 / 120);
    collectFx(s, fx);
    expect(s.mode).toBe(MODE_PLAYING);
    expect(fx).toContain(FX_SHIELD_SAVE);
    expect(s.shield).toBe(0);
  });

  it('resume keeps progress and resets balance with a new grace period', () => {
    const cfg = flatConfig();
    const s = createSimState(cfg, MODE_PLAYING, 9);
    s.t = 50;
    s.score = 1234;
    s.meters = 80;
    s.mode = MODE_OVER;
    s.angle = 1.2;
    resumeSim(s);
    expect(s.mode).toBe(MODE_PLAYING);
    expect(s.score).toBe(1234);
    expect(s.angle).toBe(0);
    expect(s.graceEnd).toBeCloseTo(50 + PHYSICS.GRACE_PERIOD);
  });
});

describe('events', () => {
  it('shows the first event within the first 10 seconds', () => {
    const cfg = flatConfig();
    const s = createSimState(cfg, MODE_PLAYING, 11);
    runBalanced(s, cfg, 10);
    expect(s.evCount).toBeGreaterThanOrEqual(1);
  });

  it('starts with a centered challenge followed by a rock', () => {
    const cfg = flatConfig();
    const s = createSimState(cfg, MODE_PLAYING, 12);
    const seen: number[] = [];
    const dt = 1 / 60;
    for (let t = 0; t < 30 && seen.length < 2; t += dt) {
      const prevCount = s.evCount;
      runBalanced(s, cfg, dt);
      if (s.evCount > prevCount) seen.push(s.evType * 10 + s.evSub);
    }
    expect(seen).toEqual([EVT_CHALLENGE * 10 + CHL_CENTERED, EVT_OBSTACLE * 10 + OBS_ROCK]);
  });

  function setupObstacle(sub: number, dir: number) {
    const cfg = flatConfig();
    const s = createSimState(cfg, MODE_PLAYING, 21);
    s.t = 20;
    s.graceEnd = 0;
    s.evCount = 5;
    s.evType = EVT_OBSTACLE;
    s.evSub = sub;
    s.evDir = dir;
    s.evStage = STAGE_WARNING;
    s.evTimer = 0.001;
    return { s, cfg };
  }

  it('a rock actually reaches the stork and trips it when not braced', () => {
    const { s, cfg } = setupObstacle(OBS_ROCK, 1);
    const fx: number[] = [];
    runBalanced(s, cfg, 3, fx);
    expect(fx).toContain(FX_ROCK_TRIP);
  });

  it('leaning away from the rock braces against it', () => {
    const { s, cfg } = setupObstacle(OBS_ROCK, 1);
    const fx: number[] = [];
    runBalanced(s, cfg, 3, fx, -0.2);
    expect(fx).toContain(FX_ROCK_BRACED);
    expect(s.dodges).toBe(1);
  });

  it('a branch hits an upright stork on the head', () => {
    const { s, cfg } = setupObstacle(OBS_BRANCH, 1);
    const fx: number[] = [];
    runBalanced(s, cfg, 2, fx);
    expect(fx).toContain(FX_BRANCH_HIT);
  });

  it('leaning away from the branch dodges it', () => {
    const { s, cfg } = setupObstacle(OBS_BRANCH, 1);
    const fx: number[] = [];
    s.angle = -0.3;
    runBalanced(s, cfg, 2, fx, -0.3);
    expect(fx).toContain(FX_BRANCH_DODGED);
    expect(fx).not.toContain(FX_BRANCH_HIT);
  });

  it('getting hit shows the hurt face; dodging shows the happy face', () => {
    const hit = setupObstacle(OBS_BRANCH, 1);
    runBalanced(hit.s, hit.cfg, 0.6);
    expect(hit.s.hurtT).toBeGreaterThan(0);

    const dodge = setupObstacle(OBS_BRANCH, 1);
    dodge.s.angle = -0.3;
    runBalanced(dodge.s, dodge.cfg, 0.6, [], -0.3);
    expect(dodge.s.hurtT).toBe(0);
    expect(dodge.s.happyT).toBeGreaterThan(0);
  });

  it('eyes turn toward an incoming rock from behind', () => {
    const { s, cfg } = setupObstacle(OBS_ROCK, -1);
    runBalanced(s, cfg, 0.4);
    expect(s.lookX).toBeLessThan(0);
  });

  it('returns to idle after an event and schedules the next one', () => {
    const { s, cfg } = setupObstacle(OBS_ROCK, -1);
    runBalanced(s, cfg, 4);
    expect([STAGE_IDLE, STAGE_WARNING, STAGE_ACTIVE]).toContain(s.evStage);
    expect(s.evNextAt).toBeGreaterThan(20);
  });
});

describe('coins', () => {
  it('a balanced stork collects coins that spawn at body and head height', () => {
    const cfg = flatConfig();
    const s = createSimState(cfg, MODE_PLAYING, 31);
    s.evNextAt = 1e9; // no events
    const fx: number[] = [];
    runBalanced(s, cfg, 45, fx);
    const collected = fx.filter((c) => c === FX_COIN).length;
    expect(collected).toBeGreaterThan(10);
  });

  it('coins scroll with the ground', () => {
    const cfg = flatConfig();
    const s = createSimState(cfg, MODE_PLAYING, 32);
    s.coinSlots[0] = 1;
    s.coinSlots[1] = 700;
    s.coinSlots[2] = 100;
    const screenBefore = s.coinSlots[1] - s.scrollX;
    runBalanced(s, cfg, 1);
    const screenAfter = s.coinSlots[1] - s.scrollX;
    // The coin's world X is fixed, so its screen movement equals the ground's scroll
    expect(screenBefore - screenAfter).toBeCloseTo(s.scrollX, 5);
    expect(COIN.MAX).toBeGreaterThan(0);
  });
});

describe('environment', () => {
  it('reaches sunset within the first minute', () => {
    const cfg = flatConfig();
    const s = createSimState(cfg, MODE_PLAYING, 41);
    s.evNextAt = 1e9;
    runBalanced(s, cfg, ENVIRONMENT.DAY_CYCLE * 0.35);
    expect(s.dayT).toBeGreaterThan(0.3);
  });
});

describe('terrain', () => {
  it('is continuous across segment joins and the pattern wrap', () => {
    const cfg = makeSimConfig(844, 330, [0, 1, 0, 1, 1, 1, 0, 1, 0, 2, 1, 1, 0, 1, 0]);
    let prev = terrainOffsetAt(cfg, 0);
    for (let x = 1; x <= cfg.terrainW * 2; x += 1) {
      const y = terrainOffsetAt(cfg, x);
      expect(Math.abs(y - prev)).toBeLessThan(2);
      prev = y;
    }
  });
});
