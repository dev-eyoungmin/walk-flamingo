// Captioned store screenshots (caption band + framed game shot), the search-result hero shot and the
// video caption overlays.
const fs = require('fs');
const path = require('path');
const { ROOT, WORK, CHROME, LATIN_FONT, FONT_CACHE, playwright } = require('./paths');
const CAPTIONS = require('./captions');
const { SHOT_NAMES, CLIPS, DEVICES } = require('./scenes');

// Caption fonts are the full versions of the in-game display fonts (the bundled ones are subsets)
const FONT = {
  latin: ["'Lilita'", 400],
  round: ["'Nunito'", 900],
  ja: ["'MPlus'", 800],
  sc: ["'NotoSC'", 900],
  tc: ["'NotoTC'", 900],
  th: ["'NotoThai'", 800],
};
const FONT_FOR = { en: 'latin', es: 'latin', 'pt-BR': 'latin', de: 'latin', fr: 'latin', it: 'latin', id: 'latin', ru: 'round', vi: 'round', ja: 'ja', 'zh-Hans': 'sc', 'zh-Hant': 'tc', th: 'th' };
const FONT_CSS = `
@font-face { font-family: 'Lilita'; src: url('file://${LATIN_FONT}'); }
@font-face { font-family: 'Nunito'; font-weight: 200 1000; src: url('file://${FONT_CACHE}/Nunito[wght].ttf'); }
@font-face { font-family: 'MPlus'; font-weight: 800; src: url('file://${FONT_CACHE}/MPLUSRounded1c-ExtraBold.ttf'); }
@font-face { font-family: 'NotoSC'; font-weight: 100 900; src: url('file://${FONT_CACHE}/NotoSansSC[wght].ttf'); }
@font-face { font-family: 'NotoTC'; font-weight: 100 900; src: url('file://${FONT_CACHE}/NotoSansTC[wght].ttf'); }
@font-face { font-family: 'NotoThai'; font-weight: 100 900; src: url('file://${FONT_CACHE}/NotoSansThai[wdth,wght].ttf'); }
`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Shrinks the caption until it fits on one line
const fit = (max, size, min) =>
  `<script>document.fonts.ready.then(()=>{const t=document.getElementById('t');let s=${size};while(t.getBoundingClientRect().width>${max}&&s>${min}){s-=1;t.style.fontSize=s+'px';}document.body.dataset.ready='1'})</script>`;

function shotHtml(lang, caption, img, device) {
  const [family, weight] = FONT[FONT_FOR[lang]];
  const { canvas: [W, H], caption: capH, frame: [fw, fh] } = DEVICES[device];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
  body{background:linear-gradient(120deg,#FF5C8F 0%,#FF86A8 45%,#FFB199 100%);position:relative}
  .dots{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.16) 9px,transparent 10px);background-size:120px 120px;background-position:30px 20px}
  .cap{position:absolute;left:0;right:0;top:0;height:${capH}px;display:flex;align-items:center;justify-content:center}
  .cap span{font-family:${family};font-weight:${weight};font-size:150px;line-height:1;color:#fff;white-space:nowrap;letter-spacing:1px;
    -webkit-text-stroke:22px #3A1535;paint-order:stroke fill;text-shadow:0 12px 0 #3A1535}
  /* The frame runs off the bottom edge, which crops the empty strip under the controls */
  .frame{position:absolute;left:${(W - fw) / 2}px;top:${capH}px;width:${fw}px;height:${fh}px;border-radius:64px;overflow:hidden;
    box-shadow:0 0 0 14px #fff,0 30px 90px rgba(90,0,50,.45)}
  .frame img{width:100%;height:100%;display:block}
  </style></head><body><div class="dots"></div><div class="cap"><span id="t">${esc(caption)}</span></div>
  <div class="frame"><img src="file://${img}"></div>${fit(fw + 80, 150, 60)}</body></html>`;
}

// The hero tagline is the App Store subtitle of the matching store locale
const STORE_LOCALE = { en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR' };
const subtitle = (lang) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'store.config.json'), 'utf8')).apple.info[STORE_LOCALE[lang] ?? lang].subtitle;
/** Game shot behind the hero title */
const HERO_SHOT = '3-chicks';

/**
 * First screenshot, the one App Store search results show: icon, the name and the subtitle large
 * enough to read at thumbnail size, next to (or above, on iPad) a tilted game shot.
 */
function heroHtml(lang, img, device) {
  const [family, weight] = FONT[FONT_FOR[lang]];
  const { canvas: [W, H] } = DEVICES[device];
  const tall = W / H < 1.6;
  const textW = tall ? W - 240 : W * 0.34;
  const shotW = tall ? W * 0.64 : W * 0.5;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
  body{background:linear-gradient(120deg,#FF5C8F 0%,#FF86A8 45%,#FFB199 100%);position:relative;display:flex;
    flex-direction:${tall ? 'column' : 'row'};align-items:center;justify-content:center;gap:${tall ? 80 : 110}px}
  .dots{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.16) 9px,transparent 10px);background-size:120px 120px;background-position:30px 20px}
  .text{position:relative;width:${textW}px;display:flex;flex-direction:column;align-items:${tall ? 'center' : 'flex-start'};text-align:${tall ? 'center' : 'left'}}
  .head{display:flex;align-items:center;gap:44px}
  .icon{width:${tall ? 230 : 250}px;height:${tall ? 230 : 250}px;border-radius:24%;box-shadow:0 0 0 10px #fff,0 18px 50px rgba(90,0,50,.4)}
  .name{font-family:'Lilita';font-size:${tall ? 230 : 210}px;line-height:.95;color:#fff;-webkit-text-stroke:24px #3A1535;paint-order:stroke fill;text-shadow:0 14px 0 #3A1535}
  .sub{margin-top:${tall ? 50 : 70}px;font-family:${family};font-weight:${weight};font-size:96px;line-height:1.15;color:#fff;
    -webkit-text-stroke:16px #3A1535;paint-order:stroke fill}
  .shot{position:relative;width:${shotW}px;border-radius:56px;overflow:hidden;transform:rotate(${tall ? -1.5 : 3}deg);
    box-shadow:0 0 0 14px #fff,0 30px 90px rgba(90,0,50,.45)}
  .shot img{width:100%;display:block}
  </style></head><body><div class="dots"></div>
  <div class="text"><div class="head"><img class="icon" src="file://${path.join(ROOT, 'assets/icon.png')}">
  ${tall ? '<div class="name">Wobbly Flamingo</div>' : ''}</div>
  ${tall ? '' : '<div class="name" style="margin-top:50px">Wobbly<br>Flamingo</div>'}
  <div class="sub" id="t">${esc(subtitle(lang))}</div></div>
  <div class="shot"><img src="file://${img}"></div>
  <script>document.fonts.ready.then(()=>{const t=document.getElementById('t');let s=96;while((t.scrollWidth>${textW}||t.getBoundingClientRect().height>${tall ? 130 : 240})&&s>50){s-=2;t.style.fontSize=s+'px';}document.body.dataset.ready='1'})</script>
  </body></html>`;
}

function overlayHtml(lang, caption) {
  const [family, weight] = FONT[FONT_FOR[lang]];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}
  html,body{margin:0;width:1920px;height:886px;overflow:hidden;background:transparent}
  /* Bottom strip: the only part of the play screen the HUD never uses */
  .cap{position:absolute;left:0;right:0;bottom:16px;display:flex;justify-content:center}
  .cap span{font-family:${family};font-weight:${weight};font-size:62px;line-height:1;color:#fff;white-space:nowrap;padding:18px 44px 20px;border-radius:60px;
    background:rgba(43,22,48,.82);box-shadow:0 0 0 5px rgba(255,255,255,.9), 0 10px 24px rgba(0,0,0,.25)}
  </style></head><body><div class="cap"><span id="t">${esc(caption)}</span></div>${fit(1500, 62, 30)}</body></html>`;
}

/**
 * WORK/raw/<device>/<lang>/*.png → WORK/out/<device>/<lang>/0N-name.jpg, plus WORK/ov/<lang>/N.png
 * for the video (iPhone only: the preview video is iPhone-sized).
 */
async function compose(langs, device = 'iphone') {
  const [W, H] = DEVICES[device].canvas;
  const scale = DEVICES[device].scale ?? 1;
  const browser = await playwright().chromium.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] });
  const tmp = path.join(WORK, `compose-${process.pid}.html`);
  for (const lang of langs) {
    const shots = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
    let page = await shots.newPage();
    const out = path.join(WORK, 'out', device, lang);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(tmp, heroHtml(lang, path.join(WORK, 'raw', device, lang, `${HERO_SHOT}.png`), device));
    await page.goto('file://' + tmp);
    await page.waitForFunction(() => document.body.dataset.ready === '1' && [...document.images].every((im) => im.complete && im.naturalWidth > 0));
    await page.screenshot({ path: path.join(out, '00-hero.jpg'), type: 'jpeg', quality: 93 });
    for (let i = 0; i < SHOT_NAMES.length; i++) {
      fs.writeFileSync(tmp, shotHtml(lang, CAPTIONS[lang][i], path.join(WORK, 'raw', device, lang, `${SHOT_NAMES[i]}.png`), device));
      await page.goto('file://' + tmp);
      await page.waitForFunction(() => document.body.dataset.ready === '1' && [...document.images].every((im) => im.complete && im.naturalWidth > 0));
      await page.screenshot({ path: path.join(out, `0${i + 1}-${SHOT_NAMES[i].slice(2)}.jpg`), type: 'jpeg', quality: 93 });
    }
    await shots.close();
    if (device !== 'iphone') continue;
    const overlays = await browser.newContext({ viewport: { width: 1920, height: 886 }, deviceScaleFactor: 1 });
    page = await overlays.newPage();
    fs.mkdirSync(path.join(WORK, 'ov', lang), { recursive: true });
    for (let i = 0; i < CLIPS.length; i++) {
      fs.writeFileSync(tmp, overlayHtml(lang, CAPTIONS[lang][i]));
      await page.goto('file://' + tmp);
      await page.waitForFunction(() => document.body.dataset.ready === '1');
      await page.screenshot({ path: path.join(WORK, 'ov', lang, `${i + 1}.png`), omitBackground: true });
    }
    await overlays.close();
  }
  fs.rmSync(tmp, { force: true });
  await browser.close();
}

module.exports = { compose };
