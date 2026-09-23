import { HUD } from './hudStrings';
import React, { useMemo } from 'react';
import { Circle, Group, Oval, Path, RoundedRect, Skia, SkFont, SkTypeface, Text, usePathValue } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { CHICKS, FEVER, FLAP, ITEMS, MODE_PLAYING, SCORE } from '../sim/constants';
import type { SimState } from '../sim/state';
import type { SimConfig } from '../sim/terrain';

const INK = '#2B1630';

export interface HudFonts {
  xs: SkFont;
  sm: SkFont;
  md: SkFont;
  lg: SkFont;
  xl: SkFont;
}

interface Props {
  sim: SharedValue<SimState>;
  cfg: SimConfig;
  fonts: HudFonts;
  typeface: SkTypeface | null;
  padX: number;
  meterX: number;
  meterY: number;
  showTutorial: boolean;
}

/** HUD for fever, baby flamingos, active items, and the flap button. */
export const TUTORIAL_Y_RATIO = 0.58;

/**
 * A copy of `font` shrunk so `text` fits in `maxW` (translations vary a lot in length).
 * Returns the font itself when it already fits.
 */
export function fitFont(font: SkFont, typeface: SkTypeface | null, text: string, maxW: number, minSize = 11): SkFont {
  // Uses the typeface from useTypeface: font.getTypeface() hands back a raw pointer on web
  // that CanvasKit refuses to build a new font from.
  const w = font.getTextWidth(text);
  if (w <= maxW || !typeface) return font;
  return Skia.Font(typeface, Math.max(minSize, (font.getSize() * maxW) / w));
}

/** Width of the right-hand HUD column (item and slow-mo timers) that hints must stay clear of. */
const RIGHT_COLUMN_W = 72;

/** Room for a hint placed right of the flamingo, left of the timers column. */
export function tutorialMaxW(cfg: SimConfig, padX: number): number {
  return cfg.width - padX - RIGHT_COLUMN_W - (cfg.storkX + 13 * cfg.unit) - 14;
}

/** Tutorial hints sit to the right of the flamingo so they never cover it. */
export function tutorialTextX(cfg: SimConfig, textW: number, padX: number): number {
  'worklet';
  return Math.max(padX + 14, Math.min(cfg.storkX + 13 * cfg.unit, cfg.width - padX - textW - 14));
}

export const FeatureHud: React.FC<Props> = ({ sim, cfg, fonts, typeface, padX, meterX, meterY, showTutorial }) => {
  const { width: W, height: H } = cfg;

  // ── Fever ──
  const feverBarOpacity = useDerivedValue(() => {
    const s = sim.value;
    return s.mode === MODE_PLAYING && (s.combo >= SCORE.COMBO_MAX || s.feverT > 0) ? 1 : 0;
  });
  const feverBarW = useDerivedValue(() => {
    const s = sim.value;
    if (s.feverT > 0) return 52 * (s.feverT / s.feverDuration);
    return 52 * Math.min(1, s.feverCharge / FEVER.CHARGE_TIME);
  });
  const feverBarColor = useDerivedValue(() => {
    const s = sim.value;
    if (s.feverT <= 0) return '#FF9A3C';
    const h = s.t * 3;
    return `rgb(${Math.round(200 + 55 * Math.sin(h))},${Math.round(200 + 55 * Math.sin(h + 2.1))},${Math.round(200 + 55 * Math.sin(h + 4.2))})`;
  });
  const feverActive = useDerivedValue(() => (sim.value.feverT > 0 && sim.value.mode === MODE_PLAYING ? 1 : 0));
  const feverTextTransform = useDerivedValue(() => {
    const pulse = 1 + 0.08 * Math.sin(sim.value.t * 12);
    const cx = padX + 70;
    const cy = 106;
    return [{ translateX: cx }, { translateY: cy }, { scale: pulse }, { translateX: -cx }, { translateY: -cy }];
  });

  // ── Baby flamingos ──
  const chickRowOpacity = useDerivedValue(() => (sim.value.mode === MODE_PLAYING ? 1 : 0));
  const chickFill = (i: number) => () => {
    'worklet';
    return sim.value.chicks > i ? 1 : 0;
  };
  const chick0 = useDerivedValue(chickFill(0));
  const chick1 = useDerivedValue(chickFill(1));
  const chick2 = useDerivedValue(chickFill(2));
  const chickFills = [chick0, chick1, chick2];
  const chickProgress = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    if (s.chicks >= CHICKS.MAX || s.mode !== MODE_PLAYING) return;
    const k = Math.min(1, s.chickTimer / CHICKS.EVERY);
    const cx = padX + 9 + s.chicks * 22;
    const cy = 150;
    p.addArc(Skia.XYWHRect(cx - 10, cy - 10, 20, 20), -90, 360 * k);
  });
  const chickBonus = useDerivedValue<string>(() => (sim.value.chicks > 0 ? `+${sim.value.chicks * 10}%` : ''));

  // ── Items (right column) ──
  const rightX = W - padX;
  const balloonOpacity = useDerivedValue(() => (sim.value.shield > 0 ? 1 : 0));
  const magnetOpacity = useDerivedValue(() => (sim.value.magnetT > 0 ? 1 : 0));
  const featherOpacity = useDerivedValue(() => (sim.value.featherT > 0 ? 1 : 0));
  const magnetText = useDerivedValue<string>(() => `${Math.ceil(sim.value.magnetT)}`);
  const featherText = useDerivedValue<string>(() => `${Math.ceil(sim.value.featherT)}`);
  const magnetArc = usePathValue((p) => {
    'worklet';
    const k = sim.value.magnetT / sim.value.magnetTime;
    if (k <= 0) return;
    p.addArc(Skia.XYWHRect(rightX - 32, 100, 20, 20), -90, 360 * k);
  });
  const featherArc = usePathValue((p) => {
    'worklet';
    const k = sim.value.featherT / ITEMS.FEATHER_TIME;
    if (k <= 0) return;
    p.addArc(Skia.XYWHRect(rightX - 32, 124, 20, 20), -90, 360 * k);
  });

  const icons = useMemo(() => {
    const magnet = Skia.Path.Make();
    magnet.moveTo(-4.5, -5);
    magnet.lineTo(-4.5, 0.5);
    magnet.cubicTo(-4.5, 6, 4.5, 6, 4.5, 0.5);
    magnet.lineTo(4.5, -5);
    const feather = Skia.Path.Make();
    feather.moveTo(-5, 5.5);
    feather.cubicTo(-6, -1, 1, -7.5, 5.5, -6);
    feather.cubicTo(4, -0.5, 0.5, 4, -5, 5.5);
    feather.close();
    const wing = Skia.Path.Make();
    wing.moveTo(6, 3);
    wing.cubicTo(3, -7, -6, -8, -8, -2);
    wing.quadTo(-5, -1, -4.5, 2);
    wing.quadTo(-2, 0.5, -1, 3.5);
    wing.quadTo(1.5, 1.5, 2.5, 4.5);
    wing.close();
    return { magnet, feather, wing };
  }, []);

  // ── Flap button ──
  const flapCx = meterX - 30;
  const flapCy = meterY - 4;
  const flapReady = useDerivedValue(() => (sim.value.flapCooldown <= 0 ? 1 : 0.35));
  const flapArc = usePathValue((p) => {
    'worklet';
    const s = sim.value;
    if (s.flapCooldown <= 0) return;
    const k = 1 - s.flapCooldown / FLAP.COOLDOWN;
    p.addArc(Skia.XYWHRect(flapCx - 13, flapCy - 13, 26, 26), -90, 360 * k);
  });
  const flapGlow = useDerivedValue(() => {
    const s = sim.value;
    if (s.flapCooldown > 0 || s.mode !== MODE_PLAYING) return 0;
    return 0.25 + 0.2 * Math.sin(s.t * 5);
  });

  // ── Second tutorial line ──
  const flapHintText = HUD.flapHint;
  const flapHintFont = useMemo(() => fitFont(fonts.md, typeface, flapHintText, tutorialMaxW(cfg, padX)), [fonts, typeface, flapHintText, cfg, padX]);
  const flapHintW = flapHintFont.getTextWidth(flapHintText);
  const flapHintX = tutorialTextX(cfg, flapHintW, padX);
  const flapHintOpacity = useDerivedValue(() => {
    const s = sim.value;
    if (!showTutorial || s.tutStep !== 0 || s.mode !== MODE_PLAYING || s.t < 4.8 || s.t > 9.5) return 0;
    return Math.min(1, (s.t - 4.8) / 0.4, (9.5 - s.t) / 0.5);
  });

  return (
    <Group opacity={chickRowOpacity}>
      {/* Fever gauge under the combo pill */}
      <Group opacity={feverBarOpacity}>
        <RoundedRect x={padX + 5} y={129} width={52} height={5} r={2.5} color="rgba(43,22,48,0.5)" />
        <RoundedRect x={padX + 5} y={129} width={feverBarW} height={5} r={2.5} color={feverBarColor} />
      </Group>
      <Group transform={feverTextTransform} opacity={feverActive}>
        <Text x={padX + 70} y={112} text={HUD.fever} font={fonts.md} color={INK} style="stroke" strokeWidth={4} strokeJoin="round" />
        <Text x={padX + 70} y={112} text={HUD.fever} font={fonts.md} color={feverBarColor} />
      </Group>

      {/* Baby flamingos */}
      {chickFills.map((fill, i) => (
        <Group key={i}>
          <Circle cx={padX + 9 + i * 22} cy={150} r={8} color="rgba(43,22,48,0.45)" />
          <Group opacity={fill}>
            <Circle cx={padX + 9 + i * 22} cy={150} r={7} color="#F1E3EA" />
            <Circle cx={padX + 11 + i * 22} cy={148} r={1.5} color={INK} />
            <Path path={beakFor(padX + 13 + i * 22, 150)} color="#2A2230" />
          </Group>
        </Group>
      ))}
      <Path path={chickProgress} color="#FFB3C7" style="stroke" strokeWidth={2.5} strokeCap="round" />
      <Text x={padX + 72} y={155} text={chickBonus} font={fonts.xs} color={INK} style="stroke" strokeWidth={3} />
      <Text x={padX + 72} y={155} text={chickBonus} font={fonts.xs} color="#FFB3C7" />

      {/* Active items */}
      <Group opacity={balloonOpacity}>
        <Oval x={rightX - 29} y={77} width={14} height={17} color="#FF5A6E" />
        <Oval x={rightX - 29} y={77} width={14} height={17} color={INK} style="stroke" strokeWidth={2} />
      </Group>
      <Group opacity={magnetOpacity}>
        <Circle cx={rightX - 22} cy={110} r={10} color="rgba(43,22,48,0.55)" />
        <Group transform={[{ translateX: rightX - 22 }, { translateY: 111 }]}>
          <Path path={icons.magnet} color="#FF5A6E" style="stroke" strokeWidth={3} />
        </Group>
        <Path path={magnetArc} color="#FF8A96" style="stroke" strokeWidth={2.5} strokeCap="round" />
        <Text x={rightX - 6} y={116} text={magnetText} font={fonts.sm} color="#FFFFFF" />
      </Group>
      <Group opacity={featherOpacity}>
        <Circle cx={rightX - 22} cy={134} r={10} color="rgba(43,22,48,0.55)" />
        <Group transform={[{ translateX: rightX - 22 }, { translateY: 134 }]}>
          <Path path={icons.feather} color="#E8FBFF" />
        </Group>
        <Path path={featherArc} color="#9EE7FF" style="stroke" strokeWidth={2.5} strokeCap="round" />
        <Text x={rightX - 6} y={140} text={featherText} font={fonts.sm} color="#FFFFFF" />
      </Group>

      {/* Flap button next to the balance meter */}
      <Circle cx={flapCx} cy={flapCy} r={17} color="#FFFFFF" opacity={flapGlow} />
      <Circle cx={flapCx} cy={flapCy} r={13} color="rgba(43,22,48,0.6)" />
      <Group transform={[{ translateX: flapCx }, { translateY: flapCy }]} opacity={flapReady}>
        <Path path={icons.wing} color="#FFFFFF" />
      </Group>
      <Path path={flapArc} color="#9EE7FF" style="stroke" strokeWidth={2.5} strokeCap="round" />

      <Group opacity={flapHintOpacity}>
        <RoundedRect x={flapHintX - 14} y={H * TUTORIAL_Y_RATIO - 26} width={flapHintW + 28} height={36} r={12} color="rgba(43,22,48,0.6)" />
        <Text x={flapHintX} y={H * TUTORIAL_Y_RATIO} text={flapHintText} font={flapHintFont} color="#FFFFFF" />
      </Group>
    </Group>
  );
};

function beakFor(x: number, y: number) {
  const p = Skia.Path.Make();
  p.moveTo(x, y - 1.5);
  p.lineTo(x + 4, y + 0.5);
  p.lineTo(x, y + 1.5);
  p.close();
  return p;
}
