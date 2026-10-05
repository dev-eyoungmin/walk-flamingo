/**
 * When to show the system "rate this app" dialog. The store caps how often it really appears, so
 * this only picks a good moment: a fresh record from a player who has been around for a while.
 */
export const REVIEW = {
  /** Finished runs before the first ask */
  MIN_RUNS: 6,
  /** Wait this long before asking the same player again */
  MIN_INTERVAL_MS: 60 * 24 * 60 * 60 * 1000,
} as const;

export interface ReviewMoment {
  newBest: boolean;
  /** Finished runs, including this one */
  runs: number;
  /** When the dialog was last requested (0 = never) */
  lastAskedAt: number;
  now: number;
}

export function shouldAskForReview({ newBest, runs, lastAskedAt, now }: ReviewMoment): boolean {
  if (!newBest || runs < REVIEW.MIN_RUNS) return false;
  return lastAskedAt <= 0 || now - lastAskedAt >= REVIEW.MIN_INTERVAL_MS;
}
