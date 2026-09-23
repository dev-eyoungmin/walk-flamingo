import { en, Strings, TKey } from './locales/en';
import { ja } from './locales/ja';
import { zhHans } from './locales/zh-Hans';
import { zhHant } from './locales/zh-Hant';
import { es } from './locales/es';
import { ptBR } from './locales/pt-BR';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { ru } from './locales/ru';
import { it } from './locales/it';
import { id } from './locales/id';
import { th } from './locales/th';
import { vi } from './locales/vi';

export type { TKey } from './locales/en';

export const LOCALES = {
  en,
  ja,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  es,
  'pt-BR': ptBR,
  de,
  fr,
  ru,
  it,
  id,
  th,
  vi,
} satisfies Record<string, Strings>;

export type Locale = keyof typeof LOCALES;

/** Which bundled display font covers a locale's script. */
export type FontKey = 'latin' | 'round' | 'ja' | 'sc' | 'tc' | 'th';

const FONT_FOR_LOCALE: Record<Locale, FontKey> = {
  en: 'latin',
  es: 'latin',
  'pt-BR': 'latin',
  de: 'latin',
  fr: 'latin',
  it: 'latin',
  id: 'latin',
  ru: 'round',
  vi: 'round',
  ja: 'ja',
  'zh-Hans': 'sc',
  'zh-Hant': 'tc',
  th: 'th',
};

interface LocaleInfo {
  languageCode?: string | null;
  languageTag?: string;
  languageScriptCode?: string | null;
  regionCode?: string | null;
}

/** Picks the first supported locale from the user's preference list (falls back to English). */
export function resolveLocale(prefs: LocaleInfo[]): Locale {
  for (const p of prefs) {
    const tag = (p.languageTag ?? '').replace('_', '-');
    const lang = (p.languageCode ?? tag.split('-')[0] ?? '').toLowerCase();
    if (lang === 'zh') {
      const script = p.languageScriptCode ?? (/Hant/i.test(tag) ? 'Hant' : /Hans/i.test(tag) ? 'Hans' : null);
      if (script === 'Hant') return 'zh-Hant';
      if (script === 'Hans') return 'zh-Hans';
      const region = (p.regionCode ?? tag.split('-').pop() ?? '').toUpperCase();
      return region === 'TW' || region === 'HK' || region === 'MO' ? 'zh-Hant' : 'zh-Hans';
    }
    if (lang === 'pt') return 'pt-BR';
    if (lang in LOCALES) return lang as Locale;
  }
  return 'en';
}

/** A saved choice from the in-game language picker: a locale, or follow the device. */
export type LanguageChoice = Locale | 'auto';

/** Each language written in itself, for the picker. */
export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  'zh-Hans': '简体中文',
  'zh-Hant': '繁體中文',
  es: 'Español',
  'pt-BR': 'Português (BR)',
  de: 'Deutsch',
  fr: 'Français',
  ru: 'Русский',
  it: 'Italiano',
  id: 'Indonesia',
  th: 'ไทย',
  vi: 'Tiếng Việt',
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && v in LOCALES;
}

function deviceLocale(): Locale {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getLocales } = require('expo-localization');
    return resolveLocale(getLocales());
  } catch {
    return 'en';
  }
}

function detectLocale(choice: LanguageChoice): Locale {
  // Web builds accept ?lang=xx so every language can be checked in a browser
  try {
    const search = (globalThis as { location?: { search?: string } }).location?.search;
    const forced = search ? new URLSearchParams(search).get('lang') : null;
    if (forced) return resolveLocale([{ languageTag: forced }]);
  } catch {
    // ignore
  }
  return choice !== 'auto' ? choice : deviceLocale();
}

function makeNumberFormat(l: Locale): Intl.NumberFormat | null {
  try {
    return new Intl.NumberFormat(l === 'zh-Hans' ? 'zh-CN' : l === 'zh-Hant' ? 'zh-TW' : l);
  } catch {
    return null;
  }
}

/**
 * The active language. It is fixed for the lifetime of the JS bundle: the app picks it once at
 * startup (initLocale), and changing it in-game saves the choice and reloads the app.
 */
export let locale: Locale = detectLocale('auto');
export let fontKey: FontKey = FONT_FOR_LOCALE[locale];
export let languageChoice: LanguageChoice = 'auto';
let strings: Strings = LOCALES[locale];
let numberFormat = makeNumberFormat(locale);

/** Applies the saved picker choice. Call before any screen module is loaded. */
export function initLocale(choice: LanguageChoice): void {
  languageChoice = choice;
  locale = detectLocale(choice);
  fontKey = FONT_FOR_LOCALE[locale];
  strings = LOCALES[locale];
  numberFormat = makeNumberFormat(locale);
}

/** Fills {placeholders} in a template. Worklet-safe so HUD text can be formatted on the UI thread. */
export function fill(template: string, params: Record<string, string | number>): string {
  'worklet';
  let out = template;
  for (const k in params) out = out.split(`{${k}}`).join(String(params[k]));
  return out;
}

export function t(key: TKey, params?: Record<string, string | number>): string {
  const s = strings[key] ?? en[key];
  return params ? fill(s, params) : s;
}

export function formatNum(n: number): string {
  const v = Math.floor(n);
  return numberFormat ? numberFormat.format(v) : String(v);
}
