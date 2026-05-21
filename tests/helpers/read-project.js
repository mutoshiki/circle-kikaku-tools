const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readCssBundle(rootDir = root) {
  const cssDir = path.join(rootDir, 'assets', 'css');
  return walk(cssDir)
    .filter(file => file.endsWith('.css'))
    .sort()
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');
}

function listCssFiles(rootDir = root) {
  const cssDir = path.join(rootDir, 'assets', 'css');
  return walk(cssDir).filter(file => file.endsWith('.css')).sort();
}

module.exports = { root, walk, readText, readCssBundle, listCssFiles };
