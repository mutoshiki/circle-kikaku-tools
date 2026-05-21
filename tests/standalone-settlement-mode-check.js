const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const state = fs.readFileSync(path.join(root, 'assets/js/features/settlement/01-state.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const templates = fs.readFileSync(path.join(root, 'assets/js/templates/settlement-templates.js'), 'utf8');

const requiredStateSnippets = [
  "standalone: {",
  "function createStandaloneSettlementData",
  "settlementPlanName: '精算だけ'",
  "isStandaloneSettlement: true",
  "hasStandaloneSettlementCounts(state)",
  "state.standalone = normalizeStandaloneSettlementState"
];

for (const snippet of requiredStateSnippets) {
  if (!state.includes(snippet)) {
    throw new Error(`standalone settlement state is missing: ${snippet}`);
  }
}

const requiredIndexSnippets = [
  'id="seisanStandaloneEnabled"',
  'id="seisanStandaloneDriverCount"',
  'id="seisanStandaloneMemberCount"',
  '人数だけで精算する',
  'それ以外の人数'
];

for (const snippet of requiredIndexSnippets) {
  if (!index.includes(snippet)) {
    throw new Error(`standalone settlement controls are missing: ${snippet}`);
  }
}

const requiredTemplateSnippets = [
  '人数だけで精算',
  '車出し人数と、それ以外の人数だけ入れると',
  '入力方法',
  '精算だけ'
];

for (const snippet of requiredTemplateSnippets) {
  if (!templates.includes(snippet)) {
    throw new Error(`standalone settlement templates are missing: ${snippet}`);
  }
}

console.log('standalone settlement mode check OK');
