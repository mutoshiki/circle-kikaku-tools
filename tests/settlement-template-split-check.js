const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { root, readText, readSettlementTemplateBundle } = require('./helpers/read-project');

const html = readText('index.html');
const bundle = readSettlementTemplateBundle();
const compat = readText('assets/js/templates/settlement-templates.js');

const splitFiles = [
  'assets/js/templates/settlement/00-template-utils.js',
  'assets/js/templates/settlement/01-cost-parts.js',
  'assets/js/templates/settlement/02-summary-templates.js',
  'assets/js/templates/settlement/04-extra-input-templates.js',
  'assets/js/templates/settlement/03-car-cost-templates.js',
  'assets/js/templates/settlement/05-collection-check-templates.js',
  'assets/js/templates/settlement/06-driver-pay-templates.js',
  'assets/js/templates/settlement/07-empty-state-templates.js',
  'assets/js/templates/settlement/08-route-helper-templates.js',
  'assets/js/templates/settlement/09-register-settlement-templates.js',
  'assets/js/templates/settlement-templates.js'
];

for (const file of splitFiles) {
  assert(fs.existsSync(path.join(root, file)), `missing split settlement template file: ${file}`);
  assert(html.includes(file), `index.html should load ${file}`);
}

for (let i = 0; i < splitFiles.length - 1; i += 1) {
  assert(html.indexOf(splitFiles[i]) < html.indexOf(splitFiles[i + 1]), `script order is wrong around ${splitFiles[i]}`);
}
assert(html.indexOf('assets/js/templates/settlement/09-register-settlement-templates.js') < html.indexOf('assets/js/features/settlement/01-state.js'), 'settlement templates must register before settlement feature state loads');

const publicNames = [
  'summary',
  'settingSummary',
  'renderIssues',
  'carRow',
  'cars',
  'collection',
  'driverPay',
  'breakdown',
  'emptyState',
  'routeStopRow',
  'routeCandidateButton'
];
for (const name of publicNames) {
  assert(bundle.includes(name), `split bundle should contain public template: ${name}`);
}
assert(bundle.includes("registerTemplates?.('settlement'"), 'split templates should keep the legacy settlement template registration API');
assert(bundle.includes('settlementTemplateParts'), 'split templates should share an internal settlementTemplateParts registry');
assert(bundle.includes('UI_CLASS.amount') && bundle.includes('UI_CLASS.chip') && bundle.includes('UI_CLASS.surfaceCard'), 'split templates should keep the shared CSS class contract');
assert(bundle.includes('function formatPaymentBadge') && bundle.includes('function formatCostBadge'), 'cost helpers should be split but still present');
assert(bundle.includes('function buildCollectionGroups') && bundle.includes('function routeCandidateButton'), 'checklist and route helper templates should be split but still present');

assert(compat.split(/\r?\n/).length <= 20, 'settlement-templates.js should stay a thin compatibility entry point');
assert(!compat.includes('function carSummary') && !compat.includes('function collectionItem'), 'settlement-templates.js should not contain the full old template implementation');

console.log('Settlement template split check OK');
