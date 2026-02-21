const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Read files
const pkgPath = path.resolve(__dirname, '../package.json');
const appJsonPath = path.resolve(__dirname, '../app.json');

const pkg = require(pkgPath);
const appJson = require(appJsonPath);

// 2. Increment Version (Patch)
const currentVersion = pkg.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;

console.log(`🚀 Bumping version: ${currentVersion} -> ${newVersion}`);

// 3. Update package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '
');

// 4. Update app.json (version + versionCode + buildNumber)
appJson.expo.version = newVersion;
if (appJson.expo.android) {
  // Increment versionCode
  const oldCode = appJson.expo.android.versionCode || 1;
  appJson.expo.android.versionCode = oldCode + 1;
}
if (appJson.expo.ios) {
  // Sync buildNumber with version string
  appJson.expo.ios.buildNumber = newVersion;
}
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '
');

// 5. Git Commit & Push
try {
  console.log('📦 Committing version bump...');
  execSync(`git add package.json app.json`);
  execSync(`git commit -m "chore(release): v${newVersion}"`);
  
  console.log(`🏷️ Tagging v${newVersion}...`);
  execSync(`git tag v${newVersion}`);

  console.log('⬆️ Pushing to remote...');
  execSync(`git push && git push --tags`);

  console.log('✅ Release successful!');
} catch (error) {
  console.error('❌ Release failed:', error.message);
  process.exit(1);
}
