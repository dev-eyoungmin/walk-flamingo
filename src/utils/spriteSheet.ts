/**
 * Calculate source rect for a frame in a horizontal sprite sheet.
 */
export function getSpriteFrame(
  frameIndex: number,
  frameWidth: number,
  frameHeight: number,
) {
  'worklet';
  return {
    x: frameIndex * frameWidth,
    y: 0,
    width: frameWidth,
    height: frameHeight,
  };
}
