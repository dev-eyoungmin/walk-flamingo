import { ANIM, COIN, MODE_PLAYING, PHYSICS, SCORE } from './constants';
import { FX_COIN, FX_NEAR_MISS } from './fx';
import { createSimState, SimState } from './state';
import { advanceSim } from './step';
import { makeSimConfig, SimConfig, TERRAIN_FLAT } from './terrain';

const cfg: SimConfig = makeSimConfig(844, 330, [TERRAIN_FLAT, 20, 0]);

function playing(seed = 7): SimState {
  const s = createSimState(cfg, MODE_PLAYING, seed);
  s.t = 10;
  s.graceEnd = 0;
  s.evNextAt = 1e9;
  s.nextWeatherAt = 1e9;
  s.nextCoinAt = 1e9;
  s.nextItemAt = 1e9;
  s.nextGoldAt = 1e9;
  s.nextRescueAt = 1e9;
  return s;
}

/** Lean to `danger` (fraction of the fall angle), then let the player steer back upright. */
function saveFrom(s: SimState, danger: number, fx: { code: number; value: number }[]): void {
  s.angle = danger * PHYSICS.GAME_OVER_ANGLE;
  s.omega = 0;
  const dt = 1 / 60;
  for (let t = 0; t < 4 && s.mode === MODE_PLAYING; t += dt) {
    const predicted = s.angle + s.omega * 0.25;
    s.input = predicted > 0.02 ? 1 : predicted < -0.02 ? 2 : 0;
    advanceSim(s, cfg, dt);
    for (let i = 0; i < s.fxLen; i++) fx.push({ code: s.fx[i * 2], value: s.fx[i * 2 + 1] });
    s.fxLen = 0;
  }
}

describe('saves', () => {
  it('a recovery from the very edge is a CLUTCH with coins and a hit-stop', () => {
    const s = playing();
    const fx: { code: number; value: number }[] = [];
    saveFrom(s, 0.95, fx);
    expect(s.mode).toBe(MODE_PLAYING);
    expect(fx).toContainEqual({ code: FX_NEAR_MISS, value: 1 });
    expect(s.clutches).toBe(1);
    expect(s.coins).toBe(SCORE.CLUTCH_COINS);
  });

  it('a shallower recovery is an ordinary save', () => {
    const s = playing();
    const fx: { code: number; value: number }[] = [];
    saveFrom(s, 0.8, fx);
    expect(fx).toContainEqual({ code: FX_NEAR_MISS, value: 0 });
    expect(s.clutches).toBe(0);
    expect(s.coins).toBe(0);
  });

  it('back-to-back saves multiply their points', () => {
    const s = playing();
    const fx: { code: number; value: number }[] = [];
    saveFrom(s, 0.8, fx);
    expect(s.saveChain).toBe(1);
    saveFrom(s, 0.8, fx);
    expect(s.saveChain).toBe(2);
    s.lastSaveAt -= SCORE.SAVE_CHAIN_WINDOW + 1;
    saveFrom(s, 0.8, fx);
    expect(s.saveChain).toBe(1);
  });

  it('a balloon rescue is not counted as the player saving it', () => {
    const s = playing();
    s.shield = 1;
    s.angle = PHYSICS.GAME_OVER_ANGLE * 0.97;
    s.omega = 2;
    // Falls into the balloon, then the player steadies the flamingo
    for (let i = 0; i < 240; i++) {
      const predicted = s.angle + s.omega * 0.25;
      s.input = s.shield ? 0 : predicted > 0.02 ? 1 : predicted < -0.02 ? 2 : 0;
      advanceSim(s, cfg, 1 / 60);
    }
    expect(s.shield).toBe(0);
    expect(s.mode).toBe(MODE_PLAYING);
    expect(s.clutches).toBe(0);
  });

  it('the hit-stop slows the world for a moment, then time runs normally again', () => {
    const s = playing();
    s.hitStopT = ANIM.HIT_STOP;
    const t0 = s.t;
    advanceSim(s, cfg, 0.1);
    expect(s.t - t0).toBeLessThan(0.1 * ANIM.HIT_STOP_SCALE + 0.01);
    for (let i = 0; i < 5; i++) advanceSim(s, cfg, 0.1);
    expect(s.hitStopT).toBe(0);
    const t1 = s.t;
    advanceSim(s, cfg, 0.1);
    expect(s.t - t1).toBeCloseTo(0.1, 1);
  });
});

describe('coin chains', () => {
  it('quick pickups chain up and every fifth pays a bonus', () => {
    const s = playing();
    // A row of coins right at the flamingo, one every few frames
    const fx: number[] = [];
    const values: number[] = [];
    for (let i = 0; i < COIN.CHAIN_BONUS_EVERY; i++) {
      const b = 0;
      s.coinSlots[b] = 1;
      s.coinSlots[b + 1] = s.scrollX + cfg.storkX;
      s.coinSlots[b + 2] = s.feetY - 18 * cfg.unit;
      s.coinSlots[b + 3] = COIN.VALUE;
      s.coinSlots[b + 4] = 0;
      s.coinSlots[b + 5] = 0;
      for (let k = 0; k < 6; k++) {
        s.input = 0;
        advanceSim(s, cfg, 1 / 60);
        for (let j = 0; j < s.fxLen; j++) {
          fx.push(s.fx[j * 2]);
          if (s.fx[j * 2] === FX_COIN) values.push(s.fx[j * 2 + 1]);
        }
        s.fxLen = 0;
      }
    }
    expect(values).toEqual([1, 2, 3, 4, 5]);
    expect(s.coins).toBe(COIN.CHAIN_BONUS_EVERY + COIN.CHAIN_BONUS);
  });
});
