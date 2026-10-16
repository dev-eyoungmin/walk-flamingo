import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { formatNum, t, TKey } from '../i18n';
import { SPINS, SpinKind, WHEEL, WheelPrize } from '../lib/wheel';
import { GameButton } from '../ui/GameButton';
import { CoinGlyph } from '../ui/CoinGlyph';
import { FONT_DISPLAY, titleShadow, UI } from '../ui/theme';

export interface SpinResult {
  segment: number;
  prize: WheelPrize;
  /** Skin rented by a skin prize */
  skinId?: string;
}

interface LuckyWheelProps {
  /** The spin on offer, or null when today's spins are used up */
  next: SpinKind | null;
  adSpinsLeft: number;
  /** Spend a spin; resolves with the prize (already granted) or null if it didn't happen */
  onSpin: (kind: SpinKind) => Promise<SpinResult | null>;
  /** Each segment passing the pointer */
  onTick: () => void;
  onPrize: (result: SpinResult) => void;
  onClose: () => void;
}

const SEG = 360 / WHEEL.length;
const OUTLINE = '#2B1630';

function prizeLabel(p: WheelPrize): string {
  if (p.kind === 'coins') return formatNum(p.amount);
  return p.kind === 'balloon' ? '🎈' : '👗';
}

function prizeText(r: SpinResult): string {
  const p = r.prize;
  if (p.kind === 'coins') return t('wheel.wonCoins', { n: formatNum(p.amount) });
  if (p.kind === 'balloon') return t('wheel.wonBalloon');
  return t('wheel.wonSkin', { name: t(`skin.${r.skinId ?? 'default'}` as TKey) });
}

/** Chance of each prize kind in percent, for the odds note. */
function odds(): { label: string; pct: string }[] {
  const total = WHEEL.reduce((n, s) => n + s.weight, 0);
  return WHEEL.map((s) => ({ label: prizeLabel(s.prize), pct: `${((s.weight / total) * 100).toFixed(1)}%` }));
}

export const LuckyWheel: React.FC<LuckyWheelProps> = ({ next, adSpinsLeft, onSpin, onTick, onPrize, onClose }) => {
  const { height } = useWindowDimensions();
  const size = Math.max(150, Math.min(220, height - 150));
  const r = size / 2;
  const rotation = useRef(new Animated.Value(0)).current;
  const angle = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showOdds, setShowOdds] = useState(false);
  const pop = useRef(new Animated.Value(0)).current;

  const wedges = useMemo(
    () =>
      WHEEL.map((_, i) => {
        const p = Skia.Path.Make();
        p.moveTo(r, r);
        // Skia angles start at 3 o'clock; the wheel starts at 12
        p.arcToOval(Skia.XYWHRect(4, 4, size - 8, size - 8), i * SEG - 90, SEG, false);
        p.close();
        return p;
      }),
    [r, size],
  );

  // Ticks as each segment boundary passes the pointer
  useEffect(() => {
    let last = 0;
    const id = rotation.addListener(({ value }) => {
      const seg = Math.floor(value / SEG);
      if (seg !== last) {
        last = seg;
        onTick();
        Haptics.selectionAsync().catch(() => undefined);
      }
    });
    return () => rotation.removeListener(id);
  }, [rotation, onTick]);

  const spin = async () => {
    if (!next || spinning) return;
    setSpinning(true);
    setResult(null);
    const res = await onSpin(next);
    if (!res) {
      setSpinning(false);
      return;
    }
    // Land the segment's centre under the pointer, slightly off-centre so it doesn't look canned
    const center = res.segment * SEG + SEG / 2;
    const jitter = (Math.random() - 0.5) * SEG * 0.6;
    const base = angle.current - (angle.current % 360);
    const target = base + 360 * 5 + ((360 - center + jitter) % 360 + 360) % 360;
    angle.current = target;
    Animated.timing(rotation, {
      toValue: target,
      duration: 3600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setSpinning(false);
      setResult(res);
      onPrize(res);
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
    });
  };

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'], extrapolate: 'extend' });
  const labelR = r * 0.68;

  return (
    <View style={styles.scrim}>
      <View style={[styles.modal, { maxHeight: height - 16 }]}>
        <Text style={styles.title}>{t('wheel.title')}</Text>
        <View style={styles.body}>
          <View style={{ width: size, height: size + 10 }}>
            <View style={[styles.pointer, { left: r - 11 }]} />
            <Animated.View style={{ width: size, height: size, marginTop: 10, transform: [{ rotate }] }}>
              <Canvas style={{ width: size, height: size }}>
                <Circle cx={r} cy={r} r={r - 1} color={OUTLINE} />
                {wedges.map((p, i) => (
                  <Path key={i} path={p} color={WHEEL[i].color} />
                ))}
                {wedges.map((p, i) => (
                  <Path key={`o${i}`} path={p} color={OUTLINE} style="stroke" strokeWidth={2} />
                ))}
                <Circle cx={r} cy={r} r={r * 0.16} color="#FFFFFF" />
                <Circle cx={r} cy={r} r={r * 0.16} color={OUTLINE} style="stroke" strokeWidth={3} />
              </Canvas>
              {WHEEL.map((s, i) => {
                const a = ((i * SEG + SEG / 2) * Math.PI) / 180;
                return (
                  <View
                    key={i}
                    pointerEvents="none"
                    style={[
                      styles.label,
                      {
                        left: r + Math.sin(a) * labelR - 26,
                        top: r - Math.cos(a) * labelR - 12,
                        // Along the radius, reading outwards, so no label ends up upside down
                        transform: [{ rotate: `${i * SEG + SEG / 2 - 90}deg` }],
                      },
                    ]}
                  >
                    {s.prize.kind === 'coins' && <CoinGlyph size={11} />}
                    <Text style={[styles.labelText, s.prize.kind !== 'coins' && { fontSize: 17 }]}>{prizeLabel(s.prize)}</Text>
                  </View>
                );
              })}
            </Animated.View>
          </View>

          <View style={styles.side}>
            {result ? (
              <Animated.Text style={[styles.prize, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
                {prizeText(result)}
              </Animated.Text>
            ) : (
              <Text style={styles.hint}>{t('wheel.hint')}</Text>
            )}
            {next ? (
              <GameButton
                label={next === 'free' ? t('wheel.spinFree') : t('wheel.spinAd')}
                ad={next === 'ad'}
                size="md"
                color={next === 'free' ? UI.pink : UI.mint}
                shade={next === 'free' ? UI.pinkDark : UI.mintDark}
                onPress={spin}
                disabled={spinning}
                style={styles.spin}
              />
            ) : (
              <Text style={styles.done}>{t('wheel.comeBack')}</Text>
            )}
            <Text style={styles.left}>{t('wheel.adLeft', { n: adSpinsLeft, max: SPINS.AD_PER_DAY })}</Text>
            <Pressable accessibilityRole="button" onPress={() => setShowOdds((v) => !v)} hitSlop={6}>
              <Text style={styles.oddsLink}>{t('wheel.odds')}</Text>
            </Pressable>
            {showOdds && (
              <View style={styles.odds}>
                {odds().map((o, i) => (
                  <Text key={i} style={styles.oddsText}>
                    {o.label} {o.pct}
                  </Text>
                ))}
              </View>
            )}
            <GameButton label={t('common.close')} size="sm" color={UI.slate} shade={UI.slateDark} onPress={onClose} disabled={spinning} style={styles.close} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,10,30,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modal: {
    backgroundColor: UI.panel,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: UI.pink,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    maxWidth: '96%',
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 24,
    color: UI.text,
    ...titleShadow,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  pointer: {
    position: 'absolute',
    top: 0,
    zIndex: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 11,
    borderRightWidth: 11,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  label: {
    position: 'absolute',
    width: 52,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  labelText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    color: '#FFFFFF',
    textShadowColor: OUTLINE,
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 0,
  },
  side: {
    width: 236,
    alignItems: 'center',
  },
  hint: {
    fontSize: 12,
    color: UI.textDim,
    textAlign: 'center',
    marginBottom: 10,
  },
  prize: {
    fontFamily: FONT_DISPLAY,
    fontSize: 20,
    color: UI.gold,
    textAlign: 'center',
    marginBottom: 10,
    ...titleShadow,
    textShadowOffset: { width: 0, height: 2 },
  },
  spin: {
    alignSelf: 'stretch',
  },
  done: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    color: UI.textDim,
    textAlign: 'center',
  },
  left: {
    fontSize: 11,
    color: UI.textFaint,
    marginTop: 6,
  },
  oddsLink: {
    fontSize: 11,
    color: UI.textDim,
    textDecorationLine: 'underline',
    marginTop: 6,
  },
  odds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 8,
    marginTop: 4,
  },
  oddsText: {
    fontSize: 10,
    color: UI.textDim,
  },
  close: {
    marginTop: 10,
    minWidth: 120,
  },
});
