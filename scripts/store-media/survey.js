#!/usr/bin/env node
// Prints the timeline of the seeded run (events, zones, fever, baby flamingos, saves) so the
// screenshot and clip times in scenes.js can be re-picked after gameplay changes.
const { open } = require('./lib');
const { startRun } = require('./shots');
const { SEED, PLAY } = require('./scenes');

(async () => {
  const { browser, page } = await open({ seed: SEED });
  await page.waitForTimeout(1500);
  await startRun(page, PLAY);
  const lines = await page.evaluate(() => {
    const out = [];
    const last = { ev: -1, biome: 0, chicks: 0, fever: 0, weather: 0, items: 0, dodges: 0, saves: 0, done: 0 };
    const EV = { '00': 'rock', '01': 'branch', '02': 'gull', 10: 'gust', 11: 'quake', 12: 'ice', 20: 'centered', 21: 'storm', 22: 'lean', 30: 'sprint', 31: 'slow', 32: 'coin rain' };
    globalThis.__wobbyFF(60 * 200, (s) => {
      const tag = (m) => out.push(`${s.t.toFixed(1)} s  ${Math.floor(s.meters)} m  ${m}`);
      const ev = s.evStage === 2 ? `${s.evType}${s.evSub}` : -1;
      if (ev !== last.ev) {
        if (ev !== -1) tag(`event: ${EV[ev]} (dir ${s.evDir})`);
        last.ev = ev;
      }
      if (s.biome !== last.biome) tag(`zone ${(last.biome = s.biome)}`);
      if (s.chicks !== last.chicks) tag(`baby flamingos: ${(last.chicks = s.chicks)}`);
      const fever = s.feverT > 0 ? 1 : 0;
      if (fever !== last.fever) tag((last.fever = fever) ? 'FEVER on' : 'fever off');
      const weather = s.weatherAmt > 0.5 ? s.weather : 0;
      if (weather !== last.weather) tag(`weather ${(last.weather = weather)}`);
      if (s.itemsCollected !== last.items) tag(`item ${(last.items = s.itemsCollected)}`);
      if (s.dodges !== last.dodges) tag(`dodge ${(last.dodges = s.dodges)}`);
      if (s.nearMisses !== last.saves) tag(`nice save ${(last.saves = s.nearMisses)}`);
      if (s.challengesDone !== last.done) tag(`challenge cleared ${(last.done = s.challengesDone)}`);
      if (s.hurtT > 0.95) tag('HIT');
      return false;
    });
    const s = globalThis.__wobby.sim.value;
    out.push(s.mode === 1 ? 'still walking at the end' : `the run ended at ${s.t.toFixed(1)} s`);
    return out;
  });
  console.log(lines.join('\n'));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
