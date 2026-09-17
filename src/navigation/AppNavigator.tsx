import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { GameScreen } from '../screens/GameScreen';
import { StartScreen } from '../screens/StartScreen';
import { GameOverScreen, RunSummary } from '../screens/GameOverScreen';
import { SkinPreview } from '../components/SkinPreview';
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
import { useProgress } from '../hooks/useProgress';
import { INTERSTITIAL_EVERY_N_GAMES, INTERSTITIAL_MIN_INTERVAL_MS } from '../lib/adConfig';
import { courseSeedForDay } from '../lib/progress';
import { getRank } from '../lib/ranks';
import { SKIN_PRICES } from '../lib/skins';

/** New players see the flap tutorial during their first few runs. */
const TUTORIAL_RUNS = 5;

type Screen = 'start' | 'playing' | 'gameover';

interface RunOptions {
  newTerrain: boolean;
  keepScroll?: boolean;
  boost?: BoostType;
  courseSeed?: number | null;
}

interface RunConfig {
  id: number;
  mode: RunMode;
  terrainKey: number;
  keepScroll: boolean;
  boost: BoostType;
  /** Today's course seed, or null for a random course */
  courseSeed: number | null;
}

export const AppNavigator: React.FC = () => {
  const { width, height } = useScreenDimensions();
  const [screen, setScreen] = useState<Screen>('start');
  const [run, setRun] = useState<RunConfig>({
    id: 0,
    mode: 'attract',
    terrainKey: 0,
    keepScroll: false,
    boost: null,
    courseSeed: null,
  });
  const [resumeId, setResumeId] = useState(0);
  const [lastStats, setLastStats] = useState<GameStats | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [hasContinued, setHasContinued] = useState(false);
  const [showSkins, setShowSkins] = useState(false);
  // Best score at the start of the run, so the HUD can announce when it is beaten
  const [runBestScore, setRunBestScore] = useState(0);

  const { bestScore, bestDistance, submitRun, loaded } = useHighScore();
  const { showAd: showRewarded } = useRewardedAd();
  const { startMusic, stopMusic, setMusicRate } = useBackgroundMusic();
  const { isFirstPlay, consumeFirstPlay, loaded: firstPlayLoaded } = useFirstPlay();
  const { showAd: showInterstitial } = useInterstitialAd();
  const { progress, recordRun, buySkin, refreshDay, loaded: progressLoaded } = useProgress();
  const { activeSkin, selectSkin, loaded: skinLoaded } = useSkin(progress.ownedSkins);
  const { play: playSfx } = useSfx();
  const handleFx = useGameFeedback(playSfx, setMusicRate);

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

  // Missions and today's course roll over at midnight even if the app stays open
  useEffect(() => {
    if (screen === 'start') refreshDay();
  }, [screen, refreshDay]);

  const startRun = useCallback(
    (mode: RunMode, options: RunOptions) => {
      setRun((r) => ({
        id: r.id + 1,
        mode,
        terrainKey: options.newTerrain ? r.terrainKey + 1 : r.terrainKey,
        keepScroll: options.keepScroll ?? false,
        boost: options.boost ?? null,
        courseSeed: options.courseSeed ?? null,
      }));
    },
    [],
  );

  const beginPlaying = useCallback(
    (options: RunOptions) => {
      setHasContinued(false);
      recordedStats.current = null;
      recordedSummary.current = null;
      setRunBestScore(bestScore);
      startRun('playing', options);
      setScreen('playing');
    },
    [bestScore, startRun],
  );

  const handlePlay = useCallback(() => beginPlaying({ newTerrain: false, keepScroll: true }), [beginPlaying]);

  // Everyone gets the same course today; it always starts from the beginning
  const handleDaily = useCallback(() => {
    const today = refreshDay();
    beginPlaying({ newTerrain: true, courseSeed: courseSeedForDay(today.day) });
  }, [refreshDay, beginPlaying]);

  const handleGameOver = useCallback(
    async (stats: GameStats) => {
      setLastStats(stats);
      const daily = run.courseSeed !== null;
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

      const isNew = await submitRun({ score: stats.score, meters: stats.meters });
      setIsNewBest(isNew);
      const show = () => setScreen('gameover');

      if (isFirstPlay) {
        await consumeFirstPlay();
        show();
        return;
      }
      gamesSinceAd.current += 1;
      const now = Date.now();
      if (
        gamesSinceAd.current >= INTERSTITIAL_EVERY_N_GAMES &&
        now - lastAdAt.current >= INTERSTITIAL_MIN_INTERVAL_MS
      ) {
        noteAdWatched();
        showInterstitial(show);
      } else {
        show();
      }
    },
    [run.courseSeed, recordRun, submitRun, isFirstPlay, consumeFirstPlay, showInterstitial, noteAdWatched],
  );

  // Retry stays on today's course if that's what was just played
  const handleRetry = useCallback(() => {
    if (run.courseSeed !== null) handleDaily();
    else beginPlaying({ newTerrain: true });
  }, [run.courseSeed, handleDaily, beginPlaying]);

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
    const course = summary?.daily ? `today's course (${summary.daily.day})` : 'a wobbly walk';
    Share.share({
      message: `I scored ${lastStats.score.toLocaleString('en-US')} and walked ${lastStats.meters} m on ${course} in Wobby! ${rank.emoji} ${rank.name}`,
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

  if (!loaded || !firstPlayLoaded || !skinLoaded || !progressLoaded) return null;

  return (
    <View style={styles.container}>
      <GameScreen
        width={width}
        height={height}
        showBanner={screen !== 'start'}
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
        showTutorial={run.mode === 'playing' && progress.runs < TUTORIAL_RUNS}
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
        />
      )}

      {screen === 'gameover' && lastStats && summary && (
        <GameOverScreen
          stats={lastStats}
          summary={summary}
          bestScore={bestScore}
          isNewBest={isNewBest}
          canContinue={!hasContinued}
          onRetry={handleRetry}
          onHome={handleHome}
          onContinue={handleContinue}
          onBoost={handleBoost}
          onOpenSkins={() => setShowSkins(true)}
          onShare={handleShare}
        />
      )}

      {showSkins && (
        <SkinPreview
          activeSkinId={activeSkin.id}
          ownedSkins={progress.ownedSkins}
          wallet={progress.wallet}
          onBuy={handleBuySkin}
          onEquip={handleEquipSkin}
          onRent={handleRentSkin}
          onClose={() => setShowSkins(false)}
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
