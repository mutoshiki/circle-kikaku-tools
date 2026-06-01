const fs = require('fs');
const path = require('path');
const { root, readText, listCssFiles } = require('./helpers/read-project');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const html = readText('index.html');
const linked = [...html.matchAll(/\.\/assets\/css\/([^\"]+\.css)/g)].map(match => match[1]);
const linkedSet = new Set(linked);
const allCss = listCssFiles().map(file => path.relative(path.join(root, 'assets/css'), file).replace(/\\/g, '/'));

for (const file of linked) {
  assert(fs.existsSync(path.join(root, 'assets/css', file)), `linked CSS is missing: ${file}`);
}

const allowedUnlinked = new Set([]);
for (const file of allCss) {
  assert(linkedSet.has(file) || allowedUnlinked.has(file), `unlinked CSS should be deleted or linked: ${file}`);
}

console.log('CSS link integrity check OK');
