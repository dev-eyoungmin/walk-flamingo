// Raw localized screenshots (2868x1320) of real game states, written to WORK/raw/<lang>/.
const fs = require('fs');
const path = require('path');
const { ROOT, WORK } = require('./paths');
const { open, settle } = require('./lib');
const installBot = require('./bot');
const { SEED, DRAMA, SHOTS, PLAY } = require('./scenes');

/** A string from the game's own translations (menu buttons are found by their label). */
function label(lang, key) {
  const src = fs.readFileSync(path.join(ROOT, 'src/i18n/locales', `${lang}.ts`), 'utf8');
  const m = src.match(new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*(['"])(.*?)\\1`));
  if (!m) throw new Error(`${lang}: no translation for ${key}`);
  return m[2].replace(/\\(['"])/g, '$1');
}

/** Freezes the title screen, pins the course position and starts a run played by the bot. */
async function startRun(page, [x, y]) {
  await page.evaluate(installBot);
  await page.evaluate((d) => {
    globalThis.__drama = d;
    globalThis.__wobbyFrozen = true;
    // The title screen scrolls in real time; start every run from the same spot
    globalThis.__wobby.sim.value.scrollX = 4000;
  }, DRAMA);
  await page.mouse.click(x, y);
  await page.waitForFunction(() => globalThis.__wobby.sim.value.mode === 1, null, { timeout: 10000 });
  await page.waitForTimeout(400);
}

async function run(lang, { menusOnly = false } = {}) {
  const out = path.join(WORK, 'raw', lang);
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, errors } = await open({ lang, dsf: 3, seed: SEED });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/7-start.png` });
  // Button widths follow the label, so the skins button sits somewhere else in every language
  await page.getByText(label(lang, 'common.skins'), { exact: true }).first().click({ force: true });
  await page.getByText(label(lang, 'skins.subtitle'), { exact: true }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/6-skins.png` });
  if (menusOnly) return browser.close();
  await page.reload();
  await page.waitForFunction(() => globalThis.__wobby, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  await startRun(page, PLAY);
  for (const [name, t] of [...SHOTS].sort((a, b) => a[1] - b[1])) {
    await page.evaluate((tt) => globalThis.__wobbyFF(1e6, (s) => s.t >= tt), t);
    await settle(page);
    await settle(page);
    await page.waitForTimeout(150);
    const mode = await page.evaluate(() => globalThis.__wobby.sim.value.mode);
    if (mode !== 1) throw new Error(`${lang}: the run ended before ${name} (t=${t})`);
    await page.screenshot({ path: `${out}/${name}.png` });
  }
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
}

module.exports = { run, startRun };
