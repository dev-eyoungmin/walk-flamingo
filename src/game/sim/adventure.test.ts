import { CHL_LEAN, COIN, ENV_ICE, ENV_LEAVES, ENV_WAVE, EVT_CHALLENGE, EVT_ENVIRONMENT, MODE_OVER, MODE_PLAYING, OBS_ROCK, SCORE, STAGE_ACTIVE, STAGE_IDLE } from './constants';
import { avoidanceWindow, regionalForce, rewardDodge, spawnGold, updateAdventure } from './adventure';
import { createSimState } from './state';
import { advanceSim, stepSim } from './step';
import { makeSimConfig, TERRAIN_FLAT } from './terrain';
import { updateFlap, pullCoins } from './features';
import { updateEvents, updateObstacle } from './events';
import { hurt, scoreMult } from './helpers';
import { FX_PERFECT, FX_RESCUE, FX_STAGE_CLEAR } from './fx';

const cfg = makeSimConfig(844, 330, [TERRAIN_FLAT, 20, 0]);
function playing(options = {}) {
  const s = createSimState(cfg, MODE_PLAYING, 234, options);
  s.t = 10; s.graceEnd = 0; s.evNextAt = 1e9; s.nextWeatherAt = 1e9;
  return s;
}
const codes = (s: ReturnType<typeof playing>) => s.fx.slice(0, s.fxLen*2).filter((_, i) => i % 2 === 0);

describe('skill rewards and traits', () => {
  it('protects successful avoidance and awards tight timing once', () => {
    const s = playing(); s.combo = 3; s.lastLeanAt = s.t - 0.15;
    s.obs = [1, OBS_ROCK, s.scrollX+cfg.storkX+3*cfg.unit, cfg.groundY, -340, 0, 0, 1, 1, 0, 0];
    // Reset unresolved state and lean away from the approaching rock.
    s.obs[7] = 0; s.angle = -0.2;
    updateObstacle(s, cfg, 1/120);
    expect(s.dodges).toBe(1); expect(s.perfects).toBe(1);
    expect(s.comboProtect).toBeGreaterThan(1); expect(codes(s)).toContain(FX_PERFECT);
    updateObstacle(s, cfg, 1/120); expect(s.perfects).toBe(1);
  });
  it('an early dodge still protects combo without a perfect reward', () => {
    const s = playing(); s.combo = 4; rewardDodge(s);
    expect(s.perfects).toBe(0); expect(s.combo).toBe(4);
    s.angle = 0.4; s.input = 1; stepSim(s, cfg, 1/120);
    expect(s.combo).toBe(4);
    hurt(s); expect(s.comboProtect).toBe(0);
  });
  it('holds combo through intentional leaning challenges', () => {
    const s = playing(); s.evStage = STAGE_ACTIVE; s.evType = EVT_CHALLENGE; s.evSub = CHL_LEAN;
    s.evTimer=3.5; s.chNeed=1.2;
    expect(avoidanceWindow(s)).toBe(true);
    s.combo = 3; s.angle = 0.3;
    for (let i=0; i<70; i++) { s.angle=0.3; s.omega=0; stepSim(s,cfg,1/120); }
    expect(s.combo).toBe(3);
  });
  it('flap rewards a real danger recovery; acrobat recharges sooner', () => {
    const s = playing({ trait: 2 }); s.danger = 0.9; s.angle = 0.95;
    updateFlap(s, 4, 1/120);
    expect(s.perfects).toBe(1); expect(s.flapCooldown).toBe(3.5);
    updateFlap(s, 4, 1/120); expect(s.perfects).toBe(1);
    const grace = createSimState(cfg, MODE_PLAYING, 1); grace.danger=0.9;
    updateFlap(grace,4,1/120); expect(grace.perfects).toBe(0);
  });
  it('family doubles only the baby bonus', () => {
    const s = playing({ trait: 3 }); s.chicks=2;
    expect(scoreMult(s)).toBeCloseTo(1.4);
  });
});

describe('gold choices, recovery rhythm and regional hazards', () => {
  it('gold needs intentional tilt and cannot be magnetized', () => {
    const s = playing(); s.meters=16; spawnGold(s,cfg,true);
    expect(s.coinSlots[5]).toBe(2);
    const b=0; s.coinSlots[b+1]=cfg.storkX; s.coinSlots[b+2]=cfg.groundY-12*cfg.unit;
    s.magnetT=8; const before=s.coinSlots.slice(); pullCoins(s,cfg,1);
    expect(s.coinSlots).toEqual(before);
    s.nextCoinAt=1e9; advanceSim(s,cfg,1/120); expect(s.golds).toBe(0);
    s.angle=0.35; s.omega=0; s.input=1; advanceSim(s,cfg,1/120);
    expect(s.golds).toBe(1); expect(s.coins).toBe(5);
  });
  it('does not spawn choice coins during blocked periods', () => {
    const s=playing(); s.meters=30; spawnGold(s,cfg,false);
    expect(s.coinSlots.every(v=>v===0)).toBe(true);
  });
  it('a hard event ends with rest and a coin opportunity', () => {
    const s=playing(); s.evStage=STAGE_ACTIVE; s.evType=EVT_ENVIRONMENT; s.evSub=ENV_ICE; s.evTimer=0;
    updateEvents(s,cfg,1/120,20,false);
    expect(s.evNextAt).toBeGreaterThanOrEqual(s.restUntil);
    expect(s.restUntil).toBeGreaterThan(s.t); expect(s.evStage).toBe(STAGE_IDLE); expect(s.nextCoinAt).toBe(s.meters);
  });
  it('the wave reverses force, leaves stay directional, and warnings exert no force', () => {
    const s=playing(); s.evStage=STAGE_ACTIVE; s.evType=EVT_ENVIRONMENT; s.evSub=ENV_WAVE; s.evDuration=4;
    s.evTimer=3; expect(regionalForce(s)).toBeGreaterThan(0);
    s.evTimer=1; expect(regionalForce(s)).toBeLessThan(0);
    s.evSub=ENV_LEAVES; expect(regionalForce(s)).toBeGreaterThan(0);
    s.evStage=1; expect(regionalForce(s)).toBe(0);
  });
});

describe('rescue and short adventures', () => {
  it('pickup, delivery and reward occur once, and hits lose the passenger', () => {
    const s=playing(); s.meters=18; updateAdventure(s,cfg,1/120,true);
    expect(s.rescueX).toBeGreaterThan(cfg.storkX);
    s.scrollX=s.rescueX-cfg.storkX;
    updateAdventure(s,cfg,1/120,true); expect(s.rescueCargo).toBe(1);
    s.meters=s.nestAt; updateAdventure(s,cfg,1/120,true);
    expect(s.rescued).toBe(1); expect(s.coins).toBe(5); expect(codes(s)).toContain(FX_RESCUE);
    updateAdventure(s,cfg,1/120,true); expect(s.rescued).toBe(1);
    s.rescueCargo=1; hurt(s); expect(s.rescueCargo).toBe(0);
  });
  it.each([1,2,3])('stage %i finishes successfully with its own target', stage => {
    const s=playing({stage}); s.meters=stage===1 ? 60 : 0; s.dodges=stage===2 ? 5 : 0; s.rescued=stage===3 ? 2 : 0;
    updateAdventure(s,cfg,1/120,false);
    expect(s.mode).toBe(MODE_OVER); expect(s.stageWon).toBe(1); expect(s.coins).toBe(10);
    expect(codes(s)).toContain(FX_STAGE_CLEAR);
    updateAdventure(s,cfg,1/120,false); expect(s.coins).toBe(10);
  });
  it.each([1,2,3])('stage %i expires without a success reward', stage => {
    const s=playing({stage}); s.t=101;
    updateAdventure(s,cfg,1/120,false);
    expect(s.mode).toBe(MODE_OVER); expect(s.stageWon).toBe(0); expect(s.coins).toBe(0);
  });
  it('endless mode has no deadline', () => {
    const s=playing(); s.t=500; updateAdventure(s,cfg,1/120,false);
    expect(s.mode).toBe(MODE_PLAYING);
  });
});
