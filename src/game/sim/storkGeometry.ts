/**
 * Stork body proportions in stork units (U). Shared by the renderer and by collision checks so
 * that what you see is what gets hit. Coordinates are relative to the feet pivot, y up is negative.
 */
export const STORK = {
  THIGH: 6.5,
  SHIN: 6.5,
  /** Hip height above the feet */
  HIP_Y: -13,
  LEG_W: 0.8,
  /** Body center relative to the hip */
  BODY_Y: -3.4,
  HEAD_R: 3.2,
  /** Head center relative to the hip */
  HEAD_X: 4.3,
  HEAD_Y: -15.8,
  /** Neck centerline (cubic) relative to the hip: base → head */
  NECK: [2.8, -6.6, 6.8, -10.2, 0.2, -11.5, 4.0, -15.2] as readonly number[],
} as const;

/**
 * Collision circles relative to the feet pivot (before tilt rotation): [x, y, r] in U.
 * Order matters for callers that care about which part was hit: head first.
 */
export const STORK_HIT_CIRCLES: readonly number[] = [
  // head
  STORK.HEAD_X, STORK.HIP_Y + STORK.HEAD_Y, STORK.HEAD_R,
  // upper neck
  3.5, -23.9, 1.4,
  // lower neck
  4.1, -21.4, 1.5,
  // body
  -0.3, STORK.HIP_Y + STORK.BODY_Y, 5.0,
  // legs
  0, -9, 1.6,
  0, -4, 1.6,
];

export const HIT_CIRCLE_COUNT = STORK_HIT_CIRCLES.length / 3;
export const HEAD_PART_COUNT = 3; // head + neck circles
