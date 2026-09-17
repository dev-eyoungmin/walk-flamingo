import { useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import type { SfxName } from '../lib/sfx';
import {
  FX_BIOME,
  FX_CHICK_JOIN,
  FX_CHICK_LOST,
  FX_FEVER_END,
  FX_FEVER_START,
  FX_FLAP,
  FX_ITEM,
  FX_BRANCH_DODGED,
  FX_BRANCH_HIT,
  FX_CHALLENGE_FAIL,
  FX_CHALLENGE_START,
  FX_CHALLENGE_SUCCESS,
  FX_COIN,
  FX_COMBO_UP,
  FX_FALL,
  FX_GUST,
  FX_ICE,
  FX_MILESTONE,
  FX_NEAR_MISS,
  FX_QUAKE,
  FX_RANK_UP,
  FX_ROCK_BRACED,
  FX_ROCK_TRIP,
  FX_SHIELD_SAVE,
  FX_SPEED_CHANGE,
  FX_WARNING,
} from '../game/sim/fx';

const impact = (style: Haptics.ImpactFeedbackStyle) => Haptics.impactAsync(style).catch(() => undefined);
const notify = (type: Haptics.NotificationFeedbackType) => Haptics.notificationAsync(type).catch(() => undefined);

/** Maps simulation effect codes to sounds and haptics. */
export function useGameFeedback(playSfx: (name: SfxName) => void, setMusicRate?: (rate: number) => void) {
  const lastCoinHaptic = useRef(0);

  return useCallback(
    (code: number) => {
      switch (code) {
        case FX_FEVER_START:
          playSfx('comboUp');
          notify(Haptics.NotificationFeedbackType.Success);
          setMusicRate?.(1.18);
          break;
        case FX_FEVER_END:
          setMusicRate?.(1);
          break;
        case FX_ITEM:
          playSfx('challengeSuccess');
          impact(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case FX_FLAP:
          playSfx('obstacleSwipe');
          impact(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case FX_CHICK_JOIN:
          playSfx('nearMiss');
          notify(Haptics.NotificationFeedbackType.Success);
          break;
        case FX_CHICK_LOST:
          playSfx('challengeFail');
          break;
        case FX_BIOME:
          playSfx('challengeStart');
          impact(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case FX_COIN: {
          playSfx('coinCollect');
          const now = Date.now();
          if (now - lastCoinHaptic.current > 90) {
            lastCoinHaptic.current = now;
            impact(Haptics.ImpactFeedbackStyle.Light);
          }
          break;
        }
        case FX_COMBO_UP:
          playSfx('comboUp');
          impact(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case FX_NEAR_MISS:
          playSfx('nearMiss');
          notify(Haptics.NotificationFeedbackType.Success);
          break;
        case FX_MILESTONE:
          playSfx('challengeSuccess');
          impact(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case FX_RANK_UP:
          playSfx('comboUp');
          notify(Haptics.NotificationFeedbackType.Success);
          break;
        case FX_WARNING:
          playSfx('warningBeep');
          break;
        case FX_ROCK_TRIP:
        case FX_BRANCH_HIT:
          playSfx('obstacleHit');
          impact(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case FX_ROCK_BRACED:
        case FX_BRANCH_DODGED:
          playSfx('obstacleSwipe');
          impact(Haptics.ImpactFeedbackStyle.Light);
          break;
        case FX_GUST:
          playSfx('gust');
          impact(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case FX_QUAKE:
          playSfx('quake');
          impact(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case FX_ICE:
        case FX_SPEED_CHANGE:
          playSfx('speedChange');
          break;
        case FX_CHALLENGE_START:
          playSfx('challengeStart');
          notify(Haptics.NotificationFeedbackType.Warning);
          break;
        case FX_CHALLENGE_SUCCESS:
          playSfx('challengeSuccess');
          notify(Haptics.NotificationFeedbackType.Success);
          break;
        case FX_CHALLENGE_FAIL:
          playSfx('challengeFail');
          break;
        case FX_SHIELD_SAVE:
          playSfx('nearMiss');
          notify(Haptics.NotificationFeedbackType.Success);
          break;
        case FX_FALL:
          playSfx('gameOver');
          notify(Haptics.NotificationFeedbackType.Error);
          setMusicRate?.(1);
          break;
      }
    },
    [playSfx, setMusicRate],
  );
}
