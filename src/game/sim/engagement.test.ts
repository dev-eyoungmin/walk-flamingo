import {
  COIN,
  EVT_OBSTACLE,
  EVT_SPEED,
  FEVER,
  ITEMS,
  MODE_PLAYING,
  OBS_GULL,
  PHYSICS,
  POPUP_BEST,
  SPD_COIN_RAIN,
  SPD_SPRINT,
  STAGE_IDLE,
  STAGE_WARNING,
  TUT_DONE,
  TUT_FLAP,
  TUT_HOLD_LEFT,
  TUT_HOLD_RIGHT,
  TUT_OFF,
} from './constants';
import { FX_BEST_PASSED, FX_COIN, FX_GULL_LAND, FX_GULL_SHOO, FX_TUTORIAL_STEP, FX_WARNING } from './fx';
import { createSimState, RunParams, SimState } from './state';
import { advanceSim, resumeSim } from './step';
import { makeSimConfig, SimConfig, TERRAIN_FLAT } from './terrain';

const cfg: SimConfig = makeSimConfig(844, 330, [TERRAIN_FLAT, 20, 0]);
const DT = 1 / 60;

function drain(s: SimState, into: number[]): void {
  for (let i = 0; i < s.fxLen; i++) into.push(s.fx[i * 2], s.fx[i * 2 + 1]);
  s.fxLen = 0;
}

function codes(fx: number[]): number[] {
  return fx.filter((_, i) => i % 2 === 0);
}

/** Balancing autopilot; `extra` is OR-ed into the input (e.g. 4 = flap). */
function balanced(s: SimState, seconds: number, fx: number[] = [], opts: { lean?: number; extra?: number } = {}): void {
  for (let t = 0; t < seconds; t += DT) {
    const predicted = s.angle - (opts.lean ?? 0) + s.omega * 0.25;
    s.input = (predicted > 0.02 ? 1 : predicted < -0.02 ? 2 : 0) | (opts.extra ?? 0);
    advanceSim(s, cfg, DT);
    drain(s, fx);
    if (s.mode !== MODE_PLAYING) break;
  }
}

function playing(params: RunParams = {}, seed = 7): SimState {
  const s = createSimState(cfg, MODE_PLAYING, seed, params);
  s.t = 10;
  s.graceEnd = 0;
  s.evNextAt = 1e9;
  s.nextWeatherAt = 1e9;
  return s;
}

describe('personal best flag', () => {
  it('celebrates passing the best exactly once, and survives a continue', () => {
    const s = playing({ bestMeters: 30 });
    const fx: number[] = [];
    balanced(s, 25, fx);
    expect(s.meters).toBeGreaterThan(30);
    expect(codes(fx).filter((c) => c === FX_BEST_PASSED)).toHaveLength(1);
    expect(s.bestPassed).toBe(1);

    resumeSim(s);
    expect(s.bestPassed).toBe(1);
    expect(s.bestMeters).toBe(30);
  });

  it('shows the record popup when passing it', () => {
    const s = playing({ bestMeters: 25 });
    for (let i = 0; i < 60 * 30 && s.bestPassed === 0; i++) balanced(s, DT);
    expect(s.popKind).toBe(POPUP_BEST);
  });

  it('has no flag without a meaningful best', () => {
    expect(playing({ bestMeters: 0 }).bestMeters).toBe(0);
    expect(playing({ bestMeters: 8 }).bestMeters).toBe(0);
    const s = playing();
    const fx: number[] = [];
    balanced(s, 20, fx);
    expect(codes(fx)).not.toContain(FX_BEST_PASSED);
  });
});

describe('upgrades in the simulation', () => {
  it('uses upgraded magnet and fever durations', () => {
    const s = playing({ magnetTime: 14, feverDuration: 12.5 });
    const b = 0;
    s.items[b] = 1;
    s.items[b + 1] = s.scrollX + cfg.storkX;
    s.items[b + 2] = s.feetY - 18 * cfg.unit;
    s.items[b + 3] = 0; // magnet
    balanced(s, 0.1);
    expect(s.magnetT).toBeGreaterThan(13.5);

    const f = playing({ feverDuration: 12.5 });
    f.combo = 4;
    f.feverCharge = FEVER.CHARGE_TIME - 0.01;
    balanced(f, 0.1);
    expect(f.feverT).toBeGreaterThan(12);
  });

  it('lucky find brings the next item closer', () => {
    const plain = playing({}, 3);
    const lucky = playing({ itemGapMult: 0.67 }, 3);
    plain.meters = lucky.meters = ITEMS.FIRST_M + 1;
    plain.nextItemAt = lucky.nextItemAt = 0;
    balanced(plain, DT);
    balanced(lucky, DT);
    const gap = (s: SimState) => s.nextItemAt - s.meters;
    expect(gap(lucky)).toBeCloseTo(gap(plain) * 0.67, 1);
  });
});

describe('first-run tutorial', () => {
  it('never falls or starts events while the player is learning', () => {
    const s = createSimState(cfg, MODE_PLAYING, 5, { tutorial: true });
    expect(s.tutStep).toBe(TUT_HOLD_LEFT);
    const fx: number[] = [];
    for (let t = 0; t < 14; t += DT) {
      s.input = 0;
      advanceSim(s, cfg, DT);
      drain(s, fx);
    }
    expect(s.mode).toBe(MODE_PLAYING);
    expect(s.evStage).toBe(STAGE_IDLE);
    expect(codes(fx)).not.toContain(FX_WARNING);
    expect(s.score).toBe(0);
  });

  it('advances hold left → hold right → flap → play with scripted input', () => {
    const s = createSimState(cfg, MODE_PLAYING, 5, { tutorial: true });
    const fx: number[] = [];
    const hold = (bit: number, seconds: number) => {
      for (let t = 0; t < seconds; t += DT) {
        s.input = bit;
        advanceSim(s, cfg, DT);
        drain(s, fx);
      }
    };
    // Each step finishes quickly: a new player should never hold a side for long with no result
    hold(1, 1.4);
    expect(s.tutStep).toBe(TUT_HOLD_RIGHT);
    hold(2, 1.4);
    expect(s.tutStep).toBe(TUT_FLAP);
    hold(0, 0.3);
    hold(4, 0.1);
    expect(s.tutStep).toBe(TUT_DONE);
    expect(codes(fx).filter((c) => c === FX_TUTORIAL_STEP)).toHaveLength(3);

    // Difficulty and the survival clock start from the end of the tutorial
    expect(s.playStart).toBeGreaterThan(2);
    expect(s.graceEnd).toBeCloseTo(s.playStart + PHYSICS.GRACE_PERIOD, 1);
    expect(s.evNextAt).toBeGreaterThan(s.playStart + PHYSICS.GRACE_PERIOD);
  });

  it('moves on by itself so nobody gets stuck', () => {
    const s = createSimState(cfg, MODE_PLAYING, 5, { tutorial: true });
    for (let t = 0; t < 50 && s.tutStep !== TUT_DONE; t += DT) {
      s.input = 0;
      advanceSim(s, cfg, DT);
    }
    expect(s.tutStep).toBe(TUT_DONE);
  });

  it('is off unless asked for', () => {
    expect(createSimState(cfg, MODE_PLAYING, 5).tutStep).toBe(TUT_OFF);
  });
});

describe('seagull', () => {
  function gull(side: number): SimState {
    const s = playing({}, 21);
    s.t = 30;
    s.evCount = 5;
    s.evType = EVT_OBSTACLE;
    s.evSub = OBS_GULL;
    s.evDir = side;
    s.evStage = STAGE_WARNING;
    s.evTimer = 0.001;
    return s;
  }

  it('lands and weighs its side down', () => {
    const s = gull(1);
    const fx: number[] = [];
    // No input: let the bird land, then watch which way the flamingo drifts
    for (let t = 0; t < 1.2; t += DT) {
      const predicted = s.angle + s.omega * 0.25;
      s.input = predicted > 0.02 ? 1 : predicted < -0.02 ? 2 : 0;
      advanceSim(s, cfg, DT);
      drain(s, fx);
    }
    expect(codes(fx)).toContain(FX_GULL_LAND);
    expect(s.obs[7]).toBe(1);
    s.angle = 0;
    s.omega = 0;
    s.wind = 0;
    s.windTarget = 0;
    let drift = 0;
    for (let t = 0; t < 0.4; t += DT) {
      s.input = 0;
      advanceSim(s, cfg, DT);
      drift += s.omega;
    }
    expect(drift).toBeGreaterThan(0);
  });

  it('a flap shoos it for points', () => {
    const s = gull(-1);
    const fx: number[] = [];
    balanced(s, 1.3, fx);
    expect(s.obs[7]).toBe(1);
    const dodges = s.dodges;
    s.flapCooldown = 0;
    balanced(s, 0.1, fx, { extra: 4 });
    expect(codes(fx)).toContain(FX_GULL_SHOO);
    expect(s.dodges).toBe(dodges + 1);
    expect(s.obs[7]).toBe(2);
  });

  it('leaves on its own without hurting', () => {
    const s = gull(1);
    balanced(s, 8);
    expect(s.mode).toBe(MODE_PLAYING);
    expect(s.hurtT).toBe(0);
    expect(s.obs[0]).toBe(0);
  });
});

describe('coin rain', () => {
  it('drops coins a balanced flamingo can catch, and clears them after', () => {
    const s = playing({}, 9);
    s.t = 40;
    s.nextCoinAt = 1e9;
    s.evCount = 5;
    s.evType = EVT_SPEED;
    s.evSub = SPD_COIN_RAIN;
    s.evStage = STAGE_WARNING;
    s.evTimer = 0.001;
    const fx: number[] = [];
    balanced(s, 4.2, fx);
    expect(s.speedModTarget).toBe(1);
    const caught = codes(fx).filter((c) => c === FX_COIN).length;
    expect(caught).toBeGreaterThanOrEqual(3);
    balanced(s, 3, fx);
    let falling = 0;
    for (let c = 0; c < COIN.MAX; c++) if (s.coinSlots[c * COIN.SLOT] > 0.5 && s.coinSlots[c * COIN.SLOT + 6] > 0) falling++;
    expect(falling).toBe(0);
  });
});

describe('early game', () => {
  it('never sprints in the first 15 seconds', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = createSimState(cfg, MODE_PLAYING, seed);
      for (let t = 0; t < 28; t += DT) {
        const prev = s.evCount;
        balanced(s, DT);
        if (s.mode !== MODE_PLAYING) break;
        if (s.evCount > prev && s.evType === EVT_SPEED) {
          expect(s.evSub === SPD_SPRINT && s.t - PHYSICS.GRACE_PERIOD < 15).toBe(false);
        }
      }
    }
  });

  it('a rookie with human-like reactions usually survives the first 30 seconds', () => {
    let survived = 0;
    const seeds = 20;
    for (let seed = 1; seed <= seeds; seed++) {
      const s = createSimState(cfg, MODE_PLAYING, seed * 7919, { rookie: 1 });
      // React to what the flamingo was doing 0.12 s ago
      const history: number[] = [];
      for (let t = 0; t < 30 && s.mode === MODE_PLAYING; t += DT) {
        history.push(s.angle + s.omega * 0.25);
        const seen = history.length > 7 ? history[history.length - 8] : 0;
        s.input = seen > 0.03 ? 1 : seen < -0.03 ? 2 : 0;
        advanceSim(s, cfg, DT);
        s.fxLen = 0;
      }
      if (s.mode === MODE_PLAYING) survived++;
    }
    expect(survived / seeds).toBeGreaterThanOrEqual(0.9);
  });

  it('rookie mode slows the difficulty clock but not walking speed', () => {
    const vet = createSimState(cfg, MODE_PLAYING, 3, { rookie: 0 });
    const rookie = createSimState(cfg, MODE_PLAYING, 3, { rookie: 1 });
    balanced(vet, 20);
    balanced(rookie, 20);
    expect(rookie.meters).toBeCloseTo(vet.meters, 0);
  });
});
