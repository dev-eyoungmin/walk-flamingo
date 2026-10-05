import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { shouldAskForReview } from '../lib/reviewPrompt';

const STORAGE_KEY = '@wobby_review_asked_at';
/** Let the game-over screen settle before the dialog covers it */
const ASK_DELAY_MS = 1500;

/**
 * Shows the system rating dialog on the game-over screen after a new best. `visible` is whether
 * that screen is up: leaving it (retry, home) drops a queued request so it never lands mid-run.
 */
export function useReviewPrompt(visible: boolean) {
  const lastAskedAt = useRef(0);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        lastAskedAt.current = raw ? parseInt(raw, 10) || 0 : 0;
      })
      .catch(() => undefined);
  }, []);

  const queueReview = useCallback((moment: { newBest: boolean; runs: number }) => {
    if (shouldAskForReview({ ...moment, lastAskedAt: lastAskedAt.current, now: Date.now() })) setQueued(true);
  }, []);

  useEffect(() => {
    if (!queued) return;
    if (!visible) {
      setQueued(false);
      return;
    }
    const timer = setTimeout(async () => {
      setQueued(false);
      try {
        if (!(await StoreReview.isAvailableAsync())) return;
        lastAskedAt.current = Date.now();
        AsyncStorage.setItem(STORAGE_KEY, String(lastAskedAt.current)).catch(() => undefined);
        await StoreReview.requestReview();
      } catch {
        // No dialog is fine
      }
    }, ASK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [queued, visible]);

  return { queueReview };
}
