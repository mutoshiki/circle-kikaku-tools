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
  'clubExpenseBreakdown',
  'emptyState',
  'routeStopRow',
  'routeCandidateButton'
];
for (const name of publicNames) {
  assert.strictEqual(typeof templates[name], 'function', `${name} should be registered as a function`);
}

assert(templates.summary({ expectedCollected: 1000, perPerson: 500, payerCount: 2, accounting: 0, driverTotal: 1000, cars: [{ name: 'A' }] }).includes('seisan-summary-card'), 'summary template should render after split');
assert(templates.emptyState().includes('人数だけで精算'), 'empty state template should render after split');
assert(templates.routeCandidateButton('上高地').includes('data-route-candidate'), 'route candidate template should render after split');

const carSummaryHtml = templates.cars({
  data: { cars: [{ name: '武藤俊樹' }] },
  result: {
    cars: [{
      name: '武藤俊樹',
      gas: 2125,
      extras: [{ name: '駐車場代', amount: 200, amountValue: 200, type: 'split' }],
      totalPay: 2325
    }]
  },
  issues: { rows: new Set(), messages: [] },
  helpers: { yen: value => `¥${Number(value || 0).toLocaleString()}` }
});
assert(carSummaryHtml.includes('ガソリン代'), 'car summary should render gas cost');
assert(/ガソリン代[\s\S]*?<span class="seisan-amount-sign" aria-hidden="true">＋<\/span>/.test(carSummaryHtml), 'gas cost amount should show a plus sign like other positive cost rows');

const carEditHtml = templates.carRow({
  car: { name: '高橋 健介' },
  cState: { dist: '86', eco: '13.5', price: '172', rentalType: 'private' },
  calc: { gas: 1096, totalPay: 1000 },
  extras: [{ name: '駐車場', amount: '400', type: 'split' }],
  issues: { rows: new Set(), messages: [] },
  helpers: { yen: value => `¥${Number(value || 0).toLocaleString()}` }
});
assert(carEditHtml.includes('<div class="seisan-subhead"><strong>ガソリン代</strong>'), 'car editor should label the fuel inputs with the same heading format as expenses');
assert(!carEditHtml.includes('高橋 健介 車</strong>'), 'car editor should not repeat the driver name above the fuel inputs');

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
assert(driverPayHtml.includes('<span class="seisan-amount-sign" aria-hidden="true">＝</span>'), 'driver payment amount should show an equals sign before the total');
assert(driverPayHtml.includes('駐車場代') && driverPayHtml.includes('端数処理分'), 'driverPay should render cost details without ReferenceError');
assert(driverPayHtml.includes('checked'), 'driverPay should reflect checked payment state');

const clubBreakdownHtml = templates.clubExpenseBreakdown({
  cars: [{
    name: '小林 悠斗',
    extras: [{ name: '部費補助', amountValue: 500, type: 'club' }]
  }],
  totalDriverRound: 94,
  totalDriverCollectionOffset: 1500,
  surplus: -306,
  accounting: -600
}, {
  yen: value => `¥${Number(value || 0).toLocaleString()}`
});
assert(clubBreakdownHtml.includes('集金不足の補填'), 'negative collection surplus should be labeled as a shortage, not a surplus');
assert(!clubBreakdownHtml.includes('集金の端数余り'), 'shortage must not be described as leftover collection');
assert(clubBreakdownHtml.includes('<strong>¥-600</strong>'), 'club breakdown total should retain the accounting sign so rows add up to the displayed total');

console.log('Settlement template runtime check OK');
