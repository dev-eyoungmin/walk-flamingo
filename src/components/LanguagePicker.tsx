import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LanguageChoice, languageChoice, LANGUAGE_NAMES, Locale, LOCALES, t } from '../i18n';
import { changeLanguage } from '../i18n/preference';
import { GameButton } from '../ui/GameButton';
import { FONT_DISPLAY, titleShadow, UI } from '../ui/theme';

interface Props {
  onClose: () => void;
}

const CHOICES: LanguageChoice[] = ['auto', ...(Object.keys(LOCALES) as Locale[])];

/** In-game language picker. Picking a language restarts the app in that language. */
export const LanguagePicker: React.FC<Props> = ({ onClose }) => {
  const { height } = useWindowDimensions();
  const [pending, setPending] = useState<LanguageChoice | null>(null);

  const pick = (choice: LanguageChoice) => {
    if (pending) return;
    if (choice === languageChoice) {
      onClose();
      return;
    }
    setPending(choice);
    changeLanguage(choice).catch(() => setPending(null));
  };

  return (
    <View style={styles.scrim}>
      <View style={[styles.modal, { maxHeight: height - 16 }]}>
        <Text style={styles.title}>🌐 {t('lang.title')}</Text>
        <ScrollView style={styles.scroller} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {CHOICES.map((choice) => {
            const selected = choice === languageChoice;
            return (
              <Pressable
                key={choice}
                onPress={() => pick(choice)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.option,
                  choice === 'auto' && styles.optionWide,
                  selected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {choice === 'auto' ? `📱 ${t('lang.auto')}` : LANGUAGE_NAMES[choice]}
                </Text>
                {pending === choice ? <ActivityIndicator size="small" color={UI.ink} /> : selected && <Text style={styles.check}>✓</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
        <GameButton label={t('common.close')} size="sm" color={UI.slate} shade={UI.slateDark} onPress={onClose} style={styles.close} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,10,30,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modal: {
    backgroundColor: UI.panel,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: UI.sky,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: 600,
    maxWidth: '94%',
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 22,
    color: UI.text,
    marginBottom: 6,
    ...titleShadow,
  },
  scroller: {
    alignSelf: 'stretch',
    flexGrow: 0,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 5,
  },
  // Four per row so every language fits without scrolling, even on the smallest phones
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '23.8%',
    minHeight: 31,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  optionWide: {
    width: '100%',
  },
  optionSelected: {
    backgroundColor: UI.sky,
    borderColor: UI.sky,
  },
  optionPressed: {
    opacity: 0.7,
  },
  // System font: every language name renders in its own script
  optionText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    color: UI.text,
  },
  optionTextSelected: {
    color: UI.ink,
  },
  check: {
    fontSize: 13,
    fontWeight: '900',
    color: UI.ink,
    marginLeft: 4,
  },
  close: {
    marginTop: 8,
    minWidth: 120,
  },
});
