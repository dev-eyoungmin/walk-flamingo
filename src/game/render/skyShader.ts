import { Skia } from '@shopify/react-native-skia';

/**
 * Sky rendered in one GPU pass: 3-stop gradient, sun glow that scatters into the sky colors,
 * a soft horizon haze, and ordered dithering so gradients don't band on 8-bit displays.
 */
const SKY_SKSL = `
uniform vec2 resolution;
uniform float horizon;
uniform vec3 top;
uniform vec3 mid;
uniform vec3 bottom;
uniform vec2 sun;
uniform float sunAmount;
uniform vec3 sunTint;

half4 main(vec2 p) {
  float y = clamp(p.y / horizon, 0.0, 1.0);
  vec3 c = y < 0.6
    ? mix(top, mid, smoothstep(0.0, 0.6, y))
    : mix(mid, bottom, smoothstep(0.6, 1.0, y));

  // Sun scattering: wide soft halo plus a tighter bloom
  vec2 d = (p - sun) / resolution.y;
  float dist = length(vec2(d.x * 0.85, d.y));
  float halo = exp(-dist * 4.0) * 0.45 + exp(-dist * 16.0) * 0.4;
  c = mix(c, sunTint, clamp(halo * sunAmount, 0.0, 0.85));

  // Haze brightens toward the horizon
  c += vec3(0.06) * smoothstep(0.55, 1.0, y) * (0.4 + 0.6 * sunAmount);

  // Dither
  float n = fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) / 180.0;
  return half4(c, 1.0);
}
`;

export const skyEffect = Skia.RuntimeEffect.Make(SKY_SKSL);
