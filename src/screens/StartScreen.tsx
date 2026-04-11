import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Canvas, Path, Circle, Rect, Group, LinearGradient, vec, Skia } from '@shopify/react-native-skia';

interface StartScreenSkinPalette {
  body: string;
  legs: string;
  legsDark: string;
  wing: string;
}

interface StartScreenProps {
  highScore: number;
  onPlay: () => void;
  skinPalette?: StartScreenSkinPalette;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  highScore,
  onPlay,
  skinPalette,
}) => {
  const { width, height } = useWindowDimensions();
  const titleBounce = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Title bounce animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(titleBounce, {
          toValue: -10,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(titleBounce, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // Fade in
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Pulsing glow on play button
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [titleBounce, fadeIn, glowPulse]);

  // Flamingo illustration dimensions
  const fU = Math.min(width, height) * 0.006;
  const flamingoW = fU * 50;
  const flamingoH = fU * 60;

  // Build flamingo illustration path (Skia Path)
  const flamingoBody = React.useMemo(() => {
    const p = Skia.Path.Make();
    // Body oval shape
    p.addOval({ x: fU * 15, y: fU * 25, width: fU * 20, height: fU * 16 });
    return p;
  }, [fU]);

  const flamingoNeck = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(fU * 28, fU * 28);
    p.cubicTo(fU * 35, fU * 18, fU * 30, fU * 8, fU * 33, fU * 3);
    return p;
  }, [fU]);

  const flamingoLegL = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(fU * 22, fU * 40);
    p.lineTo(fU * 20, fU * 55);
    p.lineTo(fU * 16, fU * 55);
    return p;
  }, [fU]);

  const flamingoLegR = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(fU * 28, fU * 40);
    p.lineTo(fU * 28, fU * 50);
    p.cubicTo(fU * 28, fU * 52, fU * 32, fU * 52, fU * 30, fU * 48);
    return p;
  }, [fU]);

  const flamingoWing = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(fU * 18, fU * 30);
    p.quadTo(fU * 8, fU * 35, fU * 12, fU * 40);
    p.quadTo(fU * 18, fU * 38, fU * 20, fU * 35);
    p.close();
    return p;
  }, [fU]);

  // Cloud paths
  const cloud1 = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.addOval({ x: 0, y: 0, width: 60, height: 24 });
    p.addOval({ x: 15, y: -8, width: 40, height: 24 });
    p.addOval({ x: -10, y: 4, width: 40, height: 20 });
    return p;
  }, []);

  // Ground silhouette
  const groundSilhouette = React.useMemo(() => {
    const p = Skia.Path.Make();
    const gY = height * 0.82;
    p.moveTo(0, gY);
    p.quadTo(width * 0.15, gY - 20, width * 0.3, gY - 8);
    p.quadTo(width * 0.5, gY + 10, width * 0.7, gY - 12);
    p.quadTo(width * 0.85, gY - 25, width, gY - 5);
    p.lineTo(width, height);
    p.lineTo(0, height);
    p.close();
    return p;
  }, [width, height]);

  const glowOpacity = glowPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeIn }]}>
      {/* Skia gradient sky background + ground silhouette + clouds + flamingo */}
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Gradient sky */}
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, height)}
            colors={['#4A90D9', '#87CEEB', '#B8E4F0', '#F0C27F']}
          />
        </Rect>

        {/* Floating clouds */}
        <Group transform={[{ translateX: width * 0.1 }, { translateY: height * 0.12 }]}>
          <Path path={cloud1} color="rgba(255,255,255,0.6)" />
        </Group>
        <Group transform={[{ translateX: width * 0.6 }, { translateY: height * 0.08 }]} opacity={0.5}>
          <Path path={cloud1} color="rgba(255,255,255,0.5)" />
        </Group>
        <Group transform={[{ translateX: width * 0.35 }, { translateY: height * 0.18 }]} opacity={0.4}>
          <Path path={cloud1} color="rgba(255,255,255,0.4)" />
        </Group>

        {/* Ground silhouette */}
        <Path path={groundSilhouette} color="#2D5A27" />
        {/* Lighter ground overlay */}
        <Rect x={0} y={height * 0.88} width={width} height={height * 0.12}>
          <LinearGradient
            start={vec(0, height * 0.88)}
            end={vec(0, height)}
            colors={['#3A7D32', '#2D5A27']}
          />
        </Rect>

        {/* Flamingo illustration */}
        <Group transform={[{ translateX: (width - flamingoW) / 2 }, { translateY: height * 0.15 }]}>
          {/* Legs */}
          <Path path={flamingoLegL} color={skinPalette?.legs    ?? '#E86A6A'} style="stroke" strokeWidth={fU * 1.2} strokeCap="round" />
          <Path path={flamingoLegR} color={skinPalette?.legsDark ?? '#D05A5A'} style="stroke" strokeWidth={fU * 1.2} strokeCap="round" />
          {/* Body */}
          <Path path={flamingoBody} color={skinPalette?.body ?? '#FF7A9A'} />
          {/* Wing */}
          <Path path={flamingoWing} color={skinPalette?.wing ?? '#E8658A'} />
          {/* Neck */}
          <Path path={flamingoNeck} color={skinPalette?.body ?? '#FF7A9A'} style="stroke" strokeWidth={fU * 2.5} strokeCap="round" />
          {/* Head */}
          <Circle cx={fU * 33} cy={fU * 3} r={fU * 4} color={skinPalette?.body ?? '#FF7A9A'} />
          {/* Eye */}
          <Circle cx={fU * 35} cy={fU * 2} r={fU * 1.2} color="#FFFFFF" />
          <Circle cx={fU * 35.5} cy={fU * 2} r={fU * 0.6} color="#1A1A1A" />
          {/* Beak */}
          <Rect x={fU * 36} y={fU * 1.5} width={fU * 6} height={fU * 2}>
            <LinearGradient
              start={vec(fU * 36, 0)}
              end={vec(fU * 42, 0)}
              colors={['#FF8845', '#2A2A2A']}
            />
          </Rect>
          {/* Cheek */}
          <Circle cx={fU * 34} cy={fU * 4.5} r={fU * 1} color="#FF5070" />
        </Group>
      </Canvas>

      {/* UI Overlay */}
      <View style={styles.uiOverlay}>
        {/* Title */}
        <Animated.View
          style={[styles.titleContainer, { transform: [{ translateY: titleBounce }] }]}
        >
          <Text style={styles.title}>Flamingo Walk</Text>
        </Animated.View>

        {/* High Score with trophy */}
        {highScore > 0 && (
          <View style={styles.highScoreContainer}>
            <Text style={styles.trophyIcon}>T</Text>
            <Text style={styles.highScoreLabel}>BEST</Text>
            <Text style={styles.highScoreValue}>{highScore}m</Text>
          </View>
        )}

        {/* Play Button with pulsing glow */}
        <View style={styles.playButtonWrapper}>
          <Animated.View
            style={[
              styles.playButtonGlow,
              { opacity: glowOpacity },
            ]}
          />
          <Pressable
            style={({ pressed }) => [
              styles.playButton,
              pressed && styles.playButtonPressed,
            ]}
            onPress={onPlay}
          >
            <Text style={styles.playButtonText}>PLAY</Text>
          </Pressable>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            TAP LEFT / RIGHT
          </Text>
          <Text style={styles.instructionSubtext}>
            Keep balance as long as you can!
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  uiOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 2,
  },
  highScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  trophyIcon: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '900',
    marginRight: 6,
  },
  highScoreLabel: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '700',
    marginRight: 8,
  },
  highScoreValue: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  playButtonWrapper: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonGlow: {
    position: 'absolute',
    width: 200,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  playButton: {
    width: 180,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: '#FF9F6B',
  },
  playButtonPressed: {
    backgroundColor: '#E55A2A',
    transform: [{ scale: 0.95 }],
  },
  playButtonText: {
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 6,
  },
  instructions: {
    alignItems: 'center',
    opacity: 0.8,
  },
  instructionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  instructionSubtext: {
    fontSize: 12,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});
