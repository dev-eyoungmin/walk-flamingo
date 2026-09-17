import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Mission, missionLabel } from '../lib/progress';
import { FONT_DISPLAY, UI } from './theme';

interface Props {
  missions: Mission[];
  /** Highlight missions finished by the last run */
  justCompleted?: string[];
  compact?: boolean;
}

export const CoinGlyph: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <View style={[styles.coinOuter, { width: size, height: size, borderRadius: size / 2 }]}>
    <View style={[styles.coinInner, { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.31 }]} />
  </View>
);

export const MissionList: React.FC<Props> = ({ missions, justCompleted = [], compact = false }) => (
  <View style={styles.list}>
    {missions.map((m) => {
      const fresh = justCompleted.includes(m.id);
      const ratio = Math.min(1, m.progress / m.target);
      return (
        <View key={m.id} style={[styles.row, compact && styles.rowCompact, fresh && styles.rowFresh]}>
          <View style={[styles.check, m.done && styles.checkDone]}>{m.done && <Text style={styles.checkMark}>✓</Text>}</View>
          <View style={styles.body}>
            <Text style={[styles.label, m.done && styles.labelDone]} numberOfLines={1}>
              {missionLabel(m)}
            </Text>
            {!m.done && (
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
              </View>
            )}
          </View>
          <View style={styles.reward}>
            <CoinGlyph size={12} />
            <Text style={[styles.rewardText, m.done && styles.labelDone]}>{m.reward}</Text>
          </View>
        </View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  list: {
    gap: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  rowCompact: {
    paddingVertical: 3,
  },
  rowFresh: {
    backgroundColor: 'rgba(94,230,201,0.22)',
    borderWidth: 1.5,
    borderColor: UI.mint,
  },
  check: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: UI.textFaint,
    marginRight: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: UI.mint,
    borderColor: UI.mint,
  },
  checkMark: {
    color: UI.ink,
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
  },
  body: {
    flex: 1,
  },
  label: {
    color: UI.text,
    fontSize: 11,
    fontWeight: '600',
  },
  labelDone: {
    color: UI.textFaint,
    textDecorationLine: 'line-through',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: UI.gold,
  },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    gap: 3,
  },
  rewardText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    color: UI.gold,
  },
  coinOuter: {
    backgroundColor: '#D08A12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinInner: {
    backgroundColor: '#FFD23F',
  },
});
