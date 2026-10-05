#!/usr/bin/env node
// Builds the App Store screenshots and preview video for the given game languages (default: all)
// and copies them into store/apple/. See README.md for the one-time setup.
//   node scripts/store-media/make.js            every language
//   node scripts/store-media/make.js ja th      only these
//   node scripts/store-media/make.js --no-video screenshots only
const fs = require('fs');
const path = require('path');
const { ROOT, WORK } = require('./paths');
const CAPTIONS = require('./captions');
const shots = require('./shots');
const video = require('./video');
const { compose } = require('./compose');

/** English lives in the en-US folder that the first release used; other languages use their code. */
const folder = (lang) => (lang === 'en' ? 'en-US' : lang);

(async () => {
  const args = process.argv.slice(2);
  const withVideo = !args.includes('--no-video');
  const langs = args.filter((a) => !a.startsWith('--'));
  for (const lang of langs.length ? langs : Object.keys(CAPTIONS)) {
    if (!CAPTIONS[lang]) throw new Error(`No captions for "${lang}" (see captions.js)`);
    const started = Date.now();
    await shots.run(lang);
    fs.rmSync(path.join(WORK, 'out', lang), { recursive: true, force: true });
    await compose([lang]);
    const shotDir = path.join(ROOT, 'store/apple/screenshot', folder(lang), 'APP_IPHONE_67');
    fs.rmSync(shotDir, { recursive: true, force: true });
    fs.mkdirSync(shotDir, { recursive: true });
    for (const f of fs.readdirSync(path.join(WORK, 'out', lang))) fs.copyFileSync(path.join(WORK, 'out', lang, f), path.join(shotDir, f));
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
