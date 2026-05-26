const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const modulesDir = path.join(root, 'assets', 'js', 'modules');
const forbidden = [
  'schema.js',
  'state.js',
  'storage.js',
  'utils.js',
  path.join('future', 'README.md'),
  path.join('future', 'schema.js'),
  path.join('future', 'state.js'),
  path.join('future', 'storage.js'),
  path.join('future', 'utils.js')
];

const existing = forbidden.filter(file => fs.existsSync(path.join(modulesDir, file)));
if (existing.length) {
  console.error('Unused modules still exist:', existing.join(', '));
  process.exit(1);
}

console.log('Unused module cleanup check OK');
