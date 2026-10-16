export interface DailyGhost { seed: number; meters: number; trace: number[] }
/** Half-second distance samples. Past the finish, the ghost waits at its finish flag. */
export function ghostMetersAt(trace: number[], seconds: number): number {
  'worklet';
  if (!trace.length) return 0;
  const at = Math.max(0, seconds) * 2;
  const i = Math.floor(at);
  if (i >= trace.length - 1) return trace[trace.length - 1];
  return trace[i] + (trace[i + 1] - trace[i]) * (at - i);
}
export function validGhost(value: unknown, seed: number): value is DailyGhost {
  if (!value || typeof value !== 'object') return false;
  const g = value as DailyGhost;
  return g.seed === seed && Number.isFinite(g.meters) && g.meters > 0 && g.meters <= 10000 && Array.isArray(g.trace)
    && g.trace.length >= 2 && g.trace.length <= 2401 && g.trace[0] === 0
    && g.trace.every((m, i) => Number.isFinite(m) && m >= 0 && m <= g.meters + 2 && (i === 0 || m >= g.trace[i-1] && m - g.trace[i-1] <= 5));
}
