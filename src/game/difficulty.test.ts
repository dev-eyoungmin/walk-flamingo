import { getDifficulty } from './difficulty';

describe('getDifficulty', () => {
  it('should return harder base values at t=0', () => {
    // At t=0: wave = (sin(0)+1)*0.5 = 0.5, surge = 1.15
    const d = getDifficulty(0);
    expect(d.gravityMultiplier).toBeCloseTo(1.8 * 1.15, 2);
    expect(d.damping).toBeCloseTo(0.86 - 0.5 * 0.04, 2);
    expect(d.jitterMultiplier).toBeCloseTo(1.8 * 1.15, 2);
    expect(d.windStrength).toBeCloseTo(0.8 * 1.15, 2);
  });

  it('should increase gravity over time', () => {
    // Gravity base rises with t, so average should be higher later
    const g0 = getDifficulty(0).gravityMultiplier;
    const g20 = getDifficulty(20).gravityMultiplier;
    // Even at a wave trough at t=20, base is much higher
    expect(g20).toBeGreaterThan(g0);
  });

  it('should have wave-based oscillation in gravity', () => {
    // Sample multiple close time points — not all the same
    const samples = [5, 5.5, 6, 6.5, 7].map(
      (t) => getDifficulty(t).gravityMultiplier,
    );
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    expect(max - min).toBeGreaterThan(0.3);
  });

  it('should decrease damping over time on average', () => {
    const d0 = getDifficulty(0).damping;
    const d30 = getDifficulty(30).damping;
    expect(d30).toBeLessThan(d0);
  });

  it('should cap damping base at minimum 0.74', () => {
    // At very large t, dampBase = 0.74, damping = 0.74 - wave*0.04
    const d = getDifficulty(1000);
    expect(d.damping).toBeGreaterThanOrEqual(0.70);
    expect(d.damping).toBeLessThanOrEqual(0.74);
  });

  it('should have wind from the start', () => {
    expect(getDifficulty(0).windStrength).toBeGreaterThan(0);
  });

  it('should increase wind over time', () => {
    // Compare averages over a full wave cycle
    const avg = (start: number) => {
      let sum = 0;
      for (let i = 0; i < 10; i++) sum += getDifficulty(start + i * 0.4).windStrength;
      return sum / 10;
    };
    expect(avg(10)).toBeGreaterThan(avg(0));
  });

  it('should cap wind strength at 2.8', () => {
    const d = getDifficulty(200);
    expect(d.windStrength).toBeLessThanOrEqual(2.8);
  });

  it('should increase jitter over time', () => {
    const j0 = getDifficulty(0).jitterMultiplier;
    const j20 = getDifficulty(20).jitterMultiplier;
    expect(j20).toBeGreaterThan(j0);
  });

  it('should decrease wind change interval over time', () => {
    const d0 = getDifficulty(0).windChangeInterval;
    const d30 = getDifficulty(30).windChangeInterval;
    expect(d30).toBeLessThan(d0);
  });

  it('should cap wind change interval at minimum 0.8', () => {
    const d = getDifficulty(200);
    expect(d.windChangeInterval).toBe(0.8);
  });
});
