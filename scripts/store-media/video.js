// App preview (1920x886, 30 fps): the real simulation stepped frame by frame, cut into captioned clips.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { WORK, BGM } = require('./paths');
const { open, settle } = require('./lib');
const { startRun } = require('./shots');
const { SEED, CLIPS, PLAY } = require('./scenes');

const CROSSFADE = 0.25;
const END_CARD = 1.8;
const frameCount = ([a, b]) => Math.round((b - a) * 30);

async function capture(lang) {
  const dir = path.join(WORK, 'frames', lang);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // 960x443 at 2x is the 1920x886 the App Store wants; the layout matches a 6.9" iPhone
  const { browser, page, errors } = await open({ lang, width: 960, height: 443, dsf: 2, seed: SEED });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/end.png` });
  await startRun(page, [PLAY[0] + 3, PLAY[1] + 2]);
  for (let c = 0; c < CLIPS.length; c++) {
    fs.mkdirSync(`${dir}/c${c + 1}`);
    await page.evaluate((tt) => globalThis.__wobbyFF(1e6, (s) => s.t >= tt), CLIPS[c][0]);
    await settle(page);
    await settle(page);
    for (let f = 0; f < frameCount(CLIPS[c]); f++) {
      await page.evaluate(() => globalThis.__wobbyFF(2)); // two 1/60 s steps per video frame
      await settle(page);
      await page.screenshot({ path: `${dir}/c${c + 1}/${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 97 });
    }
    const mode = await page.evaluate(() => globalThis.__wobby.sim.value.mode);
    if (mode !== 1) throw new Error(`${lang}: the run ended during clip ${c + 1}`);
  }
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
}

/** Clips + caption overlays (WORK/ov/<lang>/N.png) + title-screen end card + music → WORK/video/<lang>.mp4 */
function encode(lang) {
  const dir = path.join(WORK, 'frames', lang);
  const out = path.join(WORK, 'video', `${lang}.mp4`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const n = CLIPS.length;
  const durs = CLIPS.map((c) => frameCount(c) / 30);
  const args = ['-v', 'error', '-y'];
  for (let c = 0; c < n; c++) args.push('-framerate', '30', '-i', `${dir}/c${c + 1}/%04d.jpg`);
  for (let c = 0; c < n; c++) args.push('-loop', '1', '-framerate', '30', '-t', String(durs[c]), '-i', path.join(WORK, 'ov', lang, `${c + 1}.png`));
  args.push('-loop', '1', '-framerate', '30', '-t', String(END_CARD), '-i', `${dir}/end.png`);
  args.push('-stream_loop', '-1', '-i', BGM);
  let graph = '';
  for (let c = 0; c < n; c++) {
    graph += `[${n + c}:v]format=rgba,fade=t=in:st=0.1:d=0.3:alpha=1[o${c}];`;
    graph += `[${c}:v][o${c}]overlay=0:0:shortest=1,format=yuv420p,setsar=1,fps=30[v${c}];`;
  }
  graph += `[${2 * n}:v]scale=1920:886,format=yuv420p,setsar=1,fps=30[v${n}];`;
  let prev = 'v0';
  let offset = 0;
  for (let c = 1; c <= n; c++) {
    offset += durs[c - 1] - CROSSFADE;
    graph += `[${prev}][v${c}]xfade=transition=fade:duration=${CROSSFADE}:offset=${offset.toFixed(4)}[x${c}];`;
    prev = `x${c}`;
  }
  const total = durs.reduce((a, b) => a + b, 0) - CROSSFADE * n + END_CARD;
  graph += `[${2 * n + 1}:a]atrim=0:${total.toFixed(3)},afade=t=in:d=0.3,afade=t=out:st=${(total - 1.2).toFixed(3)}:d=1.2,aresample=48000,aformat=channel_layouts=stereo[a]`;
  // App preview spec: H.264 High 4.0, 30 fps, stereo AAC, 15–30 s
  args.push('-filter_complex', graph, '-map', `[${prev}]`, '-map', '[a]', '-t', total.toFixed(3));
  args.push('-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-r', '30', '-crf', '18', '-maxrate', '10M', '-bufsize', '20M', '-preset', 'slow');
  args.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', out);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

module.exports = { capture, encode };
