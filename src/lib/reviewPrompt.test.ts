import { REVIEW, shouldAskForReview } from './reviewPrompt';

const now = Date.UTC(2026, 9, 4);
const moment = (overrides: Partial<Parameters<typeof shouldAskForReview>[0]> = {}) => ({
  newBest: true,
  meters: 40,
  runs: REVIEW.MIN_RUNS,
  lastAskedAt: 0,
  now,
  ...overrides,
});

describe('review prompt', () => {
  it('asks after a new best once the player has finished enough runs', () => {
    expect(shouldAskForReview(moment())).toBe(true);
    expect(shouldAskForReview(moment({ runs: REVIEW.MIN_RUNS - 1 }))).toBe(false);
  });

  it('never asks after an ordinary run', () => {
    expect(shouldAskForReview(moment({ newBest: false, runs: 100 }))).toBe(false);
  });

  it('asks after a long run even without a record', () => {
    expect(shouldAskForReview(moment({ newBest: false, meters: REVIEW.GREAT_RUN_M }))).toBe(true);
  });

  it('waits out the interval before asking again', () => {
    expect(shouldAskForReview(moment({ lastAskedAt: now - REVIEW.MIN_INTERVAL_MS + 1 }))).toBe(false);
    expect(shouldAskForReview(moment({ lastAskedAt: now - REVIEW.MIN_INTERVAL_MS }))).toBe(true);
  });
});
