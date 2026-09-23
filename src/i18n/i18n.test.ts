import * as fs from 'fs';
import * as path from 'path';
import { fill, formatNum, initLocale, languageChoice, locale, LOCALES, resolveLocale, t } from './index';
import { en } from './locales/en';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe('translations', () => {
  const keys = Object.keys(en).sort();

  it.each(Object.keys(LOCALES))('%s has every key, the same placeholders and no blanks', (code) => {
    const strings = LOCALES[code as keyof typeof LOCALES] as Record<string, string>;
    expect(Object.keys(strings).sort()).toEqual(keys);
    for (const k of keys) {
      expect(strings[k].trim()).not.toBe('');
      expect([k, placeholders(strings[k])]).toEqual([k, placeholders((en as Record<string, string>)[k])]);
    }
  });

  it('fills placeholders', () => {
    expect(fill('{n} m to {name}', { n: 12, name: 'Eagle' })).toBe('12 m to Eagle');
    expect(fill('x{n}{n}', { n: 2 })).toBe('x22');
  });
});

describe('in-game language choice', () => {
  afterEach(() => initLocale('auto'));

  it('a saved choice overrides the device language', () => {
    initLocale('ja');
    expect(locale).toBe('ja');
    expect(languageChoice).toBe('ja');
    expect(t('start.play')).toBe(LOCALES.ja['start.play']);
    initLocale('de');
    expect(t('over.best', { n: formatNum(1234567) })).toBe(LOCALES.de['over.best'].replace('{n}', '1.234.567'));
  });

  it("'auto' follows the device again", () => {
    initLocale('ru');
    initLocale('auto');
    expect(languageChoice).toBe('auto');
    expect(t('start.play')).toBe(LOCALES[locale]['start.play']);
  });
});

describe('locale detection', () => {
  it('maps device preferences to a supported language', () => {
    expect(resolveLocale([{ languageTag: 'ja-JP', languageCode: 'ja' }])).toBe('ja');
    expect(resolveLocale([{ languageTag: 'zh-Hant-TW', languageCode: 'zh', languageScriptCode: 'Hant' }])).toBe('zh-Hant');
    expect(resolveLocale([{ languageTag: 'zh-HK', languageCode: 'zh', regionCode: 'HK' }])).toBe('zh-Hant');
    expect(resolveLocale([{ languageTag: 'zh-CN', languageCode: 'zh', regionCode: 'CN' }])).toBe('zh-Hans');
    expect(resolveLocale([{ languageTag: 'pt-PT', languageCode: 'pt' }])).toBe('pt-BR');
    expect(resolveLocale([{ languageTag: 'es-419', languageCode: 'es' }])).toBe('es');
    expect(resolveLocale([{ languageTag: 'ko-KR', languageCode: 'ko' }, { languageTag: 'de-DE', languageCode: 'de' }])).toBe('de');
    expect(resolveLocale([{ languageTag: 'ko-KR', languageCode: 'ko' }])).toBe('en');
    expect(resolveLocale([])).toBe('en');
  });
});

// ─── Font coverage: the Skia HUD draws with one font and has no fallback ─────────

/** Code points mapped by a TrueType font (cmap formats 4 and 12). */
function cmapCodePoints(file: string): Set<number> {
  const buf = fs.readFileSync(file);
  const numTables = buf.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('latin1', rec, rec + 4) === 'cmap') cmap = buf.readUInt32BE(rec + 8);
  }
  const out = new Set<number>();
  const n = buf.readUInt16BE(cmap + 2);
  for (let i = 0; i < n; i++) {
    const sub = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
    const format = buf.readUInt16BE(sub);
    if (format === 4) {
      const segX2 = buf.readUInt16BE(sub + 6);
      const ends = sub + 14;
      const starts = ends + segX2 + 2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = buf.readUInt16BE(ends + s * 2);
        const start = buf.readUInt16BE(starts + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) out.add(c);
      }
    } else if (format === 12) {
      const groups = buf.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) {
        const start = buf.readUInt32BE(sub + 16 + g * 12);
        const end = buf.readUInt32BE(sub + 20 + g * 12);
        for (let c = start; c <= end; c++) out.add(c);
      }
    }
  }
  return out;
}

const FONT_FILES: Record<string, string> = {
  en: 'LilitaOne-Regular.ttf',
  es: 'LilitaOne-Regular.ttf',
  'pt-BR': 'LilitaOne-Regular.ttf',
  de: 'LilitaOne-Regular.ttf',
  fr: 'LilitaOne-Regular.ttf',
  it: 'LilitaOne-Regular.ttf',
  id: 'LilitaOne-Regular.ttf',
  ru: 'WobbyRound.ttf',
  vi: 'WobbyRound.ttf',
  ja: 'WobbyJA.ttf',
  'zh-Hans': 'WobbySC.ttf',
  'zh-Hant': 'WobbyTC.ttf',
  th: 'WobbyThai.ttf',
};

describe('display fonts', () => {
  it.each(Object.keys(LOCALES))('%s: every character has a glyph in its display font', (code) => {
    const cps = cmapCodePoints(path.join(__dirname, '../../assets/fonts', FONT_FILES[code]));
    const strings = Object.values(LOCALES[code as keyof typeof LOCALES]) as string[];
    const missing = new Set<string>();
    for (const s of strings) {
      for (const ch of s) {
        if (/\s/.test(ch)) continue;
        if (!cps.has(ch.codePointAt(0)!)) missing.add(ch);
      }
    }
    expect([...missing].join('')).toBe('');
  });
});
