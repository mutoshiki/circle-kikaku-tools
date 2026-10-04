import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectNavigation, readProjectSection, readVehicleCostTask } from '../src/navigation/project-navigation.js';

function browser(href = 'https://example.test/?room=A&handoffToken=shared') {
  const location = { href }, events = new EventTarget(), entries = [href];
  let index = 0;
  const history = { state: {}, pushState(state, _, next) { this.state = state; location.href = new URL(next, location.href).href; entries.splice(++index); entries.push(location.href); }, replaceState(state, _, next) { this.state = state; entries[index] = location.href = new URL(next, location.href).href; } };
  const navigation = createProjectNavigation({ location, history, eventTarget: events });
  const go = n => { index += n; location.href = entries[index]; events.dispatchEvent(new Event('popstate')); };
  return { location, entries, navigation, go };
}

test('shared car expense URL refreshes and traverses history without losing launch identity', () => {
  const { navigation, location, go } = browser();
  assert.equal(readProjectSection(location.href), 'participants');
  navigation.navigateVehicleCostTask({ carKey: 'participant:p1', task: 'expense', expenseKey: 'movement', returnTo: { section: 'settlement' } });
  const expense = location.href;
  assert.equal(new URL(expense).searchParams.get('room'), 'A');
  assert.equal(new URL(expense).searchParams.get('handoffToken'), 'shared');
  assert.deepEqual(readVehicleCostTask(expense), { carKey: 'participant:p1', task: 'expense', expenseKey: 'movement', stopKey: '', returnTo: { section: 'settlement' }, invalid: false });
  navigation.navigateVehicleCostTask({ carKey: 'participant:p1', task: 'route', returnTo: { section: 'settlement' } });
  assert.equal(new URL(location.href).searchParams.has('expense'), false);
  go(-1); assert.equal(location.href, expense);
  assert.deepEqual(JSON.parse(navigation.getVehicleCostTaskSnapshot()), readVehicleCostTask(expense));
  go(1); assert.equal(readVehicleCostTask(location.href).task, 'route');
});

test('Japanese name fallback and allocation return round trip through durable URLs', () => {
  const { navigation, location } = browser();
  const destination = { carKey: 'name:田中/車', task: 'route-search', stopKey: 'waypoint:original-2', returnTo: { section: 'organization-car', groupId: 'g:one' } };
  navigation.navigateVehicleCostTask(destination);
  assert.deepEqual(readVehicleCostTask(location.href), { ...destination, expenseKey: '', invalid: false });
  navigation.navigateVehicleCostTask({ ...destination, task: 'expense', expenseKey: 'movement', stopKey: '' });
  assert.equal(readProjectSection(location.href), 'vehicle-costs');
  assert.equal(new URL(location.href).searchParams.has('stop'), false);
  assert.equal(readVehicleCostTask(location.href).returnTo.groupId, 'g:one');
});

test('leaving cost section clears private task selectors without clearing shared room selectors', () => {
  const { navigation, location } = browser('https://example.test/?room=A&handoffToken=shared&section=vehicle-costs&car=participant:p1&task=expense&expense=e1&stop=x&return=settlement&returnGroup=g&view=seisan&allocation=car&group=g');
  assert.equal(navigation.navigate('participants'), true);
  const params = new URL(location.href).searchParams;
  for (const key of ['car', 'task', 'expense', 'stop', 'return', 'returnGroup', 'view', 'allocation', 'group']) assert.equal(params.has(key), false, key);
  assert.equal(params.get('handoffToken'), 'shared');
  assert.equal(navigation.navigate('participants'), false);
});

test('same-section parent link clears a selected car and invalid context uses replace', () => {
  const { navigation, entries, location } = browser();
  navigation.navigateVehicleCostTask({ carKey: 'participant:p1' });
  assert.equal(navigation.navigate('vehicle-costs'), true);
  assert.equal(readVehicleCostTask(location.href).carKey, '');
  const count = entries.length;
  navigation.replaceVehicleCostTask({});
  assert.equal(entries.length, count);
});

test('invalid child and external return are recognizable without guessing a car or redirect', () => {
  const root = 'https://example.test/?room=A&section=vehicle-costs';
  for (const suffix of ['&task=expense', '&car=wrong&task=route', '&car=participant:p1&task=route-search', '&car=participant:p1&return=https://evil.test', '&car=participant:p1&return=organization-car']) {
    const result = readVehicleCostTask(root + suffix);
    assert.equal(result.invalid, true, suffix);
    assert.equal(result.returnTo, null);
  }
  assert.equal(readVehicleCostTask('https://example.test/?room=A&view=seisan').carKey, '');
  assert.equal(readProjectSection('https://example.test/?room=A&view=sheet&allocation=team'), 'organization-team');
});
