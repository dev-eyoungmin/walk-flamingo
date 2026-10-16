import { ANIM, COIN, ENV_GUST, ENV_ICE, ENV_LEAVES, ENV_WAVE, EVT_ENVIRONMENT, MODE_OVER, MODE_PLAYING, EVT_OBSTACLE, EVT_CHALLENGE, CHL_LEAN, STAGE_ACTIVE, STAGE_IDLE, TEXT_KIND_BONUS } from './constants';
import { FX_COIN, FX_PERFECT, FX_RESCUE, FX_STAGE_CLEAR } from './fx';
import { addText, emote, scoreMult } from './helpers';
import type { SimState } from './state';
import { SimConfig, terrainOffsetAt } from './terrain';
import { pushFx, randCoin } from './util';

/** Tight timing is optional: ordinary successful dodges still protect the combo. */
export function awardPerfect(s: SimState): void {
  'worklet';
  if (s.perfectT > 0.8) return;
  s.perfects++;
  s.perfectT = 1.1;
  s.comboProtect = 1.5;
  s.comboGrace = 0;
  s.score += Math.round(60 * scoreMult(s));
  s.comboPulse = ANIM.COMBO_PULSE;
  emote(s, ANIM.HAPPY_LONG, ANIM.CHEER);
  pushFx(s, FX_PERFECT, s.perfects);
}
export function rewardDodge(s: SimState): void {
  'worklet';
  s.comboProtect = 1.2;
  s.comboGrace = 0;
  if (s.t - Math.max(s.lastFlapAt, s.lastLeanAt) <= 0.28) awardPerfect(s);
}
/** Protect intentional avoidance while a hazard is approaching, then allow recovery. */
export function avoidanceWindow(s: SimState): boolean {
  'worklet';
  return s.evStage !== STAGE_IDLE && (s.evType === EVT_OBSTACLE || s.evType === EVT_CHALLENGE && s.evSub === CHL_LEAN);
}
export function regionalForce(s: SimState): number {
  'worklet';
  if (s.evStage !== STAGE_ACTIVE || s.evType !== EVT_ENVIRONMENT) return 0;
  const elapsed = s.evDuration - s.evTimer;
  if (s.evSub === ENV_WAVE) return s.evDir * Math.sin(elapsed / s.evDuration * Math.PI * 2) * 3.2;
  if (s.evSub === ENV_LEAVES) return s.evDir * (1.8 + Math.sin(elapsed * 5) * 1.2);
  return 0;
}
/** A choice coin sits beyond the upright body's reach and cannot be pulled by magnets. */
export function spawnGold(s: SimState, cfg: SimConfig, canSpawn: boolean): void {
  'worklet';
  if (!canSpawn || s.meters < s.nextGoldAt) return;
  for (let c = 0; c < COIN.MAX; c++) {
    const b = c * COIN.SLOT;
    if (s.coinSlots[b] > 0.5 || s.coinSlots[b + 4] > 0) continue;
    const wx = s.scrollX + cfg.width + 30;
    s.coinSlots[b] = 1;
    s.coinSlots[b+1] = wx;
    s.coinSlots[b+2] = cfg.groundY + terrainOffsetAt(cfg, wx) - 12 * cfg.unit;
    s.coinSlots[b+3] = 100;
    s.coinSlots[b+4] = 0;
    s.coinSlots[b+5] = 2;
    s.coinSlots[b+6] = 0;
    s.nextGoldAt = s.meters + 24 + randCoin(s) * 12;
    return;
  }
}
export function updateAdventure(s: SimState, cfg: SimConfig, dt: number, canSpawn: boolean): void {
  'worklet';
  if (s.mode !== MODE_PLAYING) return;
  s.perfectT = Math.max(0, s.perfectT - dt);
  s.comboProtect = Math.max(0, s.comboProtect - dt);
  if (canSpawn && s.rescueX < 0 && !s.rescueCargo && s.meters >= s.nextRescueAt) {
    s.rescueX = s.scrollX + cfg.width + 20;
  }
  if (s.rescueX >= 0 && s.scrollX + cfg.storkX >= s.rescueX - 3 * cfg.unit) {
    s.rescueX = -1;
    s.rescueCargo = 1;
    s.nestAt = s.meters + 22;
    s.nextRescueAt = s.nestAt + 15;
    emote(s, ANIM.HAPPY, ANIM.CHEER);
    pushFx(s, FX_RESCUE, 0);
  }
  if (s.rescueCargo && s.meters >= s.nestAt) {
    s.rescueCargo = 0;
    s.rescued++;
    s.coins += 5;
    const reward = Math.round(150 * scoreMult(s));
    s.score += reward;
    addText(s, cfg.storkX, s.feetY - s.camY - 25 * cfg.unit, reward, TEXT_KIND_BONUS);
    emote(s, ANIM.HAPPY_LONG, ANIM.CHEER);
    pushFx(s, FX_RESCUE, 1);
  }
  const elapsed = s.t - s.playStart;
  if (elapsed >= s.nextTraceAt && s.trace.length < 2401) {
    s.trace.push(s.meters);
    s.nextTraceAt += 0.5;
  }
  const won = s.stage === 1 ? s.meters >= 60 : s.stage === 2 ? s.dodges >= 5 : s.stage === 3 ? s.rescued >= 2 : false;
  if (s.stage && (won || elapsed >= (s.stage === 1 ? 60 : s.stage === 2 ? 90 : 100))) {
    s.stageWon = won ? 1 : 0;
    s.stageExpired = won ? 0 : 1;
    s.mode = MODE_OVER;
    s.gameOverSent = 0;
    if (won) { s.score += 300; s.coins += 10; pushFx(s, FX_STAGE_CLEAR, s.stage); }
  }
}
