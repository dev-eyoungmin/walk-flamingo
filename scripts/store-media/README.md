# Store media

Builds the App Store screenshots and the app preview video for every game language from the real
game: a seeded run is played by a small bot through the normal inputs, stopped at fixed moments
for screenshots and stepped frame by frame for the video. Output goes to `store/apple/`, where
`store.config.json` (EAS Metadata) picks it up.

## Run

```sh
sh scripts/store-media/setup-web.sh      # terminal 1: builds and serves the capture build
node scripts/store-media/make.js         # terminal 2: all 13 languages, about 3 minutes each
node scripts/store-media/make.js ja th   # or just some of them; --no-video for screenshots only
```

Needs `ffmpeg`, Chrome for Testing from Playwright (`npx playwright install chromium`; set
`STORE_MEDIA_CHROME` if the revision in `paths.js` is not the installed one) and the full fonts
in `scripts/.font-cache` (run `scripts/subset-fonts.py` once to download them).

## Files

- `web-capture.patch` — applied to a temporary copy only: a web entry point, the iPhone margins,
  seeded runs, and hooks to freeze, fast-forward and drive the simulation. Regenerate it with
  `diff -u` if one of the patched files changes and it no longer applies.
- `scenes.js` — the seed, screenshot times and video clips. After gameplay changes run
  `node scripts/store-media/survey.js` to see when things happen and pick new times.
- `captions.js` — one caption per scene and language.
- `bot.js` — the player. It never touches the simulation state, only the input.

The preview videos are about 12 MB each and are not committed (see `.gitignore`); `eas
metadata:push` skips a preview whose file is missing and leaves the one on App Store Connect.
