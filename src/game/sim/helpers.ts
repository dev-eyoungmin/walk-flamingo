import { ANIM, CHICKS, FEVER, FLOAT_TEXT } from './constants';
import { FX_CHICK_LOST } from './fx';
import type { SimState } from './state';
import { STORK_HIT_CIRCLES } from './storkGeometry';
import type { SimConfig } from './terrain';
import { pushFx } from './util';

export function addText(s: SimState, x: number, y: number, value: number, kind: number): void {
  'worklet';
  const tx = s.texts;
  let slot = 0;
  let oldest = -1;
  for (let i = 0; i < FLOAT_TEXT.MAX; i++) {
    const b = i * FLOAT_TEXT.SLOT;
    if (tx[b] < 0.5) {
      slot = i;
      oldest = -2;
      break;
    }
    if (tx[b + 1] > oldest) {
      oldest = tx[b + 1];
      slot = i;
    }
  }
  const b = slot * FLOAT_TEXT.SLOT;
  tx[b] = 1;
  tx[b + 1] = 0;
  tx[b + 2] = x;
  tx[b + 3] = y;
  tx[b + 4] = value;
  tx[b + 5] = kind;
}

/** Character reactions (visual only). */
export function emote(s: SimState, happy: number, cheer = 0): void {
  'worklet';
  if (s.hurtT > 0.2) return;
  if (happy > s.happyT) s.happyT = happy;
  if (cheer > s.cheerT) s.cheerT = cheer;
}

/** Getting hit: hurt face, and a baby flamingo runs off. */
export function hurt(s: SimState): void {
  'worklet';
  s.hurtT = ANIM.HURT;
  s.happyT = 0;
  s.cheerT = 0;
  s.chickTimer = 0;
  if (s.chicks > 0) {
    s.chicks--;
    s.chickJoin[s.chicks] = 0;
    s.chickLeaveT = CHICKS.LEAVE_ANIM;
    pushFx(s, FX_CHICK_LOST, s.chicks);
  }
}

export function breakCombo(s: SimState): void {
  'worklet';
  if (s.combo > 1) s.comboBreak = ANIM.COMBO_BREAK;
  s.combo = 1;
  s.comboT = 0;
  s.comboGrace = 0;
  if (s.feverT <= 0) s.feverCharge = 0;
}

export function shake(s: SimState, duration: number, magnitude: number): void {
  'worklet';
  if (s.shakeT <= 0 || magnitude >= s.shakeMag) {
    s.shakeT = duration;
    s.shakeMag = magnitude;
  }
}

/** Everything that multiplies earned points: combo, fever, and baby flamingos. */
export function scoreMult(s: SimState): number {
  'worklet';
  const fever = s.feverT > 0 ? FEVER.SCORE_MULT : 1;
  return s.combo * fever * (1 + CHICKS.SCORE_BONUS * s.chicks);
}

/** World position of a stork hit circle after tilt. Writes into out[0..1]. */
export function partWorld(s: SimState, cfg: SimConfig, index: number, cosA: number, sinA: number, out: number[]): number {
  'worklet';
  const U = cfg.unit;
  const x = STORK_HIT_CIRCLES[index * 3];
  const y = STORK_HIT_CIRCLES[index * 3 + 1];
  out[0] = s.scrollX + cfg.storkX + (x * cosA - y * sinA) * U;
  out[1] = s.feetY + (x * sinA + y * cosA) * U;
  return STORK_HIT_CIRCLES[index * 3 + 2] * U;
}
