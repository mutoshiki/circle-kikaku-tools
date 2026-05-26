const assert = require('assert');
const vm = require('vm');
const { readText } = require('./helpers/read-project');

const debug = readText('assets/js/features/debug-history.js');
const sandbox = {
  console,
  window: { modals: {}, SanpoOverview: null },
  byId: () => null,
  bootstrap: { Modal: function() {} },
  SINGLE_CAR_PLAN_ID: 'plan-car',
  SINGLE_TEAM_PLAN_ID: 'plan-team',
  APP_SCHEMA_VERSION: 3,
  normalizeCarSettlementState: car => car,
  normalizeSettlementState: state => state,
  Date,
  Number,
  String,
  Math,
  setTimeout: () => {},
  showAppNotice: () => {},
  appAlert: () => {},
  restore: data => { sandbox.__restored = data; },
  migrateAppData: data => data,
  updateUI: () => { sandbox.__updated = true; },
  save: () => { sandbox.__saved = true; },
  switchView: view => { sandbox.__view = view; }
};
sandbox.globalThis = sandbox;
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(debug, sandbox);
assert.strictEqual(typeof sandbox.window.executeDebugMode, 'function', 'normal sample action should be exposed');
sandbox.window.executeDebugMode();
assert(sandbox.__restored, 'sample action should restore a snapshot');
assert.strictEqual(sandbox.__restored.activeCarPlanId, 'plan-car', 'sample should activate the car plan');
assert.strictEqual(sandbox.__restored.carPlans.length, 2, 'sample should include car and team plans');
assert(sandbox.__restored.carPlans[0].cars.every(car => Array.isArray(car.members) && car.members.length > 0), 'each sample car should have passengers');
assert(sandbox.__restored.settlement.routeStops.length >= 3, 'sample should include route candidates');
assert.strictEqual(sandbox.__updated, true, 'sample should refresh UI');
assert.strictEqual(sandbox.__saved, true, 'sample should save after restore');

console.log('Sample data runtime guard check OK');
