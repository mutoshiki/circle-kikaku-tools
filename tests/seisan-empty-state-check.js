const fs = require('fs');
const path = require('path');
const { readSettlementTemplateBundle } = require('./helpers/read-project');

const root = path.join(__dirname, '..');
const js = [
  readSettlementTemplateBundle(),
  'assets/js/features/settlement.js',
  'assets/js/features/settlement/03-render.js',
  'assets/js/app.js'
].map(item => item.includes('\n') ? item : fs.readFileSync(path.join(root, item), 'utf8')).join('\n');

const settlementTemplate = readSettlementTemplateBundle();

if (!settlementTemplate.includes('class="seisan-btn" type="button" data-action="open-settlement-settings">人数だけで精算</button>')) {
  throw new Error('人数だけで精算 should use the secondary/default button style in the empty state.');
}

if (!settlementTemplate.includes('class="seisan-btn primary" type="button" data-action="open-batch">参加者登録を開く</button>')) {
  throw new Error('参加者登録を開く should use the primary button style in the empty state.');
}

const required = [
  'function toggleSettlementEmptyState',
  'seisan-empty-state',
  'まずは参加者登録から',
  'seisan-empty-or',
  'もしくは',
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
