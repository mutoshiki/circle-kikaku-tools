import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = rel => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const calculator = read('assets/js/features/settlement/02-calculator.js');
const summary = read('assets/js/templates/settlement/02-summary-templates.js');
const costParts = read('assets/js/templates/settlement/01-cost-parts.js');
const shareText = read('assets/js/features/settlement/06-share-text.js');
const settlementModule = read('assets/js/modules/settlement.js');
const gradeCss = read('assets/css/cars-members-tray/person-card/02-person-name-grade.css');
const sheetCss = read('assets/css/sheet-view/layout/01-sheet-frame.css');
const routeCss = read('assets/css/settlement/route-helper/01-route-shell.css');
const routeTemplate = read('assets/js/templates/settlement/08-route-helper-templates.js');
const index = read('index.html');

const context = {
  result: null,
  getParticipantList: data => data.participants,
  isDriverCollectionOffsetEnabled: state => state.driverCollectionOffset === true,
  isDriverCollectionFreeEnabled: state => state.driverCollectionFree === true,
  getNumberValue: value => Number(value) || 0,
  getDriverRewardAmount: () => 0,
  getDriverRewardType: () => 'split',
  ensureDriverRewardExtra: value => ({ dist: 0, eco: 0, price: 0, rentalType: '', extras: [], ...value }),
  isTimesRentalCar: () => false,
  getTimesDistanceFee: () => 0,
  normalizeExtraItem: value => value,
  hasMeaningfulExtra: () => true,
  isTimesDistanceFeeExtra: () => false,
  normalizeSettlementExtraType: value => value,
  isNegativeSettlementExtraType: value => value.endsWith('-minus'),
  getSignedSettlementExtraAmount: extra => extra.type.endsWith('-minus') ? -Math.abs(Number(extra.amount) || 0) : Number(extra.amount) || 0,
  getSettlementExtraBaseType: value => value.replace('-minus', ''),
  isDriverRewardExtra: () => false,
  roundUp: (value, unit) => Math.ceil(value / unit) * unit
};

vm.runInNewContext(`${calculator}\nresult = calculateSettlement({
  participants: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
  cars: [{ name: 'A' }, { name: 'B' }]
}, {
  organizerName: '', organizerFree: false, driverCollectionOffset: true, driverCollectionFree: false,
  rounding: 100, paid: {}, cars: {
    A: { extras: [{ name: '少額', amount: 50, type: 'split' }] },
    B: { extras: [{ name: '多額', amount: 950, type: 'split' }] }
  }
});`, context);

assert.equal(context.result.cars[0].adjustedTotalPay, -300, 'A negative driver payment must remain negative.');
assert.equal(context.result.splitPaymentTotal + context.result.totalClub, context.result.driverTotal, 'The three overall totals must reconcile exactly.');
assert.equal(context.result.splitPaymentAdjustment, context.result.splitPaymentTotal - context.result.totalSplit);
assert.equal(context.result.clubPaymentAdjustment, context.result.clubPaymentTotal - context.result.totalClub);
assert.equal(context.result.totalSplit + context.result.totalClub + context.result.paymentAdjustmentTotal, context.result.driverTotal, 'Base costs plus the consolidated rounding row must reconcile to driver payments.');
assert.doesNotMatch(calculator, /adjustedTotalPay\s*=\s*Math\.max\(0/);
assert.match(summary, /paymentAdjustmentTotal/);
assert.match(summary, /extra\.baseType === 'club'/);
assert.match(summary, /data-summary-kind="rounding"[\s\S]*割勘[\s\S]*部費[\s\S]*data-summary-kind="pay"/, 'The consolidated split/club rounding row must appear immediately before payments.');
assert.doesNotMatch(summary, /ドライバー分の集金控除|参加者集金の不足/);
assert.doesNotMatch(shareText, /accountingLabel|部費支出.*accounting/);
assert.match(costParts, /isReward \|\| isTimesFeeExtraForDisplay\(ex\)/, 'Driver rewards and Times fees must use the supporting display tone.');
assert.match(costParts, /タイムズ時間料金.*タイムズ移動料金/, 'Both Times fee names must be recognized.');

const moduleContext = { window: {} };
vm.runInNewContext(settlementModule, moduleContext);
assert.equal(moduleContext.window.SanpoSettlement.yen(-300), '−¥300');

const gradeRule = gradeCss.match(/\.grade-badge\s*\{([^}]*)\}/)?.[1] || '';
assert.doesNotMatch(gradeRule, /background\s*:|color\s*:/, 'Grade badges must not override Carbon tag colors.');
assert.match(sheetCss, /\.sheet-car-header\s*\{[\s\S]*?width:\s*max-content;/, 'Shared columns must be at least as wide as their header content.');
assert.match(routeCss, /\.route-map\s*\{[\s\S]*?z-index:\s*0;/, 'The map must form a lower stacking layer.');
assert.match(routeCss, /\.route-map-toolbar\s*\{[\s\S]*?z-index:\s*6;/, 'The route settings toolbar must stay above map and skeleton layers.');
assert.match(routeCss, /\.route-map-settings-toggle\s*\{[\s\S]*?display:\s*block;/, 'The route settings button must remain rendered.');
assert.match(routeTemplate, /data-carbon-icon="draggable"/, 'Route waypoint drag handles must use the registered Carbon draggable icon.');
assert.doesNotMatch(routeTemplate, /data-carbon-icon="drag--vertical"/, 'The unregistered drag icon alias must not return.');
assert.match(index, /settlement-balance-v58/);
assert.ok(index.indexOf('seisan-club-expense-panel') < index.indexOf('seisan-toolbar-card'), 'Overall costs must follow the club expense section.');

console.log('Settlement balance v58 contract: PASS');
