import {
  BIOME_BEACH,
  BIOME_SNOW,
  BIOMES,
  CHICKS,
  COIN,
  EVT_OBSTACLE,
  FEVER,
  FLAP,
  ITEM_BALLOON,
  ITEM_MAGNET,
  ITEMS,
  MODE_PLAYING,
  OBS_BRANCH,
  SCORE,
  STAGE_WARNING,
  WEATHER_SNOW,
} from './constants';
import { FX_BIOME, FX_CHICK_JOIN, FX_CHICK_LOST, FX_FEVER_START, FX_FLAP, FX_ITEM } from './fx';
import { createSimState, SimState } from './state';
import { advanceSim } from './step';
import { makeSimConfig, SimConfig, TERRAIN_FLAT } from './terrain';

const cfg: SimConfig = makeSimConfig(844, 330, [TERRAIN_FLAT, 20, 0]);

function balanced(s: SimState, seconds: number, fx: number[] = [], extraInput = 0): void {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const predicted = s.angle + s.omega * 0.25;
    s.input = (predicted > 0.02 ? 1 : predicted < -0.02 ? 2 : 0) | extraInput;
    advanceSim(s, cfg, dt);
    for (let i = 0; i < s.fxLen; i++) fx.push(s.fx[i * 2]);
    s.fxLen = 0;
    if (s.mode !== MODE_PLAYING) break;
  }
}

function playing(seed = 7): SimState {
  const s = createSimState(cfg, MODE_PLAYING, seed);
  s.t = 10;
  s.graceEnd = 0;
  s.evNextAt = 1e9;
  s.nextWeatherAt = 1e9;
  return s;
}

describe('fever', () => {
  it('starts after holding max combo and doubles points', () => {
    const s = playing();
    s.combo = SCORE.COMBO_MAX;
    const fx: number[] = [];
    balanced(s, FEVER.CHARGE_TIME + 0.5, fx);
    expect(fx).toContain(FX_FEVER_START);
    expect(s.feverT).toBeGreaterThan(0);

    const before = s.score;
    balanced(s, 1);
    const withFever = s.score - before;

    const calm = playing();
    calm.combo = SCORE.COMBO_MAX;
    calm.feverCharge = -1e9; // never charges
    const b2 = calm.score;
    balanced(calm, 1);
    expect(withFever).toBeGreaterThan((calm.score - b2) * 1.6);
  });
});

describe('course items', () => {
  function withItem(type: number) {
    const s = playing();
    s.items[0] = 1;
    s.items[1] = s.scrollX + cfg.storkX + 8 * cfg.unit;
    s.items[2] = cfg.groundY - ITEMS.HEIGHT_U * cfg.unit;
    s.items[3] = type;
    s.nextItemAt = 1e9;
    return s;
  }

  it('magnet pulls nearby coins in', () => {
    const s = withItem(ITEM_MAGNET);
    const fx: number[] = [];
    balanced(s, 0.5, fx);
    expect(fx).toContain(FX_ITEM);
    expect(s.magnetT).toBeGreaterThan(0);

    // A coin well above the flamingo's head would normally be missed
    s.coinSlots[0] = 1;
    s.coinSlots[1] = s.scrollX + cfg.storkX + 20 * cfg.unit;
    s.coinSlots[2] = cfg.groundY - 45 * cfg.unit;
    s.coinSlots[3] = COIN.VALUE;
    s.nextCoinAt = 1e9;
    const coinsBefore = s.coins;
    balanced(s, 1.5);
    expect(s.coins).toBe(coinsBefore + 1);
  });

  it('balloon saves one fall', () => {
    const s = withItem(ITEM_BALLOON);
    balanced(s, 0.5);
    expect(s.shield).toBe(1);
  });
});

describe('flap', () => {
  it('tapping both sides kills spin once, then needs a cooldown', () => {
    const s = playing();
    s.omega = 2;
    s.angle = 0.4;
    s.input = 3;
    advanceSim(s, cfg, 1 / 120);
    expect(Math.abs(s.omega)).toBeLessThan(2 * FLAP.OMEGA_KEEP + 0.1);
    expect(s.flapCooldown).toBeGreaterThan(0);
    expect(s.flaps).toBe(1);

    s.input = 0;
    advanceSim(s, cfg, 1 / 120);
    s.omega = 2;
    s.input = 3;
    advanceSim(s, cfg, 1 / 120);
    expect(s.flaps).toBe(1);
  });

  it('the flap key works on its own', () => {
    const s = playing();
    const fx: number[] = [];
    s.input = 4;
    advanceSim(s, cfg, 1 / 120);
    for (let i = 0; i < s.fxLen; i++) fx.push(s.fx[i * 2]);
    expect(fx).toContain(FX_FLAP);
  });
});

describe('baby flamingos', () => {
  it('join after surviving without a hit and leave when hit', () => {
    const s = playing();
    const fx: number[] = [];
    balanced(s, CHICKS.EVERY + 0.5, fx);
    expect(fx).toContain(FX_CHICK_JOIN);
    expect(s.chicks).toBe(1);

    // Force a branch hit on an upright flamingo
    s.evType = EVT_OBSTACLE;
    s.evSub = OBS_BRANCH;
    s.evDir = 1;
    s.evStage = STAGE_WARNING;
    s.evTimer = 0.001;
    s.evNextAt = s.t;
    const hitFx: number[] = [];
    balanced(s, 1.5, hitFx);
    expect(hitFx).toContain(FX_CHICK_LOST);
    expect(s.chicks).toBe(0);
  });
});

describe('zones', () => {
  it('enters the beach after the first zone and snow weather on the peaks', () => {
    const s = playing();
    s.meters = BIOMES.LENGTH_M - 0.5;
    const fx: number[] = [];
    balanced(s, 1, fx);
    expect(s.biome).toBe(BIOME_BEACH);
    expect(fx).toContain(FX_BIOME);

    const peak = playing();
    peak.meters = BIOMES.LENGTH_M * 2 + 1;
    peak.nextWeatherAt = peak.t;
    balanced(peak, 0.5);
    expect(peak.biome).toBe(BIOME_SNOW);
    expect(peak.weather).toBe(WEATHER_SNOW);
  });
});

describe('daily course', () => {
  it('keeps the same event order no matter how the player collects coins', () => {
    const order = (lean: number) => {
      const s = createSimState(cfg, MODE_PLAYING, 20260917);
      const seen: number[] = [];
      const dt = 1 / 60;
      for (let t = 0; t < 70 && seen.length < 8; t += dt) {
        const count = s.evCount;
        const predicted = s.angle - lean + s.omega * 0.25;
        s.input = predicted > 0.02 ? 1 : predicted < -0.02 ? 2 : 0;
        advanceSim(s, cfg, dt);
        s.fxLen = 0;
        if (s.mode !== MODE_PLAYING) {
          s.mode = MODE_PLAYING;
          s.angle = 0;
          s.omega = 0;
        }
        if (s.evCount > count) seen.push(s.evType * 10 + s.evSub);
      }
      return seen;
    };
    expect(order(0.12)).toEqual(order(-0.05));
  });
});
