const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const js = [
  'assets/js/templates/settlement-templates.js',
  'assets/js/features/settlement.js',
  'assets/js/features/settlement/03-render.js',
  'assets/js/app.js'
].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

const required = [
  'function toggleSettlementEmptyState',
  'seisan-empty-state',
  'まずは参加者登録から',
  'ここに精算画面が表示されます。',
  'data-action="open-batch"',
  'wrap.hidden = isEmpty',
  'if (!hasParticipants) {'
];

for (const text of required) {
  if (!js.includes(text)) {
    throw new Error(`Missing settlement empty state requirement: ${text}`);
  }
}

console.log('Settlement empty state check OK');
