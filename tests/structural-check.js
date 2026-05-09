const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'assets', 'js', 'app.js');
const js = fs.readFileSync(appPath, 'utf8');

const required = [
  'renderSettlementView',
  'syncSettlementControls',
  'renderSettlementSummaryHtml',
  'renderSettlementCarRowHtml',
  'renderSettlementCarsHtml',
  'renderSettlementCollectionHtml',
  'renderSettlementDriverPayHtml',
  'renderSettlementBreakdownHtml',
  'renderSheetView',
  'renderSheetEmptyHtml',
  'createSheetLabelColumn',
  'renderSheetCarColumnHtml',
  'createSheetCarColumn',
  'renderSheetWaitingHtml',
  'createSheetWaitingColumn'
];

const missing = required.filter(name => !js.includes(`function ${name}(`));
if (missing.length) {
  console.error('Missing functions:', missing.join(', '));
  process.exit(1);
}

const settlement = js.match(/function renderSettlementView\(\) \{[\s\S]*?\n\}/)?.[0] || '';
const sheet = js.match(/function renderSheetView\(\) \{[\s\S]*?\n\}/)?.[0] || '';

if (!settlement.includes('renderSettlementCarsHtml') || !settlement.includes('renderSettlementCollectionHtml')) {
  console.error('renderSettlementView is not using split helpers.');
  process.exit(1);
}

if (!sheet.includes('createSheetCarColumn') || !sheet.includes('createSheetWaitingColumn')) {
  console.error('renderSheetView is not using split helpers.');
  process.exit(1);
}

console.log('Structural check OK');
