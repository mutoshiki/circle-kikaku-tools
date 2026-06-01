const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const jsFiles = walk(path.join(root, 'assets', 'js')).filter(file => file.endsWith('.js'));
const js = jsFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');

const forbidden = [
  'oninput="window.onSettlementInputDelayed()"',
  'onchange="window.onSettlementInput()"',
  'onclick="window.removeSettlementExtra',
  'onclick="window.addSettlementExtra',
  'oninput="window.onRouteStopsChangedDelayed()"',
  'onchange="window.onRouteStopsChanged()"',
  'onclick="window.removeRouteStop',
  'onclick="window.editRoutePrivateOrigin',
  'onclick="window.saveRoutePrivateOrigin'
];

const found = forbidden.filter(token => js.includes(token));
if (found.length) {
  console.error('Forbidden generated inline handlers remain:', found.join(', '));
  process.exit(1);
}

if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(html)) {
  console.error('index.html should not contain executable inline scripts');
  process.exit(1);
}

if (/\bon(?:click|change|input|submit|keypress)\s*=/i.test(html + '\n' + js)) {
  console.error('Inline handler markup remains in HTML or generated templates');
  process.exit(1);
}

const propertyHandler = /\.(?:onclick|onchange|oninput|onsubmit|onkeypress)\s*=/;
for (const file of jsFiles) {
  if (propertyHandler.test(fs.readFileSync(file, 'utf8'))) {
    console.error('DOM property event handler remains:', path.relative(root, file));
    process.exit(1);
  }
}

console.log('Inline event cleanup check OK');
