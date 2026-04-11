# Flamingo Walk: Engagement & Ad Revenue Redesign

**Date**: 2026-04-12
**Status**: Draft
**Goal**: Increase game fun → retention → session count → ad revenue

---

## Problem Statement

The game lacks engagement: core mechanic is too simple, every session feels identical, and feedback is weak (no SFX). Without players, ad revenue is zero regardless of ad placement optimization.

## Constraints

- No point spending / shop / sharing features
- Existing left/right tap controls preserved — no new input types
- Session target: 30s–1min (ultra-casual)
- Mandatory ad after every game over (except first-ever session)

---

## 1. Event Lane System

Distance-based event queue that makes every session feel different. Events are pre-generated at game start with a random seed.

### Timeline

```
0s────3s────6s────10s────15s────20s────25s────30s+
│grace│ramp │ zone1 │ zone2 │ zone3 │ zone4  ...│
│safe │ease │1st evt│intens↑│ mixed │ extreme   │
```

- **Minimum gap**: 2–3s between events, never 2+ simultaneous
- **Difficulty ramp**: frequency ↑, intensity ↑, warning time ↓ over elapsed time
- **Integration**: uses existing `distance` shared value, same as coins/weather/milestones

### Event Types

#### 1.1 Obstacles

Physical objects approaching from one side. Player must lean opposite to dodge.

| Obstacle | Origin | Dodge Direction | On Hit |
|----------|--------|----------------|--------|
| **Rock** | ground, scrolls from right | lean left | angular velocity spike + screen shake (not instant death) |
| **Branch** | falls from above-left or above-right | lean away from fall side | angular velocity spike + screen shake |

- **Warning**: arrow icon on approach side, 1.5s before arrival
- **Hit penalty**: large angular velocity impulse (±8 rad/s), recoverable but difficult
- **Visual**: rock/branch rendered in Skia, scrolls with world movement
- **Collision**: distance-based hitbox (similar to coin collection)

#### 1.2 Environment Events

Temporary physics modifiers with advance warning.

| Event | Effect | Duration | Warning |
|-------|--------|----------|---------|
| **Gust** | strong one-directional wind force (±6.0) | 3–4s | "GUST!" banner + wind arrow, 2s before |
| **Quake** | rapid bilateral oscillation added to angular velocity | 3–4s | "QUAKE!" banner + screen vibration hint, 2s before |
| **Ice** | damping reduced to 0.4 (very slippery) | 4–5s | "ICE!" banner + ground color change, 2s before |

- Warning banner: top-center of screen, fades in/out
- Physics effects apply multiplicatively on top of existing difficulty

#### 1.3 Zone Challenges

Timed micro-missions that reward bonus points on success.

| Challenge | Requirement | Duration | Reward |
|-----------|------------|----------|--------|
| **"Stay Centered!"** | keep angle within CENTER_THRESHOLD | 3s | +100 points |
| **"Survive the Storm!"** | don't game-over during combined gust+quake | 4s | +150 points |
| **"Lean Left/Right!"** | maintain angle > 20° in specified direction | 2s | +80 points |

- UI: mission text at screen center + countdown timer bar
- Success: fanfare SFX + floating text + haptic
- Failure: no penalty beyond missed bonus

#### 1.4 Speed Changes

Temporary walk speed multipliers that alter rhythm.

| Type | Speed Multiplier | Duration | Warning |
|------|-----------------|----------|---------|
| **Sprint** | 2.0x | 3s | speedometer icon, 1s before |
| **Slowdown** | 0.5x | 3s | speedometer icon, 1s before |

- Sprint: background blur lines for speed feel, coins/obstacles pass faster
- Slowdown: dreamy/floaty feel, easier to collect but boring if too long

### Event Queue Generation

At game start, generate a sequence of events:
```
eventQueue = [
  { type: 'obstacle', subtype: 'rock', distance: 800, side: 'right' },
  { type: 'environment', subtype: 'gust', distance: 1400, direction: -1 },
  { type: 'challenge', subtype: 'stay_centered', distance: 2000 },
  { type: 'speed', subtype: 'sprint', distance: 2600 },
  ...
]
```

- Generated deterministically from a random seed
- Spacing: `baseInterval * (1 - elapsedTime * 0.02)` (shrinks over time, min 2s equivalent)
- Type selection: weighted random, biased toward obstacles early, mixed later
- Stored as flat number array in SharedValue for worklet access (same pattern as terrain/coins)

---

## 2. Ad Revenue Structure

### Ad Flow

```
[Game Play] ── banner ad (bottom, always)
     │
[Game Over] ── ragdoll 0.8s
     │
     ├─ First-ever session: skip interstitial
     └─ All subsequent: FORCED interstitial
     │
[Result Screen]
     │
     ├─ [CONTINUE] ── rewarded ad → resume game (1x per session)
     ├─ [BOOST ⚡] ── rewarded ad → shield OR slow-mo 3s next game
     ├─ [SKIN 🎨] ── rewarded ad → skin unlock 24h
     └─ [RETRY] ── start next game (no ad)
```

### Ad Inventory

| Placement | Type | Frequency | Expected View Rate |
|-----------|------|-----------|-------------------|
| During gameplay | Banner | 100% of sessions | 100% |
| Post game-over | Interstitial (forced) | Every session (except first-ever) | ~100% |
| Continue | Rewarded (optional) | Offered every session | ~15–25% |
| Boost | Rewarded (optional) | Offered every session | ~10–20% |
| Skin | Rewarded (optional) | Offered every session | ~5–15% |

### Changes from Current

| Current | New |
|---------|-----|
| `useDailyFreePlay.ts` — daily free play | **Remove** → first-ever-session free only (AsyncStorage `@first_game_played` flag) |
| Pre-game rewarded ad | **Remove** — eliminates start friction |
| `useInterstitialAd.ts` — unused | **Activate** — forced post-game-over |
| `useRewardedAd.ts` — Continue only | **Expand** — Continue + Boost + Skin callbacks |

### First-Ever Detection

```typescript
// Replace useDailyFreePlay with useFirstPlay
const STORAGE_KEY = '@flamingo_walk_first_played';
// Check once on mount; after first game over, set flag permanently
```

### Boost Reward

- Player chooses shield OR slow-mo before next game
- Stored in SharedValue, consumed at game start
- Shield: game-over angle check disabled for 3s
- Slow-mo: gravity multiplier halved for 3s
- Visual indicator on screen during active boost (icon + timer)

---

## 3. Skin System

### Architecture

Color palette swap only. No new geometry or animations.

```typescript
interface SkinPalette {
  body: string;
  legs: string;
  wing: string;
  neck: string;
  cheek: string;
}
```

### Available Skins

| ID | Name | Body | Legs | Wing | Unlock |
|----|------|------|------|------|--------|
| `default` | Pink | #FF7A9A | #E86A6A | #E8658A | Free |
| `golden` | Golden | #FFD700 | #DAA520 | #FFC107 | Rewarded ad (24h) |
| `arctic` | Arctic | #B3E5FC | #81D4FA | #4FC3F7 | Rewarded ad (24h) |
| `midnight` | Midnight | #7C4DFF | #6200EA | #B388FF | Rewarded ad (24h) |
| `sunset` | Sunset | #FF6D00 | #E65100 | #FF9E40 | Rewarded ad (24h) |
| `cherry` | Cherry | #FF1744 | #D50000 | #FF5252 | Rewarded ad (24h) |

### Unlock Flow

1. Result screen shows [SKIN 🎨] button
2. Tap → skin preview carousel (mini flamingo silhouettes in each palette)
3. Select skin → "Watch Ad to Unlock 24h" button
4. Ad completes → `AsyncStorage.setItem('@skin_active', JSON.stringify({ id, expiresAt }))`
5. On app launch: check expiry, revert to default if expired
6. `StorkRenderer` reads active palette from React context/prop

### Skin Expiry

- 24 hours from unlock moment
- Check on app mount + game start
- Expired → auto-revert to default, no notification (silent)
- Re-unlock available immediately (watch another ad)

---

## 4. Sound Effects System

### Architecture

Procedural WAV generation (same pattern as existing `useBackgroundMusic.ts`). Each SFX is a short buffer generated once at module load, cached as base64 data URI.

```typescript
// src/lib/sfx.ts
export const SFX = {
  obstacleSwipe: generateSweepWav({ ... }),
  obstacleHit: generateImpactWav({ ... }),
  warningBeep: generateBeepWav({ ... }),
  gust: generateNoiseWav({ ... }),
  quake: generateRumbleWav({ ... }),
  challengeStart: generateChimeWav({ ... }),
  challengeSuccess: generateFanfareWav({ ... }),
  challengeFail: generateDescendWav({ ... }),
  coinCollect: generatePingWav({ ... }),
  comboUp: generateArpeggioWav({ ... }),
  nearMiss: generateReliefWav({ ... }),
  gameOver: generateCrashWav({ ... }),
  speedChange: generateBendWav({ ... }),
} as const;
```

### Playback

- Pre-load all SFX as `Audio.Sound` instances on component mount
- Trigger via `runOnJS(playSfx)('obstacleHit')` from worklet
- Max 3 concurrent sounds (drop oldest if exceeded)
- Volume: SFX at 0.5, BGM at 0.3 (SFX takes priority)

### Haptic Mapping

| Event | Haptic |
|-------|--------|
| Obstacle hit | `ImpactFeedbackStyle.Heavy` |
| Obstacle dodge | `ImpactFeedbackStyle.Light` |
| Gust/Quake active | `ImpactFeedbackStyle.Medium` (repeated) |
| Ice start | `ImpactFeedbackStyle.Light` |
| Challenge start | `NotificationFeedbackType.Warning` |
| Challenge success | `NotificationFeedbackType.Success` |
| Speed change | `ImpactFeedbackStyle.Light` |
| Existing (coin, combo, near-miss, milestone, game-over) | Unchanged |

### Visual Feedback Additions

| Event | Visual |
|-------|--------|
| Obstacle approach | Warning arrow icon on approach side (1.5s before) |
| Obstacle hit | Strong screen shake (shakeTimer = 0.5) + white flash overlay (0.1s) |
| Environment warning | Top-center banner text with icon, fade in 0.3s before event |
| Challenge active | Center text + progress bar counting down |
| Challenge success | Floating "+100" text + burst particles |
| Sprint | Horizontal blur lines behind flamingo |
| Slowdown | Subtle dreamy vignette |

---

## 5. File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/game/events.ts` | Event types, queue generation, encoding for worklet |
| `src/components/ObstacleRenderer.tsx` | Rock/branch Skia rendering |
| `src/components/EventWarningRenderer.tsx` | Warning arrows, banners, challenge UI |
| `src/lib/sfx.ts` | Procedural SFX WAV generation (13 sounds) |
| `src/lib/skins.ts` | Skin palette definitions + AsyncStorage persistence |
| `src/hooks/useFirstPlay.ts` | First-ever-session detection (replaces useDailyFreePlay) |
| `src/hooks/useInterstitialAd.ts` | Already exists — activate and integrate |
| `src/hooks/useSfx.ts` | SFX preload + playback hook |
| `src/hooks/useSkin.ts` | Active skin state + expiry check |
| `src/components/SkinPreview.tsx` | Skin carousel for result screen |

### Modified Files

| File | Changes |
|------|---------|
| `src/game/GameCanvas.tsx` | Event queue processing in useFrameCallback, obstacle collision, environment physics, challenge tracking, speed modifiers, SFX triggers |
| `src/game/constants.ts` | Event constants (intervals, thresholds, durations) |
| `src/components/StorkRenderer.tsx` | Accept skin palette prop, apply colors dynamically |
| `src/screens/GameOverScreen.tsx` | Add Boost/Skin buttons, remove Continue-only layout |
| `src/screens/StartScreen.tsx` | Show active skin on flamingo illustration |
| `src/navigation/AppNavigator.tsx` | Replace useDailyFreePlay with useFirstPlay, add interstitial flow, boost state, skin state |
| `src/hooks/useRewardedAd.ts` | Support multiple reward callbacks (continue/boost/skin) |
| `src/hooks/useSoundEffects.ts` | Replace with useSfx or remove (superseded) |

### Deleted Files

| File | Reason |
|------|--------|
| `src/hooks/useDailyFreePlay.ts` | Replaced by useFirstPlay |

---

## 6. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| GameCanvas.tsx is already 1000+ lines; event system adds more | Extract event processing into separate worklet-compatible functions in `events.ts` |
| Too many simultaneous visual elements (obstacles + coins + weather + warnings) | Enforce max 1 active event + coins; pause coin spawning during environment events |
| Forced interstitial every session may cause uninstalls | First session free + interstitial after game-over (not before) minimizes friction |
| Procedural SFX may sound low-quality | Design modular generators; can swap to asset files per-sound without architecture change |
| 24h skin expiry feels aggressive | Can adjust to 48h or 72h based on user feedback; the mechanism is the same |
| Event queue determinism may feel repetitive after many plays | Seed from `Date.now()` ensures unique sequence; pool of 4 event types × multiple subtypes provides sufficient variety |

---

## 7. Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| Average session length | ~20s | 30–60s |
| Sessions per user per day | unknown (low) | 10+ |
| Retry rate (immediate retry after game over) | unknown | 60%+ |
| Rewarded ad view rate (any of 3 options) | ~15% (Continue only) | 30%+ combined |
| Interstitial impressions per user per day | 0 | = sessions - 1 |
| D1 retention | unknown (low) | 30%+ |
