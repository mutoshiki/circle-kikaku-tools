const fs = require('fs');
const path = require('path');

const js = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'app.js'), 'utf8');

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

console.log('Inline event cleanup check OK');
