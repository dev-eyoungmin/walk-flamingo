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

  // Gravity: higher base + surge peaks
  const gravityMultiplier = (1.8 + t * 0.055) * surge;

  // Damping: lower base + dips further during surge
  const dampBase = Math.max(0.74, 0.86 - t * 0.0025);
  const damping = dampBase - wave * 0.04;

  // Jitter: higher base + surge peaks, caps at 4.68
  const jitterMultiplier = (1.8 + Math.min(t * 0.07, 1.8)) * surge;

  // Wind: stronger base + surge, caps at 5.0 (HARDER)
  const windStrength = Math.min((1.5 + t * 0.08) * surge, 5.0);

  // Wind direction changes faster over time, min 0.6s
  const windChangeInterval = Math.max(0.6, 3.5 - t * 0.25);

  return {
    gravityMultiplier,
    damping,
    jitterMultiplier,
    windStrength,
    windChangeInterval,
  };
}
