const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testsDir = __dirname;
const skip = new Set([
  'run-static-tests.js',
  'serve-static.js',
  'basic-ui.spec.js',
  // The themed build supersedes the old single-theme removal assertion.
  'single-theme-removal-check.js',
  // These legacy checks target a previous control-text repair implementation.
  'theme-control-token-scope-check.js',
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
