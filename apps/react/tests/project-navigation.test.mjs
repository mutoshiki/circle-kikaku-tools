import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectNavigation } from '../src/navigation/project-navigation.js';

function browser(href) {
  const location = { href };
  const pushes = [];
  const events = new EventTarget();
  const history = { state: null, pushState(state, _, next) { this.state = state; location.href = new URL(next, location.href).href; pushes.push(next); } };
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
