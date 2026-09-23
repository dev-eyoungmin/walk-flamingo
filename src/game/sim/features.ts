import {
  ANIM,
  BIOMES,
  CHICKS,
  COIN,
  FEVER,
  FLAP,
  ITEM_BALLOON,
  ITEM_FEATHER,
  ITEM_MAGNET,
  ITEMS,
  POPUP_BIOME,
  POPUP_CHICK,
  POPUP_FEVER,
  POPUP_ITEM,
  SCORE,
} from './constants';
import { FX_BIOME, FX_CHICK_JOIN, FX_FEVER_END, FX_FEVER_START, FX_FLAP, FX_ITEM } from './fx';
import { emote, partWorld, shake } from './helpers';
import type { SimState } from './state';
import { HIT_CIRCLE_COUNT } from './storkGeometry';
import { SimConfig, terrainOffsetAt } from './terrain';
import { approach, pushFx, randCoin } from './util';

// ─── Fever ─────────────────────────────────────────────────────────────────────

/** Holding max combo charges fever; fever doubles all points for a while. */
export function updateFever(s: SimState, dt: number): void {
  'worklet';
  if (s.feverT > 0) {
    s.feverT -= dt;
    if (s.feverT <= 0) {
      s.feverT = 0;
      s.feverCharge = 0;
      pushFx(s, FX_FEVER_END, 0);
    }
    return;
  }
  if (s.combo >= SCORE.COMBO_MAX) {
    s.feverCharge += dt;
    if (s.feverCharge >= FEVER.CHARGE_TIME) {
      s.feverT = s.feverDuration;
      s.feverCharge = 0;
      s.fevers++;
      s.popKind = POPUP_FEVER;
      s.popT = ANIM.POPUP;
      shake(s, 0.3, 4);
      emote(s, ANIM.HAPPY_LONG, ANIM.CHEER);
      pushFx(s, FX_FEVER_START, 0);
    }
  } else {
    s.feverCharge = 0;
  }
}

// ─── Course items ──────────────────────────────────────────────────────────────

export function updateItems(s: SimState, cfg: SimConfig, dt: number, canSpawn: boolean): void {
  'worklet';
  const U = cfg.unit;
  const it = s.items;

  if (canSpawn && s.meters >= s.nextItemAt) {
    let free = -1;
    for (let i = 0; i < ITEMS.MAX; i++) {
      const b = i * ITEMS.SLOT;
      if (it[b] < 0.5 && it[b + 4] <= 0) {
        free = i;
        break;
      }
    }
    if (free >= 0) {
      const r = randCoin(s);
      // Balloons (a saved fall) are the rare prize
      let type = r < 0.45 ? ITEM_MAGNET : r < 0.85 ? ITEM_FEATHER : ITEM_BALLOON;
      if (type === ITEM_BALLOON && s.shield > 0) type = ITEM_FEATHER;
      const wx = s.scrollX + cfg.width + 60;
      const b = free * ITEMS.SLOT;
      it[b] = 1;
      it[b + 1] = wx;
      it[b + 2] = cfg.groundY + terrainOffsetAt(cfg, wx) - ITEMS.HEIGHT_U * U;
      it[b + 3] = type;
      it[b + 4] = 0;
    }
    s.nextItemAt = s.meters + (ITEMS.GAP_MIN_M + randCoin(s) * ITEMS.GAP_RANGE_M) * s.itemGapMult;
  }

  const storkWorldX = s.scrollX + cfg.storkX;
  const cosA = Math.cos(s.angle);
  const sinA = Math.sin(s.angle);
  const p = [0, 0];
  const itemR = ITEMS.RADIUS_U * U;
  for (let i = 0; i < ITEMS.MAX; i++) {
    const b = i * ITEMS.SLOT;
    if (it[b + 4] > 0) it[b + 4] = Math.max(0, it[b + 4] - dt);
    if (it[b] < 0.5) continue;
    if (it[b + 1] < s.scrollX - 80) {
      it[b] = 0;
      continue;
    }
    if (Math.abs(it[b + 1] - storkWorldX) > 14 * U) continue;
    for (let k = 0; k < HIT_CIRCLE_COUNT; k++) {
      const r = partWorld(s, cfg, k, cosA, sinA, p);
      const dx = it[b + 1] - p[0];
      const dy = it[b + 2] - p[1];
      const rr = r + itemR;
      if (dx * dx + dy * dy < rr * rr) {
        const type = it[b + 3];
        it[b] = 0;
        it[b + 4] = ITEMS.COLLECT_ANIM;
        s.itemsCollected++;
        if (type === ITEM_MAGNET) s.magnetT = s.magnetTime;
        else if (type === ITEM_FEATHER) s.featherT = ITEMS.FEATHER_TIME;
        else s.shield = 1;
        s.popKind = POPUP_ITEM;
        s.popValue = type;
        s.popT = ANIM.POPUP * 0.7;
        emote(s, ANIM.HAPPY, ANIM.CHEER * 0.5);
        pushFx(s, FX_ITEM, type);
        break;
      }
    }
  }

  if (s.magnetT > 0) s.magnetT = Math.max(0, s.magnetT - dt);
  if (s.featherT > 0) s.featherT = Math.max(0, s.featherT - dt);
}

/** Magnet: nearby coins fly toward the flamingo's chest. */
export function pullCoins(s: SimState, cfg: SimConfig, dt: number): void {
  'worklet';
  if (s.magnetT <= 0) return;
  const U = cfg.unit;
  const tx = s.scrollX + cfg.storkX + 1.5 * U;
  const ty = s.feetY - 20 * U;
  const slots = s.coinSlots;
  const step = ITEMS.MAGNET_PULL_U * U * dt;
  for (let c = 0; c < COIN.MAX; c++) {
    const b = c * COIN.SLOT;
    if (slots[b] < 0.5) continue;
    const dx = tx - slots[b + 1];
    if (dx < -ITEMS.MAGNET_RANGE_U * U || dx > 6 * U) continue;
    const dy = ty - slots[b + 2];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) continue;
    const move = Math.min(dist, step);
    slots[b + 1] += (dx / dist) * move;
    slots[b + 2] += (dy / dist) * move;
  }
}

// ─── Flap ──────────────────────────────────────────────────────────────────────

/** Tapping both sides at once (or the flap key) kills most spin and nudges toward upright. */
export function updateFlap(s: SimState, input: number, dt: number): void {
  'worklet';
  const pressed = (input & 3) === 3 || (input & 4) !== 0;
  const wasPressed = (s.prevInput & 3) === 3 || (s.prevInput & 4) !== 0;
  s.prevInput = input;
  if (s.flapAnim > 0) s.flapAnim = Math.max(0, s.flapAnim - dt);
  if (s.flapCooldown > 0) {
    s.flapCooldown = Math.max(0, s.flapCooldown - dt);
    return;
  }
  if (pressed && !wasPressed) {
    s.omega *= FLAP.OMEGA_KEEP;
    s.angle *= FLAP.ANGLE_KEEP;
    s.flapCooldown = FLAP.COOLDOWN;
    s.flapAnim = FLAP.ANIM;
    s.flaps++;
    pushFx(s, FX_FLAP, 0);
  }
}

// ─── Baby flamingos ────────────────────────────────────────────────────────────

/** A chick joins for every stretch survived without getting hit. Chicks mimic the parent's tilt. */
export function updateChicks(s: SimState, dt: number, earning: boolean): void {
  'worklet';
  if (earning && s.chicks < CHICKS.MAX) {
    s.chickTimer += dt;
    if (s.chickTimer >= CHICKS.EVERY) {
      s.chickTimer = 0;
      s.chickJoin[s.chicks] = CHICKS.JOIN_ANIM;
      s.chicks++;
      if (s.chicks > s.chicksMax) s.chicksMax = s.chicks;
      s.popKind = POPUP_CHICK;
      s.popValue = s.chicks;
      s.popT = ANIM.POPUP * 0.8;
      emote(s, ANIM.HAPPY_LONG, ANIM.CHEER);
      pushFx(s, FX_CHICK_JOIN, s.chicks);
    }
  }
  for (let i = 0; i < CHICKS.MAX; i++) {
    if (s.chickJoin[i] > 0) s.chickJoin[i] = Math.max(0, s.chickJoin[i] - dt);
    const target = s.angle * 0.7;
    s.chickAngles[i] += (target - s.chickAngles[i]) * approach(dt, 0.2 + i * 0.12);
  }
  if (s.chickLeaveT > 0) s.chickLeaveT = Math.max(0, s.chickLeaveT - dt);
}

// ─── Zones ─────────────────────────────────────────────────────────────────────

export function biomeAtMeters(meters: number): number {
  'worklet';
  return Math.floor(Math.max(0, meters) / BIOMES.LENGTH_M) % BIOMES.COUNT;
}

export function updateBiome(s: SimState): void {
  'worklet';
  const b = biomeAtMeters(s.meters);
  if (b !== s.biome) {
    s.biome = b;
    s.popKind = POPUP_BIOME;
    s.popValue = b;
    s.popT = ANIM.POPUP;
    emote(s, ANIM.HAPPY, ANIM.CHEER * 0.6);
    pushFx(s, FX_BIOME, b);
  }
}
