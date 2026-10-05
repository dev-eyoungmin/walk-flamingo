// Captioned store screenshots (caption band + framed game shot) and the video caption overlays.
const fs = require('fs');
const path = require('path');
const { WORK, CHROME, LATIN_FONT, FONT_CACHE, playwright } = require('./paths');
const CAPTIONS = require('./captions');
const { SHOT_NAMES, CLIPS } = require('./scenes');

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

function shotHtml(lang, caption, img) {
  const [family, weight] = FONT[FONT_FOR[lang]];
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}
  html,body{margin:0;width:2868px;height:1320px;overflow:hidden}
  body{background:linear-gradient(120deg,#FF5C8F 0%,#FF86A8 45%,#FFB199 100%);position:relative}
  .dots{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.16) 9px,transparent 10px);background-size:120px 120px;background-position:30px 20px}
  .cap{position:absolute;left:0;right:0;top:0;height:262px;display:flex;align-items:center;justify-content:center}
  .cap span{font-family:${family};font-weight:${weight};font-size:150px;line-height:1;color:#fff;white-space:nowrap;letter-spacing:1px;
    -webkit-text-stroke:22px #3A1535;paint-order:stroke fill;text-shadow:0 12px 0 #3A1535}
  /* The frame runs off the bottom edge, which crops the empty strip under the controls */
  .frame{position:absolute;left:164px;top:262px;width:2540px;height:1169px;border-radius:64px;overflow:hidden;
    box-shadow:0 0 0 14px #fff,0 30px 90px rgba(90,0,50,.45)}
  .frame img{width:100%;height:100%;display:block}
  </style></head><body><div class="dots"></div><div class="cap"><span id="t">${esc(caption)}</span></div>
  <div class="frame"><img src="file://${img}"></div>${fit(2620, 150, 60)}</body></html>`;
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

/** WORK/raw/<lang>/*.png → WORK/out/<lang>/0N-name.jpg, plus WORK/ov/<lang>/N.png for the video. */
async function compose(langs) {
  const browser = await playwright().chromium.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] });
  const tmp = path.join(WORK, `compose-${process.pid}.html`);
  for (const lang of langs) {
    const shots = await browser.newContext({ viewport: { width: 2868, height: 1320 }, deviceScaleFactor: 1 });
    let page = await shots.newPage();
    fs.mkdirSync(path.join(WORK, 'out', lang), { recursive: true });
    for (let i = 0; i < SHOT_NAMES.length; i++) {
      fs.writeFileSync(tmp, shotHtml(lang, CAPTIONS[lang][i], path.join(WORK, 'raw', lang, `${SHOT_NAMES[i]}.png`)));
      await page.goto('file://' + tmp);
      await page.waitForFunction(() => document.body.dataset.ready === '1' && [...document.images].every((im) => im.complete && im.naturalWidth > 0));
      await page.screenshot({ path: path.join(WORK, 'out', lang, `0${i + 1}-${SHOT_NAMES[i].slice(2)}.jpg`), type: 'jpeg', quality: 93 });
    }
    await shots.close();
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
