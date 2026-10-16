import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, Platform, StyleSheet, Text, View } from 'react-native';
import { Canvas, Path, RoundedRect, Skia } from '@shopify/react-native-skia';
import { t } from '../i18n';
import { FONT_DISPLAY } from '../ui/theme';
import * as Haptics from 'expo-haptics';

interface TouchControlsProps {
  width: number;
  height: number;
  /** Called with a bitmask: 1 = left held, 2 = right held */
  onInputChange: (mask: number) => void;
  enabled: boolean;
  bottomInset?: number;
  flapButton?: boolean;
  flapSeconds?: number;
  flapReady?: boolean;
}

const HINT_W = 92;
const HINT_H = 56;
const SAFE_X = Platform.OS === 'ios' ? 44 : 12;

function makeArrow(dir: 1 | -1) {
  const p = Skia.Path.Make();
  const cx = HINT_W / 2;
  const cy = HINT_H / 2;
  const s = 13;
  p.moveTo(cx - dir * s * 0.45, cy - s);
  p.lineTo(cx + dir * s * 0.65, cy);
  p.lineTo(cx - dir * s * 0.45, cy + s);
  return p;
}

const Hint: React.FC<{ dir: 1 | -1; pressed: boolean }> = ({ dir, pressed }) => {
  const arrow = useMemo(() => makeArrow(dir), [dir]);
  return (
    <Canvas style={styles.hint} pointerEvents="none">
      <RoundedRect x={1} y={1} width={HINT_W - 2} height={HINT_H - 2} r={HINT_H / 2} color={pressed ? 'rgba(255,255,255,0.42)' : 'rgba(43,22,48,0.28)'} />
      <RoundedRect
        x={1.5}
        y={1.5}
        width={HINT_W - 3}
        height={HINT_H - 3}
        r={HINT_H / 2}
        color={pressed ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}
        style="stroke"
        strokeWidth={2.5}
      />
      <Path path={arrow} color="#FFFFFF" style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" opacity={pressed ? 1 : 0.8} />
    </Canvas>
  );
};

/**
 * Whole-screen input: the left half leans left, the right half leans right. Multi-touch aware,
 * so holding both sides cancels out instead of getting stuck.
 */
export const TouchControls: React.FC<TouchControlsProps> = ({ width, height, onInputChange, enabled, bottomInset = 0, flapButton = true, flapSeconds = 0, flapReady = true }) => {
  const [mask, setMask] = useState(0);
  const maskRef = useRef(0);

  const apply = useCallback(
    (next: number) => {
      if (next === maskRef.current) return;
      const newlyPressed = next & ~maskRef.current;
      maskRef.current = next;
      setMask(next);
      onInputChange(next);
      if (newlyPressed) Haptics.selectionAsync().catch(() => undefined);
    },
    [onInputChange],
  );

  const fromEvent = useCallback(
    (e: GestureResponderEvent, ended: boolean) => {
      const touches = e.nativeEvent.touches ?? [];
      let next = 0;
      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        const flap = flapButton && Math.abs(touch.pageX - width / 2) <= 55 && touch.pageY >= height - 66 - bottomInset;
        next |= flap ? 4 : touch.pageX < width / 2 ? 1 : 2;
      }
      if (touches.length === 0 && !ended) {
        const flap = flapButton && Math.abs(e.nativeEvent.pageX - width / 2) <= 55 && e.nativeEvent.pageY >= height - 66 - bottomInset;
        next = flap ? 4 : e.nativeEvent.pageX < width / 2 ? 1 : 2;
      }
      apply(enabled ? next : 0);
    },
    [apply, enabled, width, height, bottomInset, flapButton],
  );

  // Drop input when controls get disabled mid-press
  useEffect(() => {
    if (!enabled) apply(0);
  }, [enabled, apply]);

  return (
    <View
      style={[StyleSheet.absoluteFill, { width, height }]}
      onStartShouldSetResponder={() => enabled}
      onMoveShouldSetResponder={() => enabled}
      onResponderGrant={(e) => fromEvent(e, false)}
      onResponderStart={(e) => fromEvent(e, false)}
      onResponderMove={(e) => fromEvent(e, false)}
      onResponderEnd={(e) => fromEvent(e, true)}
      onResponderRelease={() => apply(0)}
      onResponderTerminate={() => apply(0)}
      onResponderTerminationRequest={() => false}
    >
      {enabled && (
        <>
          {flapButton && <View pointerEvents="none" style={[styles.flap, { left: width / 2 - 55, bottom: 10 + bottomInset, backgroundColor: flapReady ? '#5EE6C9' : '#43334D' }]}><Text style={styles.flapText}>{flapReady ? t('play.ready') : `${flapSeconds}s`}</Text><Text style={styles.flapLabel}>{t('play.flap')}</Text></View>}
          <View style={[styles.hintWrap, { left: SAFE_X, bottom: 10 + bottomInset }]} pointerEvents="none">
            <Hint dir={-1} pressed={(mask & 1) !== 0} />
          </View>
          <View style={[styles.hintWrap, { right: SAFE_X, bottom: 10 + bottomInset }]} pointerEvents="none">
            <Hint dir={1} pressed={(mask & 2) !== 0} />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flap: { position: 'absolute', width: 110, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  flapText: { fontFamily: FONT_DISPLAY, color: '#FFFFFF', fontSize: 16 },
  flapLabel: { fontFamily: FONT_DISPLAY, color: '#FFFFFF', fontSize: 11 },
  hintWrap: {
    position: 'absolute',
  },
  hint: {
    width: HINT_W,
    height: HINT_H,
  },
});
