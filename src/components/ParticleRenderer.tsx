import React from 'react';
import { Circle, Group } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

interface ParticleRendererProps {
  width: number;
  height: number;
  comboLevelUpAnim: SharedValue<number>; // >0 when combo just leveled up, decays to 0
  dangerRatio: SharedValue<number>;      // 0-1 how close to game over
  elapsedTime: SharedValue<number>;
  distance: SharedValue<number>;
  angle: SharedValue<number>;
  isGameOver: SharedValue<boolean>;
}

// Fixed-count maxima
const MAX_DUST = 6;
const MAX_BURST = 16;
const MAX_SPARKS = 8;
const MAX_IMPACT = 12;

// Burst colors cycling
const BURST_COLORS = ['#FFD700', '#FF6B8A', '#4ECDC4', '#FF8C5A', '#C084FC', '#45B7D1'];

// ─── Footstep Dust Particle ───────────────────────────────────────────────────
const DustParticle: React.FC<{
  index: number;
  width: number;
  height: number;
  elapsedTime: SharedValue<number>;
}> = ({ index, width, height, elapsedTime }) => {
  const groundY = height * 0.65;
  const cx = width / 2;

  // Each particle has a staggered phase offset
  const phaseOffset = (index / MAX_DUST) * Math.PI * 2;
  // Spread particles horizontally around feet
  const xSpread = (index - MAX_DUST / 2) * 8;

  const particleX = useDerivedValue(() => {
    const cycle = (elapsedTime.value * 1.2 + phaseOffset) % (Math.PI * 2);
    // Drift outward from center with a slight wobble
    const drift = Math.sin(cycle) * 12;
    return cx + xSpread + drift;
  });

  const particleY = useDerivedValue(() => {
    const cycle = (elapsedTime.value * 1.2 + phaseOffset) % (Math.PI * 2);
    // Normalize to [0,1] lifecycle (0 = just appeared, 1 = about to disappear)
    const life = (cycle / (Math.PI * 2));
    // Drift upward from ground
    return groundY - life * 18;
  });

  const particleOpacity = useDerivedValue(() => {
    const cycle = (elapsedTime.value * 1.2 + phaseOffset) % (Math.PI * 2);
    const life = cycle / (Math.PI * 2);
    // Fade in quickly, fade out over lifecycle
    if (life < 0.15) return life / 0.15 * 0.55;
    return (1 - life) * 0.55;
  });

  const particleR = useDerivedValue(() => {
    const cycle = (elapsedTime.value * 1.2 + phaseOffset) % (Math.PI * 2);
    const life = cycle / (Math.PI * 2);
    // Grow slightly then shrink
    return 2 + life * 3;
  });

  return (
    <Circle
      cx={particleX}
      cy={particleY}
      r={particleR}
      color="#C8B99A"
      opacity={particleOpacity}
    />
  );
};

// ─── Combo Burst Particle ─────────────────────────────────────────────────────
const BurstParticle: React.FC<{
  index: number;
  width: number;
  height: number;
  comboLevelUpAnim: SharedValue<number>;
}> = ({ index, width, height, comboLevelUpAnim }) => {
  const BURST_LIFETIME = 0.6;
  const cx = width / 2;
  const groundY = height * 0.65;

  // Pre-compute deterministic angle and speed for this particle index
  const angle = (index / MAX_BURST) * Math.PI * 2;
  // Vary speed per particle using a deterministic pseudo-random
  const speedSeed = Math.sin(index * 3.7 * 12.9898 + 78.233) * 0.5 + 1.5;
  const speed = 60 + speedSeed * 40;

  const color = BURST_COLORS[index % BURST_COLORS.length];

  const particleX = useDerivedValue(() => {
    if (comboLevelUpAnim.value <= 0) return -100;
    const progress = 1 - comboLevelUpAnim.value / BURST_LIFETIME;
    return cx + Math.cos(angle) * speed * progress;
  });

  const particleY = useDerivedValue(() => {
    if (comboLevelUpAnim.value <= 0) return -100;
    const progress = 1 - comboLevelUpAnim.value / BURST_LIFETIME;
    // Slight upward arc
    return groundY - 40 + Math.sin(angle) * speed * progress - progress * progress * 20;
  });

  const particleOpacity = useDerivedValue(() => {
    if (comboLevelUpAnim.value <= 0) return 0;
    return comboLevelUpAnim.value / BURST_LIFETIME;
  });

  const particleR = useDerivedValue(() => {
    if (comboLevelUpAnim.value <= 0) return 0;
    const progress = 1 - comboLevelUpAnim.value / BURST_LIFETIME;
    return 4 + progress * 3;
  });

  return (
    <Circle
      cx={particleX}
      cy={particleY}
      r={particleR}
      color={color}
      opacity={particleOpacity}
    />
  );
};

// ─── Danger Spark Particle ────────────────────────────────────────────────────
const SparkParticle: React.FC<{
  index: number;
  width: number;
  height: number;
  dangerRatio: SharedValue<number>;
  elapsedTime: SharedValue<number>;
  angle: SharedValue<number>;
}> = ({ index, width, height, dangerRatio, elapsedTime, angle }) => {
  const groundY = height * 0.65;
  const cx = width / 2;

  const DANGER_THRESHOLD = 0.6;
  // Deterministic offset per spark
  const phaseOffset = (index / MAX_SPARKS) * Math.PI * 2;
  const freqMult = 1.5 + (index % 3) * 0.7;
  const isRed = index % 2 === 0;
  const color = isRed ? '#FF4444' : '#FF8C00';
  // Spread sparks around the flamingo body area
  const xOff = (index - MAX_SPARKS / 2) * 10;

  const particleX = useDerivedValue(() => {
    if (dangerRatio.value < DANGER_THRESHOLD) return -100;
    // Follow stork lean direction slightly
    const lean = angle.value * 20;
    const flicker = Math.sin(elapsedTime.value * freqMult * 8 + phaseOffset) * 8;
    return cx + xOff + lean + flicker;
  });

  const particleY = useDerivedValue(() => {
    if (dangerRatio.value < DANGER_THRESHOLD) return -100;
    const flicker = Math.cos(elapsedTime.value * freqMult * 7 + phaseOffset) * 10;
    // Sparks near legs/feet area, scaled by danger
    const intensity = (dangerRatio.value - DANGER_THRESHOLD) / (1 - DANGER_THRESHOLD);
    return groundY - 10 - intensity * 20 + flicker;
  });

  const particleOpacity = useDerivedValue(() => {
    if (dangerRatio.value < DANGER_THRESHOLD) return 0;
    const intensity = (dangerRatio.value - DANGER_THRESHOLD) / (1 - DANGER_THRESHOLD);
    // Flickering opacity scaled with danger intensity
    const flicker = (Math.sin(elapsedTime.value * freqMult * 12 + phaseOffset) + 1) * 0.5;
    return intensity * (0.4 + flicker * 0.6);
  });

  const particleR = useDerivedValue(() => {
    if (dangerRatio.value < DANGER_THRESHOLD) return 0;
    const intensity = (dangerRatio.value - DANGER_THRESHOLD) / (1 - DANGER_THRESHOLD);
    const flicker = (Math.sin(elapsedTime.value * freqMult * 9 + phaseOffset) + 1) * 0.5;
    return 2 + intensity * (1 + flicker * 2);
  });

  return (
    <Circle
      cx={particleX}
      cy={particleY}
      r={particleR}
      color={color}
      opacity={particleOpacity}
    />
  );
};

// ─── Game-Over Impact Particle ────────────────────────────────────────────────
const ImpactParticle: React.FC<{
  index: number;
  width: number;
  height: number;
  isGameOver: SharedValue<boolean>;
  elapsedTime: SharedValue<number>;
}> = ({ index, width, height, isGameOver, elapsedTime }) => {
  const groundY = height * 0.65;
  const cx = width / 2;

  const IMPACT_DURATION = 0.8;

  // Deterministic angle and speed for radial expansion
  const angle = (index / MAX_IMPACT) * Math.PI * 2;
  const speedSeed = Math.sin(index * 5.1 * 12.9898 + 31.415) * 0.5 + 1.0;
  const speed = 50 + speedSeed * 50;

  // Capture the elapsed time at game over to measure impact progress
  // We use a simple approach: start time is tracked by reading initial elapsedTime
  // Since we can't store state in worklets, we use the fact that isGameOver just
  // turned true and measure time from a fixed window
  const startTimeRef = useDerivedValue(() => {
    // When game over is false, reset to current time so we're ready to capture
    if (!isGameOver.value) return elapsedTime.value;
    return elapsedTime.value; // will be overwritten below
  });

  // Track game-over start time: once isGameOver becomes true, the impact starts
  // We approximate using a separate derived value that remembers the trigger moment
  const gameOverStartTime = useDerivedValue(() => {
    // This approach resets when NOT in game over and "freezes" when in game over.
    // Since worklets can't persist state across calls easily, we compute progress
    // by using the current elapsedTime — the first frame after isGameOver becomes
    // true will have the smallest elapsed value relative to when it was set.
    // Instead, we gate the full animation on isGameOver and use a time window approach.
    return elapsedTime.value;
  });

  const particleX = useDerivedValue(() => {
    if (!isGameOver.value) return -100;
    // Use elapsedTime modulo a small window to drive the animation
    // The impact plays for IMPACT_DURATION seconds; progress cycles through
    const progress = Math.min(1, (elapsedTime.value % IMPACT_DURATION) / IMPACT_DURATION);
    return cx + Math.cos(angle) * speed * progress;
  });

  const particleY = useDerivedValue(() => {
    if (!isGameOver.value) return -100;
    const progress = Math.min(1, (elapsedTime.value % IMPACT_DURATION) / IMPACT_DURATION);
    // Expand radially with slight gravity drop
    return groundY + Math.sin(angle) * speed * progress + progress * progress * 30;
  });

  const particleOpacity = useDerivedValue(() => {
    if (!isGameOver.value) return 0;
    const progress = Math.min(1, (elapsedTime.value % IMPACT_DURATION) / IMPACT_DURATION);
    // Quick fade out
    return 1 - progress;
  });

  const particleR = useDerivedValue(() => {
    if (!isGameOver.value) return 0;
    const progress = Math.min(1, (elapsedTime.value % IMPACT_DURATION) / IMPACT_DURATION);
    // Expand then shrink
    return 5 + progress * 4 - progress * progress * 8;
  });

  return (
    <Circle
      cx={particleX}
      cy={particleY}
      r={particleR}
      color="#8B4513"
      opacity={particleOpacity}
    />
  );
};

// ─── Static index arrays (avoids creating arrays inside render) ───────────────
const dustIndices = Array.from({ length: MAX_DUST }, (_, i) => i);
const burstIndices = Array.from({ length: MAX_BURST }, (_, i) => i);
const sparkIndices = Array.from({ length: MAX_SPARKS }, (_, i) => i);
const impactIndices = Array.from({ length: MAX_IMPACT }, (_, i) => i);

// ─── ParticleRenderer ─────────────────────────────────────────────────────────
export const ParticleRenderer: React.FC<ParticleRendererProps> = ({
  width,
  height,
  comboLevelUpAnim,
  dangerRatio,
  elapsedTime,
  distance,
  angle,
  isGameOver,
}) => {
  return (
    <Group>
      {/* 1. Footstep dust */}
      {dustIndices.map((i) => (
        <DustParticle
          key={`dust-${i}`}
          index={i}
          width={width}
          height={height}
          elapsedTime={elapsedTime}
        />
      ))}

      {/* 2. Combo burst */}
      {burstIndices.map((i) => (
        <BurstParticle
          key={`burst-${i}`}
          index={i}
          width={width}
          height={height}
          comboLevelUpAnim={comboLevelUpAnim}
        />
      ))}

      {/* 3. Danger sparks */}
      {sparkIndices.map((i) => (
        <SparkParticle
          key={`spark-${i}`}
          index={i}
          width={width}
          height={height}
          dangerRatio={dangerRatio}
          elapsedTime={elapsedTime}
          angle={angle}
        />
      ))}

      {/* 4. Game-over impact */}
      {impactIndices.map((i) => (
        <ImpactParticle
          key={`impact-${i}`}
          index={i}
          width={width}
          height={height}
          isGameOver={isGameOver}
          elapsedTime={elapsedTime}
        />
      ))}
    </Group>
  );
};
