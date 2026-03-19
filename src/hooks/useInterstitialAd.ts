import { useCallback, useEffect, useRef, useState } from 'react';
import { IS_EXPO_GO, INTERSTITIAL_AD_UNIT_ID } from '../lib/adConfig';

export function useInterstitialAd() {
  const [loaded, setLoaded] = useState(false);
  const adRef = useRef<any>(null);
  const onDismissRef = useRef<(() => void) | null>(null);

  const loadAd = useCallback(() => {
    if (IS_EXPO_GO || !INTERSTITIAL_AD_UNIT_ID) return () => {};

    try {
      const { InterstitialAd, AdEventType } = require('react-native-google-mobile-ads');
      const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
        setLoaded(true);
      });

      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        setLoaded(false);
        onDismissRef.current?.();
        onDismissRef.current = null;
        loadAd();
      });

      const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
        setLoaded(false);
        onDismissRef.current?.();
        onDismissRef.current = null;
      });

      ad.load();
      adRef.current = ad;

      return () => {
        unsubLoaded();
        unsubClosed();
        unsubError();
      };
    } catch {
      return () => {};
    }
  }, []);

  useEffect(() => {
    const cleanup = loadAd();
    return cleanup;
  }, [loadAd]);

  const showAd = useCallback(
    (onDismiss: () => void) => {
      if (loaded && adRef.current) {
        onDismissRef.current = onDismiss;
        adRef.current.show();
      } else {
        onDismiss();
      }
    },
    [loaded],
  );

  return { showAd, adLoaded: loaded };
}
