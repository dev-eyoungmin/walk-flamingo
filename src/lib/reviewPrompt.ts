/**
 * When to show the system "rate this app" dialog. The store caps how often it really appears, so
 * this only picks a good moment: a fresh record or a long run from a player who has played a few times.
 */
export const REVIEW = {
  /** Finished runs before the first ask */
  MIN_RUNS: 3,
  /** A run this long is a good moment even without a record */
  GREAT_RUN_M: 150,
  /** Wait this long before asking the same player again */
  MIN_INTERVAL_MS: 30 * 24 * 60 * 60 * 1000,
} as const;

export interface ReviewMoment {
  newBest: boolean;
  /** Distance of the run just finished */
  meters: number;
  /** Finished runs, including this one */
  runs: number;
  /** When the dialog was last requested (0 = never) */
  lastAskedAt: number;
  now: number;
}

export function shouldAskForReview({ newBest, meters, runs, lastAskedAt, now }: ReviewMoment): boolean {
  if (!(newBest || meters >= REVIEW.GREAT_RUN_M) || runs < REVIEW.MIN_RUNS) return false;
  return lastAskedAt <= 0 || now - lastAskedAt >= REVIEW.MIN_INTERVAL_MS;
}
