import { useCallback, useEffect, useRef, useState } from 'react';
import { IS_EXPO_GO, REWARDED_AD_UNIT_ID } from '../lib/adConfig';

export function useRewardedAd() {
  const [loaded, setLoaded] = useState(false);
  const adRef = useRef<any>(null);
  const onRewardRef = useRef<(() => void) | null>(null);

  const loadAd = useCallback(() => {
    if (IS_EXPO_GO || !REWARDED_AD_UNIT_ID) return () => {};

    try {
      const { RewardedAd, RewardedAdEventType, AdEventType } =
        require('react-native-google-mobile-ads');
      const ad = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID);

      const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        console.log('[RewardedAd] Ad loaded successfully');
        setLoaded(true);
      });

      const unsubEarned = ad.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          onRewardRef.current?.();
          onRewardRef.current = null;
        },
      );

      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        setLoaded(false);
        loadAd();
      });

      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error: any) => {
        console.warn('[RewardedAd] Error:', error?.message, error?.code);
        setLoaded(false);
        onRewardRef.current?.();
        onRewardRef.current = null;
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

  const showAd = useCallback(
    (onReward: () => void) => {
      if (loaded && adRef.current) {
        onRewardRef.current = onReward;
        adRef.current.show();
      } else {
        onReward();
      }
    },
    [loaded],
  );

  return { showAd, adLoaded: loaded };
}
