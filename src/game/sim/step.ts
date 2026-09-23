import {
  ANIM,
  BIOME_SNOW,
  BIOMES,
  BOOST,
  CHL_STORM,
  COIN,
  DIFFICULTY,
  ENV_GUST,
  ENV_QUAKE,
  ENVIRONMENT,
  EVENTS,
  EVT_CHALLENGE,
  EVT_ENVIRONMENT,
  EVT_NONE,
  EVT_OBSTACLE,
  FLOAT_TEXT,
  ITEMS,
  LAYOUT,
  MAX_STEPS_PER_FRAME,
  MILESTONES_M,
  MODE_ATTRACT,
  MODE_FALLING,
  MODE_OVER,
  MODE_PLAYING,
  PHYSICS,
  POPUP_MILESTONE,
  POPUP_RANK,
  POPUP_SHIELD,
  SCORE,
  SIM_STEP,
  STAGE_ACTIVE,
  STAGE_IDLE,
  TEXT_KIND_BONUS,
  TEXT_KIND_COIN,
  WALK,
  WEATHER_RAIN,
  WEATHER_SNOW,
  WEATHER_WINDY,
  OBS_GULL,
  POPUP_BEST,
  ROOKIE,
  TEXT_KIND_NICE,
  TUT_DONE,
  TUT_FLAP,
  TUT_HOLD_LEFT,
  TUT_HOLD_RIGHT,
  TUTORIAL,
} from './constants';
import { gullForce, updateEvents, updateObstacle } from './events';
import { pullCoins, updateBiome, updateChicks, updateFever, updateFlap, updateItems } from './features';
import {
  FX_COIN,
  FX_COMBO_UP,
  FX_FALL,
  FX_GAME_OVER,
  FX_MILESTONE,
  FX_NEAR_MISS,
  FX_RANK_UP,
  FX_SHIELD_SAVE,
  FX_BEST_PASSED,
  FX_TUTORIAL_STEP,
} from './fx';
import { addText, breakCombo, emote, partWorld, scoreMult, shake } from './helpers';
import { OBS_SLOT, SimState } from './state';
import { HIT_CIRCLE_COUNT, STORK } from './storkGeometry';
import { SimConfig, terrainOffsetAt, terrainSlopeAt } from './terrain';
import { approach, clamp, lerp, pushFx, randCoin, randWind, smooth01 } from './util';
import { RANK_THRESHOLDS_M } from '../../lib/ranks';

// ─── Difficulty curves (exported for tests and tuning) ─────────────────────────

export function gravityMultAt(effT: number): number {
  'worklet';
  const early = smooth01(effT / DIFFICULTY.GRAVITY_EARLY_TIME);
  const g =
    lerp(DIFFICULTY.GRAVITY_EARLY_START, DIFFICULTY.GRAVITY_EARLY_END, early) +
    Math.max(0, effT - DIFFICULTY.GRAVITY_EARLY_TIME) * DIFFICULTY.GRAVITY_LATE_RATE;
  return Math.min(g, DIFFICULTY.GRAVITY_MAX);
}

export function dampingAt(effT: number): number {
  'worklet';
  return lerp(PHYSICS.DAMPING_START, PHYSICS.DAMPING_END, smooth01(effT / PHYSICS.DAMPING_RAMP_TIME));
}

export function windStrengthAt(effT: number): number {
  'worklet';
  const w =
    lerp(DIFFICULTY.WIND_START, DIFFICULTY.WIND_EARLY_END, smooth01(effT / DIFFICULTY.WIND_EARLY_TIME)) +
    Math.max(0, effT - DIFFICULTY.WIND_EARLY_TIME) * DIFFICULTY.WIND_LATE_RATE;
  return Math.min(w, DIFFICULTY.WIND_MAX);
}

// ─── Subsystems ────────────────────────────────────────────────────────────────

function updateCoins(s: SimState, cfg: SimConfig, dt: number, canSpawn: boolean): void {
  'worklet';
  const U = cfg.unit;
  const slots = s.coinSlots;

  if (canSpawn && s.meters >= s.nextCoinAt) {
    const count = 1 + Math.floor(randCoin(s) * 5);
    const pattern = Math.floor(randCoin(s) * 3);
    const startX = s.scrollX + cfg.width + 30;
    const spacing = COIN.SPACING_M * cfg.pxPerMeter;
    for (let i = 0; i < count; i++) {
      let free = -1;
      for (let c = 0; c < COIN.MAX; c++) {
        const b = c * COIN.SLOT;
        if (slots[b] < 0.5 && slots[b + 4] <= 0) {
          free = c;
          break;
        }
      }
      if (free < 0) break;
      const wx = startX + i * spacing;
      const frac = count > 1 ? i / (count - 1) : 0.5;
      let hU = 17;
      if (pattern === 1) hU = 17 + 11 * Math.sin(frac * Math.PI);
      else if (pattern === 2) hU = 28;
      const big = hU >= 26 ? 1 : 0;
      const b = free * COIN.SLOT;
      slots[b] = 1;
      slots[b + 1] = wx;
      slots[b + 2] = cfg.groundY + terrainOffsetAt(cfg, wx) - hU * U;
      slots[b + 3] = big ? COIN.BIG_VALUE : COIN.VALUE;
      slots[b + 4] = 0;
      slots[b + 5] = big;
      slots[b + 6] = 0;
    }
    s.nextCoinAt = s.meters + COIN.GAP_MIN + randCoin(s) * COIN.GAP_RANGE + count * COIN.SPACING_M;
  }

  pullCoins(s, cfg, dt);

  const storkWorldX = s.scrollX + cfg.storkX;
  const cosA = Math.cos(s.angle);
  const sinA = Math.sin(s.angle);
  const p = [0, 0];
  const coinR = (COIN.RADIUS_U + COIN.MAGNET_U) * U;
  for (let c = 0; c < COIN.MAX; c++) {
    const b = c * COIN.SLOT;
    if (slots[b + 4] > 0) slots[b + 4] = Math.max(0, slots[b + 4] - dt);
    if (slots[b] < 0.5) continue;
    if (slots[b + 6] > 0) {
      // Coin rain: falls until it lands, then disappears
      slots[b + 2] += slots[b + 6] * dt;
      if (slots[b + 2] > cfg.groundY + terrainOffsetAt(cfg, slots[b + 1]) - COIN.RADIUS_U * U) {
        slots[b] = 0;
        continue;
      }
    }
    const wx = slots[b + 1];
    if (wx < s.scrollX - 60) {
      slots[b] = 0;
      continue;
    }
    if (Math.abs(wx - storkWorldX) > 14 * U || s.mode !== MODE_PLAYING) continue;
    const wy = slots[b + 2];
    for (let k = 0; k < HIT_CIRCLE_COUNT; k++) {
      const r = partWorld(s, cfg, k, cosA, sinA, p);
      const dx = wx - p[0];
      const dy = wy - p[1];
      const rr = r + coinR;
      if (dx * dx + dy * dy < rr * rr) {
        const value = Math.round(slots[b + 3] * scoreMult(s));
        slots[b] = 0;
        slots[b + 4] = COIN.COLLECT_ANIM;
        s.coins += 1;
        s.score += value;
        addText(s, wx - s.scrollX, wy - s.camY, value, TEXT_KIND_COIN);
        pushFx(s, FX_COIN, value);
        emote(s, ANIM.HAPPY_SHORT);
        break;
      }
    }
  }
}

function updateEnvironment(s: SimState, dt: number): void {
  'worklet';
  s.dayT = (s.t / ENVIRONMENT.DAY_CYCLE) % 1;
  const active = s.t < s.weatherEnd;
  s.weatherAmt += ((active ? 1 : 0) - s.weatherAmt) * approach(dt, ENVIRONMENT.WEATHER_FADE / 3);
  if (!active && s.t >= s.nextWeatherAt && s.weatherAmt < 0.05) {
    // Weather suits the zone: snow on the peaks, wind on the beach and in the woods
    const other = s.biome === BIOME_SNOW ? WEATHER_SNOW : WEATHER_WINDY;
    s.weather = randWind(s) < BIOMES.RAIN_CHANCE[s.biome] ? WEATHER_RAIN : other;
    const duration = ENVIRONMENT.WEATHER_DURATION_MIN + randWind(s) * ENVIRONMENT.WEATHER_DURATION_RANGE;
    s.weatherEnd = s.t + duration;
    s.nextWeatherAt = s.weatherEnd + ENVIRONMENT.WEATHER_GAP_MIN + randWind(s) * ENVIRONMENT.WEATHER_GAP_RANGE;
  }
}

function updateProgression(s: SimState): void {
  'worklet';
  if (s.bestMeters > 0 && s.bestPassed === 0 && s.meters >= s.bestMeters) {
    s.bestPassed = 1;
    s.popKind = POPUP_BEST;
    s.popValue = Math.floor(s.bestMeters);
    s.popT = ANIM.POPUP;
    shake(s, 0.3, 4);
    emote(s, ANIM.HAPPY_LONG, ANIM.CHEER);
    pushFx(s, FX_BEST_PASSED, s.popValue);
    return;
  }
  for (let i = 0; i < MILESTONES_M.length; i++) {
    const m = MILESTONES_M[i];
    if (s.meters >= m && s.lastMilestone < m) {
      s.lastMilestone = m;
      s.popKind = POPUP_MILESTONE;
      s.popValue = m;
      s.popT = ANIM.POPUP;
      shake(s, 0.25, 3);
      pushFx(s, FX_MILESTONE, m);
      emote(s, ANIM.HAPPY, ANIM.CHEER);
      break;
    }
  }
  let idx = 0;
  for (let i = 0; i < RANK_THRESHOLDS_M.length; i++) {
    if (s.meters >= RANK_THRESHOLDS_M[i]) idx = i;
  }
  if (idx > s.rankIdx) {
    s.rankIdx = idx;
    s.popKind = POPUP_RANK;
    s.popValue = idx;
    s.popT = ANIM.POPUP;
    shake(s, 0.3, 4);
    pushFx(s, FX_RANK_UP, idx);
    emote(s, ANIM.HAPPY_LONG, ANIM.CHEER * 1.25);
  }
}

/** Eyes follow the incoming obstacle, else the next coin or item, else look ahead. */
function updateLook(s: SimState, cfg: SimConfig, dt: number): void {
  'worklet';
  const U = cfg.unit;
  const headX = s.scrollX + cfg.storkX + STORK.HEAD_X * U;
  const headY = s.feetY + (STORK.HIP_Y + STORK.HEAD_Y) * U;
  let tx = 0.45;
  let ty = 0.05;
  const o = s.obs;
  if (o[0] > 0.5 && o[7] < 0.5) {
    tx = clamp((o[2] - headX) / (8 * U), -1, 1);
    ty = clamp((o[3] - headY) / (8 * U), -1, 1);
  } else {
    let nearest = 30 * U;
    const slots = s.coinSlots;
    for (let c = 0; c < COIN.MAX; c++) {
      const b = c * COIN.SLOT;
      if (slots[b] < 0.5) continue;
      const dx = slots[b + 1] - headX;
      if (dx > -2 * U && dx < nearest) {
        nearest = dx;
        tx = clamp(dx / (10 * U), -1, 1);
        ty = clamp((slots[b + 2] - headY) / (8 * U), -1, 1);
      }
    }
    const it = s.items;
    for (let i = 0; i < ITEMS.MAX; i++) {
      const b = i * ITEMS.SLOT;
      if (it[b] < 0.5) continue;
      const dx = it[b + 1] - headX;
      if (dx > -2 * U && dx < nearest) {
        nearest = dx;
        tx = clamp(dx / (10 * U), -1, 1);
        ty = clamp((it[b + 2] - headY) / (8 * U), -1, 1);
      }
    }
  }
  const k = approach(dt, 0.12);
  s.lookX += (tx - s.lookX) * k;
  s.lookY += (ty - s.lookY) * k;
}

function decayAnims(s: SimState, dt: number): void {
  'worklet';
  if (s.comboPulse > 0) s.comboPulse = Math.max(0, s.comboPulse - dt);
  if (s.comboBreak > 0) s.comboBreak = Math.max(0, s.comboBreak - dt);
  if (s.nearMissT > 0) s.nearMissT = Math.max(0, s.nearMissT - dt);
  if (s.nearMissCooldown > 0) s.nearMissCooldown -= dt;
  if (s.hitFlash > 0) s.hitFlash = Math.max(0, s.hitFlash - dt);
  if (s.happyT > 0) s.happyT = Math.max(0, s.happyT - dt);
  if (s.hurtT > 0) s.hurtT = Math.max(0, s.hurtT - dt);
  if (s.cheerT > 0) s.cheerT = Math.max(0, s.cheerT - dt);
  if (s.popT > 0) s.popT = Math.max(0, s.popT - dt);
  if (s.shakeT > 0) s.shakeT = Math.max(0, s.shakeT - dt);
  const tx = s.texts;
  for (let i = 0; i < FLOAT_TEXT.MAX; i++) {
    const b = i * FLOAT_TEXT.SLOT;
    if (tx[b] < 0.5) continue;
    tx[b + 1] += dt;
    if (tx[b + 1] >= FLOAT_TEXT.DURATION) tx[b] = 0;
  }
}

/** First run: hold left, hold right, then flap. Each step waits for the player (or times out). */
function updateTutorial(s: SimState, cfg: SimConfig, input: number, dt: number): void {
  'worklet';
  s.tutStepT += dt;
  let done = false;
  if (s.tutStep === TUT_HOLD_LEFT || s.tutStep === TUT_HOLD_RIGHT) {
    // Teaches which side to press: counts time on the right side (the tilt is the visible feedback)
    const bit = s.tutStep === TUT_HOLD_LEFT ? 1 : 2;
    if ((input & 3) === bit) s.tutHold += dt;
    else s.tutHold = Math.max(0, s.tutHold - dt * 0.5);
    done = s.tutHold >= TUTORIAL.HOLD_TIME;
  } else if (s.tutStep === TUT_FLAP) {
    done = s.flapAnim > 0;
  }
  if (!done && s.tutStepT < TUTORIAL.AUTO_ADVANCE) return;

  const step = s.tutStep;
  s.tutStep++;
  s.tutHold = 0;
  s.tutStepT = 0;
  s.angle *= TUTORIAL.STEP_ANGLE_KEEP;
  s.omega *= 0.2;
  addText(s, cfg.storkX + 14 * cfg.unit, s.feetY - s.camY - 18 * cfg.unit, 0, TEXT_KIND_NICE);
  emote(s, ANIM.HAPPY, ANIM.CHEER);
  pushFx(s, FX_TUTORIAL_STEP, step);
  if (s.tutStep === TUT_DONE) {
    // Real play starts now: a normal grace period, then the usual first event
    s.playStart = s.t;
    s.graceEnd = s.t + PHYSICS.GRACE_PERIOD;
    s.evNextAt = s.graceEnd + EVENTS.FIRST_DELAY;
    s.nextCoinAt = s.meters + 2;
    s.nextItemAt = Math.max(s.nextItemAt, s.meters + ITEMS.FIRST_M);
    s.chickTimer = 0;
  }
}

/** Input for the start-screen autopilot. */
export function autopilotInput(s: SimState): number {
  'worklet';
  const predicted = s.angle + s.omega * 0.3;
  if (predicted > 0.04) return 1;
  if (predicted < -0.04) return 2;
  return 0;
}

// ─── Main step ─────────────────────────────────────────────────────────────────

export function stepSim(s: SimState, cfg: SimConfig, dt: number): void {
  'worklet';
  const U = cfg.unit;

  // After a fall the clock keeps running for visuals (shake, clouds, stars) but nothing is scored
  if (s.mode === MODE_OVER) {
    decayAnims(s, dt);
    s.t += dt;
    return;
  }

  if (s.mode === MODE_FALLING) {
    s.t += dt;
    s.fallT += dt;
    const dir = s.angle >= 0 ? 1 : -1;
    s.omega += dir * 9 * dt;
    s.angle += s.omega * dt;
    decayAnims(s, dt);
    updateObstacle(s, cfg, dt);
    updateChicks(s, dt, false);
    for (let c = 0; c < COIN.MAX; c++) {
      const b = c * COIN.SLOT + 4;
      if (s.coinSlots[b] > 0) s.coinSlots[b] = Math.max(0, s.coinSlots[b] - dt);
    }
    if (s.fallT >= PHYSICS.FALL_DURATION) {
      s.mode = MODE_OVER;
      pushFx(s, FX_GAME_OVER, 0);
    }
    return;
  }

  const attract = s.mode === MODE_ATTRACT;
  const t = s.t;
  // The tutorial keeps the run in a gentle, fall-proof grace until it's finished
  const tutorial = !attract && s.tutStep >= TUT_HOLD_LEFT && s.tutStep < TUT_DONE;
  if (tutorial) s.graceEnd = t + PHYSICS.GRACE_PERIOD;
  const inGrace = !attract && t < s.graceEnd;
  const graceRatio = tutorial
    ? TUTORIAL.GRAVITY
    : inGrace
      ? clamp((t - (s.graceEnd - PHYSICS.GRACE_PERIOD)) / PHYSICS.GRACE_PERIOD, 0, 1)
      : 1;
  const effT = attract ? 0 : Math.max(0, t - s.playStart - PHYSICS.GRACE_PERIOD);
  // New players get a slower difficulty clock (walk speed and scoring keep the real one)
  const effD = effT * lerp(1, ROOKIE.SLOWEST, s.rookie);
  const slowmo = s.slowT > 0;
  const calm = s.featherT > 0 ? ITEMS.FEATHER_CALM : 1;

  // ── Difficulty ──
  const surge = 1 + DIFFICULTY.SURGE_AMOUNT * (Math.sin(effT * DIFFICULTY.SURGE_FREQ) + 1) * 0.5;
  let gravity = gravityMultAt(effD) * surge * graceRatio;
  if (slowmo) gravity *= BOOST.SLOWMO_GRAVITY_MULT;
  if (s.featherT > 0) gravity *= ITEMS.FEATHER_GRAVITY;
  if (attract) gravity = 1.2;

  let damping = dampingAt(effD);
  if (s.weather === WEATHER_RAIN || s.weather === WEATHER_SNOW) {
    damping *= lerp(1, PHYSICS.RAIN_DAMPING_MULT, s.weatherAmt);
  }
  damping = lerp(damping, PHYSICS.ICE_DAMPING, s.iceAmt);

  // ── Wind: holds a direction for a readable stretch, then eases to the next ──
  s.windHold -= dt;
  if (s.windHold <= 0) {
    const k = smooth01(effD / DIFFICULTY.RAMP_TIME);
    s.windHold =
      lerp(DIFFICULTY.WIND_HOLD_MIN_START, DIFFICULTY.WIND_HOLD_MIN_END, k) +
      randWind(s) * lerp(DIFFICULTY.WIND_HOLD_RANGE_START, DIFFICULTY.WIND_HOLD_RANGE_END, k);
    let strength = windStrengthAt(effD);
    if (s.weather === WEATHER_WINDY) strength += ENVIRONMENT.WINDY_EXTRA_WIND * s.weatherAmt;
    if (randWind(s) < DIFFICULTY.WIND_CALM_CHANCE) {
      s.windTarget = 0;
    } else {
      s.windTarget = (randWind(s) < 0.5 ? -1 : 1) * strength * (0.5 + randWind(s) * 0.8);
    }
  }
  const windGoal = s.windTarget * graceRatio * (attract ? 0.3 : 1);
  s.wind += (windGoal - s.wind) * approach(dt, DIFFICULTY.WIND_SMOOTH_TAU);

  // ── Input ──
  const input = attract ? autopilotInput(s) : s.input;
  if (tutorial && s.tutStep === TUT_FLAP) s.flapCooldown = 0;
  if (!attract) updateFlap(s, input, dt);
  if (tutorial) updateTutorial(s, cfg, input, dt);
  const dir = ((input & 2) !== 0 ? 1 : 0) - ((input & 1) !== 0 ? 1 : 0);
  const tiltRatio = Math.min(1, Math.abs(s.angle) / PHYSICS.GAME_OVER_ANGLE);
  let torque = PHYSICS.PLAYER_TORQUE * (1 + PHYSICS.RECOVERY_ASSIST * tiltRatio);
  if (dir !== 0 && dir * s.omega < 0) torque *= PHYSICS.COUNTER_STEER;

  // ── Forces ──
  let speedFeel = 1;
  if (s.speedMod > 1.05) speedFeel = 1.2;
  else if (s.speedMod < 0.95) speedFeel = 0.8;
  const wobbleAmp =
    Math.min(DIFFICULTY.WOBBLE_MAX, DIFFICULTY.WOBBLE_START + effD * DIFFICULTY.WOBBLE_RATE) *
    speedFeel *
    calm *
    (attract ? 0.5 : 1);
  const wobble =
    (Math.sin(t * 7.3 + 1.2) * 1.8 +
      Math.sin(t * 13.1 + 3.7) * 1.2 +
      Math.sin(t * 3.9) * 0.8 +
      Math.sin(t * 19.7 + 5.1) * 0.6) *
    wobbleAmp;

  let eventForce = 0;
  if (s.evStage === STAGE_ACTIVE) {
    if (s.evType === EVT_ENVIRONMENT) {
      if (s.evSub === ENV_GUST) eventForce += s.evDir * s.gustForce;
      else if (s.evSub === ENV_QUAKE) eventForce += Math.sin(t * 22) * s.quakeAmp;
    } else if (s.evType === EVT_CHALLENGE && s.evSub === CHL_STORM) {
      eventForce += Math.sin(t * 2.2) * EVENTS.STORM_GUST + Math.sin(t * 22) * EVENTS.STORM_QUAKE;
    }
  }
  if (s.obs[0] > 0.5 && s.obs[1] === OBS_GULL) eventForce += gullForce(s, effD);

  const acc =
    PHYSICS.GRAVITY * Math.sin(s.angle) * gravity +
    dir * torque +
    s.wind * (slowmo ? BOOST.SLOWMO_GRAVITY_MULT : 1) * calm +
    wobble +
    eventForce +
    s.slope * WALK.SLOPE_PUSH;

  // Exponential damping integrates exactly regardless of step size
  s.omega = s.omega * Math.exp(-damping * dt) + acc * dt;
  s.angle += s.omega * dt;

  // ── Grace / invulnerability clamps ──
  if (inGrace || attract || s.invulnT > 0) {
    const limit = s.invulnT > 0 ? PHYSICS.GAME_OVER_ANGLE * 0.85 : tutorial ? TUTORIAL.MAX_ANGLE : PHYSICS.GRACE_MAX_ANGLE;
    if (Math.abs(s.angle) > limit) {
      const sign = s.angle > 0 ? 1 : -1;
      s.angle = sign * limit;
      if (s.omega * sign > 0) s.omega = 0;
    }
  }
  if (s.invulnT > 0) s.invulnT = Math.max(0, s.invulnT - dt);

  s.danger = Math.min(1, Math.abs(s.angle) / PHYSICS.GAME_OVER_ANGLE);

  // ── Fall / shield ──
  if (!attract && !inGrace && Math.abs(s.angle) >= PHYSICS.GAME_OVER_ANGLE) {
    const sign = s.angle > 0 ? 1 : -1;
    if (s.shield > 0) {
      s.shield = 0;
      s.angle = sign * 0.2;
      s.omega = -sign * 1.2;
      s.invulnT = BOOST.SHIELD_INVULN;
      s.popKind = POPUP_SHIELD;
      s.popT = ANIM.SHIELD_SAVE;
      shake(s, 0.3, 5);
      pushFx(s, FX_SHIELD_SAVE, 0);
      emote(s, ANIM.HAPPY_LONG);
    } else {
      s.mode = MODE_FALLING;
      s.fallT = 0;
      // Remember the circumstances for analytics
      s.fallEvent = s.evStage !== STAGE_IDLE && s.evType !== EVT_NONE ? s.evType * 10 + s.evSub : -1;
      s.fallWeather = s.weatherAmt > 0.3 ? s.weather : 0;
      s.fallBiome = s.biome;
      s.fallAfterHit = s.hurtT > 0 ? 1 : 0;
      breakCombo(s);
      s.feverT = 0;
      shake(s, 0.4, 6);
      pushFx(s, FX_FALL, 0);
      return;
    }
  }

  // ── Movement ──
  let speed = attract
    ? WALK.ATTRACT_SPEED
    : lerp(WALK.SPEED_START, WALK.SPEED_END, smooth01(effT / WALK.SPEED_RAMP_TIME)) *
      (1 + 0.08 * Math.sin(t * 0.5));
  s.speedMod += (s.speedModTarget - s.speedMod) * approach(dt, EVENTS.SPEED_SMOOTH_TAU);
  speed *= s.speedMod;
  speed *= clamp(1 + s.slope * WALK.SLOPE_SPEED, 0.8, 1.15);
  if (s.weather === WEATHER_SNOW) speed *= lerp(1, BIOMES.SNOW_SPEED_MULT, s.weatherAmt);
  if (inGrace) speed *= 0.4 + 0.6 * graceRatio;
  s.speed = speed;
  if (!attract) s.meters += speed * dt;
  s.scrollX += speed * cfg.pxPerMeter * dt;
  s.walkPhase += speed * WALK.CYCLES_PER_METER * dt;

  const storkWorldX = s.scrollX + cfg.storkX;
  const offset = terrainOffsetAt(cfg, storkWorldX);
  s.feetY = cfg.groundY + offset;
  // Slope is in screen space where y grows downward: rising terrain ahead is a negative dy/dx
  s.slope = terrainSlopeAt(cfg, storkWorldX);
  s.camY += (offset * LAYOUT.CAMERA_FOLLOW - s.camY) * approach(dt, 0.25);

  decayAnims(s, dt);

  if (!attract) {
    // ── Combo & score ──
    const centered = Math.abs(s.angle) < PHYSICS.CENTER_ANGLE;
    if (centered) {
      s.comboGrace = 0;
      s.comboT += dt;
      if (s.combo < SCORE.COMBO_MAX && s.comboT >= SCORE.COMBO_THRESHOLDS[s.combo - 1]) {
        s.combo++;
        s.comboT = 0;
        s.comboPulse = ANIM.COMBO_PULSE;
        if (s.combo > s.bestCombo) s.bestCombo = s.combo;
        shake(s, 0.2, 2.5);
        pushFx(s, FX_COMBO_UP, s.combo);
        emote(s, ANIM.HAPPY, ANIM.CHEER * 0.6);
      }
    } else if (s.combo > 1) {
      s.comboGrace += dt;
      if (s.comboGrace >= SCORE.COMBO_GRACE) breakCombo(s);
    } else {
      s.comboT = 0;
    }
    updateFever(s, dt);

    if (!inGrace) {
      const sprint = s.speedMod > 1.05 ? SCORE.SPRINT_SCORE_MULT : 1;
      s.score += SCORE.POINTS_PER_SECOND * (centered ? SCORE.CENTER_BONUS : 1) * scoreMult(s) * sprint * dt;
      if (s.slowT > 0) s.slowT = Math.max(0, s.slowT - dt);
    }

    // ── Near miss ──
    if (s.danger > SCORE.NEAR_MISS_ENTER) s.wasDanger = 1;
    if (s.wasDanger > 0.5 && s.danger < SCORE.NEAR_MISS_EXIT) {
      s.wasDanger = 0;
      if (s.nearMissCooldown <= 0) {
        s.nearMissT = ANIM.NEAR_MISS;
        s.nearMissCooldown = SCORE.NEAR_MISS_COOLDOWN;
        s.nearMisses++;
        s.score += SCORE.NEAR_MISS_POINTS;
        addText(s, cfg.storkX + 16 * U, s.feetY - s.camY - 16 * U, SCORE.NEAR_MISS_POINTS, TEXT_KIND_BONUS);
        pushFx(s, FX_NEAR_MISS, 0);
        emote(s, ANIM.HAPPY);
      }
    }

    const obstacleBusy = s.evType === EVT_OBSTACLE && s.evStage !== STAGE_IDLE;
    updateCoins(s, cfg, dt, !obstacleBusy && !tutorial);
    updateItems(s, cfg, dt, !obstacleBusy && !tutorial);
    updateBiome(s);
    updateEvents(s, cfg, dt, effD, inGrace);
    updateEnvironment(s, dt);
    updateProgression(s);
    updateChicks(s, dt, !inGrace);
  } else {
    // Title screen: occasional happy wiggle so the flamingo feels alive
    const every = ANIM.ATTRACT_EMOTE_EVERY;
    const beat = Math.floor((t + dt) / every);
    if (beat > Math.floor(t / every)) {
      if (beat % 2 === 0) emote(s, ANIM.HAPPY_LONG, ANIM.CHEER);
      else emote(s, ANIM.HAPPY);
    }
  }
  updateObstacle(s, cfg, dt);
  updateLook(s, cfg, dt);

  s.t += dt;
}

/** Advance by a display frame using fixed simulation steps. */
export function advanceSim(s: SimState, cfg: SimConfig, frameDt: number): void {
  'worklet';
  s.acc += Math.min(Math.max(frameDt, 0), 0.1);
  let steps = 0;
  while (s.acc >= SIM_STEP) {
    stepSim(s, cfg, SIM_STEP);
    s.acc -= SIM_STEP;
    steps++;
    if (steps >= MAX_STEPS_PER_FRAME) {
      s.acc = 0;
      break;
    }
  }
}

/** Continue after a rewarded ad: keep score/progress, reset balance with a fresh grace period. */
export function resumeSim(s: SimState): void {
  'worklet';
  s.mode = MODE_PLAYING;
  s.angle = 0;
  s.omega = 0;
  s.wind = 0;
  s.windTarget = 0;
  s.windHold = 1.5;
  s.fallT = 0;
  s.gameOverSent = 0;
  s.danger = 0;
  s.wasDanger = 0;
  s.graceEnd = s.t + PHYSICS.GRACE_PERIOD;
  s.evStage = STAGE_IDLE;
  s.evType = EVT_NONE;
  s.obs[0] = 0;
  s.speedModTarget = 1;
  s.chProgress = 0;
  s.evNextAt = s.t + PHYSICS.GRACE_PERIOD + 3;
  s.flapCooldown = 0;
  s.prevInput = 0;
  s.fallEvent = -1;
}

export { OBS_SLOT };
