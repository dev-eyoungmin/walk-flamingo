import React, { useMemo } from 'react';
import {
  Group,
  Rect,
  RoundedRect,
  Text,
  Path,
  Skia,
  matchFont,
} from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';
import { EVENTS } from '../game/constants';

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------
const EVT_OBSTACLE = 0;
const EVT_ENVIRONMENT = 1;
const EVT_CHALLENGE = 2;
const EVT_SPEED = 3;

// Environment subtypes
const ENV_GUST = 0;
const ENV_QUAKE = 1;
const ENV_ICE = 2;

// Challenge subtypes
const CHL_CENTERED = 0;
const CHL_STORM = 1;
const CHL_LEAN = 2;

// Boost types
const BOOST_SHIELD = 1;
const BOOST_SLOWMO = 2;

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------
const BANNER_W = 220;
const BANNER_H = 44;
const ARROW_W = 32;
const ARROW_H = 52;
const CHALLENGE_W = 240;
const CHALLENGE_H = 64;
const BOOST_W = 130;
const BOOST_H = 32;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Usage:
 *   <EventWarningRenderer
 *     warningTimer={warningTimerSV}
 *     warningEventType={warningEventTypeSV}
 *     warningEventSubtype={warningEventSubtypeSV}
 *     warningEventParam={warningEventParamSV}
 *     challengeActive={challengeActiveSV}
 *     challengeSubtype={challengeSubtypeSV}
 *     challengeTimer={challengeTimerSV}
 *     challengeParam={challengeParamSV}
 *     challengeResultAnim={challengeResultAnimSV}
 *     activeEventType={activeEventTypeSV}
 *     activeEventSubtype={activeEventSubtypeSV}
 *     boostType={boostTypeSV}
 *     boostTimer={boostTimerSV}
 *     speedModifier={speedModifierSV}
 *     width={width}
 *     height={height}
 *   />
 */
interface EventWarningRendererProps {
  warningTimer: SharedValue<number>;
  warningEventType: SharedValue<number>;
  warningEventSubtype: SharedValue<number>;
  /** For obstacles: side (-1=left, 1=right). For others: unused. */
  warningEventParam: SharedValue<number>;

  challengeActive: SharedValue<number>;
  challengeSubtype: SharedValue<number>;
  /** Counts down from duration to 0 */
  challengeTimer: SharedValue<number>;
  /** Lean direction for CHL_LEAN: -1=left, 1=right */
  challengeParam: SharedValue<number>;
  /** Counts down from 1.0: success>0 shown as green, fail<0 shown as red */
  challengeResultAnim: SharedValue<number>;

  activeEventType: SharedValue<number>;
  activeEventSubtype: SharedValue<number>;

  boostType: SharedValue<number>;
  boostTimer: SharedValue<number>;
  speedModifier: SharedValue<number>;

  width: number;
  height: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Warning banner at top-center: shows text based on event type/subtype.
 * Opacity driven by warningTimer (0→1 = active, fades at edges).
 */
const WarningBanner: React.FC<{
  warningTimer: SharedValue<number>;
  warningEventType: SharedValue<number>;
  warningEventSubtype: SharedValue<number>;
  cx: number;
  topY: number;
}> = ({ warningTimer, warningEventType, warningEventSubtype, cx, topY }) => {
  const fontFamily = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });
  const titleFont = matchFont({ fontFamily, fontSize: 18, fontWeight: '700' });

  const bannerOpacity = useDerivedValue(() => {
    const t = warningTimer.value;
    if (t <= 0) return 0;
    // Fade in over first 0.3s, fade out over last 0.3s
    const WARNING_TIME = EVENTS.OBSTACLE.WARNING_TIME; // 1.5s reference
    if (t > WARNING_TIME - 0.3) {
      return (WARNING_TIME - t) / 0.3;
    }
    if (t < 0.3) {
      return t / 0.3;
    }
    return 1;
  });

  const bannerText = useDerivedValue(() => {
    const type = warningEventType.value;
    const sub = warningEventSubtype.value;
    if (type === EVT_OBSTACLE) return 'WATCH OUT!';
    if (type === EVT_ENVIRONMENT) {
      if (sub === ENV_GUST) return 'GUST!';
      if (sub === ENV_QUAKE) return 'QUAKE!';
      if (sub === ENV_ICE) return 'ICE!';
      return 'WATCH OUT!';
    }
    if (type === EVT_SPEED) return 'SPEED!';
    return 'WATCH OUT!';
  });

  const bannerColor = useDerivedValue(() => {
    const type = warningEventType.value;
    const sub = warningEventSubtype.value;
    if (type === EVT_OBSTACLE) return 'rgba(220,40,40,0.88)';
    if (type === EVT_ENVIRONMENT) {
      if (sub === ENV_GUST) return 'rgba(80,160,255,0.88)';
      if (sub === ENV_QUAKE) return 'rgba(180,120,50,0.88)';
      if (sub === ENV_ICE) return 'rgba(100,200,255,0.88)';
    }
    if (type === EVT_SPEED) return 'rgba(255,180,0,0.88)';
    return 'rgba(220,40,40,0.88)';
  });

  const x = cx - BANNER_W / 2;
  const y = topY;

  return (
    <Group opacity={bannerOpacity}>
      <RoundedRect x={x} y={y} width={BANNER_W} height={BANNER_H} r={12} color={bannerColor} />
      {/* Border */}
      <RoundedRect
        x={x + 2}
        y={y + 2}
        width={BANNER_W - 4}
        height={BANNER_H - 4}
        r={10}
        color="rgba(255,255,255,0.3)"
        style="stroke"
        strokeWidth={1.5}
      />
      {/* Warning text */}
      <Text
        x={x + 14}
        y={y + BANNER_H - 13}
        text={bannerText}
        font={titleFont}
        color="#FFFFFF"
      />
    </Group>
  );
};

// ---------------------------------------------------------------------------

/**
 * Flashing directional arrow for obstacle warning.
 * Appears on left or right edge based on warningEventParam (-1/1).
 */
const WarningArrow: React.FC<{
  warningTimer: SharedValue<number>;
  warningEventType: SharedValue<number>;
  warningEventParam: SharedValue<number>;
  width: number;
  cy: number;
}> = ({ warningTimer, warningEventType, warningEventParam, width, cy }) => {
  // Arrow path pointing right (pointing toward screen center), mirrored for left
  const arrowRightPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(0, 0);
    p.lineTo(ARROW_W, ARROW_H / 2);
    p.lineTo(0, ARROW_H);
    p.lineTo(8, ARROW_H / 2);
    p.close();
    return p;
  }, []);

  const arrowLeftPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.moveTo(ARROW_W, 0);
    p.lineTo(0, ARROW_H / 2);
    p.lineTo(ARROW_W, ARROW_H);
    p.lineTo(ARROW_W - 8, ARROW_H / 2);
    p.close();
    return p;
  }, []);

  const MARGIN = 16;

  const rightArrowOpacity = useDerivedValue(() => {
    const t = warningTimer.value;
    if (t <= 0) return 0;
    const type = warningEventType.value;
    if (type !== EVT_OBSTACLE) return 0;
    const side = warningEventParam.value;
    if (side <= 0) return 0; // left obstacle = right arrow points toward it
    // Flash: sin-based, capped 0..1
    const flash = Math.max(0, Math.sin(t * 10));
    return flash;
  });

  const leftArrowOpacity = useDerivedValue(() => {
    const t = warningTimer.value;
    if (t <= 0) return 0;
    const type = warningEventType.value;
    if (type !== EVT_OBSTACLE) return 0;
    const side = warningEventParam.value;
    if (side >= 0) return 0;
    const flash = Math.max(0, Math.sin(t * 10));
    return flash;
  });

  return (
    <Group>
      {/* Right-side arrow (obstacle coming from right) */}
      <Group
        transform={[{ translateX: width - ARROW_W - MARGIN }, { translateY: cy - ARROW_H / 2 }]}
        opacity={rightArrowOpacity}
      >
        <Path path={arrowRightPath} color="#FF4444" />
      </Group>

      {/* Left-side arrow (obstacle coming from left) */}
      <Group
        transform={[{ translateX: MARGIN }, { translateY: cy - ARROW_H / 2 }]}
        opacity={leftArrowOpacity}
      >
        <Path path={arrowLeftPath} color="#FF4444" />
      </Group>
    </Group>
  );
};

// ---------------------------------------------------------------------------

/**
 * Full-screen environment overlay tint during active environment events.
 */
const EnvironmentOverlay: React.FC<{
  activeEventType: SharedValue<number>;
  activeEventSubtype: SharedValue<number>;
  width: number;
  height: number;
}> = ({ activeEventType, activeEventSubtype, width, height }) => {
  const overlayOpacity = useDerivedValue(() => {
    const type = activeEventType.value;
    return type === EVT_ENVIRONMENT ? 0.18 : 0;
  });

  const overlayColor = useDerivedValue(() => {
    const sub = activeEventSubtype.value;
    if (sub === ENV_GUST) return 'rgba(100,160,255,1)';
    if (sub === ENV_QUAKE) return 'rgba(180,140,80,1)';
    if (sub === ENV_ICE) return 'rgba(180,240,255,1)';
    return 'rgba(100,160,255,1)';
  });

  return (
    <Rect x={0} y={0} width={width} height={height} color={overlayColor} opacity={overlayOpacity} />
  );
};

// ---------------------------------------------------------------------------

/**
 * Challenge UI: centered banner with label + progress bar.
 * Visible when challengeActive > 0.
 */
const ChallengeUI: React.FC<{
  challengeActive: SharedValue<number>;
  challengeSubtype: SharedValue<number>;
  challengeTimer: SharedValue<number>;
  challengeParam: SharedValue<number>;
  challengeResultAnim: SharedValue<number>;
  cx: number;
  cy: number;
}> = ({
  challengeActive,
  challengeSubtype,
  challengeTimer,
  challengeParam,
  challengeResultAnim,
  cx,
  cy,
}) => {
  const fontFamily = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });
  const labelFont = matchFont({ fontFamily, fontSize: 16, fontWeight: '700' });
  const resultFont = matchFont({ fontFamily, fontSize: 22, fontWeight: '700' });

  const panelOpacity = useDerivedValue(() => {
    return challengeActive.value > 0 ? 1 : 0;
  });

  const challengeLabel = useDerivedValue(() => {
    const sub = challengeSubtype.value;
    if (sub === CHL_CENTERED) return 'STAY CENTERED!';
    if (sub === CHL_STORM) return 'SURVIVE THE STORM!';
    const dir = challengeParam.value >= 0 ? 'RIGHT' : 'LEFT';
    return `LEAN ${dir}!`;
  });

  const getDuration = (sub: number): number => {
    if (sub === CHL_CENTERED) return EVENTS.CHALLENGE.CENTERED_DURATION;
    if (sub === CHL_STORM) return EVENTS.CHALLENGE.STORM_DURATION;
    return EVENTS.CHALLENGE.LEAN_DURATION;
  };

  const progressBarWidth = useDerivedValue(() => {
    const sub = challengeSubtype.value;
    const duration = getDuration(sub);
    const remaining = Math.max(0, challengeTimer.value);
    const ratio = duration > 0 ? remaining / duration : 0;
    return ratio * (CHALLENGE_W - 16);
  });

  const progressBarColor = useDerivedValue(() => {
    const sub = challengeSubtype.value;
    const duration = getDuration(sub);
    const remaining = challengeTimer.value;
    const ratio = duration > 0 ? remaining / duration : 0;
    if (ratio > 0.5) return '#44FF44';
    if (ratio > 0.25) return '#FFFF44';
    return '#FF4444';
  });

  // Result text
  const resultOpacity = useDerivedValue(() => {
    const v = challengeResultAnim.value;
    return Math.abs(v) > 0 ? Math.min(1, Math.abs(v) / 0.5) : 0;
  });

  const resultText = useDerivedValue(() =>
    challengeResultAnim.value >= 0 ? 'SUCCESS!' : 'FAILED',
  );

  const resultColor = useDerivedValue(() =>
    challengeResultAnim.value >= 0 ? '#44FF44' : '#FF4444',
  );

  const bx = cx - CHALLENGE_W / 2;
  const by = cy - CHALLENGE_H / 2;

  return (
    <Group>
      {/* Main challenge panel */}
      <Group opacity={panelOpacity}>
        <RoundedRect x={bx} y={by} width={CHALLENGE_W} height={CHALLENGE_H} r={14} color="rgba(0,0,0,0.75)" />
        {/* Border */}
        <RoundedRect
          x={bx + 2}
          y={by + 2}
          width={CHALLENGE_W - 4}
          height={CHALLENGE_H - 4}
          r={12}
          color="rgba(255,255,180,0.4)"
          style="stroke"
          strokeWidth={1.5}
        />
        {/* Label */}
        <Text x={bx + 12} y={by + 24} text={challengeLabel} font={labelFont} color="#FFFFFF" />
        {/* Progress bar background */}
        <Rect x={bx + 8} y={by + 36} width={CHALLENGE_W - 16} height={10} color="rgba(255,255,255,0.15)" />
        {/* Progress bar fill */}
        <Rect x={bx + 8} y={by + 36} width={progressBarWidth} height={10} color={progressBarColor} />
      </Group>

      {/* Challenge result overlay */}
      <Group opacity={resultOpacity}>
        <Text
          x={cx - 52}
          y={by - 10}
          text={resultText}
          font={resultFont}
          color={resultColor}
        />
      </Group>
    </Group>
  );
};

// ---------------------------------------------------------------------------

/**
 * Boost indicator pill at bottom-center: shows SHIELD or SLOW-MO while active.
 */
const BoostIndicator: React.FC<{
  boostType: SharedValue<number>;
  boostTimer: SharedValue<number>;
  cx: number;
  bottomY: number;
}> = ({ boostType, boostTimer, cx, bottomY }) => {
  const fontFamily = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });
  const boostFont = matchFont({ fontFamily, fontSize: 14, fontWeight: '700' });

  const boostOpacity = useDerivedValue(() => {
    const bType = boostType.value;
    const t = boostTimer.value;
    return bType > 0 && t > 0 ? 1 : 0;
  });

  const boostText = useDerivedValue(() => {
    const bType = boostType.value;
    if (bType === BOOST_SHIELD) return 'SHIELD';
    if (bType === BOOST_SLOWMO) return 'SLOW-MO';
    return '';
  });

  const boostColor = useDerivedValue(() => {
    const bType = boostType.value;
    if (bType === BOOST_SHIELD) return 'rgba(80,200,255,0.88)';
    if (bType === BOOST_SLOWMO) return 'rgba(180,80,255,0.88)';
    return 'rgba(80,200,255,0.88)';
  });

  const bx = cx - BOOST_W / 2;
  const by = bottomY - BOOST_H - 8;

  return (
    <Group opacity={boostOpacity}>
      <RoundedRect x={bx} y={by} width={BOOST_W} height={BOOST_H} r={16} color={boostColor} />
      <Text x={bx + 16} y={by + BOOST_H - 9} text={boostText} font={boostFont} color="#FFFFFF" />
    </Group>
  );
};

// ---------------------------------------------------------------------------

/**
 * Speed/sprint lines: horizontal white lines at various heights,
 * visible when speedModifier > 1.5.
 */
const SprintLines: React.FC<{
  speedModifier: SharedValue<number>;
  width: number;
  height: number;
}> = ({ speedModifier, width, height }) => {
  // Fixed line Y positions (ratio of height)
  const lineYRatios = [0.2, 0.32, 0.45, 0.55, 0.65, 0.74];
  const lineWidths = [120, 80, 140, 100, 90, 110];
  const lineXOffsets = [0.1, 0.55, 0.05, 0.6, 0.2, 0.45];

  const sprintOpacity = useDerivedValue(() => {
    const mod = speedModifier.value;
    if (mod <= 1.5) return 0;
    return Math.min(1, (mod - 1.5) / 0.5) * 0.6;
  });

  return (
    <Group opacity={sprintOpacity}>
      {lineYRatios.map((ratio, i) => (
        <Rect
          key={i}
          x={lineXOffsets[i] * width}
          y={ratio * height}
          width={lineWidths[i]}
          height={2}
          color="rgba(255,255,255,0.8)"
        />
      ))}
    </Group>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const EventWarningRenderer: React.FC<EventWarningRendererProps> = ({
  warningTimer,
  warningEventType,
  warningEventSubtype,
  warningEventParam,
  challengeActive,
  challengeSubtype,
  challengeTimer,
  challengeParam,
  challengeResultAnim,
  activeEventType,
  activeEventSubtype,
  boostType,
  boostTimer,
  speedModifier,
  width,
  height,
}) => {
  const cx = width / 2;
  const SAFE_TOP = Platform.OS === 'ios' ? 54 : 16;

  return (
    <Group>
      {/* Full-screen environment tint (rendered first, behind everything) */}
      <EnvironmentOverlay
        activeEventType={activeEventType}
        activeEventSubtype={activeEventSubtype}
        width={width}
        height={height}
      />

      {/* Sprint lines */}
      <SprintLines speedModifier={speedModifier} width={width} height={height} />

      {/* Warning banner */}
      <WarningBanner
        warningTimer={warningTimer}
        warningEventType={warningEventType}
        warningEventSubtype={warningEventSubtype}
        cx={cx}
        topY={SAFE_TOP}
      />

      {/* Directional obstacle arrows */}
      <WarningArrow
        warningTimer={warningTimer}
        warningEventType={warningEventType}
        warningEventParam={warningEventParam}
        width={width}
        cy={height * 0.5}
      />

      {/* Challenge UI (centered) */}
      <ChallengeUI
        challengeActive={challengeActive}
        challengeSubtype={challengeSubtype}
        challengeTimer={challengeTimer}
        challengeParam={challengeParam}
        challengeResultAnim={challengeResultAnim}
        cx={cx}
        cy={height * 0.22}
      />

      {/* Boost indicator */}
      <BoostIndicator
        boostType={boostType}
        boostTimer={boostTimer}
        cx={cx}
        bottomY={height - 80}
      />
    </Group>
  );
};
