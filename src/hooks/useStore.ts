import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IS_EXPO_GO } from '../lib/adConfig';
import { coinsForProduct, isConsumable, PRODUCT_IDS, REMOVE_ADS_ID } from '../lib/shop';

const ADS_REMOVED_KEY = '@wobby_ads_removed';
/** Transactions already credited, so a replayed coin purchase is never paid twice */
const CREDITED_KEY = '@wobby_iap_credited';
const CREDITED_MAX = 50;

// The store module is native: missing in Expo Go and on web
let IAP: typeof import('expo-iap') | null = null;
if (!IS_EXPO_GO && Platform.OS !== 'web') {
  try {
    IAP = require('expo-iap');
  } catch {
    IAP = null;
  }
}

export interface StoreProduct {
  id: string;
  /** Localized price from the App Store, e.g. "$2.99" or "₩3,300" */
  price: string;
}

export type PurchaseState = 'idle' | 'buying' | 'restoring';
/** How a buy tap ended: started (the store sheet takes over), unavailable (no store/product) or failed */
export type BuyResult = 'started' | 'unavailable' | 'failed';

/** Product fetches on launch: retried because the first one can fail on a slow or fresh network */
const FETCH_RETRY_MS = [0, 2000, 6000];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Options {
  /** Coins from a coin pack (called once per transaction) */
  onCoins: (amount: number) => void;
  /** A purchase or restore finished successfully */
  onSuccess?: (productId: string) => void;
}

/**
 * In-app purchases: coin packs (consumable) and Remove Ads (non-consumable). Remove Ads is cached
 * locally so ads stay off offline, and re-checked against the App Store on launch.
 */
export function useStore({ onCoins, onSuccess }: Options) {
  const [adsRemoved, setAdsRemoved] = useState(false);
  const [products, setProducts] = useState<Record<string, StoreProduct>>({});
  const [state, setState] = useState<PurchaseState>('idle');
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const productsRef = useRef(products);
  productsRef.current = products;
  const connected = useRef(false);
  const onCoinsRef = useRef(onCoins);
  const onSuccessRef = useRef(onSuccess);
  onCoinsRef.current = onCoins;
  onSuccessRef.current = onSuccess;
  const credited = useRef<string[]>([]);

  const unlockNoAds = useCallback(() => {
    setAdsRemoved(true);
    AsyncStorage.setItem(ADS_REMOVED_KEY, '1').catch(() => undefined);
  }, []);

  // Credit a purchase once, then finish it so the App Store stops replaying it
  const handlePurchase = useCallback(
    async (purchase: { id: string; productId: string; transactionId?: string | null }) => {
      if (!IAP) return;
      const txId = purchase.transactionId ?? purchase.id;
      if (purchase.productId === REMOVE_ADS_ID) {
        unlockNoAds();
      } else if (isConsumable(purchase.productId) && !credited.current.includes(txId)) {
        credited.current = [...credited.current, txId].slice(-CREDITED_MAX);
        await AsyncStorage.setItem(CREDITED_KEY, JSON.stringify(credited.current)).catch(() => undefined);
        onCoinsRef.current(coinsForProduct(purchase.productId));
      }
      try {
        await IAP.finishTransaction({ purchase: purchase as never, isConsumable: isConsumable(purchase.productId) });
      } catch {
        // It replays on the next launch and is skipped as already credited
      }
      setState('idle');
      onSuccessRef.current?.(purchase.productId);
    },
    [unlockNoAds],
  );

  /** Connects if needed and fetches the catalog; returns what the store knows (may be empty) */
  const loadProducts = useCallback(async (): Promise<Record<string, StoreProduct>> => {
    if (!IAP) return {};
    setLoading(true);
    try {
      if (!connected.current) {
        await IAP.initConnection();
        connected.current = true;
      }
      const items = await IAP.fetchProducts({ skus: [...PRODUCT_IDS], type: 'in-app' });
      const map: Record<string, StoreProduct> = {};
      if (Array.isArray(items)) {
        for (const it of items as { id: string; displayPrice: string }[]) map[it.id] = { id: it.id, price: it.displayPrice };
      }
      if (Object.keys(map).length) setProducts(map);
      return map;
    } catch {
      connected.current = false;
      return {};
    } finally {
      setLoading(false);
    }
  }, []);

  /** Fetches again when the shop opens with prices missing */
  const refresh = useCallback(() => {
    if (Object.keys(productsRef.current).length < PRODUCT_IDS.length) void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    let cancelled = false;
    const subs: { remove: () => void }[] = [];

    (async () => {
      try {
        const [cached, creditedRaw] = await Promise.all([AsyncStorage.getItem(ADS_REMOVED_KEY), AsyncStorage.getItem(CREDITED_KEY)]);
        if (cached === '1') setAdsRemoved(true);
        const list = creditedRaw ? JSON.parse(creditedRaw) : [];
        if (Array.isArray(list)) credited.current = list.filter((x) => typeof x === 'string');
      } catch {
        // Defaults are fine
      }
      if (!IAP) {
        setLoaded(true);
        return;
      }
      try {
        subs.push(IAP.purchaseUpdatedListener((p) => void handlePurchase(p as never)));
        subs.push(IAP.purchaseErrorListener(() => setState('idle')));
        for (const delay of FETCH_RETRY_MS) {
          await wait(delay);
          if (cancelled) return;
          if (Object.keys(await loadProducts()).length) break;
        }
        if (!connected.current) return;
        // Remove Ads bought on another device or before a reinstall
        const owned = await IAP.getAvailablePurchases();
        if (!cancelled && owned.some((p) => p.productId === REMOVE_ADS_ID)) unlockNoAds();
      } catch {
        // No store connection (offline, simulator): the shop shows prices as unavailable
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
      subs.forEach((s) => s.remove());
      connected.current = false;
      IAP?.endConnection().catch(() => undefined);
    };
  }, [handlePurchase, unlockNoAds, loadProducts]);

  const buy = useCallback(
    async (productId: string): Promise<BuyResult> => {
      if (!IAP) return 'unavailable';
      if (state !== 'idle') return 'started';
      setState('buying');
      // A tap on a price that never loaded tries the store again before giving up
      if (!productsRef.current[productId] && !(await loadProducts())[productId]) {
        setState('idle');
        return 'unavailable';
      }
      try {
        await IAP.requestPurchase({ request: { apple: { sku: productId }, google: { skus: [productId] } }, type: 'in-app' });
        return 'started';
      } catch {
        setState('idle');
        return 'failed';
      }
    },
    [state, loadProducts],
  );

  /** Restore Remove Ads. Returns true when it was found. */
  const restore = useCallback(async (): Promise<boolean> => {
    if (!IAP || state !== 'idle') return false;
    setState('restoring');
    try {
      if (!connected.current) {
        await IAP.initConnection();
        connected.current = true;
      }
      await IAP.restorePurchases();
      const owned = await IAP.getAvailablePurchases();
      const found = owned.some((p) => p.productId === REMOVE_ADS_ID);
      if (found) unlockNoAds();
      return found;
    } catch {
      return false;
    } finally {
      setState('idle');
    }
  }, [state, unlockNoAds]);

  return { adsRemoved, products, state, loaded, loading, available: IAP !== null, buy, restore, refresh };
}
