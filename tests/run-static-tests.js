const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testsDir = __dirname;
const skip = new Set([
  'run-static-tests.js',
  'serve-static.js',
  'basic-ui.spec.js',
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
