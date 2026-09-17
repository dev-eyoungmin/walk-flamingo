import { Skia } from '@shopify/react-native-skia';

/**
 * The sway renders the foliage into an offscreen layer every frame. If a low-end device drops
 * frames, flip this off: foliage then draws directly (static) with no other change.
 */
export const FOLIAGE_SWAY_ENABLED = true;
export const FOLIAGE_GROUND_SAMPLES = 24;
/** DisplacementMap scale: a full-strength sway moves the canopy tops by half of this (px) */
export const FOLIAGE_SWAY_SCALE = 18;

/**
 * Wind field for grass, flowers, bushes and trees. The output is not a color: it is a
 * displacement map (red = horizontal shift, 0.5 = none) fed to a DisplacementMap image filter
 * over the foliage layer. Sway grows with height above the local ground, so roots stay planted
 * and treetops move the most. Steady wind bends everything one way; gusts add fast flutter.
 */
const FOLIAGE_SKSL = `
uniform vec2 resolution;
uniform float time;
uniform float scroll;
uniform float wind;
uniform float gust;
uniform float tallHeight;
uniform float ground[${FOLIAGE_GROUND_SAMPLES}];

half4 main(vec2 p) {
  // Ground height under this pixel (linear interpolation between samples)
  float fx = clamp(p.x / resolution.x, 0.0, 1.0) * ${FOLIAGE_GROUND_SAMPLES - 1}.0;
  float groundY = 0.0;
  for (int i = 0; i < ${FOLIAGE_GROUND_SAMPLES}; i++) {
    groundY += ground[i] * max(0.0, 1.0 - abs(fx - float(i)));
  }
  float above = max(0.0, groundY - p.y);
  float lowWeight = clamp(above / 14.0, 0.0, 1.0);
  float highWeight = clamp(above / tallHeight, 0.0, 1.0);
  float weight = lowWeight * 0.3 + highWeight * highWeight * 0.7;

  // Phase follows the world so each plant keeps its own rhythm while scrolling
  float wx = p.x + scroll;
  float calm = sin(time * 1.6 + wx * 0.017) * 0.6 + sin(time * 2.7 + wx * 0.043 + 1.3) * 0.4;
  float flutter = sin(time * 9.0 + wx * 0.09 + p.y * 0.05) * gust;
  float sway = (calm * (0.3 + abs(wind) * 0.35 + gust * 0.25) + wind * 0.55 + flutter * 0.35) * weight;

  return half4(clamp(0.5 - sway * 0.5, 0.0, 1.0), 0.5, 0.0, 1.0);
}
`;

export const foliageEffect = Skia.RuntimeEffect.Make(FOLIAGE_SKSL);
