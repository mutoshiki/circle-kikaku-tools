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


const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const linkedCss = [...html.matchAll(/<link[^>]+href=["']\.\/assets\/css\/([^"']+\.css)["'][^>]*>/g)].map(match => match[1]);
let finalZModal = null;
let finalZBackdrop = null;
for (const rel of linkedCss) {
  const file = path.join(root, 'assets', 'css', rel);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/--z-modal(?:-backdrop)?\s*:\s*([0-9]+)/g)) {
    if (match[0].startsWith('--z-modal-backdrop')) {
      finalZBackdrop = Number(match[1]);
    } else {
      finalZModal = Number(match[1]);
    }
  }
}

if (!(Number.isFinite(finalZBackdrop) && Number.isFinite(finalZModal) && finalZModal > finalZBackdrop)) {
  console.error(`final z-index tokens must keep modal above backdrop: modal=${finalZModal}, backdrop=${finalZBackdrop}`);
  process.exit(1);
}

const componentContracts = fs.readFileSync(path.join(root, 'assets', 'css', 'components', '00-component-contracts.css'), 'utf8');
if (/--z-(?:modal|modal-backdrop|dropdown|tray)\s*:/.test(componentContracts)) {
  console.error('component contracts must not redefine app-level z-index tokens such as --z-modal, --z-dropdown or --z-tray.');
  process.exit(1);
}

console.log('Modal z-layer guard OK');
