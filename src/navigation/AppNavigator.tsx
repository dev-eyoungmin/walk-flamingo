import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { StartScreen } from '../screens/StartScreen';
import { GameScreen } from '../screens/GameScreen';
import { GameOverScreen } from '../screens/GameOverScreen';
import { useHighScore } from '../hooks/useHighScore';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { useRewardedAd } from '../hooks/useRewardedAd';
import { useBackgroundMusic } from '../hooks/useBackgroundMusic';
import { useFirstPlay } from '../hooks/useFirstPlay';
import { useInterstitialAd } from '../hooks/useInterstitialAd';
import { useSkin } from '../hooks/useSkin';
import { useSfx } from '../hooks/useSfx';
import type { GameScreen as GameScreenType } from '../game/types';

export const AppNavigator: React.FC = () => {
  const [screen, setScreen] = useState<GameScreenType>('start');
  const [lastScore, setLastScore] = useState(0);
  const [lastDistance, setLastDistance] = useState(0);
  const [lastCoins, setLastCoins] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [hasContinued, setHasContinued] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [pendingBoost, setPendingBoost] = useState<'shield' | 'slowmo' | null>(null);
  const { width, height } = useScreenDimensions();
  const { highScore, submitScore, loaded } = useHighScore();
  const { showAd } = useRewardedAd();
  const { startMusic, stopMusic } = useBackgroundMusic();
  const { isFirstPlay, consumeFirstPlay, loaded: firstPlayLoaded } = useFirstPlay();
  const { showAd: showInterstitial } = useInterstitialAd();
  const { activeSkin, selectSkin, loaded: skinLoaded } = useSkin();
  const { play: playSfx } = useSfx();
  const prevScreen = useRef<GameScreenType>(screen);

  useEffect(() => {
    if (screen === 'playing' && prevScreen.current !== 'playing') {
      startMusic();
    } else if (screen !== 'playing' && prevScreen.current === 'playing') {
      stopMusic();
    }
    prevScreen.current = screen;
  }, [screen, startMusic, stopMusic]);

  const handlePlay = useCallback(() => {
    setHasContinued(false);
    setIsResuming(false);
    setPendingBoost(null);
    setScreen('playing');
  }, []);

  const handleGameOver = useCallback(
    async (data: { score: number; distance: number; coins?: number }) => {
      stopMusic();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playSfx('gameOver');
      setLastScore(data.score);
      setLastDistance(data.distance);
      setLastCoins(data.coins ?? 0);
      const isNew = await submitScore(data.distance);
      setIsNewHighScore(isNew);

      if (isFirstPlay) {
        await consumeFirstPlay();
        setScreen('gameover');
      } else {
        showInterstitial(() => {
          setScreen('gameover');
        });
      }
    },
    [submitScore, stopMusic, playSfx, isFirstPlay, consumeFirstPlay, showInterstitial],
  );

  const handleRetry = useCallback(() => {
    setIsResuming(false);
    setPendingBoost(null);
    setScreen('playing');
  }, []);

  const handleContinue = useCallback(() => {
    showAd(() => {
      setIsResuming(true);
      setScreen('playing');
      setHasContinued(true);
    });
  }, [showAd]);

  const handleHome = useCallback(() => {
    setScreen('start');
  }, []);

  const handleBoost = useCallback((boostType: 'shield' | 'slowmo') => {
    showAd(() => {
      setPendingBoost(boostType);
      setIsResuming(false);
      setScreen('playing');
    });
  }, [showAd]);

  const handleSkinUnlock = useCallback((skinId: string) => {
    showAd(() => {
      selectSkin(skinId);
    });
  }, [showAd, selectSkin]);

  if (!loaded || !firstPlayLoaded || !skinLoaded) return null;

  return (
    <View style={styles.container}>
      {/* Game screen is always mounted but only runs physics when playing */}
      {(screen === 'playing' || screen === 'gameover') && (
        <GameScreen
          width={width}
          height={height}
          isPlaying={screen === 'playing'}
          isResuming={isResuming}
          onGameOver={handleGameOver}
          pendingBoost={pendingBoost}
          skinPalette={activeSkin}
          onPlaySfx={playSfx}
        />
      )}

      {/* Start screen overlay */}
      {screen === 'start' && (
        <StartScreen highScore={highScore} onPlay={handlePlay} skinPalette={activeSkin} />
      )}

      {/* Game over overlay */}
      {screen === 'gameover' && (
        <GameOverScreen
          score={lastScore}
          distance={lastDistance}
          coins={lastCoins}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          onRetry={handleRetry}
          onHome={handleHome}
          onContinue={handleContinue}
          canContinue={!hasContinued}
          onBoost={handleBoost}
          onSkinUnlock={handleSkinUnlock}
          activeSkinId={activeSkin.id}
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
