import { EVENTS, EVENT_SLOT_SIZE } from './constants';

// Event type codes (for worklet flat array)
export const EVT_OBSTACLE = 0;
export const EVT_ENVIRONMENT = 1;
export const EVT_CHALLENGE = 2;
export const EVT_SPEED = 3;

// Obstacle subtypes
export const OBS_ROCK = 0;
export const OBS_BRANCH = 1;

// Environment subtypes
export const ENV_GUST = 0;
export const ENV_QUAKE = 1;
export const ENV_ICE = 2;

// Challenge subtypes
export const CHL_CENTERED = 0;
export const CHL_STORM = 1;
export const CHL_LEAN = 2;

// Speed subtypes
export const SPD_SPRINT = 0;
export const SPD_SLOWDOWN = 1;

// Status codes
export const STATUS_PENDING = 0;
export const STATUS_WARNING = 1;
export const STATUS_ACTIVE = 2;
export const STATUS_DONE = 3;

/** Simple seeded pseudo-random number generator for deterministic event queues */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generate a flat number array encoding an event queue for worklet consumption.
 * Each event = EVENT_SLOT_SIZE numbers: [type, subtype, triggerDist, param1, param2, param3, status]
 *
 * param meanings vary by type:
 * - obstacle: param1=side(-1=left,1=right), param2=screenX, param3=screenY
 * - environment: param1=direction(-1/1 for gust, 0 for quake/ice), param2=duration, param3=unused
 * - challenge: param1=direction(-1/1 for lean, 0 for others), param2=duration, param3=reward
 * - speed: param1=multiplier, param2=duration, param3=unused
 */
export function generateEventQueue(seed: number, screenWidth: number): number[] {
  const rand = seededRandom(seed);
  const arr: number[] = new Array(EVENTS.QUEUE_SIZE * EVENT_SLOT_SIZE).fill(0);

  let currentDist = EVENTS.FIRST_EVENT_DIST;

  for (let i = 0; i < EVENTS.QUEUE_SIZE; i++) {
    const offset = i * EVENT_SLOT_SIZE;

    // Pick event type: weighted random
    // Early game (low distance): bias toward obstacles
    // Later: more variety
    const distFactor = Math.min(1.0, currentDist / 5000);
    const r = rand();
    let type: number;
    if (r < 0.4 - distFactor * 0.1) {
      type = EVT_OBSTACLE;
    } else if (r < 0.65) {
      type = EVT_ENVIRONMENT;
    } else if (r < 0.85) {
      type = EVT_CHALLENGE;
    } else {
      type = EVT_SPEED;
    }

    arr[offset] = type; // type
    arr[offset + 4] = 0; // param2 default
    arr[offset + 5] = 0; // param3 default
    arr[offset + 6] = STATUS_PENDING; // status

    if (type === EVT_OBSTACLE) {
      const subtype = rand() < 0.6 ? OBS_ROCK : OBS_BRANCH;
      const side = rand() < 0.5 ? -1 : 1;
      arr[offset + 1] = subtype;
      arr[offset + 2] = currentDist;
      arr[offset + 3] = side;
      // param2: initial screenX (will be set at warning time)
      arr[offset + 4] = side > 0 ? screenWidth + 50 : -50;
      // param3: screenY (rock=ground level, branch=top)
      arr[offset + 5] = subtype === OBS_ROCK ? 0 : -50;
    } else if (type === EVT_ENVIRONMENT) {
      const subR = rand();
      const subtype = subR < 0.4 ? ENV_GUST : subR < 0.7 ? ENV_QUAKE : ENV_ICE;
      const direction = subtype === ENV_GUST ? (rand() < 0.5 ? -1 : 1) : 0;
      const duration =
        subtype === ENV_GUST
          ? EVENTS.ENVIRONMENT.GUST_DURATION
          : subtype === ENV_QUAKE
            ? EVENTS.ENVIRONMENT.QUAKE_DURATION
            : EVENTS.ENVIRONMENT.ICE_DURATION;
      arr[offset + 1] = subtype;
      arr[offset + 2] = currentDist;
      arr[offset + 3] = direction;
      arr[offset + 4] = duration;
    } else if (type === EVT_CHALLENGE) {
      const subR = rand();
      const subtype = subR < 0.4 ? CHL_CENTERED : subR < 0.7 ? CHL_STORM : CHL_LEAN;
      const direction = subtype === CHL_LEAN ? (rand() < 0.5 ? -1 : 1) : 0;
      const duration =
        subtype === CHL_CENTERED
          ? EVENTS.CHALLENGE.CENTERED_DURATION
          : subtype === CHL_STORM
            ? EVENTS.CHALLENGE.STORM_DURATION
            : EVENTS.CHALLENGE.LEAN_DURATION;
      const reward =
        subtype === CHL_CENTERED
          ? EVENTS.CHALLENGE.CENTERED_REWARD
          : subtype === CHL_STORM
            ? EVENTS.CHALLENGE.STORM_REWARD
            : EVENTS.CHALLENGE.LEAN_REWARD;
      arr[offset + 1] = subtype;
      arr[offset + 2] = currentDist;
      arr[offset + 3] = direction;
      arr[offset + 4] = duration;
      arr[offset + 5] = reward;
    } else {
      // Speed
      const subtype = rand() < 0.5 ? SPD_SPRINT : SPD_SLOWDOWN;
      const mult = subtype === SPD_SPRINT ? EVENTS.SPEED.SPRINT_MULT : EVENTS.SPEED.SLOWDOWN_MULT;
      arr[offset + 1] = subtype;
      arr[offset + 2] = currentDist;
      arr[offset + 3] = mult;
      arr[offset + 4] = EVENTS.SPEED.DURATION;
    }

    // Advance distance with shrinking gap
    const elapsedEstimate = currentDist * 0.005; // rough time estimate
    const gap = Math.max(
      EVENTS.MIN_GAP,
      EVENTS.BASE_GAP * (1 - elapsedEstimate * EVENTS.GAP_SHRINK_RATE),
    );
    currentDist += gap + rand() * gap * 0.5;
  }

  return arr;
}
