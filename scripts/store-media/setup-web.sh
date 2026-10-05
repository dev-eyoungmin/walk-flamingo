#!/bin/sh
# One-time setup for the store media scripts: builds a web version of the game with capture hooks
# in a temporary copy (the app itself ships no web support) and serves it on :8123.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${STORE_MEDIA_WORK:-${TMPDIR:-/tmp}/wobby-store-media}"
WEB="$WORK/web"

rm -rf "$WEB"
mkdir -p "$WEB"
rsync -a --exclude node_modules --exclude ios --exclude android --exclude .git --exclude .expo --exclude dist --exclude store "$ROOT/" "$WEB/"
cd "$WEB"
patch -p1 < "$ROOT/scripts/store-media/web-capture.patch"
node -e "const p=require('./package.json');p.main='index';require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"
pnpm add react-dom@19.1.0 react-native-web@~0.21.0 @expo/metro-runtime@~6.1.2
cp node_modules/canvaskit-wasm/bin/full/canvaskit.wasm public/
npx expo export --platform web --output-dir dist

cd "$WORK"
[ -d node_modules/playwright-core ] || npm install --no-save --prefix "$WORK" playwright-core
echo "Serving the capture build on http://localhost:8123 (Ctrl+C to stop)"
python3 -m http.server 8123 --directory "$WEB/dist"
