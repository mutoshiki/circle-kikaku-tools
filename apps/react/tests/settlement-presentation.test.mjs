import test from 'node:test';
import assert from 'node:assert/strict';
import { getMovementInputStatus, getVehicleExpenseStatus, getPaymentSourcePresentation } from '../src/components/settlement/presentation.js';

const settlement = {
  isTimesRentalCar: car => car?.rentalType === 'times',
  isDriverRewardExtra: row => row?.driverReward === true,
  isTimesDistanceFeeExtra: row => row?.timesDistance === true,
  isGasMovementFeeExtra: row => row?.gasMovement === true,
  isTimesTimeFeeExtra: row => row?.timesFee === true,
  hasMeaningfulExtra: row => Boolean(String(row?.name || '').trim() || String(row?.amount ?? '').trim()),
};

test('movement status distinguishes blank, ready zero, invalid, and missing fields', () => {
  assert.equal(getMovementInputStatus({}, settlement).kind, 'missing');
  assert.deepEqual(getMovementInputStatus({ dist: '0', eco: '15', price: '0' }, settlement).kind, 'ready');
  assert.equal(getMovementInputStatus({ dist: 'abc', eco: '0', price: '' }, settlement).kind, 'invalid');
  assert.deepEqual(getMovementInputStatus({ rentalType: 'times', dist: '0' }, settlement).kind, 'ready');
  assert.deepEqual(getMovementInputStatus({ rentalType: 'times' }, settlement).missingFields.map(field => field.key), ['dist']);
});

test('vehicle status ignores generated and pending extras but accepts explicit zero amounts', () => {
  const empty = getVehicleExpenseStatus({ extras: [{ name: '', amount: '', pending: true }] }, settlement);
  assert.equal(empty.hasSavedExpenses, false);
  const zero = getVehicleExpenseStatus({ extras: [{ name: '駐車場代', amount: '0' }] }, settlement);
  assert.equal(zero.hasSavedExpenses, true);
  assert.equal(zero.savedManualExpenses[0].amount, '0');
  const partial = getVehicleExpenseStatus({ extras: [{ name: '高速代', amount: '' }] }, settlement);
  assert.equal(partial.hasPartialExpenses, true);
  const timesFee = getVehicleExpenseStatus({ rentalType: 'times', extras: [{ timesFee: true, amount: '500' }] }, settlement);
  assert.equal(timesFee.hasSavedExpenses, true);
  assert.equal(timesFee.hasPartialExpenses, true);
  const emptyAmount = getVehicleExpenseStatus({ extras: [{ name: '', amount: '0' }] }, settlement);
  assert.equal(emptyAmount.hasSavedExpenses, false);
  assert.equal(emptyAmount.hasPartialExpenses, true);
  const invalidTimesFee = getVehicleExpenseStatus({ rentalType: 'times', extras: [{ timesFee: true, amount: 'abc' }] }, settlement);
  assert.equal(invalidTimesFee.hasSavedExpenses, false);
  assert.equal(invalidTimesFee.hasPartialExpenses, true);
});

test('invalid movement values take priority over missing fields and preserve field labels', () => {
  const status = getMovementInputStatus({ dist: '  ', eco: '0', price: '' }, settlement);
  assert.equal(status.kind, 'invalid');
  assert.deepEqual(status.invalidFields, [{ key: 'eco', label: '燃費' }]);
  assert.deepEqual(status.missingFields, [{ key: 'dist', label: '移動距離' }, { key: 'price', label: 'ガソリン単価' }]);
  assert.equal(status.errors.eco, '燃費は0より大きい値を入力してください。');
  assert.equal(getMovementInputStatus({ dist: 'abc', eco: '', price: '' }, settlement).kind, 'invalid');
});

test('invalid named expenses stay actionable instead of being treated as saved', () => {
  const status = getVehicleExpenseStatus({ extras: [{ name: '高速代', amount: 'abc' }] }, settlement);
  assert.equal(status.hasSavedExpenses, false);
  assert.equal(status.hasPartialExpenses, true);
});

test('payment sources avoid duplicate totals and preserve signed mixed funding', () => {
  assert.deepEqual(getPaymentSourcePresentation(2900, 1900, 1000), [
    { id: 'split', label: '集金から', value: '¥1,900' },
    { id: 'club', label: '部費から', value: '¥1,000' },
  ]);
  assert.deepEqual(getPaymentSourcePresentation(500, 500, 0), [
    { id: 'single', label: '全額集金から', value: null },
  ]);
  assert.deepEqual(getPaymentSourcePresentation(-200, -200, 0), [
    { id: 'split', label: '集金分', value: '−¥200' },
  ]);
  assert.deepEqual(getPaymentSourcePresentation(0, -200, 200), [
    { id: 'split', label: '集金分', value: '−¥200' },
    { id: 'club', label: '部費分', value: '¥200' },
  ]);
  assert.deepEqual(getPaymentSourcePresentation(0, 0, 0), []);
});
