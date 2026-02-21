import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { StartScreen } from '../screens/StartScreen';
import { GameScreen } from '../screens/GameScreen';
import { GameOverScreen } from '../screens/GameOverScreen';
import { useHighScore } from '../hooks/useHighScore';
import { useScreenDimensions } from '../hooks/useScreenDimensions';
import { useInterstitialAd } from '../hooks/useInterstitialAd';
import { useBackgroundMusic } from '../hooks/useBackgroundMusic';
import { useDailyFreePlay } from '../hooks/useDailyFreePlay';
import type { GameScreen as GameScreenType } from '../game/types';

export const AppNavigator: React.FC = () => {
  const [screen, setScreen] = useState<GameScreenType>('start');
  const [lastScore, setLastScore] = useState(0);
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const { width, height } = useScreenDimensions();
  const { highScore, submitScore, loaded } = useHighScore();
  const { showAd } = useInterstitialAd();
  const { startMusic, stopMusic } = useBackgroundMusic();
  const { isFreePlay, consumeFreePlay, loaded: freePlayLoaded } = useDailyFreePlay();
  const prevScreen = useRef<GameScreenType>(screen);

  useEffect(() => {
    if (screen === 'playing' && prevScreen.current !== 'playing') {
      startMusic();
    } else if (screen !== 'playing' && prevScreen.current === 'playing') {
      stopMusic();
    }
    prevScreen.current = screen;
  }, [screen, startMusic, stopMusic]);

  /** Start game — free once per day, otherwise show ad first. */
  const startGame = useCallback(() => {
    if (isFreePlay) {
      consumeFreePlay();
      setScreen('playing');
    } else {
      showAd(() => {
        setScreen('playing');
      });
    }
  }, [isFreePlay, consumeFreePlay, showAd]);

  const handlePlay = useCallback(() => {
    startGame();
  }, [startGame]);

  const handleGameOver = useCallback(
    async (score: number) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setLastScore(score);
      const isNew = await submitScore(score);
      setIsNewHighScore(isNew);
      setScreen('gameover');
    },
    [submitScore],
  );

  const handleRetry = useCallback(() => {
    startGame();
  }, [startGame]);

  const handleHome = useCallback(() => {
    setScreen('start');
  }, []);

  if (!loaded || !freePlayLoaded) return null;

  return (
    <View style={styles.container}>
      {/* Game screen is always mounted but only runs physics when playing */}
      {(screen === 'playing' || screen === 'gameover') && (
        <GameScreen
          width={width}
          height={height}
          isPlaying={screen === 'playing'}
          onGameOver={handleGameOver}
        />
      )}

      {/* Start screen overlay */}
      {screen === 'start' && (
        <StartScreen highScore={highScore} onPlay={handlePlay} />
      )}

      {/* Game over overlay */}
      {screen === 'gameover' && (
        <GameOverScreen
          score={lastScore}
          highScore={highScore}
          isNewHighScore={isNewHighScore}
          onRetry={handleRetry}
          onHome={handleHome}
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
