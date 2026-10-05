const { CHROME, URL, playwright } = require('./paths');

/** A returning player's save, so captures skip the tutorial and show coins, skins and a best score. */
function storage() {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    '@flamingo_walk_first_played': 'true',
    '@wobby_progress_v1': JSON.stringify({
      version: 2,
      wallet: 1502,
      lifetimeCoins: 4200,
      ownedSkins: ['default', 'arctic', 'sunset'],
      runs: 42,
      upgrades: { magnet: 1, fever: 1, luck: 1, balloon: 0 },
      streak: { lastDay: day, count: 3 },
    }),
    '@wobby_best_score_v2': '7124',
    '@wobby_best_distance_v2': '375',
  };
}

/** Opens the capture build in headless Chrome (GPU on, so Skia renders at full speed). */
async function open({ lang = 'en', width = 956, height = 440, dsf = 1, seed = 0 } = {}) {
  const browser = await playwright().chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--allow-file-access-from-files'],
  });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await page.addInitScript(
    ({ st, sd }) => {
      for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v);
      if (sd) globalThis.__wobbySeed = sd;
    },
    { st: storage(), sd: seed },
  );
  await page.goto(`${URL}/?lang=${lang}`);
  await page.waitForFunction(() => globalThis.__wobby, null, { timeout: 30000 });
  return { browser, page, errors };
}

/** Two animation frames: enough for Skia and React to draw the current simulation state. */
const settle = (page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

module.exports = { open, settle, storage };
