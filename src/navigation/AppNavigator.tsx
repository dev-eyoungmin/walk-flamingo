import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Share, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RunSetup, WalkPlan } from '../components/RunSetup';
import { DailyGhost, validGhost } from '../lib/ghost';
import { GameScreen } from '../screens/GameScreen';
import { StartScreen } from '../screens/StartScreen';
import { GameOverScreen, RunSummary } from '../screens/GameOverScreen';
import { SkinPreview } from '../components/SkinPreview';
import { UpgradeShop } from '../components/UpgradeShop';
import { LanguagePicker } from '../components/LanguagePicker';
import { ShopModal } from '../components/ShopModal';
import { LuckyWheel, SpinResult } from '../components/LuckyWheel';
import { AchievementsModal } from '../components/AchievementsModal';
import type { BoostType, GameStats, RunMode } from '../game/GameCanvas';
import { useHighScore } from '../hooks/useHighScore';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { useRewardedAd } from '../hooks/useRewardedAd';
import { useBackgroundMusic } from '../hooks/useBackgroundMusic';
import { useFirstPlay } from '../hooks/useFirstPlay';
import { useInterstitialAd } from '../hooks/useInterstitialAd';
import { useSkin } from '../hooks/useSkin';
import { useSfx } from '../hooks/useSfx';
import { useGameFeedback } from '../hooks/useGameFeedback';
import { useReviewPrompt } from '../hooks/useReviewPrompt';
import { useProgress } from '../hooks/useProgress';
import { useStore } from '../hooks/useStore';
import { INTERSTITIAL_EVERY_N_GAMES, INTERSTITIAL_MIN_INTERVAL_MS } from '../lib/adConfig';
import { balloonsLeft, courseSeedForDay, doubleCoinsAmount, freeCoinsLeft, metersShortOfBest, streakStatus } from '../lib/progress';
import { allAchievements, AchievementId, claimableCount } from '../lib/achievements';
import { adSpinsLeft, nextSpin, SpinKind } from '../lib/wheel';
import { anyUpgradeAffordable, runParamsFor } from '../lib/upgrades';
import { ROOKIE } from '../game/sim/constants';
import { getRank } from '../lib/ranks';
import { rentableSkins, SKIN_PRICES } from '../lib/skins';
import { REVIEW_URL, STORE_URL } from '../lib/storeLinks';
import { formatNum, t } from '../i18n';
import { REMOVE_ADS_ID } from '../lib/shop';

/** New players see the flap tutorial during their first few runs. */
const TUTORIAL_RUNS = 5;

type Screen = 'start' | 'playing' | 'gameover';

interface RunOptions {
  newTerrain: boolean;
  plan?: WalkPlan;
  keepScroll?: boolean;
  boost?: BoostType;
  courseSeed?: number | null;
}

interface RunConfig {
  id: number;
  trait: number;
  stage: number;
  flapButton: boolean;
  mode: RunMode;
  terrainKey: number;
  keepScroll: boolean;
  boost: BoostType;
  /** Today's course seed, or null for a random course */
  courseSeed: number | null;
  /** Best distance to flag on the course (0 = none) */
  bestMeters: number;
  /** Play the interactive first-run tutorial */
  tutorial: boolean;
  /** New-player ease-in, 0..1 */
  rookie: number;
}

export const AppNavigator: React.FC = () => {
  const { width, height } = useScreenDimensions();
  const [screen, setScreen] = useState<Screen>('start');
  const [run, setRun] = useState<RunConfig>({
    id: 0,
    trait: 0,
    stage: 0,
    flapButton: true,
    mode: 'attract',
    terrainKey: 0,
    keepScroll: false,
    boost: null,
    courseSeed: null,
    bestMeters: 0,
    tutorial: false,
    rookie: 0,
  });
  const [showSetup, setShowSetup] = useState(false);
  const [plan, setPlan] = useState<WalkPlan>({ trait: 1, stage: 0, flapButton: true });
  const [ghost, setGhost] = useState<DailyGhost | null>(null);
  const [resumeId, setResumeId] = useState(0);
  const [lastStats, setLastStats] = useState<GameStats | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [hasContinued, setHasContinued] = useState(false);
  const [showSkins, setShowSkins] = useState(false);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  // Coins collected from the game-over "x2" ad this run (0 = not yet)
  const [doubledCoins, setDoubledCoins] = useState(0);
  // An interstitial played before this game-over screen: offer Remove Ads
  const [offerNoAds, setOfferNoAds] = useState(false);
  const [metersShort, setMetersShort] = useState(0);
  // Best score at the start of the run, so the HUD can announce when it is beaten
  const [runBestScore, setRunBestScore] = useState(0);

  const { bestScore, bestDistance, submitRun, loaded } = useHighScore();
  const { showAd: showRewarded } = useRewardedAd();
  const { startMusic, stopMusic, setMusicRate } = useBackgroundMusic();
  const { isFirstPlay, consumeFirstPlay, loaded: firstPlayLoaded } = useFirstPlay();
  const { showAd: showInterstitial } = useInterstitialAd();
  const {
    progress,
    recordRun,
    buySkin,
    buyUpgrade,
    consumeBalloon,
    claimDailyGift,
    grantCoins,
    collectFreeCoins,
    spin,
    claimAchievements,
    refreshDay,
    loaded: progressLoaded,
  } = useProgress();
  const { activeSkin, selectSkin, loaded: skinLoaded } = useSkin(progress.ownedSkins);
  const { play: playSfx } = useSfx();
  const handleFx = useGameFeedback(playSfx, setMusicRate);
  const { queueReview } = useReviewPrompt(screen === 'gameover');
  const celebrate = useCallback(() => {
    playSfx('challengeSuccess');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [playSfx]);
  const store = useStore({ onCoins: grantCoins, onSuccess: celebrate });
  const { adsRemoved } = store;

  const gamesSinceAd = useRef(0);
  const lastAdAt = useRef(0);
  const noteAdWatched = useCallback(() => {
    gamesSinceAd.current = 0;
    lastAdAt.current = Date.now();
  }, []);

  // Stats of the current run already recorded before a continue (stats keep accumulating after it)
  const recordedStats = useRef<GameStats | null>(null);
  const recordedSummary = useRef<RunSummary | null>(null);

  useEffect(() => {
    if (screen === 'playing') startMusic();
    else {
      stopMusic();
      setMusicRate(1);
    }
  }, [screen, startMusic, stopMusic, setMusicRate]);

  useEffect(() => {
    AsyncStorage.getItem('@wobby_walk_plan').then(raw => {
      if (!raw) return;
      const saved = JSON.parse(raw);
      if ([1,2,3].includes(saved.trait) && [0,1,2,3].includes(saved.stage) && typeof saved.flapButton === 'boolean') setPlan(saved);
    }).catch(() => undefined);
  }, []);

  // Missions and today's course roll over at midnight even if the app stays open
  useEffect(() => {
    if (screen === 'start') refreshDay();
  }, [screen, refreshDay]);

  const startRun = useCallback(
    (mode: RunMode, options: RunOptions, extra?: Pick<RunConfig, 'bestMeters' | 'tutorial' | 'rookie'>) => {
      setRun((r) => ({
        id: r.id + 1,
        trait: options.courseSeed != null ? 0 : options.plan?.trait ?? plan.trait,
        stage: options.courseSeed != null ? 0 : options.plan?.stage ?? plan.stage,
        flapButton: options.plan?.flapButton ?? plan.flapButton,
        mode,
        terrainKey: options.newTerrain ? r.terrainKey + 1 : r.terrainKey,
        keepScroll: options.keepScroll ?? false,
        boost: options.boost ?? null,
        courseSeed: options.courseSeed ?? null,
        bestMeters: extra?.bestMeters ?? 0,
        tutorial: extra?.tutorial ?? false,
        rookie: extra?.rookie ?? 0,
      }));
    },
    [plan],
  );

  const beginPlaying = useCallback(
    (options: RunOptions) => {
      setHasContinued(false);
      setDoubledCoins(0);
      setOfferNoAds(false);
      recordedStats.current = null;
      recordedSummary.current = null;
      setRunBestScore(bestScore);
      const daily = options.courseSeed != null;
      // Starter balloon upgrade: regular runs without an ad boost start with a rescue balloon
      let boost = options.boost ?? null;
      if (!daily && !boost && balloonsLeft(progress) > 0 && consumeBalloon()) boost = 'shield';
      startRun(
        'playing',
        { ...options, boost },
        {
          bestMeters: daily ? progress.daily.bestMeters : bestDistance,
          tutorial: isFirstPlay && !daily && !(options.plan?.stage ?? plan.stage),
          // Today's course stays the same for everyone, so no ease-in there
          rookie: daily ? 0 : Math.max(0, Math.min(1, 1 - progress.runs / ROOKIE.RUNS)),
        },
      );
      setScreen('playing');
    },
    [bestScore, bestDistance, progress, consumeBalloon, isFirstPlay, startRun, plan.stage],
  );

  const handlePlay = useCallback(() => setShowSetup(true), []);
  const handlePlan = (next: WalkPlan) => {
    setPlan(next);
    AsyncStorage.setItem('@wobby_walk_plan', JSON.stringify(next)).catch(() => undefined);
    setShowSetup(false);
    beginPlaying({ newTerrain: true, plan: next });
  };

  // Everyone gets the same course today; it always starts from the beginning
  const handleDaily = useCallback(async () => {
    const today = refreshDay();
    const seed = courseSeedForDay(today.day);
    setGhost(null);
    try {
      const raw = await AsyncStorage.getItem('@wobby_daily_ghost_v2');
      const value = raw ? JSON.parse(raw) : null;
      if (validGhost(value, seed)) setGhost(value);
    } catch { /* A corrupt ghost never prevents playing. */ }
    beginPlaying({ newTerrain: true, courseSeed: seed });
  }, [refreshDay, beginPlaying]);

  const handleGameOver = useCallback(
    async (stats: GameStats) => {
      setLastStats(stats);
      const daily = run.courseSeed !== null;
      if (daily && stats.trace && stats.trace.length >= 2 && (!ghost || stats.meters > ghost.meters)) {
        const nextGhost = { seed: run.courseSeed!, meters: stats.meters, trace: stats.trace };
        await AsyncStorage.setItem('@wobby_daily_ghost_v2', JSON.stringify(nextGhost)).catch(() => undefined);
      }
      const previous = recordedStats.current;
      const before = recordedSummary.current;
      const result = recordRun(stats, daily, previous);
      const next: RunSummary = {
        coinsEarned: (before?.coinsEarned ?? 0) + result.coinsEarned,
        missionCoins: (before?.missionCoins ?? 0) + result.missionCoins,
        completedIds: [...(before?.completedIds ?? []), ...result.completed.map((m) => m.id)],
        wallet: result.data.wallet,
        missions: result.data.missions,
        daily: daily
          ? {
              best: result.data.daily.best,
              top: result.data.daily.top,
              newBest: result.newDailyBest || !!before?.daily?.newBest,
              day: result.data.daily.day,
            }
          : null,
      };
      recordedStats.current = stats;
      recordedSummary.current = next;
      setSummary(next);

      const records = await submitRun({ score: stats.score, meters: stats.meters });
      setIsNewBest(records.newScore);
      setMetersShort(records.newDistance ? 0 : metersShortOfBest(stats.meters, run.bestMeters));
      const show = () => setScreen('gameover');

      if (isFirstPlay) {
        await consumeFirstPlay();
        show();
        return;
      }
      gamesSinceAd.current += 1;
      const now = Date.now();
      if (
        !adsRemoved &&
        gamesSinceAd.current >= INTERSTITIAL_EVERY_N_GAMES &&
        now - lastAdAt.current >= INTERSTITIAL_MIN_INTERVAL_MS
      ) {
        noteAdWatched();
        setOfferNoAds(true);
        showInterstitial(show);
      } else {
        show();
        // A record with no ad in the way is the moment to ask for a rating
        queueReview({ newBest: records.newScore || records.newDistance, meters: stats.meters, runs: result.data.runs });
      }
    },
    [
      run.courseSeed,
      ghost,
      run.bestMeters,
      recordRun,
      submitRun,
      isFirstPlay,
      consumeFirstPlay,
      showInterstitial,
      noteAdWatched,
      queueReview,
      adsRemoved,
    ],
  );

  // Retry stays on today's course if that's what was just played
  const handleRetry = useCallback(() => {
    if (run.courseSeed !== null) handleDaily();
    else beginPlaying({ newTerrain: true, plan: { trait: run.trait, stage: run.stage, flapButton: run.flapButton } });
  }, [run, handleDaily, beginPlaying]);

  const handleContinue = useCallback(() => {
    showRewarded(() => {
      noteAdWatched();
      setHasContinued(true);
      setResumeId((id) => id + 1);
      setScreen('playing');
    });
  }, [showRewarded, noteAdWatched]);

  const handleHome = useCallback(() => {
    startRun('attract', { newTerrain: true });
    setScreen('start');
  }, [startRun]);

  // Boosted runs are always regular courses so today's course stays a fair comparison
  const handleBoost = useCallback(
    (boost: 'shield' | 'slowmo') => {
      showRewarded(() => {
        noteAdWatched();
        beginPlaying({ newTerrain: true, boost });
      });
    },
    [showRewarded, noteAdWatched, beginPlaying],
  );

  const handleShare = useCallback(() => {
    if (!lastStats) return;
    const rank = getRank(lastStats.meters);
    const params = {
      score: formatNum(lastStats.score),
      m: lastStats.meters,
      day: summary?.daily?.day ?? '',
      rank: `${rank.emoji} ${rank.name}`,
    };
    Share.share({
      message: `${t(summary?.daily ? 'share.daily' : 'share.normal', params)}\n${STORE_URL}`,
    }).catch(() => undefined);
  }, [lastStats, summary]);

  const handleBuySkin = useCallback(
    (skinId: string) => {
      if (buySkin(skinId, SKIN_PRICES[skinId] ?? 0)) selectSkin(skinId, true);
    },
    [buySkin, selectSkin],
  );

  const handleEquipSkin = useCallback((skinId: string) => selectSkin(skinId, true), [selectSkin]);

  const handleRentSkin = useCallback(
    (skinId: string) => {
      showRewarded(() => {
        noteAdWatched();
        selectSkin(skinId);
      });
    },
    [showRewarded, noteAdWatched, selectSkin],
  );

  const handleClaimStreak = useCallback(
    (doubled: boolean) => {
      const claim = (mult: number) => {
        if (claimDailyGift(mult) > 0) celebrate();
      };
      if (!doubled) claim(1);
      else
        showRewarded(() => {
          noteAdWatched();
          claim(2);
        });
    },
    [claimDailyGift, celebrate, showRewarded, noteAdWatched],
  );

  // Game over: watch an ad for the run's coins again
  const runCoins = summary?.coinsEarned ?? 0;
  const handleDoubleCoins = useCallback(() => {
    if (doubledCoins > 0) return;
    const amount = doubleCoinsAmount(runCoins);
    showRewarded(() => {
      noteAdWatched();
      grantCoins(amount);
      setDoubledCoins(amount);
      celebrate();
    });
  }, [doubledCoins, runCoins, showRewarded, noteAdWatched, grantCoins, celebrate]);

  const handleFreeCoins = useCallback(() => {
    if (freeCoinsLeft(progress) <= 0) return;
    showRewarded(() => {
      noteAdWatched();
      if (collectFreeCoins()) celebrate();
    });
  }, [progress, showRewarded, noteAdWatched, collectFreeCoins, celebrate]);

  const handleRestore = useCallback(async () => {
    if (await store.restore()) celebrate();
    else Alert.alert(t('shop.restore'), t('shop.restoreNone'));
  }, [store, celebrate]);

  const handleBuy = useCallback(
    async (productId: string) => {
      const result = await store.buy(productId);
      if (result === 'unavailable') Alert.alert(t('shop.title'), t('shop.unavailable'));
    },
    [store],
  );

  // Lucky wheel: ad spins wait for the reward; a skin prize rents a random skin for a day
  const handleSpin = useCallback(
    async (kind: SpinKind): Promise<SpinResult | null> => {
      if (kind === 'ad') {
        const earned = await new Promise<boolean>((resolve) =>
          showRewarded(
            () => resolve(true),
            () => resolve(false),
          ),
        );
        if (!earned) return null;
        noteAdWatched();
      }
      const candidates = rentableSkins(progress.ownedSkins);
      const result = spin(kind, candidates.length > 0);
      if (!result) return null;
      if (result.prize.kind === 'skin') {
        const skinId = candidates[Math.floor(Math.random() * candidates.length)];
        selectSkin(skinId);
        return { ...result, skinId };
      }
      return result;
    },
    [showRewarded, noteAdWatched, progress.ownedSkins, spin, selectSkin],
  );
  const handleWheelTick = useCallback(() => playSfx('coinCollect'), [playSfx]);

  const handleClaimAchievement = useCallback(
    (id?: AchievementId) => {
      if (claimAchievements(id).coins > 0) celebrate();
    },
    [claimAchievements, celebrate],
  );

  const handleBuyUpgrade = useCallback(
    (id: Parameters<typeof buyUpgrade>[0]) => {
      const ok = buyUpgrade(id);
      if (ok) playSfx('challengeSuccess');
      return ok;
    },
    [buyUpgrade, playSfx],
  );

  const runParams = useMemo(
    () => ({ ...(run.courseSeed === null ? runParamsFor(progress.upgrades) : {}), trait: run.trait, stage: run.stage, bestMeters: run.bestMeters, tutorial: run.tutorial, rookie: run.rookie }),
    [progress.upgrades, run],
  );
  const upgradeBadge = anyUpgradeAffordable(progress.upgrades, progress.wallet);
  const achievementsReady = claimableCount(progress);
  const openShop = useCallback(() => setShowShop(true), []);

  if (!loaded || !firstPlayLoaded || !skinLoaded || !progressLoaded) return null;

  return (
    <View style={styles.container}>
      <GameScreen
        width={width}
        height={height}
        showBanner={screen !== 'start' && !adsRemoved}
        controlsEnabled={screen === 'playing'}
        runId={run.id}
        runMode={run.mode}
        terrainKey={run.terrainKey}
        keepScroll={run.keepScroll}
        resumeId={resumeId}
        boost={run.boost}
        bestScore={runBestScore}
        skin={activeSkin}
        courseSeed={run.courseSeed}
        ghostTrace={run.courseSeed === null ? undefined : ghost?.trace}
        flapButton={run.flapButton}
        showTutorial={run.mode === 'playing' && progress.runs < TUTORIAL_RUNS}
        runParams={runParams}
        onGameOver={handleGameOver}
        onFx={handleFx}
      />

      {screen === 'start' && (
        <StartScreen
          bestScore={bestScore}
          bestDistance={bestDistance}
          wallet={progress.wallet}
          missions={progress.missions}
          dailyBest={progress.daily.best}
          onPlay={handlePlay}
          onDaily={handleDaily}
          onOpenSkins={() => setShowSkins(true)}
          onOpenUpgrades={() => setShowUpgrades(true)}
          onOpenLanguage={() => setShowLanguage(true)}
          upgradeBadge={upgradeBadge}
          streak={streakStatus(progress, new Date())}
          onClaimStreak={handleClaimStreak}
          onOpenShop={openShop}
          onOpenWheel={() => setShowWheel(true)}
          onOpenAchievements={() => setShowAchievements(true)}
          onRate={REVIEW_URL ? () => Linking.openURL(REVIEW_URL!).catch(() => undefined) : undefined}
          wheelBadge={nextSpin(progress) === 'free'}
          achievementBadge={achievementsReady}
        />
      )}

      {screen === 'gameover' && lastStats && summary && (
        <GameOverScreen
          stats={lastStats}
          summary={summary}
          bestScore={bestScore}
          isNewBest={isNewBest}
          canContinue={!hasContinued && run.courseSeed === null && !run.stage}
          onRetry={handleRetry}
          onHome={handleHome}
          onContinue={handleContinue}
          onBoost={handleBoost}
          onOpenSkins={() => setShowSkins(true)}
          onOpenUpgrades={() => setShowUpgrades(true)}
          upgradeBadge={upgradeBadge}
          onShare={handleShare}
          metersShort={metersShort}
          bestMeters={run.bestMeters}
          doubleCoins={doubledCoins || doubleCoinsAmount(summary.coinsEarned)}
          doubled={doubledCoins > 0}
          onDoubleCoins={handleDoubleCoins}
          achievementsReady={achievementsReady}
          onOpenAchievements={() => setShowAchievements(true)}
          offerNoAds={offerNoAds && !adsRemoved && !!store.products[REMOVE_ADS_ID]}
          onOpenShop={openShop}
        />
      )}

      {showSetup && <RunSetup initial={plan} onStart={handlePlan} onClose={() => setShowSetup(false)} />}

      {showSkins && (
        <SkinPreview
          activeSkinId={activeSkin.id}
          ownedSkins={progress.ownedSkins}
          wallet={progress.wallet}
          onBuy={handleBuySkin}
          onEquip={handleEquipSkin}
          onRent={handleRentSkin}
          onOpenShop={openShop}
          onClose={() => setShowSkins(false)}
        />
      )}

      {showLanguage && <LanguagePicker onClose={() => setShowLanguage(false)} />}

      {showUpgrades && (
        <UpgradeShop
          levels={progress.upgrades}
          wallet={progress.wallet}
          onBuy={handleBuyUpgrade}
          onOpenShop={openShop}
          onClose={() => setShowUpgrades(false)}
        />
      )}

      {showWheel && (
        <LuckyWheel
          next={nextSpin(progress)}
          adSpinsLeft={adSpinsLeft(progress)}
          onSpin={handleSpin}
          onTick={handleWheelTick}
          onPrize={celebrate}
          onClose={() => setShowWheel(false)}
        />
      )}

      {showAchievements && (
        <AchievementsModal
          list={allAchievements(progress)}
          onClaim={handleClaimAchievement}
          onClaimAll={() => handleClaimAchievement()}
          onClose={() => setShowAchievements(false)}
        />
      )}

      {showShop && (
        <ShopModal
          wallet={progress.wallet}
          products={store.products}
          adsRemoved={adsRemoved}
          state={store.state}
          freeCoinsLeft={freeCoinsLeft(progress)}
          onBuy={handleBuy}
          onOpen={store.refresh}
          onFreeCoins={handleFreeCoins}
          onRestore={handleRestore}
          onClose={() => setShowShop(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
