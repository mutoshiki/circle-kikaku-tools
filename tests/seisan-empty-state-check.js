const fs = require('fs');
const js = fs.readFileSync('assets/js/app.js', 'utf8');

const required = [
  'function toggleSettlementEmptyState',
  'seisan-empty-state',
  'まずは参加者登録から',
  'ここに精算画面が表示されます。',
  'data-action=\"open-batch\"',
  'wrap.hidden = isEmpty',
  'if (!hasParticipants) {'
];

for (const text of required) {
  if (!js.includes(text)) {
    throw new Error(`Missing settlement empty state requirement: ${text}`);
  }
}

console.log('Settlement empty state check OK');
