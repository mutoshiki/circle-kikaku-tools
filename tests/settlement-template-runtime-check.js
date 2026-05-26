const assert = require('assert');
const vm = require('vm');
const { readText } = require('./helpers/read-project');

const files = [
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

const context = {
  console: { warn() {} },
  window: {
    escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    },
    SanpoApp: {
      templates: {},
      registerTemplates(name, templates) {
        this.templates[name] = templates;
      }
    }
  }
};
context.window.window = context.window;
vm.createContext(context);

for (const file of files) {
  vm.runInContext(readText(file), context, { filename: file });
}

const templates = context.window.SanpoApp.templates.settlement;
const publicNames = [
  'summary',
  'settingSummary',
  'renderIssues',
  'carRow',
  'cars',
  'extraRow',
  'collection',
  'driverPay',
  'breakdown',
  'emptyState',
  'routePrivateOriginView',
  'routePrivateOriginEdit',
  'routeStopRow',
  'routeCandidateButton'
];
for (const name of publicNames) {
  assert.strictEqual(typeof templates[name], 'function', `${name} should be registered as a function`);
}

assert(templates.summary({ expectedCollected: 1000, perPerson: 500, payerCount: 2, accounting: 0, driverTotal: 1000, cars: [{ name: 'A' }] }).includes('seisan-summary-card'), 'summary template should render after split');
assert(templates.emptyState().includes('人数だけで精算'), 'empty state template should render after split');
assert(templates.routeCandidateButton('上高地').includes('data-route-candidate'), 'route candidate template should render after split');

const driverPayHtml = templates.driverPay({
  result: {
    cars: [{
      name: '武藤俊樹',
      gas: 2125,
      extras: [{ name: '駐車場代', amount: 200, amountValue: 200, type: 'split' }],
      collectionOffset: 600,
      driverRound: 75,
      totalPay: 1725,
      adjustedTotalPay: 1800
    }]
  },
  state: { driverPaid: { '武藤俊樹': true } },
  helpers: { yen: value => `¥${Number(value || 0).toLocaleString()}` }
});
assert(driverPayHtml.includes('seisan-driver-pay-row'), 'driverPay should render the payment checklist row');
assert(driverPayHtml.includes('駐車場代') && driverPayHtml.includes('端数処理分'), 'driverPay should render cost details without ReferenceError');
assert(driverPayHtml.includes('checked'), 'driverPay should reflect checked payment state');

console.log('Settlement template runtime check OK');
