import type { DifficultyParams } from './types';

/**
 * Calculate difficulty parameters based on elapsed time.
 * Wave pattern: difficulty surges then eases, with rising baseline.
 * Must match inlined worklet values in GameCanvas.tsx.
 */
export function getDifficulty(elapsedTime: number): DifficultyParams {
  const t = elapsedTime;

  // Wave oscillates 0‥1 with ~4s period, adds up to 30% on top of base
  const wave = (Math.sin(t * 1.6) + 1) * 0.5;  // 0‥1
  const surge = 1.0 + wave * 0.3;               // 1.0‥1.3

  // Gravity: higher base + faster ramp + surge peaks
  const gravityMultiplier = (2.2 + t * 0.08) * surge;

  // Damping: lower base + drops faster during surge
  const dampBase = Math.max(0.68, 0.84 - t * 0.004);
  const damping = dampBase - wave * 0.06;

  // Jitter: higher base + surge peaks, caps at 5.5
  const jitterMultiplier = (2.2 + Math.min(t * 0.09, 2.2)) * surge;

  // Wind: stronger base + surge, caps at 7.0
  const windStrength = Math.min((2.2 + t * 0.12) * surge, 7.0);

  // Wind direction changes faster over time, min 0.4s
  const windChangeInterval = Math.max(0.4, 3.0 - t * 0.30);

  return {
    gravityMultiplier,
    damping,
    jitterMultiplier,
    windStrength,
    windChangeInterval,
  };
}
