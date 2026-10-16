import { useCallback, useEffect, useRef, useState } from 'react';
import { IS_EXPO_GO, REWARDED_AD_UNIT_ID } from '../lib/adConfig';

export function useRewardedAd() {
  const [loaded, setLoaded] = useState(false);
  const adRef = useRef<any>(null);
  const onRewardRef = useRef<(() => void) | null>(null);
  // Called when the ad is closed before the reward was earned
  const onCancelRef = useRef<(() => void) | null>(null);

  const loadAd = useCallback(() => {
    if (IS_EXPO_GO || !REWARDED_AD_UNIT_ID || __DEV__) return () => {};

    try {
      const { RewardedAd, RewardedAdEventType, AdEventType } =
        require('react-native-google-mobile-ads');
      const ad = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log('[RewardedAd] Ad loaded successfully');
        setLoaded(true);
      });

      const unsubEarned = ad.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          onRewardRef.current?.();
          onRewardRef.current = null;
          onCancelRef.current = null;
        },
      );

      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        setLoaded(false);
        onCancelRef.current?.();
        onCancelRef.current = null;
        onRewardRef.current = null;
        loadAd();
      });

      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.warn('[RewardedAd] Error:', error?.message, error?.code);
        setLoaded(false);
        onRewardRef.current?.();
        onRewardRef.current = null;
        onCancelRef.current = null;
        // Retry loading after a delay
        setTimeout(() => loadAd(), 5000);
      });

      ad.load();
      adRef.current = ad;

      return () => {
        unsubLoaded();
        unsubEarned();
        unsubClosed();
        unsubError();
      };
    } catch (e) {
      console.warn('[RewardedAd] Setup failed:', e);
      return () => {};
    }
  }, []);

  useEffect(() => {
    const cleanup = loadAd();
    return cleanup;
  }, [loadAd]);

  /** Show the ad; `onReward` runs once it is earned (or right away when no ad is available). */
  const showAd = useCallback(
    (onReward: () => void, onCancel?: () => void) => {
      if (loaded && adRef.current) {
        try {
          onRewardRef.current = onReward;
          onCancelRef.current = onCancel ?? null;
          adRef.current.show();
        } catch {
          onCancelRef.current = null;
          onReward();
        }
      } else {
        onReward();
      }
    },
    [loaded],
  );

  return { showAd, adLoaded: loaded };
}
