const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testsDir = __dirname;
const skip = new Set([
  'run-static-tests.js',
  'basic-ui.spec.js',
  // Theme/appearance picker was intentionally removed in the single-theme build.
  'appearance-done-visible-check.js',
  'appearance-footer-check.js',
  'guide-theme-preview-check.js',
  'theme-control-token-scope-check.js',
  'theme-preset-renderer-check.js',
  'theme-primary-text-fix-check.js'
]);
const files = fs.readdirSync(testsDir)
  .filter(name => name.endsWith('.js') && !name.endsWith('.spec.js') && !skip.has(name))
  .sort();

for (const file of files) {
  const full = path.join(testsDir, file);
  console.log(`RUN ${file}`);
  const result = spawnSync(process.execPath, [full], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Static test suite OK (${files.length} files)`);
