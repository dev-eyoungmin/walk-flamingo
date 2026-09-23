#!/usr/bin/env python3
"""
Builds the small per-script display fonts in assets/fonts/ from Google Fonts sources.

Only the characters actually used by src/i18n/locales/*.ts (plus ASCII and a few symbols) are kept,
so each font stays tiny. Re-run after changing any translation:

    python3 -m venv .venv && .venv/bin/pip install fonttools
    .venv/bin/python scripts/subset-fonts.py

Sources are downloaded once into scripts/.font-cache (gitignored).
"""
import os
import re
import sys
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'scripts', '.font-cache')
OUT = os.path.join(ROOT, 'assets', 'fonts')
LOCALES = os.path.join(ROOT, 'src', 'i18n', 'locales')
GF = 'https://github.com/google/fonts/raw/main/ofl'

# name -> (source url, variable axes to pin or None, locales whose strings it must cover)
TARGETS = {
    'WobbyRound': (f'{GF}/nunito/Nunito%5Bwght%5D.ttf', {'wght': 900}, ['ru', 'vi']),
    'WobbyJA': (f'{GF}/mplusrounded1c/MPLUSRounded1c-ExtraBold.ttf', None, ['ja']),
    'WobbySC': (f'{GF}/notosanssc/NotoSansSC%5Bwght%5D.ttf', {'wght': 900}, ['zh-Hans']),
    'WobbyTC': (f'{GF}/notosanstc/NotoSansTC%5Bwght%5D.ttf', {'wght': 900}, ['zh-Hant']),
    'WobbyThai': (f'{GF}/notosansthai/NotoSansThai%5Bwdth,wght%5D.ttf', {'wght': 800, 'wdth': 100}, ['th']),
}

# Always kept: ASCII plus symbols the UI builds around translated text
EXTRA = ''.join(chr(c) for c in range(0x20, 0x7F)) + '·×✓★→%+–—…’‘“”«»¡¿°'


def locale_chars(code: str) -> str:
    with open(os.path.join(LOCALES, f'{code}.ts'), encoding='utf-8') as f:
        src = f.read()
    # Values are single-quoted string literals; keys are ASCII so including them is harmless
    return ''.join(re.findall(r"'((?:[^'\\]|\\.)*)'", src))


def fetch(url: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, os.path.basename(url).replace('%5B', '[').replace('%5D', ']'))
    if not os.path.exists(path):
        print(f'  downloading {url}')
        urllib.request.urlretrieve(url, path)
    return path


def build(name: str, url: str, axes, codes) -> None:
    font = TTFont(fetch(url))
    if axes:
        font = instancer.instantiateVariableFont(font, axes)
    text = EXTRA + ''.join(locale_chars(c) for c in codes)
    cmap = font.getBestCmap()
    missing = sorted({ch for ch in text if ord(ch) not in cmap and ch.isprintable() and not ch.isspace()})
    # Skip symbols the source font lacks (they fall back or are not drawn in that script)
    missing_locale = [ch for ch in missing if ch not in EXTRA]
    if missing_locale:
        print(f'  ! {name} lacks glyphs for: {"".join(missing_locale)}', file=sys.stderr)
        sys.exit(1)
    options = subset.Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.hinting = False
    sub = subset.Subsetter(options)
    sub.populate(text=text)
    sub.subset(font)
    # Give every subset a unique family so iOS/web register them side by side
    for rec in font['name'].names:
        if rec.nameID in (1, 4, 16):
            rec.string = name
        elif rec.nameID == 6:
            rec.string = f'{name}-Regular'
        elif rec.nameID in (2, 17):
            rec.string = 'Regular'
    out = os.path.join(OUT, f'{name}.ttf')
    font.save(out)
    print(f'  {name}.ttf  {os.path.getsize(out) // 1024} KB  ({len(set(text))} chars)')


if __name__ == '__main__':
    for n, (u, a, c) in TARGETS.items():
        build(n, u, a, c)
