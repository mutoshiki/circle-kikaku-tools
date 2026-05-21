const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cssFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.css')) cssFiles.push(full);
  }
}
walk(path.join(root, 'assets', 'css'));

const css = cssFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');

if (!/\.modal-backdrop\s*\{[^}]*z-index:\s*var\(--z-modal-backdrop\)/s.test(css)) {
  console.error('modal-backdrop must use --z-modal-backdrop.');
  process.exit(1);
}

if (!/\.modal\s*\{[^}]*z-index:\s*var\(--z-modal\)/s.test(css)) {
  console.error('modal must use --z-modal, not a local z-index token.');
  process.exit(1);
}

if (/\.modal-backdrop\s*\{[^}]*z-index:\s*var\(--z-modal\)/s.test(css)) {
  console.error('modal-backdrop cannot share --z-modal because it will cover the dialog.');
  process.exit(1);
}

if (/\.modal\s*\{[^}]*z-index:\s*var\(--z-local-/s.test(css)) {
  console.error('modal cannot use local z-index tokens because the backdrop may block taps.');
  process.exit(1);
}

console.log('Modal z-layer guard OK');
