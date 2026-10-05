// Shared locations for the store media scripts. Everything temporary lives in WORK, outside the repo.
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const WORK = process.env.STORE_MEDIA_WORK || path.join(os.tmpdir(), 'wobby-store-media');

module.exports = {
  ROOT,
  WORK,
  /** Where setup-web.sh serves the capture build */
  URL: process.env.STORE_MEDIA_URL || 'http://localhost:8123',
  /** Chrome for Testing downloaded by Playwright (`npx playwright install chromium`) */
  CHROME:
    process.env.STORE_MEDIA_CHROME ||
    path.join(
      os.homedir(),
      'Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    ),
  BGM: path.join(ROOT, 'assets/music/bgm.wav'),
  LATIN_FONT: path.join(ROOT, 'assets/fonts/LilitaOne-Regular.ttf'),
  /** Full (not subset) fonts fetched by scripts/subset-fonts.py */
  FONT_CACHE: path.join(ROOT, 'scripts/.font-cache'),
  /** playwright-core is installed into WORK by setup-web.sh, not into the app's dependencies */
  playwright: () => require(require.resolve('playwright-core', { paths: [WORK] })),
};
