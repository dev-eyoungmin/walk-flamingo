/** Linear interpolation between a and b by t (0..1) */
export function lerp(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}
