const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, '..', 'assets', 'css');
const files = fs.readdirSync(cssDir).filter(name => name.endsWith('.css'));
const offenders = [];

for (const file of files) {
  const text = fs.readFileSync(path.join(cssDir, file), 'utf8');
  if (text.includes('!important')) offenders.push(file);
}

if (offenders.length) {
  console.error('!important remains in:', offenders.join(', '));
  process.exit(1);
}

console.log('No !important check OK');
