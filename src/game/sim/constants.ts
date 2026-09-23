/**
 * Tuning constants for the game simulation.
 *
 * Everything in `src/game/sim` is plain TypeScript with `'worklet'` directives, so the same
 * code runs on the UI thread (via useFrameCallback) and in Jest.
 */

/** Fixed simulation step. Physics never depends on the display refresh rate. */
export const SIM_STEP = 1 / 120;
/** Max steps per frame before the accumulator is dropped (prevents spiral of death). */
export const MAX_STEPS_PER_FRAME = 12;

export const MODE_ATTRACT = 0;
export const MODE_PLAYING = 1;
export const MODE_FALLING = 2;
export const MODE_OVER = 3;

// ─── Layout (ratios of canvas size) ─────────────────────────────────────────
export const LAYOUT = {
  /** Flat ground line, ratio of canvas height */
  GROUND_RATIO: 0.76,
  /** Stork feet screen X, ratio of canvas width */
  STORK_X_RATIO: 0.42,
  /** Stork unit size, ratio of min(width, height) */
  UNIT_RATIO: 0.014,
  /** Terrain base segment width, ratio of canvas width */
  SEG_W_RATIO: 0.35,
  /** Max hill/valley height, ratio of canvas height */
  HILL_RATIO: 0.14,
  /** Portion of the terrain height the camera follows (rest moves the stork on screen) */
  CAMERA_FOLLOW: 0.65,
  /** 1 meter of travel in stork units */
  METER_IN_UNITS: 13,
} as const;

// ─── Physics ────────────────────────────────────────────────────────────────
export const PHYSICS = {
  GAME_OVER_ANGLE: (65 * Math.PI) / 180,
  GRAVITY: 5.0,
  PLAYER_TORQUE: 10.0,
  /** Extra torque at max tilt (1 + ASSIST * tiltRatio) */
  RECOVERY_ASSIST: 0.5,
  /** Torque multiplier when input opposes the current angular velocity (rewards timing, not mashing) */
  COUNTER_STEER: 1.25,
  /** Angular damping rate (1/s) at the start. Higher = more sluggish/stable. */
  DAMPING_START: 13.0,
  /** Angular damping rate (1/s) late game. Lower = more momentum = harder. */
  DAMPING_END: 9.5,
  DAMPING_RAMP_TIME: 150,
  /** Ice: very little damping (slippery) */
  ICE_DAMPING: 3.5,
  /** Rain multiplies damping */
  RAIN_DAMPING_MULT: 0.92,
  GRACE_PERIOD: 3.0,
  /** Angle limit while in grace (game over is disabled, so keep the stork recoverable) */
  GRACE_MAX_ANGLE: (50 * Math.PI) / 180,
  FALL_DURATION: 0.9,
  CENTER_ANGLE: (12 * Math.PI) / 180,
} as const;

export const DIFFICULTY = {
  GRAVITY_EARLY_START: 1.25,
  GRAVITY_EARLY_END: 2.6,
  GRAVITY_EARLY_TIME: 40,
  GRAVITY_LATE_RATE: 0.008,
  GRAVITY_MAX: 5.0,
  SURGE_AMOUNT: 0.2,
  SURGE_FREQ: 1.2,
  WIND_START: 0.8,
  WIND_EARLY_END: 2.6,
  WIND_EARLY_TIME: 45,
  WIND_LATE_RATE: 0.01,
  WIND_MAX: 5.5,
  WIND_HOLD_MIN_START: 1.4,
  WIND_HOLD_MIN_END: 0.8,
  WIND_HOLD_RANGE_START: 1.2,
  WIND_HOLD_RANGE_END: 0.8,
  WIND_SMOOTH_TAU: 0.5,
  WIND_CALM_CHANCE: 0.25,
  WOBBLE_START: 0.4,
  WOBBLE_RATE: 0.008,
  WOBBLE_MAX: 1.4,
  RAMP_TIME: 150,
} as const;

// ─── Movement ───────────────────────────────────────────────────────────────
export const WALK = {
  /** meters / second */
  SPEED_START: 1.6,
  SPEED_END: 2.8,
  SPEED_RAMP_TIME: 150,
  /** Walk cycles per meter; ties leg animation to actual ground speed */
  CYCLES_PER_METER: 0.78,
  /** Speed change per unit of terrain slope (uphill slower, downhill faster) */
  SLOPE_SPEED: 0.25,
  SLOPE_PUSH: 2.5,
  ATTRACT_SPEED: 1.5,
} as const;

// ─── Scoring ────────────────────────────────────────────────────────────────
export const SCORE = {
  POINTS_PER_SECOND: 10,
  CENTER_BONUS: 1.5,
  COMBO_THRESHOLDS: [3.0, 5.0, 8.0] as readonly number[],
  COMBO_MAX: 4,
  COMBO_GRACE: 0.5,
  NEAR_MISS_ENTER: 0.75,
  NEAR_MISS_EXIT: 0.3,
  NEAR_MISS_POINTS: 50,
  NEAR_MISS_COOLDOWN: 1.5,
  DODGE_POINTS: 25,
  SPRINT_SCORE_MULT: 1.5,
} as const;

// ─── Coins ──────────────────────────────────────────────────────────────────
export const COIN = {
  MAX: 8,
  /** [active, worldX, worldY, value, collectT, big, fallVy] (fallVy > 0 only for coin rain) */
  SLOT: 7,
  RADIUS_U: 2.1,
  MAGNET_U: 0.5,
  VALUE: 10,
  BIG_VALUE: 20,
  /** Meters between coin runs */
  GAP_MIN: 7,
  GAP_RANGE: 7,
  SPACING_M: 0.9,
  COLLECT_ANIM: 0.4,
} as const;

// ─── Floating texts ─────────────────────────────────────────────────────────
export const TEXT_KIND_COIN = 0;
export const TEXT_KIND_BONUS = 1;
export const TEXT_KIND_DODGE = 2;
export const TEXT_KIND_BRACE = 3;
export const TEXT_KIND_BONK = 4;
export const TEXT_KIND_NICE = 5;
export const TEXT_KIND_SHOO = 6;

export const FLOAT_TEXT = {
  MAX: 5,
  /** [active, t, x, y, value, kind] in screen space */
  SLOT: 6,
  DURATION: 0.9,
  RISE: 55,
} as const;

// ─── Events ─────────────────────────────────────────────────────────────────
export const EVT_NONE = -1;
export const EVT_OBSTACLE = 0;
export const EVT_ENVIRONMENT = 1;
export const EVT_CHALLENGE = 2;
export const EVT_SPEED = 3;

export const OBS_ROCK = 0;
export const OBS_BRANCH = 1;
/** A seagull lands on the head or back and weighs that side down until shooed with a flap */
export const OBS_GULL = 2;

export const ENV_GUST = 0;
export const ENV_QUAKE = 1;
export const ENV_ICE = 2;

export const CHL_CENTERED = 0;
export const CHL_STORM = 1;
export const CHL_LEAN = 2;

export const SPD_SPRINT = 0;
export const SPD_SLOW = 1;
/** Positive event: big coins rain down around the flamingo */
export const SPD_COIN_RAIN = 2;

export const STAGE_IDLE = 0;
export const STAGE_WARNING = 1;
export const STAGE_ACTIVE = 2;

export const EVENTS = {
  /** First event warning starts this long after the grace period */
  FIRST_DELAY: 6.0,
  GAP_START: 5.5,
  GAP_END: 2.0,
  GAP_RANDOM: 1.5,
  WARN_OBSTACLE: 1.4,
  WARN_ENVIRONMENT: 1.6,
  WARN_CHALLENGE: 1.3,
  WARN_SPEED: 0.9,
  /** Warnings get up to this much shorter late game */
  WARN_SHRINK: 0.25,

  ROCK_SCREEN_SPEED: 340,
  ROCK_RADIUS_U: 3.0,
  ROCK_IMPULSE: 3.2,
  ROCK_BRACE_ANGLE: (6 * Math.PI) / 180,
  ROCK_BRACE_MULT: 0.7,
  BRANCH_HALF_W_U: 3.5,
  BRANCH_THICK_U: 0.8,
  BRANCH_OFFSET_U: 1.0,
  /** Branch fall acceleration, stork units per s² */
  BRANCH_GRAVITY_U: 236,
  BRANCH_IMPULSE: 2.8,
  OBSTACLE_MAX_TIME: 3.0,

  GUST_DURATION: 3.0,
  GUST_FORCE_START: 3.5,
  GUST_FORCE_END: 5.0,
  QUAKE_DURATION: 3.0,
  QUAKE_AMP_START: 3.5,
  QUAKE_AMP_END: 5.0,
  ICE_DURATION: 4.0,

  CENTERED_WINDOW: 4.0,
  CENTERED_NEED: 2.4,
  CENTERED_ANGLE: (14 * Math.PI) / 180,
  CENTERED_REWARD: 100,
  LEAN_WINDOW: 3.5,
  LEAN_NEED: 1.2,
  LEAN_ANGLE: (10 * Math.PI) / 180,
  LEAN_REWARD: 80,
  STORM_WINDOW: 4.0,
  STORM_REWARD: 150,
  STORM_GUST: 3.0,
  STORM_QUAKE: 2.5,
  RESULT_ANIM: 1.2,

  SPRINT_MULT: 1.7,
  SPRINT_DURATION: 4.0,
  SLOW_MULT: 0.6,
  SLOW_DURATION: 3.5,
  SPEED_SMOOTH_TAU: 0.35,
  /** No sprints this early: a sprint plus the first rocks is the most common early fall */
  SPRINT_MIN_T: 25,

  GULL_MIN_T: 15,
  GULL_CHANCE: 0.2,
  /** Seconds to fly in and land */
  GULL_FLY_TIME: 1.0,
  GULL_PERCH_TIME: 4.5,
  /** Lean torque while perched (start → late game) */
  GULL_WEIGHT_START: 2.2,
  GULL_WEIGHT_END: 3.2,
  /** Perch points relative to the feet pivot, in stork units: head top and back */
  GULL_HEAD_X: 4.3,
  GULL_HEAD_Y: -32.2,
  GULL_BACK_X: -2.5,
  GULL_BACK_Y: -21.2,

  COIN_RAIN_MIN_T: 20,
  COIN_RAIN_CHANCE: 0.2,
  COIN_RAIN_DURATION: 4.0,
  COIN_RAIN_EVERY: 0.22,
  /** Horizontal scatter around the stork's chest, stork units */
  COIN_RAIN_SPREAD_U: 12,
  COIN_RAIN_FALL_U: 60,
} as const;

// ─── Environment ────────────────────────────────────────────────────────────
export const WEATHER_CLEAR = 0;
export const WEATHER_RAIN = 1;
export const WEATHER_WINDY = 2;
export const WEATHER_SNOW = 3;

// ─── Biomes (zones of the course) ───────────────────────────────────────────
export const BIOME_MEADOW = 0;
export const BIOME_BEACH = 1;
export const BIOME_SNOW = 2;
export const BIOME_AUTUMN = 3;

export const BIOMES = {
  COUNT: 4,
  /** Meters per zone (about a minute of walking early on) */
  LENGTH_M: 110,
  /** Weather odds per biome: chance of rain (the rest is the biome's other weather) */
  RAIN_CHANCE: [0.55, 0.3, 0, 0.3] as readonly number[],
  /** Chance an environment event is ICE / GUST, per biome */
  ICE_CHANCE: [0.3, 0.1, 0.6, 0.2] as readonly number[],
  GUST_CHANCE: [0.4, 0.6, 0.2, 0.5] as readonly number[],
  SNOW_SPEED_MULT: 0.92,
} as const;

// ─── Fever ──────────────────────────────────────────────────────────────────
export const FEVER = {
  /** Seconds at max combo needed to start fever */
  CHARGE_TIME: 5,
  DURATION: 8,
  SCORE_MULT: 2,
} as const;

// ─── Course items ───────────────────────────────────────────────────────────
export const ITEM_MAGNET = 0;
export const ITEM_FEATHER = 1;
export const ITEM_BALLOON = 2;

export const ITEMS = {
  MAX: 2,
  /** [active, worldX, worldY, type, collectT] */
  SLOT: 5,
  FIRST_M: 22,
  GAP_MIN_M: 35,
  GAP_RANGE_M: 25,
  HEIGHT_U: 26,
  RADIUS_U: 2.6,
  COLLECT_ANIM: 0.5,
  MAGNET_TIME: 8,
  MAGNET_RANGE_U: 28,
  /** Coin pull speed, stork units per s */
  MAGNET_PULL_U: 118,
  FEATHER_TIME: 6,
  /** Feather: wobble and wind are scaled by this, gravity slightly less */
  FEATHER_CALM: 0.5,
  FEATHER_GRAVITY: 0.85,
} as const;

// ─── Flap (tap both sides) ──────────────────────────────────────────────────
export const FLAP = {
  COOLDOWN: 5,
  /** Angular velocity kept after a flap */
  OMEGA_KEEP: 0.3,
  /** Tilt kept after a flap (pulls toward upright) */
  ANGLE_KEEP: 0.82,
  ANIM: 0.5,
} as const;

// ─── Baby flamingos ─────────────────────────────────────────────────────────
export const CHICKS = {
  MAX: 3,
  /** Seconds without getting hit to earn a chick */
  EVERY: 30,
  SCORE_BONUS: 0.1,
  JOIN_ANIM: 1.2,
  LEAVE_ANIM: 1.0,
  FIRST_OFFSET_U: 10,
  SPACING_U: 7.5,
  SCALE: 0.45,
} as const;

export const ENVIRONMENT = {
  DAY_CYCLE: 120,
  /** Day cycle position used while on the start screen */
  ATTRACT_DAY_T: 0.08,
  WEATHER_FIRST_MIN: 40,
  WEATHER_FIRST_RANGE: 10,
  WEATHER_DURATION_MIN: 14,
  WEATHER_DURATION_RANGE: 6,
  WEATHER_GAP_MIN: 25,
  WEATHER_GAP_RANGE: 12,
  WEATHER_FADE: 2.0,
  WINDY_EXTRA_WIND: 1.0,
} as const;

// ─── Boosts ─────────────────────────────────────────────────────────────────
export const BOOST = {
  SLOWMO_DURATION: 12,
  SLOWMO_GRAVITY_MULT: 0.6,
  SHIELD_INVULN: 1.5,
} as const;

// ─── Feedback animation lengths ─────────────────────────────────────────────
export const ANIM = {
  COMBO_PULSE: 0.6,
  COMBO_BREAK: 0.4,
  NEAR_MISS: 1.0,
  POPUP: 2.2,
  HIT_FLASH: 0.25,
  SHIELD_SAVE: 1.2,
  /** Character expressions (visual only) */
  HURT: 1.0,
  HAPPY_SHORT: 0.35,
  HAPPY: 0.9,
  HAPPY_LONG: 1.2,
  CHEER: 0.8,
  /** Title screen: the flamingo reacts to nothing in particular every few seconds */
  ATTRACT_EMOTE_EVERY: 4.5,
} as const;

export const POPUP_NONE = 0;
export const POPUP_MILESTONE = 1;
export const POPUP_RANK = 2;
export const POPUP_SHIELD = 3;
export const POPUP_BIOME = 4;
export const POPUP_FEVER = 5;
export const POPUP_ITEM = 6;
export const POPUP_CHICK = 7;
export const POPUP_BEST = 8;

// ─── Personal best marker ───────────────────────────────────────────────────
export const BEST = {
  /** Bests shorter than this don't get a flag or "so close" treatment */
  MIN_M: 20,
  /** The "m to best" HUD appears once this share of the best is walked */
  HUD_FROM_RATIO: 0.5,
  /** Within this share of the best counts as close */
  CLOSE_RATIO: 0.85,
} as const;

// ─── First-run tutorial ─────────────────────────────────────────────────────
export const TUT_OFF = 0;
export const TUT_HOLD_LEFT = 1;
export const TUT_HOLD_RIGHT = 2;
export const TUT_FLAP = 3;
export const TUT_DONE = 4;

export const TUTORIAL = {
  /** Gravity share while learning: tilting feels real but you can't fall */
  GRAVITY: 0.35,
  HOLD_TIME: 0.6,
  /** Tilt limit while learning, so the next step never starts from lying on one side */
  MAX_ANGLE: (30 * Math.PI) / 180,
  /** Share of the tilt kept when a step completes (the flamingo straightens up) */
  STEP_ANGLE_KEEP: 0.3,
  /** Never get stuck on a step */
  AUTO_ADVANCE: 15,
} as const;

// ─── New-player ease-in ─────────────────────────────────────────────────────
export const ROOKIE = {
  /** Runs until the ease-in has faded out */
  RUNS: 8,
  /** Difficulty clock speed for a brand-new player (1 = normal) */
  SLOWEST: 0.7,
} as const;

export const MILESTONES_M: readonly number[] = [50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000];
