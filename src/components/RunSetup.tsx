import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { FONT_DISPLAY, UI } from '../ui/theme';
import { GameButton } from '../ui/GameButton';

export interface WalkPlan {
  trait: number;
  stage: number;
  flapButton: boolean;
}

interface Props {
  initial: WalkPlan;
  onStart: (plan: WalkPlan) => void;
  onClose: () => void;
}

const STAGE_KEYS = ['play.endless', 'play.stage1', 'play.stage2', 'play.stage3'] as const;

export const RunSetup: React.FC<Props> = ({ initial, onStart, onClose }) => {
  const [plan, setPlan] = useState(initial);
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape']}>
      <View style={styles.scrim}>
        <View style={styles.panel}>
          <View style={styles.heading}>
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {t('play.setup')}
            </Text>
            {/* Kept in the heading so it never scrolls out of view on short screens */}
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={t('play.flapButton')}
              accessibilityState={{ checked: plan.flapButton }}
              onPress={() => setPlan({ ...plan, flapButton: !plan.flapButton })}
              style={styles.toggle}
            >
              <Text style={styles.toggleLabel}>{t('play.flapButton')}</Text>
              <View style={[styles.track, plan.flapButton && styles.trackOn]}>
                <View style={[styles.knob, plan.flapButton && styles.knobOn]} />
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onClose}>
              <Text style={styles.close}>{t('common.close')}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.label}>{t('play.traits')}</Text>
            <View style={styles.row}>
              {(['collector', 'acrobat', 'family'] as const).map((id, i) => (
                <Pressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: plan.trait === i + 1 }}
                  onPress={() => setPlan({ ...plan, trait: i + 1 })}
                  style={[styles.card, plan.trait === i + 1 && styles.selected]}
                >
                  <Text style={styles.name}>{t(`play.${id}`)}</Text>
                  <Text style={styles.note}>{t(`play.${id}Note`)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>{t('play.stages')}</Text>
            <View style={styles.row}>
              {STAGE_KEYS.map((key, stage) => (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: plan.stage === stage }}
                  onPress={() => setPlan({ ...plan, stage })}
                  style={[styles.card, plan.stage === stage && styles.selected]}
                >
                  <Text style={styles.name}>{t(key)}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <GameButton label={t('start.play')} onPress={() => onStart(plan)} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: UI.scrim, alignItems: 'center', justifyContent: 'center', padding: 18 },
  panel: { width: '90%', maxWidth: 760, maxHeight: '100%', backgroundColor: UI.panel, borderColor: UI.panelBorder, borderWidth: 2, borderRadius: 20, padding: 16, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontFamily: FONT_DISPLAY, color: UI.gold, fontSize: 22 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  toggleLabel: { color: UI.textDim, fontFamily: FONT_DISPLAY, fontSize: 12 },
  track: { width: 38, height: 22, borderRadius: 11, backgroundColor: '#3B294C', padding: 3 },
  trackOn: { backgroundColor: UI.mint },
  knob: { width: 16, height: 16, borderRadius: 8, backgroundColor: UI.text },
  knobOn: { transform: [{ translateX: 16 }] },
  close: { color: UI.text, padding: 8 },
  content: { gap: 10, paddingBottom: 8 },
  label: { color: UI.textDim, fontFamily: FONT_DISPLAY, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8 },
  card: { flex: 1, minHeight: 48, backgroundColor: '#3B294C', borderRadius: 10, borderWidth: 2, borderColor: 'transparent', padding: 10, justifyContent: 'center' },
  selected: { borderColor: UI.mint, backgroundColor: '#244946' },
  name: { color: UI.text, fontFamily: FONT_DISPLAY, fontSize: 14 },
  note: { color: UI.textDim, fontSize: 12, marginTop: 3 },
});
