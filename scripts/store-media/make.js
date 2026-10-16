#!/usr/bin/env node
// Builds the App Store screenshots and preview video for the given game languages (default: all)
// and copies them into store/apple/. See README.md for the one-time setup.
//   node scripts/store-media/make.js            every language
//   node scripts/store-media/make.js ja th      only these
//   node scripts/store-media/make.js --no-video screenshots only
//   node scripts/store-media/make.js --ipad     13" iPad screenshots (no video)
//   node scripts/store-media/make.js --android  Google Play phone screenshots (store/google/)
const fs = require('fs');
const path = require('path');
const { ROOT, WORK } = require('./paths');
const { DEVICES } = require('./scenes');
const CAPTIONS = require('./captions');
const shots = require('./shots');
const video = require('./video');
const { compose } = require('./compose');

/** English lives in the en-US folder that the first release used; other languages use their code. */
const folder = (lang) => (lang === 'en' ? 'en-US' : lang);

(async () => {
  const args = process.argv.slice(2);
  const device = args.includes('--ipad') ? 'ipad' : args.includes('--android') ? 'android' : 'iphone';
  const withVideo = device === 'iphone' && !args.includes('--no-video');
  const langs = args.filter((a) => !a.startsWith('--'));
  for (const lang of langs.length ? langs : Object.keys(CAPTIONS)) {
    if (!CAPTIONS[lang]) throw new Error(`No captions for "${lang}" (see captions.js)`);
    const started = Date.now();
    await shots.run(lang, { device });
    const out = path.join(WORK, 'out', device, lang);
    fs.rmSync(out, { recursive: true, force: true });
    await compose([lang], device);
    const shotDir =
      device === 'android'
        ? path.join(ROOT, 'store/google/screenshot', lang)
        : path.join(ROOT, 'store/apple/screenshot', folder(lang), DEVICES[device].folder);
    fs.rmSync(shotDir, { recursive: true, force: true });
    fs.mkdirSync(shotDir, { recursive: true });
    for (const f of fs.readdirSync(out)) fs.copyFileSync(path.join(out, f), path.join(shotDir, f));
    if (withVideo) {
      await video.capture(lang);
      const previewDir = path.join(ROOT, 'store/apple/preview', folder(lang));
      fs.mkdirSync(previewDir, { recursive: true });
      fs.copyFileSync(video.encode(lang), path.join(previewDir, 'IPHONE_67.mp4'));
    }
    console.log(`${lang}: done in ${Math.round((Date.now() - started) / 1000)} s`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
