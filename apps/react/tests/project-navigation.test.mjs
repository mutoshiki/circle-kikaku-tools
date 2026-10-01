import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectNavigation, readAllocationTask } from '../src/navigation/project-navigation.js';

function browser(href) {
  const location = { href };
  const pushes = [];
  const events = new EventTarget();
  const history = { state: null, pushState(state, _, next) { this.state = state; location.href = new URL(next, location.href).href; pushes.push(next); }, replaceState(state, _, next) { this.state = state; location.href = new URL(next, location.href).href; } };
  return { location, pushes, events, navigation: createProjectNavigation({ location, history, eventTarget: events }) };
}

test('participant child navigation keeps room identity and returning to the same section clears task', () => {
  const { navigation, location, pushes } = browser('https://example.test/?room=A&handoffToken=secret&section=participants&task=import');
  assert.equal(navigation.getTaskSnapshot?.(), 'import');
  assert.equal(navigation.navigate('participants'), true);
  assert.equal(new URL(location.href).searchParams.has('task'), false);
  assert.equal(new URL(location.href).searchParams.get('room'), 'A');
  assert.equal(new URL(location.href).searchParams.get('handoffToken'), 'secret');
  assert.equal(navigation.navigateTask('announcement'), true);
  assert.equal(navigation.getTaskSnapshot(), 'announcement');
  assert.equal(navigation.navigate('settlement'), true);
  assert.equal(navigation.getTaskSnapshot(), '');
  assert.equal(pushes.length, 3);
});

test('allocation destinations keep launch identity, restore group and clear child parameters on section navigation', () => {
  const { navigation, location, events, pushes } = browser('https://example.test/?room=A&handoffToken=secret&section=organization-car&task=assign&group=g1');
  assert.deepEqual(JSON.parse(navigation.getAllocationTaskSnapshot()), { type: 'car', task: 'assign', groupId: 'g1', invalid: false });
  assert.equal(navigation.getTaskSnapshot(), '');
  navigation.navigateAllocationTask('team', 'group', 'g2');
  assert.equal(new URL(location.href).searchParams.get('room'), 'A');
  assert.equal(new URL(location.href).searchParams.get('handoffToken'), 'secret');
  assert.equal(navigation.getSnapshot(), 'organization-team');
  navigation.navigate('participants');
  assert.equal(new URL(location.href).searchParams.has('group'), false);
  assert.equal(new URL(location.href).searchParams.has('task'), false);
  navigation.navigateTask('import');
  assert.equal(navigation.getTaskSnapshot(), 'import');
  location.href = 'https://example.test/?room=A&section=organization-car&task=assign&group=g1';
  events.dispatchEvent(new Event('popstate'));
  assert.equal(JSON.parse(navigation.getAllocationTaskSnapshot()).groupId, 'g1');
  const length = pushes.length;
  navigation.replaceAllocationTask('car', '');
  assert.equal(pushes.length, length);
  assert.equal(new URL(location.href).searchParams.has('group'), false);
});

test('invalid allocation URL is recognizable before loaded-room validation without inventing a group', () => {
  assert.deepEqual(readAllocationTask('https://example.test/?room=A&section=organization-car&task=assign'), { type: 'car', task: '', groupId: '', invalid: true });
  assert.equal(readAllocationTask('https://example.test/?room=A&section=organization-team&task=unknown&group=g1').invalid, true);
  assert.deepEqual(readAllocationTask('https://example.test/?room=A&section=participants&task=import'), { type: '', task: '', groupId: '', invalid: false });
});

test('invalid child contexts resolve parent and task subscribers follow browser history', () => {
  const { navigation, location, events } = browser('https://example.test/?room=A&section=settlement&task=import');
  assert.equal(navigation.getTaskSnapshot?.(), '');
  let calls = 0;
  const unsubscribe = navigation.subscribe(() => { calls += 1; });
  navigation.navigateTask('import');
  assert.equal(navigation.getSnapshot(), 'participants');
  location.href = 'https://example.test/?room=A&task=announcement';
  events.dispatchEvent(new Event('popstate'));
  assert.equal(navigation.getTaskSnapshot(), 'announcement');
  location.href = 'https://example.test/?room=A&task=not-supported';
  assert.equal(navigation.getTaskSnapshot(), '');
  assert.equal(calls, 2);
  unsubscribe();
  events.dispatchEvent(new Event('popstate'));
  assert.equal(calls, 2);
});
