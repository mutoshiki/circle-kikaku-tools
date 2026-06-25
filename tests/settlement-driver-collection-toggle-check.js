const assert = require('assert');
const vm = require('vm');
const { readText, readSettlementTemplateBundle } = require('./helpers/read-project');

const html = readText('index.html');
const stateText = readText('assets/js/features/settlement/01-state.js');
const calcText = readText('assets/js/features/settlement/02-calculator.js');
const renderText = readText('assets/js/features/settlement/03-render.js');
const eventsText = readText('assets/js/features/events/05-view-feature-events.js');
const templatesText = readSettlementTemplateBundle();
const guideText = readText('assets/js/templates/user-guide-content.js');

assert(html.includes('id="seisanDriverCollectionOffset"'), 'settings modal should expose driver collection offset toggle');
assert(html.includes('id="seisanDriverCollectionFree"'), 'settings modal should expose separate driver collection-free toggle');
assert(html.includes('value="0" aria-label="車出し協力代"'), 'driver reward input should default to zero yen');
assert(stateText.includes('driverCollectionOffset: true'), 'driver collection offset should default on for compatibility');
assert(stateText.includes('driverCollectionFree: false'), 'driver collection-free mode should default off');
assert(stateText.includes("driverReward: '0'"), 'default driver reward should be zero yen');
assert(stateText.includes('function isDriverCollectionOffsetEnabled'), 'driver collection offset should have a single state helper');
assert(stateText.includes('state.driverCollectionOffset = driverCollectionOffset.checked'), 'settings sync should save driver collection offset toggle');
assert(stateText.includes('state.driverCollectionFree = driverCollectionFree.checked'), 'settings sync should save driver collection-free toggle separately');
assert(calcText.includes('const excludedNames = new Set();'), 'drivers should not be excluded unconditionally');
assert(calcText.includes('if (driverCollectionOffset || driverCollectionFree) driverNames.forEach(name => excludedNames.add(name));'), 'drivers should be excluded for either driver collection mode');
assert(calcText.includes('if (driverCollectionFree) driverNames.forEach(name => shareExcludedNames.add(name));'), 'collection-free drivers should be excluded from the split');
assert(calcText.includes('car.collectionOffset = driverCollectionOffset && driverNames.has(car.name) ? perPerson : 0;'), 'driver payment offset should be conditional');
assert(renderText.includes('seisanDriverCollectionOffset') && eventsText.includes('seisanDriverCollectionOffset'), 'driver collection offset control should render and react to changes');
assert(templatesText.includes('車出しの集金:') && templatesText.includes('しない（支払い額から差し引き）') && templatesText.includes("'する'"), 'settings summary should show driver collection mode');
assert(!guideText.includes('¥1,000/台'), 'user guide should not advertise an obsolete fixed reward');

const context = {
  console,
  Math,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Set,
  JSON,
  window: { SanpoSettlement: null },
  settlementState: null
};
vm.createContext(context);
vm.runInContext(`${stateText}\n${calcText}`, context);

const data = {
  roomName: 'test',
  waiting: [],
  cars: [{ name: 'Driver', members: [{ name: 'Passenger' }] }]
};

const base = {
  rounding: '100',
  organizerFree: false,
  organizerName: '',
  driverReward: '0',
  cars: { Driver: { dist: '100', eco: '10', price: '100', extras: [] } },
  paid: {},
  driverPaid: {}
};

const on = context.calculateSettlement(data, context.normalizeSettlementState({ ...base, driverCollectionOffset: true }));
assert.strictEqual(on.perPerson, 500, 'per-person amount should include drivers in the split even when offset is on');
assert.strictEqual(on.payerCount, 1, 'driver should not appear in collection checklist when offset is on');
assert.strictEqual(on.cars[0].collectionOffset, 500, 'driver collection amount should be deducted from payment when offset is on');
assert.strictEqual(on.cars[0].adjustedTotalPay, 500, 'driver payment should be reduced by their own collection amount when offset is on');
assert(on.excludedNames.has('Driver'), 'driver should be marked excluded only when offset is on');

const off = context.calculateSettlement(data, context.normalizeSettlementState({ ...base, driverCollectionOffset: false }));
assert.strictEqual(off.perPerson, 500, 'per-person amount should stay the same when offset is off');
assert.strictEqual(off.payerCount, 2, 'driver should be included in collection checklist when offset is off');
assert.strictEqual(off.cars[0].collectionOffset, 0, 'driver payment should not be offset when setting is off');
assert.strictEqual(off.cars[0].adjustedTotalPay, 1000, 'driver payment should remain full when setting is off');
assert(!off.excludedNames.has('Driver'), 'driver should not be excluded when setting is off');

const free = context.calculateSettlement(data, context.normalizeSettlementState({
  ...base,
  driverCollectionOffset: false,
  driverCollectionFree: true
}));
assert.strictEqual(free.perPerson, 1000, 'collection-free driver should be excluded from the split denominator');
assert.strictEqual(free.payerCount, 1, 'collection-free driver should not appear in collection checklist');
assert.strictEqual(free.cars[0].collectionOffset, 0, 'collection-free mode should not deduct anything from driver payment');
assert.strictEqual(free.cars[0].adjustedTotalPay, 1000, 'collection-free mode should preserve full driver payment');

const normalizedDefault = context.normalizeSettlementState({});
assert.strictEqual(normalizedDefault.driverReward, '0', 'fresh settlement state should use zero yen reward');
assert.strictEqual(normalizedDefault.driverCollectionOffset, true, 'fresh settlement state should keep driver offset on by default');
const noRewardCar = context.ensureDriverRewardExtra({}, normalizedDefault);
assert.strictEqual(noRewardCar.extras.length, 0, 'zero yen default should not auto-create a reward extra row');

console.log('Settlement driver collection toggle check OK');
