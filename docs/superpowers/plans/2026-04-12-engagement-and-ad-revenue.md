# Engagement & Ad Revenue Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add event lane system, restructure ads, add skin system, add procedural SFX — making the game engaging enough to retain players and monetize via ads.

**Architecture:** Distance-based event queue drives 4 event types (obstacles, environment, challenges, speed). Forced interstitial post-game-over replaces pre-game rewarded. Skin palette system with 24h ad-unlock. Procedural WAV SFX following existing `useBackgroundMusic.ts` pattern. All game physics run in Reanimated worklets using flat SharedValue arrays.

**Tech Stack:** React Native, @shopify/react-native-skia, react-native-reanimated (worklets), expo-av (audio), expo-haptics, AsyncStorage, react-native-google-mobile-ads

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/game/events.ts` | Event types, queue generation, flat-array encoding for worklet |
| `src/components/ObstacleRenderer.tsx` | Skia rendering for rock/branch obstacles |
| `src/components/EventWarningRenderer.tsx` | Warning arrows, environment banners, challenge UI overlay |
| `src/lib/sfx.ts` | Procedural WAV buffer generation (13 sounds) |
| `src/hooks/useSfx.ts` | SFX preload + playback hook via expo-av |
| `src/lib/skins.ts` | Skin palette definitions + AsyncStorage persistence |
| `src/hooks/useSkin.ts` | Active skin state + expiry check |
| `src/hooks/useFirstPlay.ts` | First-ever-session detection (replaces useDailyFreePlay) |
| `src/components/SkinPreview.tsx` | Skin carousel for result screen |

### Modified Files

| File | Changes |
|------|---------|
| `src/game/constants.ts` | Add EVENT constants |
| `src/game/GameCanvas.tsx` | Event queue SharedValues, event processing in useFrameCallback, obstacle collision, environment physics, challenge tracking, speed modifiers, boost consumption, SFX trigger callbacks |
| `src/components/StorkRenderer.tsx` | Accept `skinPalette` prop, replace hardcoded color constants |
| `src/screens/GameOverScreen.tsx` | Add Boost/Skin buttons alongside Continue/Retry/Home |
| `src/screens/StartScreen.tsx` | Accept skin palette for flamingo illustration colors |
| `src/navigation/AppNavigator.tsx` | Replace useDailyFreePlay with useFirstPlay, add interstitial flow, boost state, skin state, SFX integration |
| `src/lib/adConfig.ts` | Configure interstitial ad unit ID for iOS |

### Deleted Files

| File | Reason |
|------|--------|
| `src/hooks/useDailyFreePlay.ts` | Replaced by useFirstPlay |
| `src/hooks/useSoundEffects.ts` | Replaced by useSfx |

---

## Task 1: Event Types & Queue Generation

**Files:**
- Create: `src/game/events.ts`
- Modify: `src/game/constants.ts`

- [ ] **Step 1: Add event constants to constants.ts**

Add at end of `src/game/constants.ts`:

```typescript
/** Event system constants */
export const EVENTS = {
  /** Minimum internal distance before first event can appear */
  FIRST_EVENT_DIST: 600,
  /** Base gap between events in internal distance units */
  BASE_GAP: 400,
  /** Minimum gap between events */
  MIN_GAP: 200,
  /** Gap shrink rate per second of elapsed time */
  GAP_SHRINK_RATE: 0.02,
  /** Max events in the pre-generated queue */
  QUEUE_SIZE: 30,

  /** Obstacle constants */
  OBSTACLE: {
    /** Warning time before obstacle arrives (seconds) */
    WARNING_TIME: 1.5,
    /** Angular velocity impulse on hit (rad/s) */
    HIT_IMPULSE: 8.0,
    /** Hitbox radius (pixels) */
    HITBOX_RADIUS: 35,
    /** Rock scroll speed multiplier (relative to walkSpeed) */
    SCROLL_SPEED: 1.5,
    /** Branch fall speed (pixels/second) */
    BRANCH_FALL_SPEED: 200,
  },

  /** Environment event constants */
  ENVIRONMENT: {
    /** Gust wind force */
    GUST_FORCE: 6.0,
    /** Gust duration (seconds) */
    GUST_DURATION: 3.5,
    /** Quake oscillation amplitude */
    QUAKE_AMPLITUDE: 4.0,
    /** Quake duration (seconds) */
    QUAKE_DURATION: 3.5,
    /** Ice damping override */
    ICE_DAMPING: 0.4,
    /** Ice duration (seconds) */
    ICE_DURATION: 4.5,
    /** Warning lead time (seconds) */
    WARNING_TIME: 2.0,
  },

  /** Challenge constants */
  CHALLENGE: {
    /** Stay centered duration (seconds) */
    CENTERED_DURATION: 3.0,
    /** Stay centered reward */
    CENTERED_REWARD: 100,
    /** Survive storm duration (seconds) */
    STORM_DURATION: 4.0,
    /** Survive storm reward */
    STORM_REWARD: 150,
    /** Lean direction duration (seconds) */
    LEAN_DURATION: 2.0,
    /** Lean direction reward */
    LEAN_REWARD: 80,
    /** Lean angle threshold (radians, ~20 degrees) */
    LEAN_THRESHOLD: (20 * Math.PI) / 180,
  },

  /** Speed change constants */
  SPEED: {
    /** Sprint multiplier */
    SPRINT_MULT: 2.0,
    /** Slowdown multiplier */
    SLOWDOWN_MULT: 0.5,
    /** Duration (seconds) */
    DURATION: 3.0,
    /** Warning lead time (seconds) */
    WARNING_TIME: 1.0,
  },
} as const;

/**
 * Event slot encoding for worklet SharedValue.
 * Each event = [type, subtype, triggerDist, param1, param2, param3, status]
 * type: 0=obstacle, 1=environment, 2=challenge, 3=speed
 * subtype: depends on type
 * status: 0=pending, 1=warning, 2=active, 3=done
 */
export const EVENT_SLOT_SIZE = 7;
```

- [ ] **Step 2: Create events.ts with types and queue generator**

Create `src/game/events.ts`:

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/game/events.ts src/game/constants.ts
git commit -m "feat: add event types and queue generation system"
```

---

## Task 2: Procedural SFX System

**Files:**
- Create: `src/lib/sfx.ts`
- Create: `src/hooks/useSfx.ts`
- Delete: `src/hooks/useSoundEffects.ts`

- [ ] **Step 1: Create sfx.ts with procedural WAV generators**

Create `src/lib/sfx.ts`. This follows the same WAV generation pattern as `useBackgroundMusic.ts` — generate PCM samples, write WAV header, base64-encode:

```typescript
const SAMPLE_RATE = 22050;

function writeWavHeader(view: DataView, dataSize: number) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
}

function samplesToBase64(samples: number[]): string {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeWavHeader(view, dataSize);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-0.95, Math.min(0.95, samples[i]));
    view.setInt16(44 + i * 2, Math.floor(clamped * 32767), true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function generateTone(freq: number, duration: number, decay: number, volume: number): number[] {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    samples[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * decay) * volume;
  }
  return samples;
}

function generateNoise(duration: number, decay: number, volume: number): number[] {
  const len = Math.floor(SAMPLE_RATE * duration);
  const samples: number[] = new Array(len);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const noise = (Math.random() * 2 - 1);
    // Low-pass filter for rumble/wind
    prev = prev * 0.8 + noise * 0.2;
    samples[i] = prev * Math.exp(-t * decay) * volume;
  }
  return samples;
}

function mixSamples(...arrays: number[][]): number[] {
  const maxLen = Math.max(...arrays.map(a => a.length));
  const result: number[] = new Array(maxLen).fill(0);
  for (const arr of arrays) {
    for (let i = 0; i < arr.length; i++) result[i] += arr[i];
  }
  return result;
}

// --- Individual SFX generators ---

function genObstacleSwipe(): string {
  // White noise sweep (high to low freq filter)
  const len = Math.floor(SAMPLE_RATE * 0.25);
  const samples: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 2000 - t * 6000; // sweep down
    samples[i] = Math.sin(2 * Math.PI * freq * t) * (1 - t * 4) * 0.4;
  }
  return samplesToBase64(samples);
}

function genObstacleHit(): string {
  const impact = generateNoise(0.15, 8, 0.7);
  const lowBoom = generateTone(60, 0.3, 6, 0.5);
  return samplesToBase64(mixSamples(impact, lowBoom));
}

function genWarningBeep(): string {
  const beep1 = generateTone(880, 0.08, 15, 0.3);
  const silence = new Array(Math.floor(SAMPLE_RATE * 0.06)).fill(0);
  const beep2 = generateTone(880, 0.08, 15, 0.3);
  return samplesToBase64([...beep1, ...silence, ...beep2]);
}

function genGust(): string {
  return samplesToBase64(generateNoise(0.6, 1.5, 0.5));
}

function genQuake(): string {
  const rumble = generateNoise(0.5, 2, 0.6);
  const sub = generateTone(40, 0.5, 3, 0.4);
  return samplesToBase64(mixSamples(rumble, sub));
}

function genChallengeStart(): string {
  const note1 = generateTone(523, 0.1, 12, 0.3); // C5
  const gap = new Array(Math.floor(SAMPLE_RATE * 0.05)).fill(0);
  const note2 = generateTone(659, 0.15, 10, 0.35); // E5
  return samplesToBase64([...note1, ...gap, ...note2]);
}

function genChallengeSuccess(): string {
  const c = generateTone(523, 0.12, 8, 0.3);
  const g1 = new Array(Math.floor(SAMPLE_RATE * 0.04)).fill(0);
  const e = generateTone(659, 0.12, 8, 0.3);
  const g2 = new Array(Math.floor(SAMPLE_RATE * 0.04)).fill(0);
  const g = generateTone(784, 0.2, 6, 0.35);
  return samplesToBase64([...c, ...g1, ...e, ...g2, ...g]);
}

function genChallengeFail(): string {
  const note1 = generateTone(440, 0.15, 6, 0.3);
  const note2 = generateTone(330, 0.25, 4, 0.3);
  return samplesToBase64([...note1, ...note2]);
}

function genCoinCollect(): string {
  return samplesToBase64(generateTone(1200, 0.1, 18, 0.25));
}

function genComboUp(): string {
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  let all: number[] = [];
  for (const freq of notes) {
    all = [...all, ...generateTone(freq, 0.08, 14, 0.25)];
  }
  return samplesToBase64(all);
}

function genNearMiss(): string {
  const c = generateTone(392, 0.1, 10, 0.2);
  const e = generateTone(523, 0.15, 8, 0.25);
  return samplesToBase64([...c, ...e]);
}

function genGameOver(): string {
  const impact = generateNoise(0.2, 5, 0.8);
  const crack = generateTone(80, 0.4, 4, 0.5);
  const high = generateTone(200, 0.15, 12, 0.3);
  return samplesToBase64(mixSamples(impact, crack, high));
}

function genSpeedChange(): string {
  // Pitch bend effect
  const len = Math.floor(SAMPLE_RATE * 0.3);
  const samples: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 300 + t * 1000;
    samples[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 5) * 0.3;
  }
  return samplesToBase64(samples);
}

// --- Cached URIs (generated once at import time) ---

export const SFX_URIS = {
  obstacleSwipe: genObstacleSwipe(),
  obstacleHit: genObstacleHit(),
  warningBeep: genWarningBeep(),
  gust: genGust(),
  quake: genQuake(),
  challengeStart: genChallengeStart(),
  challengeSuccess: genChallengeSuccess(),
  challengeFail: genChallengeFail(),
  coinCollect: genCoinCollect(),
  comboUp: genComboUp(),
  nearMiss: genNearMiss(),
  gameOver: genGameOver(),
  speedChange: genSpeedChange(),
} as const;

export type SfxName = keyof typeof SFX_URIS;
```

- [ ] **Step 2: Create useSfx.ts hook**

Create `src/hooks/useSfx.ts`:

```typescript
import { useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { SFX_URIS, type SfxName } from '../lib/sfx';

const MAX_CONCURRENT = 3;

export function useSfx() {
  const soundPool = useRef<Audio.Sound[]>([]);
  const loadedRef = useRef(false);
  const soundMap = useRef<Map<SfxName, Audio.Sound>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function preload() {
      try {
        for (const [name, uri] of Object.entries(SFX_URIS)) {
          if (cancelled) return;
          const { sound } = await Audio.Sound.createAsync(
            { uri },
            { shouldPlay: false, volume: 0.5 },
          );
          soundMap.current.set(name as SfxName, sound);
        }
        loadedRef.current = true;
      } catch {
        // SFX non-critical
      }
    }

    preload();

    return () => {
      cancelled = true;
      soundMap.current.forEach((sound) => {
        sound.unloadAsync().catch(() => {});
      });
      soundMap.current.clear();
      loadedRef.current = false;
    };
  }, []);

  const play = useCallback(async (name: SfxName) => {
    if (!loadedRef.current) return;
    try {
      const sound = soundMap.current.get(name);
      if (sound) {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      }
    } catch {
      // SFX non-critical
    }
  }, []);

  return { play };
}
```

- [ ] **Step 3: Delete useSoundEffects.ts**

```bash
rm src/hooks/useSoundEffects.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/sfx.ts src/hooks/useSfx.ts
git rm src/hooks/useSoundEffects.ts
git commit -m "feat: add procedural SFX system with 13 sounds"
```

---

## Task 3: Skin System

**Files:**
- Create: `src/lib/skins.ts`
- Create: `src/hooks/useSkin.ts`
- Modify: `src/components/StorkRenderer.tsx`
- Modify: `src/screens/StartScreen.tsx`

- [ ] **Step 1: Create skins.ts with palette definitions and persistence**

Create `src/lib/skins.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SkinPalette {
  id: string;
  name: string;
  body: string;
  bodyLight: string;
  legs: string;
  legsDark: string;
  wing: string;
  neck: string;
  cheek: string;
}

export const SKINS: SkinPalette[] = [
  { id: 'default', name: 'Pink',     body: '#FF7A9A', bodyLight: '#FFA0B8', legs: '#E86A6A', legsDark: '#D05A5A', wing: '#E8658A', neck: '#FF7A9A', cheek: '#FF5070' },
  { id: 'golden',  name: 'Golden',   body: '#FFD700', bodyLight: '#FFE44D', legs: '#DAA520', legsDark: '#B8860B', wing: '#FFC107', neck: '#FFD700', cheek: '#FFB300' },
  { id: 'arctic',  name: 'Arctic',   body: '#B3E5FC', bodyLight: '#E1F5FE', legs: '#81D4FA', legsDark: '#4FC3F7', wing: '#4FC3F7', neck: '#B3E5FC', cheek: '#29B6F6' },
  { id: 'midnight',name: 'Midnight', body: '#7C4DFF', bodyLight: '#B388FF', legs: '#6200EA', legsDark: '#4A148C', wing: '#B388FF', neck: '#7C4DFF', cheek: '#651FFF' },
  { id: 'sunset',  name: 'Sunset',   body: '#FF6D00', bodyLight: '#FF9E40', legs: '#E65100', legsDark: '#BF360C', wing: '#FF9E40', neck: '#FF6D00', cheek: '#FF3D00' },
  { id: 'cherry',  name: 'Cherry',   body: '#FF1744', bodyLight: '#FF5252', legs: '#D50000', legsDark: '#B71C1C', wing: '#FF5252', neck: '#FF1744', cheek: '#FF0000' },
];

export const DEFAULT_SKIN = SKINS[0];

const STORAGE_KEY = '@flamingo_walk_active_skin';

interface StoredSkin {
  id: string;
  expiresAt: number; // unix timestamp ms
}

export async function loadActiveSkin(): Promise<SkinPalette> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SKIN;
    const stored: StoredSkin = JSON.parse(raw);
    if (Date.now() > stored.expiresAt) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return DEFAULT_SKIN;
    }
    return SKINS.find(s => s.id === stored.id) ?? DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export async function unlockSkin(skinId: string): Promise<SkinPalette> {
  const skin = SKINS.find(s => s.id === skinId);
  if (!skin) return DEFAULT_SKIN;
  const stored: StoredSkin = {
    id: skinId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return skin;
}
```

- [ ] **Step 2: Create useSkin.ts hook**

Create `src/hooks/useSkin.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SKIN, loadActiveSkin, unlockSkin, type SkinPalette } from '../lib/skins';

export function useSkin() {
  const [activeSkin, setActiveSkin] = useState<SkinPalette>(DEFAULT_SKIN);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadActiveSkin().then((skin) => {
      setActiveSkin(skin);
      setLoaded(true);
    });
  }, []);

  const selectSkin = useCallback(async (skinId: string) => {
    const skin = await unlockSkin(skinId);
    setActiveSkin(skin);
  }, []);

  return { activeSkin, selectSkin, loaded };
}
```

- [ ] **Step 3: Modify StorkRenderer.tsx to accept skin palette**

In `src/components/StorkRenderer.tsx`, update the interface and replace hardcoded colors:

Add `skinPalette` to props interface (after line 17):
```typescript
  skinPalette?: {
    body: string;
    bodyLight: string;
    legs: string;
    legsDark: string;
    wing: string;
    neck: string;
    cheek: string;
  };
```

Replace the hardcoded color constants (lines 42-54) with palette-driven values:
```typescript
  // Colors — use skin palette or defaults
  const p = skinPalette;
  const C_BODY = p?.body ?? '#FF7A9A';
  const C_BODY_LIGHT = p?.bodyLight ?? '#FFA0B8';
  const C_LEG = p?.legs ?? '#E86A6A';
  const C_LEG_DARK = p?.legsDark ?? '#D05A5A';
  const C_NECK = p?.neck ?? '#FF7A9A';
  const C_BEAK = '#FF8845';
  const C_BEAK_TIP = '#2A2A2A';
  const C_EYE_W = '#FFFFFF';
  const C_EYE_B = '#1A1A1A';
  const C_CHEEK = p?.cheek ?? '#FF5070';
  const C_SHADOW = 'rgba(0,0,0,0.15)';
  const C_WING = p?.wing ?? '#E8658A';
  const C_MOUTH = '#CC3344';
```

- [ ] **Step 4: Update StartScreen.tsx flamingo illustration colors**

In `src/screens/StartScreen.tsx`, add `skinPalette` prop to the interface:

```typescript
interface StartScreenProps {
  highScore: number;
  onPlay: () => void;
  skinPalette?: { body: string; legs: string; legsDark: string; wing: string; };
}
```

Replace hardcoded flamingo colors in the Canvas rendering (around lines 178-184):

```typescript
  const bodyColor = skinPalette?.body ?? '#FF7A9A';
  const legColor = skinPalette?.legs ?? '#E86A6A';
  const legDarkColor = skinPalette?.legsDark ?? '#D05A5A';
  const wingColor = skinPalette?.wing ?? '#E8658A';
```

Use these variables in place of the hardcoded color strings in the `<Path>` elements.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skins.ts src/hooks/useSkin.ts src/components/StorkRenderer.tsx src/screens/StartScreen.tsx
git commit -m "feat: add skin palette system with 6 skins and 24h ad-unlock"
```

---

## Task 4: First-Play Hook & Ad Restructure

**Files:**
- Create: `src/hooks/useFirstPlay.ts`
- Delete: `src/hooks/useDailyFreePlay.ts`
- Modify: `src/lib/adConfig.ts`
- Modify: `src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Create useFirstPlay.ts**

Create `src/hooks/useFirstPlay.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@flamingo_walk_first_played';

export function useFirstPlay() {
  const [isFirstPlay, setIsFirstPlay] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      setIsFirstPlay(value !== 'true');
      setLoaded(true);
    });
  }, []);

  /** Mark first play as consumed. Call after first game over. */
  const consumeFirstPlay = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setIsFirstPlay(false);
  }, []);

  return { isFirstPlay, consumeFirstPlay, loaded };
}
```

- [ ] **Step 2: Configure interstitial ad ID in adConfig.ts**

In `src/lib/adConfig.ts`, update the interstitial section (around line 40-45). Replace the empty iOS string with an actual ad unit ID (or test ID for now):

```typescript
    INTERSTITIAL_ID = USE_TEST_ADS
      ? TestIds.INTERSTITIAL
      : Platform.select({
          ios: 'ca-app-pub-7783064858826225/INTERSTITIAL_ID_HERE',
          android: 'ca-app-pub-xxxxxxxxxxxxxxxx/iiiiiiiiii',
        }) ?? TestIds.INTERSTITIAL;
```

Note: The actual interstitial ad unit ID must be created in the AdMob console. For development, set `USE_TEST_ADS = true` temporarily.

- [ ] **Step 3: Rewrite AppNavigator.tsx with new ad flow**

Rewrite `src/navigation/AppNavigator.tsx` to:
- Replace `useDailyFreePlay` with `useFirstPlay`
- Add `useInterstitialAd` for forced post-game-over
- Add boost state management
- Add skin state management
- Wire up SFX

The key changes to the game flow:

```typescript
import { useFirstPlay } from '../hooks/useFirstPlay';
import { useInterstitialAd } from '../hooks/useInterstitialAd';
import { useSkin } from '../hooks/useSkin';
import { useSfx } from '../hooks/useSfx';
// Remove: import { useDailyFreePlay } from '../hooks/useDailyFreePlay';

// Inside AppNavigator:
const { isFirstPlay, consumeFirstPlay, loaded: firstPlayLoaded } = useFirstPlay();
const { showAd: showInterstitial } = useInterstitialAd();
const { showAd: showRewarded } = useRewardedAd();
const { activeSkin, selectSkin, loaded: skinLoaded } = useSkin();
const { play: playSfx } = useSfx();

// Boost state
const [pendingBoost, setPendingBoost] = useState<'shield' | 'slowmo' | null>(null);

// Game over handler — show interstitial (skip on first play)
const handleGameOver = useCallback(async (data) => {
  stopMusic();
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  playSfx('gameOver');
  setLastScore(data.score);
  setLastDistance(data.distance);
  setLastCoins(data.coins ?? 0);
  const isNew = await submitScore(data.distance);
  setIsNewHighScore(isNew);

  if (isFirstPlay) {
    await consumeFirstPlay();
    setScreen('gameover');
  } else {
    showInterstitial(() => {
      setScreen('gameover');
    });
  }
}, [/* deps */]);

// Play — no pre-game ad, direct start
const handlePlay = useCallback(() => {
  setHasContinued(false);
  setIsResuming(false);
  setScreen('playing');
}, []);

// Retry — no ad, direct restart
const handleRetry = useCallback(() => {
  setIsResuming(false);
  setPendingBoost(null);
  setScreen('playing');
}, []);

// Boost — watch rewarded ad, then set boost for next game
const handleBoost = useCallback((boostType: 'shield' | 'slowmo') => {
  showRewarded(() => {
    setPendingBoost(boostType);
    setIsResuming(false);
    setScreen('playing');
  });
}, [showRewarded]);

// Skin unlock — watch rewarded ad
const handleSkinUnlock = useCallback((skinId: string) => {
  showRewarded(() => {
    selectSkin(skinId);
  });
}, [showRewarded, selectSkin]);
```

Pass `pendingBoost`, `activeSkin`, and `playSfx` to GameCanvas as new props.

Pass `onBoost` and `onSkinUnlock` to GameOverScreen.

- [ ] **Step 4: Delete useDailyFreePlay.ts**

```bash
rm src/hooks/useDailyFreePlay.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFirstPlay.ts src/lib/adConfig.ts src/navigation/AppNavigator.tsx
git rm src/hooks/useDailyFreePlay.ts
git commit -m "feat: restructure ads — forced interstitial post-game-over, remove pre-game ad"
```

---

## Task 5: GameOverScreen — Boost & Skin Buttons

**Files:**
- Create: `src/components/SkinPreview.tsx`
- Modify: `src/screens/GameOverScreen.tsx`

- [ ] **Step 1: Create SkinPreview.tsx**

Create `src/components/SkinPreview.tsx`:

```typescript
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SKINS, type SkinPalette } from '../lib/skins';

interface SkinPreviewProps {
  activeSkinId: string;
  onSelect: (skinId: string) => void;
  onClose: () => void;
}

export const SkinPreview: React.FC<SkinPreviewProps> = ({ activeSkinId, onSelect, onClose }) => {
  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <Text style={styles.title}>SKINS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {SKINS.map((skin) => {
            const isActive = skin.id === activeSkinId;
            const isFree = skin.id === 'default';
            return (
              <Pressable
                key={skin.id}
                style={[styles.skinCard, isActive && styles.skinCardActive]}
                onPress={() => !isFree && !isActive && onSelect(skin.id)}
              >
                {/* Mini flamingo silhouette using skin colors */}
                <View style={[styles.silhouette, { backgroundColor: skin.body }]}>
                  <View style={[styles.silhouetteHead, { backgroundColor: skin.body }]} />
                  <View style={[styles.silhouetteLeg, { backgroundColor: skin.legs }]} />
                </View>
                <Text style={styles.skinName}>{skin.name}</Text>
                {isActive ? (
                  <Text style={styles.skinStatus}>ACTIVE</Text>
                ) : isFree ? (
                  <Text style={styles.skinStatus}>FREE</Text>
                ) : (
                  <Text style={styles.skinUnlock}>Watch Ad</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>CLOSE</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  container: {
    backgroundColor: '#FFF8F0',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#333',
    letterSpacing: 3,
    marginBottom: 16,
  },
  scroll: {
    paddingHorizontal: 8,
    gap: 12,
  },
  skinCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    padding: 12,
    width: 80,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  skinCardActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  silhouette: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  silhouetteHead: {
    width: 14,
    height: 14,
    borderRadius: 7,
    position: 'absolute',
    top: -4,
    right: -2,
  },
  silhouetteLeg: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  skinName: {
    fontSize: 10,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  skinStatus: {
    fontSize: 8,
    fontWeight: '600',
    color: '#999',
  },
  skinUnlock: {
    fontSize: 8,
    fontWeight: '700',
    color: '#DAA520',
  },
  closeBtn: {
    marginTop: 16,
    backgroundColor: '#7A8B99',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 20,
  },
  closeBtnText: {
    color: '#FFF',
    fontWeight: '800',
    letterSpacing: 2,
  },
});
```

- [ ] **Step 2: Add Boost & Skin buttons to GameOverScreen**

In `src/screens/GameOverScreen.tsx`, add new props:

```typescript
interface GameOverScreenProps {
  score: number;
  distance: number;
  coins?: number;
  highScore: number;
  isNewHighScore: boolean;
  onRetry: () => void;
  onHome: () => void;
  onContinue?: () => void;
  canContinue?: boolean;
  onBoost?: (type: 'shield' | 'slowmo') => void;
  onSkinUnlock?: (skinId: string) => void;
  activeSkinId?: string;
}
```

Add boost button row after the Continue button and before the Home/Retry row:

```tsx
{/* Boost Buttons */}
{onBoost && (
  <View style={[styles.boostRow, { marginTop: s(8), gap: s(8) }]}>
    <Pressable
      style={({ pressed }) => [
        styles.button, styles.boostButton,
        { paddingHorizontal: s(20), paddingVertical: s(8), borderRadius: s(20) },
        pressed && styles.buttonPressed,
      ]}
      onPress={() => onBoost('shield')}
    >
      <Text style={[styles.boostButtonText, { fontSize: s(11) }]}>SHIELD</Text>
      <Text style={[styles.boostSubtext, { fontSize: s(8) }]}>Watch Ad</Text>
    </Pressable>
    <Pressable
      style={({ pressed }) => [
        styles.button, styles.boostButton,
        { paddingHorizontal: s(20), paddingVertical: s(8), borderRadius: s(20) },
        pressed && styles.buttonPressed,
      ]}
      onPress={() => onBoost('slowmo')}
    >
      <Text style={[styles.boostButtonText, { fontSize: s(11) }]}>SLOW-MO</Text>
      <Text style={[styles.boostSubtext, { fontSize: s(8) }]}>Watch Ad</Text>
    </Pressable>
  </View>
)}

{/* Skin Button */}
{onSkinUnlock && (
  <Pressable
    style={({ pressed }) => [
      styles.button, styles.skinButton,
      { paddingHorizontal: s(32), paddingVertical: s(8), borderRadius: s(20), marginTop: s(6) },
      pressed && styles.buttonPressed,
    ]}
    onPress={() => setShowSkinPreview(true)}
  >
    <Text style={[styles.skinButtonText, { fontSize: s(11) }]}>SKIN</Text>
    <Text style={[styles.boostSubtext, { fontSize: s(8) }]}>Watch Ad</Text>
  </Pressable>
)}
```

Add skin preview modal state and rendering:
```typescript
const [showSkinPreview, setShowSkinPreview] = useState(false);

// In render, after the main container:
{showSkinPreview && onSkinUnlock && (
  <SkinPreview
    activeSkinId={activeSkinId ?? 'default'}
    onSelect={(skinId) => {
      onSkinUnlock(skinId);
      setShowSkinPreview(false);
    }}
    onClose={() => setShowSkinPreview(false)}
  />
)}
```

Add styles for new buttons:
```typescript
boostRow: {
  flexDirection: 'row',
  justifyContent: 'center',
},
boostButton: {
  backgroundColor: '#4ECDC4',
  borderWidth: 2,
  borderColor: '#6EDDD6',
},
boostButtonText: {
  color: '#FFFFFF',
  fontWeight: '800',
  letterSpacing: 1,
},
boostSubtext: {
  color: 'rgba(255,255,255,0.7)',
  fontWeight: '600',
  marginTop: 1,
},
skinButton: {
  backgroundColor: '#9C27B0',
  borderWidth: 2,
  borderColor: '#BA68C8',
  alignSelf: 'center',
},
skinButtonText: {
  color: '#FFFFFF',
  fontWeight: '800',
  letterSpacing: 1,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SkinPreview.tsx src/screens/GameOverScreen.tsx
git commit -m "feat: add Boost and Skin buttons to game over screen"
```

---

## Task 6: Event Processing in GameCanvas

**Files:**
- Modify: `src/game/GameCanvas.tsx`

This is the largest task. It adds event queue processing, obstacle collision, environment physics, challenge tracking, speed modifiers, boost consumption, and SFX callbacks to the existing useFrameCallback worklet.

- [ ] **Step 1: Add new props and SharedValues to GameCanvas**

In `src/game/GameCanvas.tsx`, update the interface and add new SharedValues:

```typescript
// Add imports at top
import { EVENTS, EVENT_SLOT_SIZE } from './constants';
import { generateEventQueue, EVT_OBSTACLE, EVT_ENVIRONMENT, EVT_CHALLENGE, EVT_SPEED,
         OBS_ROCK, OBS_BRANCH, ENV_GUST, ENV_QUAKE, ENV_ICE,
         CHL_CENTERED, CHL_STORM, CHL_LEAN, SPD_SPRINT, SPD_SLOWDOWN,
         STATUS_PENDING, STATUS_WARNING, STATUS_ACTIVE, STATUS_DONE } from './events';
import { ObstacleRenderer } from '../components/ObstacleRenderer';
import { EventWarningRenderer } from '../components/EventWarningRenderer';

// Update props interface
interface GameCanvasProps {
  width: number;
  height: number;
  onGameOver: (data: { score: number; distance: number; coins?: number }) => void;
  isPlaying: boolean;
  isResuming?: boolean;
  pendingBoost?: 'shield' | 'slowmo' | null;
  skinPalette?: { body: string; bodyLight: string; legs: string; legsDark: string; wing: string; neck: string; cheek: string; };
  onPlaySfx?: (name: string) => void;
}
```

Add new SharedValues after existing ones (around line 162):

```typescript
  // === Event System ===
  const eventQueue = useSharedValue<number[]>(
    generateEventQueue(Date.now(), width),
  );
  const eventCursor = useSharedValue(0); // index of next pending event
  const activeEventType = useSharedValue(-1); // -1=none
  const activeEventSubtype = useSharedValue(0);
  const activeEventTimer = useSharedValue(0); // countdown for active event
  const activeEventParam = useSharedValue(0); // direction/multiplier for active event
  const warningTimer = useSharedValue(0); // countdown for warning display
  const warningEventType = useSharedValue(-1);
  const warningEventSubtype = useSharedValue(0);
  const warningEventParam = useSharedValue(0);

  // === Obstacle rendering data ===
  // [type, screenX, screenY, active(0/1), side]
  const obstacleData = useSharedValue<number[]>([0, 0, 0, 0, 0]);

  // === Challenge tracking ===
  const challengeActive = useSharedValue(0); // 0=inactive, 1=active
  const challengeSubtype = useSharedValue(0);
  const challengeTimer = useSharedValue(0);
  const challengeParam = useSharedValue(0); // direction for lean
  const challengeReward = useSharedValue(0);
  const challengeSuccess = useSharedValue(0); // 1=currently meeting requirement
  const challengeResultAnim = useSharedValue(0); // >0 = showing result

  // === Speed modifier ===
  const speedModifier = useSharedValue(1.0);

  // === Boost ===
  const boostType = useSharedValue(0); // 0=none, 1=shield, 2=slowmo
  const boostTimer = useSharedValue(0);

  // === Hit flash ===
  const hitFlashTimer = useSharedValue(0);
```

- [ ] **Step 2: Add event reset to resetGame and resumeGame**

In `resetGame`, add after existing resets:

```typescript
    // Reset event system
    eventQueue.value = generateEventQueue(Date.now(), width);
    eventCursor.value = 0;
    activeEventType.value = -1;
    activeEventSubtype.value = 0;
    activeEventTimer.value = 0;
    activeEventParam.value = 0;
    warningTimer.value = 0;
    warningEventType.value = -1;
    warningEventSubtype.value = 0;
    warningEventParam.value = 0;
    obstacleData.value = [0, 0, 0, 0, 0];
    challengeActive.value = 0;
    challengeSubtype.value = 0;
    challengeTimer.value = 0;
    challengeParam.value = 0;
    challengeReward.value = 0;
    challengeSuccess.value = 0;
    challengeResultAnim.value = 0;
    speedModifier.value = 1.0;
    hitFlashTimer.value = 0;
    // Apply pending boost
    if (pendingBoost === 'shield') {
      boostType.value = 1;
      boostTimer.value = 3.0;
    } else if (pendingBoost === 'slowmo') {
      boostType.value = 2;
      boostTimer.value = 3.0;
    } else {
      boostType.value = 0;
      boostTimer.value = 0;
    }
```

- [ ] **Step 3: Add event processing to useFrameCallback**

Inside `useFrameCallback`, after the existing `// ──── Animation Frame ────` section (around line 818) but before the closing of the callback, add the event processing block:

```typescript
    // ──── Event Queue Processing ────
    if (!inGrace) {
      const eq = eventQueue.value;
      const cursor = eventCursor.value;
      const evtOffset = cursor * EVENT_SLOT_SIZE;

      if (cursor < EVENTS.QUEUE_SIZE && evtOffset + EVENT_SLOT_SIZE <= eq.length) {
        const evtType = eq[evtOffset];
        const evtSubtype = eq[evtOffset + 1];
        const evtTriggerDist = eq[evtOffset + 2];
        const evtParam1 = eq[evtOffset + 3];
        const evtParam2 = eq[evtOffset + 4];
        const evtParam3 = eq[evtOffset + 5];
        const evtStatus = eq[evtOffset + 6];

        // Warning phase
        const warningDist = evtType === EVT_OBSTACLE
          ? evtTriggerDist - walkSpeed.value * EVENTS.OBSTACLE.WARNING_TIME * (1 / PIXELS_TO_METERS)
          : evtType === EVT_SPEED
            ? evtTriggerDist - walkSpeed.value * EVENTS.SPEED.WARNING_TIME * (1 / PIXELS_TO_METERS)
            : evtTriggerDist - walkSpeed.value * EVENTS.ENVIRONMENT.WARNING_TIME * (1 / PIXELS_TO_METERS);

        if (evtStatus === STATUS_PENDING && distance.value >= warningDist) {
          // Enter warning phase
          eq[evtOffset + 6] = STATUS_WARNING;
          eventQueue.value = eq;
          warningEventType.value = evtType;
          warningEventSubtype.value = evtSubtype;
          warningEventParam.value = evtParam1;
          warningTimer.value = evtType === EVT_OBSTACLE
            ? EVENTS.OBSTACLE.WARNING_TIME
            : evtType === EVT_SPEED
              ? EVENTS.SPEED.WARNING_TIME
              : EVENTS.ENVIRONMENT.WARNING_TIME;
          runOnJS(onPlaySfx ?? (() => {}))('warningBeep');
        }

        if (evtStatus === STATUS_WARNING && distance.value >= evtTriggerDist) {
          // Activate event
          eq[evtOffset + 6] = STATUS_ACTIVE;
          eventQueue.value = eq;
          warningTimer.value = 0;
          warningEventType.value = -1;

          if (evtType === EVT_OBSTACLE) {
            // Spawn obstacle
            const side = evtParam1;
            const startX = side > 0 ? width + 50 : -50;
            const screenY = evtSubtype === OBS_ROCK ? groundY - 20 : 50;
            obstacleData.value = [evtSubtype, startX, screenY, 1, side];
            activeEventType.value = EVT_OBSTACLE;
            activeEventSubtype.value = evtSubtype;
            activeEventTimer.value = 3.0; // max lifetime
            activeEventParam.value = side;
          } else if (evtType === EVT_ENVIRONMENT) {
            activeEventType.value = EVT_ENVIRONMENT;
            activeEventSubtype.value = evtSubtype;
            activeEventTimer.value = evtParam2; // duration
            activeEventParam.value = evtParam1; // direction
            const sfxName = evtSubtype === ENV_GUST ? 'gust' : evtSubtype === ENV_QUAKE ? 'quake' : 'warningBeep';
            runOnJS(onPlaySfx ?? (() => {}))((sfxName as string));
          } else if (evtType === EVT_CHALLENGE) {
            challengeActive.value = 1;
            challengeSubtype.value = evtSubtype;
            challengeTimer.value = evtParam2; // duration
            challengeParam.value = evtParam1; // direction
            challengeReward.value = evtParam3;
            challengeSuccess.value = 1; // assume success until proven otherwise
            activeEventType.value = EVT_CHALLENGE;
            activeEventTimer.value = evtParam2;
            runOnJS(onPlaySfx ?? (() => {}))('challengeStart');
          } else if (evtType === EVT_SPEED) {
            speedModifier.value = evtParam1;
            activeEventType.value = EVT_SPEED;
            activeEventTimer.value = evtParam2;
            runOnJS(onPlaySfx ?? (() => {}))('speedChange');
          }

          // Advance cursor to next event
          eventCursor.value = cursor + 1;
        }
      }

      // ──── Active Event Tick ────
      if (activeEventType.value >= 0) {
        activeEventTimer.value -= dt;

        // Obstacle movement & collision
        if (activeEventType.value === EVT_OBSTACLE) {
          const obs = obstacleData.value;
          if (obs[3] > 0.5) { // active
            const side = obs[4];
            // Move obstacle toward center
            const speed = walkSpeed.value * EVENTS.OBSTACLE.SCROLL_SPEED;
            obs[1] += (side > 0 ? -speed : speed) * dt;
            obstacleData.value = [...obs];

            // Collision check with stork
            const storkX = width / 2;
            const dx = obs[1] - storkX;
            const dy = obs[2] - (groundY + storkHillY.value);
            const distSq = dx * dx + dy * dy;
            const radius = EVENTS.OBSTACLE.HITBOX_RADIUS;

            if (distSq < radius * radius) {
              // HIT!
              const impulse = EVENTS.OBSTACLE.HIT_IMPULSE * -side;
              angularVelocity.value += impulse;
              shakeTimer.value = 0.5;
              hitFlashTimer.value = 0.1;
              obs[3] = 0; // deactivate
              obstacleData.value = [...obs];
              activeEventType.value = -1;
              runOnJS(onPlaySfx ?? (() => {}))('obstacleHit');
            }

            // Passed stork without hit = dodge success
            if ((side > 0 && obs[1] < storkX - 60) || (side < 0 && obs[1] > storkX + 60)) {
              obs[3] = 0;
              obstacleData.value = [...obs];
              activeEventType.value = -1;
              runOnJS(onPlaySfx ?? (() => {}))('obstacleSwipe');
            }
          }
        }

        // Environment physics
        if (activeEventType.value === EVT_ENVIRONMENT) {
          if (activeEventSubtype.value === ENV_GUST) {
            angularVelocity.value += EVENTS.ENVIRONMENT.GUST_FORCE * activeEventParam.value * dt;
          } else if (activeEventSubtype.value === ENV_QUAKE) {
            const quakeForce = Math.sin(t * 25) * EVENTS.ENVIRONMENT.QUAKE_AMPLITUDE;
            angularVelocity.value += quakeForce * dt;
          }
          // ICE: damping override handled below in damping calculation
        }

        // Challenge tracking
        if (activeEventType.value === EVT_CHALLENGE && challengeActive.value > 0.5) {
          challengeTimer.value -= dt;

          if (challengeSubtype.value === CHL_CENTERED) {
            if (Math.abs(angle.value) > CENTER_THRESHOLD) {
              challengeSuccess.value = 0;
            }
          } else if (challengeSubtype.value === CHL_LEAN) {
            const dir = challengeParam.value;
            if (dir > 0 && angle.value < EVENTS.CHALLENGE.LEAN_THRESHOLD) {
              challengeSuccess.value = 0;
            } else if (dir < 0 && angle.value > -EVENTS.CHALLENGE.LEAN_THRESHOLD) {
              challengeSuccess.value = 0;
            }
          }
          // CHL_STORM: success = didn't die, handled by default (success stays 1)

          if (challengeTimer.value <= 0) {
            challengeActive.value = 0;
            if (challengeSuccess.value > 0.5) {
              score.value += challengeReward.value;
              challengeResultAnim.value = 1.0; // success popup
              // Spawn floating text
              const ftSlots = floatingTexts.value;
              for (let fi = 0; fi < FLOATING_TEXT.MAX_COUNT; fi++) {
                const fbi = fi * FLOATING_TEXT.SLOT_SIZE;
                if (ftSlots[fbi] < 0.5) {
                  ftSlots[fbi] = 1;
                  ftSlots[fbi + 1] = 0;
                  ftSlots[fbi + 2] = width / 2;
                  ftSlots[fbi + 3] = canvasHeight * 0.3;
                  ftSlots[fbi + 4] = challengeReward.value;
                  ftSlots[fbi + 5] = 1; // bonus type
                  break;
                }
              }
              floatingTexts.value = ftSlots;
              runOnJS(onPlaySfx ?? (() => {}))('challengeSuccess');
            } else {
              challengeResultAnim.value = -1.0; // fail indicator
              runOnJS(onPlaySfx ?? (() => {}))('challengeFail');
            }
          }
        }

        // Event expiry
        if (activeEventTimer.value <= 0) {
          if (activeEventType.value === EVT_SPEED) {
            speedModifier.value = 1.0;
          }
          if (activeEventType.value === EVT_ENVIRONMENT && activeEventSubtype.value === ENV_ICE) {
            // damping restored automatically (no override stored)
          }
          activeEventType.value = -1;
        }
      }

      // Warning timer tick
      if (warningTimer.value > 0) {
        warningTimer.value -= dt;
      }

      // Challenge result animation tick
      if (challengeResultAnim.value > 0) {
        challengeResultAnim.value -= dt;
        if (challengeResultAnim.value < 0) challengeResultAnim.value = 0;
      } else if (challengeResultAnim.value < 0) {
        challengeResultAnim.value += dt;
        if (challengeResultAnim.value > 0) challengeResultAnim.value = 0;
      }

      // Hit flash tick
      if (hitFlashTimer.value > 0) {
        hitFlashTimer.value -= dt;
        if (hitFlashTimer.value < 0) hitFlashTimer.value = 0;
      }

      // ──── Boost Timer ────
      if (boostTimer.value > 0) {
        boostTimer.value -= dt;
        if (boostTimer.value <= 0) {
          boostType.value = 0;
          boostTimer.value = 0;
        }
      }
    }
```

- [ ] **Step 4: Modify damping and speed calculations for events/boost**

In the existing physics section, modify the damping line to account for ICE:

```typescript
    // Original damping line — replace with:
    let effectiveDamping = Math.max(0.52, 0.82 - effectiveT * 0.012) - wave * 0.06;
    // ICE override
    if (activeEventType.value === EVT_ENVIRONMENT && activeEventSubtype.value === ENV_ICE) {
      effectiveDamping = EVENTS.ENVIRONMENT.ICE_DAMPING;
    }
```

Modify the walkSpeed line to account for speed modifier:
```typescript
    // After existing walkSpeed calculation, add:
    walkSpeed.value *= speedModifier.value;
```

Modify the game-over check for shield boost:
```typescript
    // In the game over check, wrap with boost check:
    if (!inGrace && Math.abs(angle.value) >= GAME_OVER_ANGLE && boostType.value !== 1) {
      // ... existing game over logic
    }
    // Shield auto-correct when active
    if (boostType.value === 1 && Math.abs(angle.value) > GAME_OVER_ANGLE * 0.8) {
      angle.value *= 0.95; // push back toward center
    }
```

Modify gravity for slow-mo boost:
```typescript
    // After gravityMult calculation, add:
    let finalGravityMult = clampedGravityMult;
    if (boostType.value === 2) {
      finalGravityMult *= 0.5;
    }
    // Use finalGravityMult in the gravity acceleration line
    const gravityAccel = GRAVITY_TORQUE * Math.sin(angle.value) * finalGravityMult;
```

- [ ] **Step 5: Add SFX callbacks for existing events**

Add `runOnJS(onPlaySfx ?? (() => {}))` calls to existing events in the worklet:

- Coin collect (around line 614): add `runOnJS(onPlaySfx ?? (() => {}))('coinCollect');`
- Combo level up (around line 493): add `runOnJS(onPlaySfx ?? (() => {}))('comboUp');`
- Near miss (around line 651): add `runOnJS(onPlaySfx ?? (() => {}))('nearMiss');`

- [ ] **Step 6: Add ObstacleRenderer and EventWarningRenderer to Canvas**

In the JSX return, inside the `<Group transform={shakeTransform}>`, after `NearMissRenderer`:

```tsx
          <ObstacleRenderer
            obstacleData={obstacleData}
            groundY={groundY}
            width={width}
            height={canvasHeight}
          />
          <EventWarningRenderer
            warningTimer={warningTimer}
            warningEventType={warningEventType}
            warningEventSubtype={warningEventSubtype}
            warningEventParam={warningEventParam}
            challengeActive={challengeActive}
            challengeSubtype={challengeSubtype}
            challengeTimer={challengeTimer}
            challengeParam={challengeParam}
            challengeResultAnim={challengeResultAnim}
            activeEventType={activeEventType}
            activeEventSubtype={activeEventSubtype}
            boostType={boostType}
            boostTimer={boostTimer}
            speedModifier={speedModifier}
            width={width}
            height={canvasHeight}
          />
```

Add hit flash overlay after danger vignette:
```tsx
          {/* Hit flash overlay */}
          <Rect x={0} y={0} width={width} height={canvasHeight}
            color="white"
            opacity={useDerivedValue(() => hitFlashTimer.value > 0 ? 0.4 : 0)}
          />
```

- [ ] **Step 7: Pass skin palette to StorkRenderer**

Update the StorkRenderer call in JSX:
```tsx
          <StorkRenderer
            // ... existing props
            skinPalette={skinPalette}
          />
```

- [ ] **Step 8: Commit**

```bash
git add src/game/GameCanvas.tsx
git commit -m "feat: add event processing, boost system, and SFX triggers to GameCanvas"
```

---

## Task 7: Obstacle & Warning Renderers

**Files:**
- Create: `src/components/ObstacleRenderer.tsx`
- Create: `src/components/EventWarningRenderer.tsx`

- [ ] **Step 1: Create ObstacleRenderer.tsx**

Create `src/components/ObstacleRenderer.tsx`:

```typescript
import React from 'react';
import { Group, Path, Circle, Rect, Skia, RoundedRect } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface ObstacleRendererProps {
  obstacleData: SharedValue<number[]>;
  groundY: number;
  width: number;
  height: number;
}

export const ObstacleRenderer: React.FC<ObstacleRendererProps> = ({
  obstacleData,
  groundY,
  width,
  height,
}) => {
  const rockPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    // Rock shape: irregular polygon
    p.moveTo(-15, 0);
    p.lineTo(-12, -20);
    p.lineTo(-5, -28);
    p.lineTo(5, -25);
    p.lineTo(12, -18);
    p.lineTo(15, 0);
    p.close();
    return p;
  }, []);

  const branchPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    // Branch shape: horizontal line with twigs
    p.moveTo(-20, 0);
    p.lineTo(20, -3);
    p.moveTo(-8, 0);
    p.lineTo(-12, -10);
    p.moveTo(5, -1);
    p.lineTo(8, -12);
    p.moveTo(15, -2);
    p.lineTo(12, 8);
    return p;
  }, []);

  const transform = useDerivedValue(() => {
    const d = obstacleData.value;
    if (d[3] < 0.5) return [{ translateX: -100 }, { translateY: -100 }];
    return [{ translateX: d[1] }, { translateY: d[2] }];
  });

  const opacity = useDerivedValue(() => {
    return obstacleData.value[3] > 0.5 ? 1 : 0;
  });

  const isRock = useDerivedValue(() => {
    return obstacleData.value[0] < 0.5; // 0 = rock
  });

  return (
    <Group transform={transform} opacity={opacity}>
      {/* Rock */}
      <Group opacity={useDerivedValue(() => isRock.value ? 1 : 0)}>
        <Path path={rockPath} color="#6B5B4F" />
        <Path path={rockPath} color="#8B7B6F" style="stroke" strokeWidth={1.5} />
      </Group>
      {/* Branch */}
      <Group opacity={useDerivedValue(() => isRock.value ? 0 : 1)}>
        <Path path={branchPath} color="#5D4037" style="stroke" strokeWidth={3} strokeCap="round" />
      </Group>
    </Group>
  );
};
```

- [ ] **Step 2: Create EventWarningRenderer.tsx**

Create `src/components/EventWarningRenderer.tsx`:

```typescript
import React from 'react';
import { Group, Text as SkiaText, RoundedRect, Rect, matchFont, Path, Skia } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { Platform } from 'react-native';

const EVT_OBSTACLE = 0;
const EVT_ENVIRONMENT = 1;
const EVT_CHALLENGE = 2;
const EVT_SPEED = 3;
const ENV_GUST = 0;
const ENV_QUAKE = 1;
const ENV_ICE = 2;
const CHL_CENTERED = 0;
const CHL_STORM = 1;
const CHL_LEAN = 2;

const font = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
  fontSize: 18,
  fontStyle: 'normal',
  fontWeight: 'bold',
});

const smallFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
  fontSize: 14,
  fontStyle: 'normal',
  fontWeight: 'bold',
});

interface EventWarningRendererProps {
  warningTimer: SharedValue<number>;
  warningEventType: SharedValue<number>;
  warningEventSubtype: SharedValue<number>;
  warningEventParam: SharedValue<number>;
  challengeActive: SharedValue<number>;
  challengeSubtype: SharedValue<number>;
  challengeTimer: SharedValue<number>;
  challengeParam: SharedValue<number>;
  challengeResultAnim: SharedValue<number>;
  activeEventType: SharedValue<number>;
  activeEventSubtype: SharedValue<number>;
  boostType: SharedValue<number>;
  boostTimer: SharedValue<number>;
  speedModifier: SharedValue<number>;
  width: number;
  height: number;
}

export const EventWarningRenderer: React.FC<EventWarningRendererProps> = ({
  warningTimer,
  warningEventType,
  warningEventSubtype,
  warningEventParam,
  challengeActive,
  challengeSubtype,
  challengeTimer,
  challengeParam,
  challengeResultAnim,
  activeEventType,
  activeEventSubtype,
  boostType,
  boostTimer,
  speedModifier,
  width,
  height,
}) => {
  // Warning arrow for obstacles
  const arrowPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(0, -12);
    p.lineTo(10, 0);
    p.lineTo(4, 0);
    p.lineTo(4, 12);
    p.lineTo(-4, 12);
    p.lineTo(-4, 0);
    p.lineTo(-10, 0);
    p.close();
    return p;
  }, []);

  // Warning banner opacity
  const bannerOpacity = useDerivedValue(() => {
    if (warningTimer.value <= 0) return 0;
    return Math.min(1, warningTimer.value * 3); // fade in
  });

  // Warning banner text
  const bannerText = useDerivedValue(() => {
    const type = warningEventType.value;
    const sub = warningEventSubtype.value;
    if (type === EVT_OBSTACLE) return 'WATCH OUT!';
    if (type === EVT_ENVIRONMENT) {
      if (sub === ENV_GUST) return 'GUST!';
      if (sub === ENV_QUAKE) return 'QUAKE!';
      if (sub === ENV_ICE) return 'ICE!';
    }
    if (type === EVT_SPEED) return 'SPEED!';
    return '';
  });

  // Warning arrow position
  const arrowX = useDerivedValue(() => {
    if (warningEventType.value !== EVT_OBSTACLE || warningTimer.value <= 0) return -100;
    return warningEventParam.value > 0 ? width - 40 : 40;
  });

  const arrowRotation = useDerivedValue(() => {
    return warningEventParam.value > 0 ? -Math.PI / 2 : Math.PI / 2;
  });

  // Challenge UI
  const challengeOpacity = useDerivedValue(() => challengeActive.value > 0.5 ? 1 : 0);

  const challengeText = useDerivedValue(() => {
    const sub = challengeSubtype.value;
    if (sub === CHL_CENTERED) return 'STAY CENTERED!';
    if (sub === CHL_STORM) return 'SURVIVE!';
    if (sub === CHL_LEAN) {
      return challengeParam.value > 0 ? 'LEAN RIGHT!' : 'LEAN LEFT!';
    }
    return '';
  });

  const challengeProgressWidth = useDerivedValue(() => {
    if (challengeActive.value < 0.5) return 0;
    const maxDuration =
      challengeSubtype.value === CHL_CENTERED ? 3.0
      : challengeSubtype.value === CHL_STORM ? 4.0
      : 2.0;
    return Math.max(0, (1 - challengeTimer.value / maxDuration)) * 120;
  });

  // Challenge result
  const resultOpacity = useDerivedValue(() => Math.abs(challengeResultAnim.value));
  const resultText = useDerivedValue(() => challengeResultAnim.value > 0 ? 'SUCCESS!' : 'FAILED');
  const resultColor = useDerivedValue(() => challengeResultAnim.value > 0 ? '#44FF44' : '#FF4444');

  // Active environment banner
  const envBannerOpacity = useDerivedValue(() => {
    if (activeEventType.value !== EVT_ENVIRONMENT) return 0;
    return 0.8;
  });

  const envBannerColor = useDerivedValue(() => {
    const sub = activeEventSubtype.value;
    if (sub === ENV_GUST) return 'rgba(100,180,255,0.3)';
    if (sub === ENV_QUAKE) return 'rgba(180,100,50,0.3)';
    if (sub === ENV_ICE) return 'rgba(150,220,255,0.3)';
    return 'transparent';
  });

  // Boost indicator
  const boostOpacity = useDerivedValue(() => boostType.value > 0 ? 1 : 0);
  const boostText = useDerivedValue(() => {
    if (boostType.value === 1) return 'SHIELD';
    if (boostType.value === 2) return 'SLOW-MO';
    return '';
  });

  // Speed lines for sprint
  const sprintOpacity = useDerivedValue(() => speedModifier.value > 1.5 ? 0.4 : 0);

  return (
    <>
      {/* Warning banner */}
      <Group opacity={bannerOpacity}>
        <RoundedRect x={width / 2 - 70} y={20} width={140} height={32} r={16} color="rgba(0,0,0,0.6)" />
        <SkiaText x={width / 2 - 45} y={42} text={bannerText} font={font} color="#FFFFFF" />
      </Group>

      {/* Warning arrow for obstacles */}
      <Group
        transform={useDerivedValue(() => [
          { translateX: arrowX.value },
          { translateY: height * 0.5 },
          { rotate: arrowRotation.value },
        ])}
        opacity={useDerivedValue(() => warningEventType.value === EVT_OBSTACLE && warningTimer.value > 0 ? (Math.sin(warningTimer.value * 12) > 0 ? 1 : 0.3) : 0)}
      >
        <Path path={arrowPath} color="#FF4444" />
      </Group>

      {/* Environment active overlay */}
      <Rect x={0} y={0} width={width} height={height} color={envBannerColor} opacity={envBannerOpacity} />

      {/* Challenge UI */}
      <Group opacity={challengeOpacity}>
        <RoundedRect x={width / 2 - 80} y={height * 0.25} width={160} height={40} r={20} color="rgba(0,0,0,0.7)" />
        <SkiaText x={width / 2 - 60} y={height * 0.25 + 26} text={challengeText} font={smallFont} color="#FFD700" />
        {/* Progress bar */}
        <RoundedRect x={width / 2 - 60} y={height * 0.25 + 34} width={120} height={4} r={2} color="rgba(255,255,255,0.2)" />
        <RoundedRect x={width / 2 - 60} y={height * 0.25 + 34} width={challengeProgressWidth} height={4} r={2} color="#FFD700" />
      </Group>

      {/* Challenge result popup */}
      <Group opacity={resultOpacity}>
        <SkiaText x={width / 2 - 40} y={height * 0.35} text={resultText} font={font} color={resultColor} />
      </Group>

      {/* Boost indicator */}
      <Group opacity={boostOpacity}>
        <RoundedRect x={width / 2 - 40} y={height - 50} width={80} height={24} r={12} color="rgba(78,205,196,0.8)" />
        <SkiaText x={width / 2 - 28} y={height - 32} text={boostText} font={smallFont} color="#FFFFFF" />
      </Group>

      {/* Sprint speed lines */}
      <Group opacity={sprintOpacity}>
        <Rect x={0} y={height * 0.3} width={width * 0.05} height={2} color="rgba(255,255,255,0.5)" />
        <Rect x={0} y={height * 0.45} width={width * 0.08} height={2} color="rgba(255,255,255,0.4)" />
        <Rect x={0} y={height * 0.55} width={width * 0.06} height={2} color="rgba(255,255,255,0.3)" />
        <Rect x={0} y={height * 0.65} width={width * 0.04} height={2} color="rgba(255,255,255,0.5)" />
      </Group>
    </>
  );
};
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ObstacleRenderer.tsx src/components/EventWarningRenderer.tsx
git commit -m "feat: add obstacle and event warning Skia renderers"
```

---

## Task 8: Wire Everything Together in AppNavigator

**Files:**
- Modify: `src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Full rewrite of AppNavigator with all new systems integrated**

Update `src/navigation/AppNavigator.tsx` with all new imports and state. The key changes:

1. Replace `useDailyFreePlay` with `useFirstPlay`
2. Add `useInterstitialAd`, `useSkin`, `useSfx`
3. Add boost state
4. Pass new props to `GameScreen`, `GameOverScreen`, `StartScreen`
5. Wire `handleBoost` and `handleSkinUnlock` callbacks

The complete updated file should:
- Import `useFirstPlay` instead of `useDailyFreePlay`
- Import `useInterstitialAd`, `useSkin`, `useSfx`
- Add `pendingBoost` state
- Modify `handleGameOver` to show interstitial (skip on first play)
- Modify `handlePlay` to remove pre-game ad
- Add `handleBoost` callback
- Add `handleSkinUnlock` callback
- Pass `pendingBoost`, `activeSkin`, `playSfx` to GameCanvas via GameScreen
- Pass `onBoost`, `onSkinUnlock`, `activeSkinId` to GameOverScreen
- Pass `skinPalette` to StartScreen

- [ ] **Step 2: Update GameScreen to forward new props**

In `src/screens/GameScreen.tsx`, add the new props to the interface and forward to GameCanvas:

```typescript
interface GameScreenProps {
  width: number;
  height: number;
  isPlaying: boolean;
  isResuming?: boolean;
  onGameOver: (data: { score: number; distance: number; coins?: number }) => void;
  pendingBoost?: 'shield' | 'slowmo' | null;
  skinPalette?: { body: string; bodyLight: string; legs: string; legsDark: string; wing: string; neck: string; cheek: string; };
  onPlaySfx?: (name: string) => void;
}
```

Forward to `<GameCanvas ... pendingBoost={pendingBoost} skinPalette={skinPalette} onPlaySfx={onPlaySfx} />`

- [ ] **Step 3: Commit**

```bash
git add src/navigation/AppNavigator.tsx src/screens/GameScreen.tsx
git commit -m "feat: wire event system, ads, skins, and SFX into app navigator"
```

---

## Task 9: Final Cleanup & Version Bump

**Files:**
- Modify: `src/game/constants.ts` (verify no orphaned references)
- Verify: all imports resolve, no TypeScript errors

- [ ] **Step 1: Remove any remaining references to deleted files**

Search for imports of `useDailyFreePlay` and `useSoundEffects` and remove:

```bash
grep -r "useDailyFreePlay\|useSoundEffects" src/
```

Fix any found references.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -50
```

Fix any type errors found.

- [ ] **Step 3: Test on simulator**

```bash
npx expo start --ios
```

Verify:
- Game starts without pre-game ad
- Events spawn during gameplay (obstacles, environment, challenges, speed)
- SFX plays on events
- Game over triggers interstitial (skip first play)
- Boost buttons work on result screen
- Skin preview and unlock works
- Continue button still works

- [ ] **Step 4: Commit final cleanup**

```bash
git add -A
git commit -m "chore: cleanup imports and verify integration"
```

---

## Dependency Graph

```
Task 1 (Events) ──────────┐
Task 2 (SFX) ─────────────┤
Task 3 (Skins) ───────────┤
Task 4 (Ads/FirstPlay) ───┤
                           ├── Task 6 (GameCanvas) ──── Task 8 (AppNavigator wiring)
Task 5 (GameOverScreen) ──┤                                      │
Task 7 (Renderers) ────────┘                             Task 9 (Cleanup)
```

Tasks 1-5 and 7 are independent and can be parallelized. Task 6 depends on 1 and 7. Task 8 depends on all. Task 9 is last.
