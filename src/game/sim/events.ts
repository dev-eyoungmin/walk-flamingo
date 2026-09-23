import {
  ANIM,
  BIOMES,
  CHL_CENTERED,
  CHL_LEAN,
  ENV_GUST,
  ENV_ICE,
  ENV_QUAKE,
  EVENTS,
  EVT_CHALLENGE,
  EVT_ENVIRONMENT,
  EVT_NONE,
  EVT_OBSTACLE,
  EVT_SPEED,
  MODE_PLAYING,
  OBS_BRANCH,
  OBS_ROCK,
  SCORE,
  SPD_SLOW,
  SPD_SPRINT,
  STAGE_ACTIVE,
  STAGE_IDLE,
  STAGE_WARNING,
  TEXT_KIND_BONK,
  TEXT_KIND_BONUS,
  TEXT_KIND_BRACE,
  TEXT_KIND_DODGE,
  CHL_STORM,
  COIN,
  OBS_GULL,
  SPD_COIN_RAIN,
  TEXT_KIND_SHOO,
} from './constants';
import {
  FX_BRANCH_DODGED,
  FX_BRANCH_HIT,
  FX_CHALLENGE_FAIL,
  FX_CHALLENGE_START,
  FX_CHALLENGE_SUCCESS,
  FX_GUST,
  FX_ICE,
  FX_QUAKE,
  FX_ROCK_BRACED,
  FX_ROCK_TRIP,
  FX_SPEED_CHANGE,
  FX_WARNING,
  FX_COIN_RAIN,
  FX_GULL_LAND,
  FX_GULL_SHOO,
} from './fx';
import { addText, breakCombo, emote, hurt, partWorld, scoreMult, shake } from './helpers';
import type { SimState } from './state';
import { HEAD_PART_COUNT, STORK } from './storkGeometry';
import { SimConfig, terrainOffsetAt } from './terrain';
import { approach, clamp, lerp, pushFx, rand, randEvent, smooth01 } from './util';

function pickEvent(s: SimState, effT: number): void {
  'worklet';
  let type = EVT_OBSTACLE;
  let sub = OBS_ROCK;
  if (s.evCount === 0) {
    type = EVT_CHALLENGE;
    sub = CHL_CENTERED;
  } else if (s.evCount === 1) {
    type = EVT_OBSTACLE;
    sub = OBS_ROCK;
  } else {
    const late = smooth01(effT / 60);
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = randEvent(s);
      const wObs = lerp(0.45, 0.35, late);
      const wCh = lerp(0.3, 0.2, late);
      const wEnv = lerp(0.2, 0.25, late);
      if (r < wObs) type = EVT_OBSTACLE;
      else if (r < wObs + wCh) type = EVT_CHALLENGE;
      else if (r < wObs + wCh + wEnv) type = EVT_ENVIRONMENT;
      else type = EVT_SPEED;
      if (type !== s.evLastType) break;
    }
    const r2 = randEvent(s);
    if (type === EVT_OBSTACLE) {
      sub = r2 < 0.55 ? OBS_ROCK : OBS_BRANCH;
      if (effT >= EVENTS.GULL_MIN_T && r2 >= 1 - EVENTS.GULL_CHANCE) sub = OBS_GULL;
    }
    else if (type === EVT_ENVIRONMENT) {
      // Each zone leans toward its own hazards: icy peaks, windy beaches
      const ice = BIOMES.ICE_CHANCE[s.biome];
      const gust = BIOMES.GUST_CHANCE[s.biome];
      sub = r2 < gust ? ENV_GUST : r2 < gust + ice ? ENV_ICE : ENV_QUAKE;
    } else if (type === EVT_CHALLENGE) sub = r2 < 0.4 ? CHL_CENTERED : r2 < 0.75 ? CHL_LEAN : CHL_STORM;
    else {
      sub = r2 < 0.55 ? SPD_SPRINT : SPD_SLOW;
      if (effT >= EVENTS.COIN_RAIN_MIN_T && r2 >= 1 - EVENTS.COIN_RAIN_CHANCE) sub = SPD_COIN_RAIN;
      if (sub === SPD_SPRINT && effT < EVENTS.SPRINT_MIN_T) sub = SPD_SLOW;
    }
  }
  s.evType = type;
  s.evSub = sub;
  s.evDir = randEvent(s) < 0.5 ? -1 : 1;
  let warn: number = EVENTS.WARN_OBSTACLE;
  if (type === EVT_ENVIRONMENT) warn = EVENTS.WARN_ENVIRONMENT;
  else if (type === EVT_CHALLENGE) warn = EVENTS.WARN_CHALLENGE;
  else if (type === EVT_SPEED) warn = EVENTS.WARN_SPEED;
  warn *= 1 - EVENTS.WARN_SHRINK * smooth01(effT / 150);
  s.evStage = STAGE_WARNING;
  s.evTimer = warn;
  s.evDuration = warn;
  s.evCount++;
  pushFx(s, FX_WARNING, type * 10 + sub);
}

function activateEvent(s: SimState, cfg: SimConfig, effT: number): void {
  'worklet';
  const U = cfg.unit;
  const late = smooth01(effT / 150);
  s.evStage = STAGE_ACTIVE;
  const o = s.obs;
  if (s.evType === EVT_OBSTACLE) {
    s.evTimer = EVENTS.OBSTACLE_MAX_TIME;
    o[0] = 1;
    o[1] = s.evSub;
    o[6] = 0;
    o[7] = 0;
    o[8] = s.evDir;
    o[9] = s.biome;
    o[10] = 0;
    if (s.evSub === OBS_GULL) {
      // Swoops in from the top right; o[4..5] hold the start offset from the perch
      s.evTimer = EVENTS.GULL_FLY_TIME + EVENTS.GULL_PERCH_TIME + 2.5;
      o[4] = cfg.width * 0.55;
      o[5] = -cfg.height * 0.5;
      o[2] = s.scrollX + cfg.storkX + o[4];
      o[3] = s.feetY + o[5];
    } else if (s.evSub === OBS_ROCK) {
      const r = EVENTS.ROCK_RADIUS_U * U;
      const screenX = s.evDir > 0 ? cfg.width + r : -r;
      o[2] = s.scrollX + screenX;
      o[3] = cfg.groundY + terrainOffsetAt(cfg, o[2]) - r;
      o[4] = -s.evDir * EVENTS.ROCK_SCREEN_SPEED * (s.evDir > 0 ? 1 : 0.8);
      o[5] = 0;
    } else {
      o[2] = s.scrollX + cfg.storkX + (STORK.HEAD_X + s.evDir * EVENTS.BRANCH_OFFSET_U) * U;
      o[3] = s.camY - 12 * U * 0.5;
      o[4] = 0;
      o[5] = 0;
    }
  } else if (s.evType === EVT_ENVIRONMENT) {
    if (s.evSub === ENV_GUST) {
      s.evTimer = EVENTS.GUST_DURATION;
      s.gustForce = lerp(EVENTS.GUST_FORCE_START, EVENTS.GUST_FORCE_END, late);
      pushFx(s, FX_GUST, s.evDir);
    } else if (s.evSub === ENV_QUAKE) {
      s.evTimer = EVENTS.QUAKE_DURATION;
      s.quakeAmp = lerp(EVENTS.QUAKE_AMP_START, EVENTS.QUAKE_AMP_END, late);
      pushFx(s, FX_QUAKE, 0);
    } else {
      s.evTimer = EVENTS.ICE_DURATION;
      pushFx(s, FX_ICE, 0);
    }
  } else if (s.evType === EVT_CHALLENGE) {
    s.chProgress = 0;
    if (s.evSub === CHL_CENTERED) {
      s.evTimer = EVENTS.CENTERED_WINDOW;
      s.chNeed = EVENTS.CENTERED_NEED;
    } else if (s.evSub === CHL_LEAN) {
      s.evTimer = EVENTS.LEAN_WINDOW;
      s.chNeed = EVENTS.LEAN_NEED;
    } else {
      s.evTimer = EVENTS.STORM_WINDOW;
      s.chNeed = EVENTS.STORM_WINDOW;
    }
    pushFx(s, FX_CHALLENGE_START, s.evSub);
  } else {
    if (s.evSub === SPD_COIN_RAIN) {
      s.evTimer = EVENTS.COIN_RAIN_DURATION;
      s.rainT = 0;
      pushFx(s, FX_COIN_RAIN, 0);
    } else if (s.evSub === SPD_SPRINT) {
      s.speedModTarget = EVENTS.SPRINT_MULT;
      s.evTimer = EVENTS.SPRINT_DURATION;
    } else {
      s.speedModTarget = EVENTS.SLOW_MULT;
      s.evTimer = EVENTS.SLOW_DURATION;
    }
    if (s.evSub !== SPD_COIN_RAIN) pushFx(s, FX_SPEED_CHANGE, s.evSub);
  }
  s.evDuration = s.evTimer;
}

function finishEvent(s: SimState, effT: number): void {
  'worklet';
  s.evStage = STAGE_IDLE;
  s.evLastType = s.evType;
  if (s.evType === EVT_SPEED) s.speedModTarget = 1;
  s.evType = EVT_NONE;
  s.evTimer = 0;
  s.evNextAt =
    s.t + lerp(EVENTS.GAP_START, EVENTS.GAP_END, smooth01(effT / 150)) + randEvent(s) * EVENTS.GAP_RANDOM;
}

function challengeReward(s: SimState): number {
  'worklet';
  if (s.evSub === CHL_CENTERED) return EVENTS.CENTERED_REWARD;
  if (s.evSub === CHL_LEAN) return EVENTS.LEAN_REWARD;
  return EVENTS.STORM_REWARD;
}

/** Lean torque from a perched seagull: +1 side is the head (tips forward), -1 the back. */
export function gullForce(s: SimState, effT: number): number {
  'worklet';
  const o = s.obs;
  if (o[7] < 0.5 || o[7] > 1.5) return 0;
  return o[8] * lerp(EVENTS.GULL_WEIGHT_START, EVENTS.GULL_WEIGHT_END, smooth01(effT / 150));
}

function gullLeave(o: number[], U: number): void {
  'worklet';
  o[7] = 2;
  o[10] = 0;
  o[4] = 55 * U;
  o[5] = -45 * U;
}

function updateGull(s: SimState, cfg: SimConfig, dt: number): void {
  'worklet';
  const o = s.obs;
  const U = cfg.unit;
  o[10] += dt;
  const head = o[8] > 0;
  const lx = head ? EVENTS.GULL_HEAD_X : EVENTS.GULL_BACK_X;
  const ly = head ? EVENTS.GULL_HEAD_Y : EVENTS.GULL_BACK_Y;
  const cosA = Math.cos(s.angle);
  const sinA = Math.sin(s.angle);
  const px = s.scrollX + cfg.storkX + (lx * cosA - ly * sinA) * U;
  const py = s.feetY + (lx * sinA + ly * cosA) * U;

  if (o[7] < 0.5) {
    const k = smooth01(Math.min(1, o[10] / EVENTS.GULL_FLY_TIME));
    o[2] = px + (1 - k) * o[4];
    o[3] = py + (1 - k) * o[5] - Math.sin(k * Math.PI) * 6 * U;
    o[6] = 0;
    if (o[10] >= EVENTS.GULL_FLY_TIME) {
      if (s.mode !== MODE_PLAYING) {
        gullLeave(o, U);
        return;
      }
      o[7] = 1;
      o[10] = 0;
      // Flaps before landing don't count
      o[9] = s.flaps;
      shake(s, 0.15, 2);
      pushFx(s, FX_GULL_LAND, o[8]);
    }
  } else if (o[7] < 1.5) {
    o[2] = px;
    o[3] = py;
    o[6] = s.angle;
    if (s.mode === MODE_PLAYING && s.flaps > o[9]) {
      // Shooed away with a flap
      gullLeave(o, U);
      s.dodges++;
      const pts = Math.round(SCORE.DODGE_POINTS * scoreMult(s));
      s.score += pts;
      addText(s, cfg.storkX, s.feetY - s.camY - 36 * U, pts, TEXT_KIND_SHOO);
      pushFx(s, FX_GULL_SHOO, 0);
      emote(s, ANIM.HAPPY, ANIM.CHEER * 0.6);
    } else if (o[10] >= EVENTS.GULL_PERCH_TIME || s.mode !== MODE_PLAYING) {
      gullLeave(o, U);
    }
  } else {
    o[2] += (s.speed * cfg.pxPerMeter + o[4]) * dt;
    o[3] += o[5] * dt;
    o[5] -= 30 * U * dt;
    o[6] = 0;
    if (o[3] - s.camY < -40 * U || o[2] - s.scrollX > cfg.width + 60) o[0] = 0;
  }
}

/** Coin rain: big coins drop ahead of the flamingo so they meet it around chest height. */
function updateCoinRain(s: SimState, cfg: SimConfig, dt: number): void {
  'worklet';
  s.rainT -= dt;
  if (s.rainT > 0) return;
  s.rainT += EVENTS.COIN_RAIN_EVERY;
  const U = cfg.unit;
  const slots = s.coinSlots;
  let free = -1;
  for (let c = 0; c < COIN.MAX; c++) {
    const b = c * COIN.SLOT;
    if (slots[b] < 0.5 && slots[b + 4] <= 0) {
      free = c;
      break;
    }
  }
  if (free < 0) return;
  const vy = EVENTS.COIN_RAIN_FALL_U * U;
  const startY = s.camY - 4 * U;
  const fallTime = Math.max(0.2, (s.feetY - 18 * U - startY) / vy);
  const b = free * COIN.SLOT;
  slots[b] = 1;
  slots[b + 1] =
    s.scrollX + cfg.storkX + s.speed * cfg.pxPerMeter * fallTime + (rand(s) * 2 - 1) * EVENTS.COIN_RAIN_SPREAD_U * U;
  slots[b + 2] = startY;
  slots[b + 3] = COIN.BIG_VALUE;
  slots[b + 4] = 0;
  slots[b + 5] = 1;
  slots[b + 6] = vy;
}

export function updateObstacle(s: SimState, cfg: SimConfig, dt: number): void {
  'worklet';
  const o = s.obs;
  if (o[0] < 0.5) return;
  if (o[1] === OBS_GULL) {
    updateGull(s, cfg, dt);
    return;
  }
  const U = cfg.unit;
  const scrollSpeed = s.speed * cfg.pxPerMeter;
  const storkWorldX = s.scrollX + cfg.storkX;
  const side = o[8];

  if (o[1] === OBS_ROCK) {
    const r = EVENTS.ROCK_RADIUS_U * U;
    o[2] += (scrollSpeed + o[4]) * dt;
    if (o[7] < 0.5) {
      o[3] = cfg.groundY + terrainOffsetAt(cfg, o[2]) - r;
      o[6] += (o[4] * dt) / r;
      const dx = o[2] - storkWorldX;
      const contact = (EVENTS.ROCK_RADIUS_U + 1.0) * U;
      if (s.mode === MODE_PLAYING && (side > 0 ? dx <= contact : dx >= -contact)) {
        o[7] = 1;
        const braced = s.angle * -side >= EVENTS.ROCK_BRACE_ANGLE;
        s.omega += side * EVENTS.ROCK_IMPULSE * (braced ? EVENTS.ROCK_BRACE_MULT : 1);
        const tx = cfg.storkX;
        const ty = s.feetY - s.camY - 20 * U;
        if (braced) {
          s.dodges++;
          const pts = Math.round(SCORE.DODGE_POINTS * scoreMult(s));
          s.score += pts;
          addText(s, tx, ty, pts, TEXT_KIND_BRACE);
          pushFx(s, FX_ROCK_BRACED, 0);
          emote(s, ANIM.HAPPY);
          shake(s, 0.2, 3);
        } else {
          addText(s, tx, ty, 0, TEXT_KIND_BONK);
          pushFx(s, FX_ROCK_TRIP, 0);
          hurt(s);
          shake(s, 0.35, 7);
          s.hitFlash = ANIM.HIT_FLASH;
          breakCombo(s);
        }
        o[4] = -o[4] * 0.35;
        o[5] = -71 * U;
      }
    } else {
      o[5] += EVENTS.BRANCH_GRAVITY_U * U * dt;
      o[3] += o[5] * dt;
      o[6] += (o[4] * dt) / r;
    }
    const screenX = o[2] - s.scrollX;
    if (screenX < -120 || screenX > cfg.width + 120 || o[3] - s.camY > cfg.height + 60) {
      o[0] = 0;
    }
  } else {
    const halfW = EVENTS.BRANCH_HALF_W_U * U;
    if (o[7] < 0.5) {
      o[2] = storkWorldX + (STORK.HEAD_X + side * EVENTS.BRANCH_OFFSET_U) * U;
      o[5] += EVENTS.BRANCH_GRAVITY_U * U * dt;
      o[3] += o[5] * dt;
      o[6] = Math.sin(s.t * 18) * 0.06;
      if (s.mode === MODE_PLAYING) {
        const cosA = Math.cos(s.angle);
        const sinA = Math.sin(s.angle);
        const p = [0, 0];
        const thick = EVENTS.BRANCH_THICK_U * U;
        for (let k = 0; k < HEAD_PART_COUNT; k++) {
          const r = partWorld(s, cfg, k, cosA, sinA, p);
          const nearestX = clamp(p[0], o[2] - halfW, o[2] + halfW);
          const dx = p[0] - nearestX;
          const dy = p[1] - o[3];
          const rr = r + thick;
          if (dx * dx + dy * dy < rr * rr) {
            o[7] = 1;
            const push = p[0] >= o[2] ? 1 : -1;
            s.omega += push * EVENTS.BRANCH_IMPULSE;
            o[4] = -push * 15 * U;
            o[5] = -44 * U;
            addText(s, cfg.storkX, p[1] - s.camY - 3 * U, 0, TEXT_KIND_BONK);
            pushFx(s, FX_BRANCH_HIT, 0);
            hurt(s);
            shake(s, 0.35, 7);
            s.hitFlash = ANIM.HIT_FLASH;
            breakCombo(s);
            break;
          }
        }
        if (o[7] < 0.5 && o[3] > s.feetY + (STORK.HIP_Y - 5) * U) {
          o[7] = 2;
          s.dodges++;
          const pts = Math.round(SCORE.DODGE_POINTS * scoreMult(s));
          s.score += pts;
          addText(s, cfg.storkX, s.feetY - s.camY - 30 * U, pts, TEXT_KIND_DODGE);
          pushFx(s, FX_BRANCH_DODGED, 0);
          emote(s, ANIM.HAPPY);
        }
      }
    } else {
      // Released: falls with the world
      o[2] += o[4] * dt;
      o[5] += EVENTS.BRANCH_GRAVITY_U * U * 0.7 * dt;
      o[3] += o[5] * dt;
      o[6] += (o[4] >= 0 ? 1 : -1) * 3 * dt;
      const ground = cfg.groundY + terrainOffsetAt(cfg, o[2]);
      if (o[3] > ground) {
        o[3] = ground;
        o[5] = 0;
        o[4] = 0;
      }
    }
    const screenX = o[2] - s.scrollX;
    if (screenX < -120 || o[3] - s.camY > cfg.height + 60) o[0] = 0;
  }
}

export function updateEvents(s: SimState, cfg: SimConfig, dt: number, effT: number, inGrace: boolean): void {
  'worklet';
  if (s.chResultT > 0) s.chResultT = Math.max(0, s.chResultT - dt);
  else if (s.chResultT < 0) s.chResultT = Math.min(0, s.chResultT + dt);

  const iceTarget = s.evStage === STAGE_ACTIVE && s.evType === EVT_ENVIRONMENT && s.evSub === ENV_ICE ? 1 : 0;
  s.iceAmt += (iceTarget - s.iceAmt) * approach(dt, 0.3);

  if (s.evStage === STAGE_IDLE) {
    if (!inGrace && s.t >= s.evNextAt) pickEvent(s, effT);
    return;
  }

  s.evTimer -= dt;

  if (s.evStage === STAGE_WARNING) {
    if (s.evTimer <= 0) activateEvent(s, cfg, effT);
    return;
  }

  // Active
  if (s.evType === EVT_OBSTACLE) {
    if (s.obs[0] < 0.5 || s.evTimer <= 0) finishEvent(s, effT);
    return;
  }

  if (s.evType === EVT_CHALLENGE) {
    let met = false;
    if (s.evSub === CHL_CENTERED) met = Math.abs(s.angle) < EVENTS.CENTERED_ANGLE;
    else if (s.evSub === CHL_LEAN) met = s.angle * s.evDir > EVENTS.LEAN_ANGLE;
    else met = true;
    if (met) s.chProgress += dt;
    const done = s.chProgress >= s.chNeed - 1e-6;
    if (done || s.evTimer <= 0) {
      if (done) {
        const reward = Math.round(challengeReward(s) * scoreMult(s));
        s.score += reward;
        s.challengesDone++;
        s.chResultT = EVENTS.RESULT_ANIM;
        addText(s, cfg.storkX + 16 * cfg.unit, s.feetY - s.camY - 22 * cfg.unit, reward, TEXT_KIND_BONUS);
        pushFx(s, FX_CHALLENGE_SUCCESS, s.evSub);
        emote(s, ANIM.HAPPY_LONG, ANIM.CHEER);
      } else {
        s.chResultT = -EVENTS.RESULT_ANIM;
        pushFx(s, FX_CHALLENGE_FAIL, s.evSub);
      }
      finishEvent(s, effT);
    }
    return;
  }

  if (s.evType === EVT_SPEED && s.evSub === SPD_COIN_RAIN && s.mode === MODE_PLAYING) updateCoinRain(s, cfg, dt);
  if (s.evTimer <= 0) finishEvent(s, effT);
}
