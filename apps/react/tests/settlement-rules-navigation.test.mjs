import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectNavigation, readSettlementTask } from '../src/navigation/project-navigation.js';
function browser(href = 'https://example.test/?room=A&handoffToken=shared') {
  const location = { href }, events = new EventTarget(), entries = [href]; let index = 0;
  const history = { state: {}, pushState(state, _, next) { this.state = state; location.href = new URL(next, location.href).href; entries.splice(++index); entries.push(location.href); }, replaceState(state, _, next) { this.state = state; entries[index] = location.href = new URL(next, location.href).href; } };
  return { location, entries, navigation: createProjectNavigation({ location, history, eventTarget: events }), go(n) { index += n; location.href = entries[index]; events.dispatchEvent(new Event('popstate')); } };
}
test('rules / costs / parent refresh and history keep exact task and shared room selectors', () => {
  const { navigation: n, location: l, go } = browser(); n.navigateSettlementTask('rules'); const href = l.href;
  assert.deepEqual(readSettlementTask(href), { task: 'rules', invalid: false });
  const p = new URL(href).searchParams; assert.equal(p.get('room'), 'A'); assert.equal(p.get('handoffToken'), 'shared');
  assert.deepEqual([...p.keys()], ['room', 'handoffToken', 'section', 'task']);
  n.navigateVehicleCostTask({ carKey: 'participant:p1', task: 'expense', expenseKey: 'movement' });
  go(-1); assert.equal(l.href, href); assert.equal(n.getSettlementTaskSnapshot(), JSON.stringify(readSettlementTask(href)));
  go(1); assert.deepEqual(readSettlementTask(l.href), { task: '', invalid: false }); go(-1);
  n.navigate('settlement'); assert.deepEqual(readSettlementTask(l.href), { task: '', invalid: false }); go(-1); assert.equal(l.href, href);
});
test('unknown rules task is recognizable; replace is idempotent without growing history', () => {
  const { navigation: n, location: l, entries } = browser('https://example.test/?room=A&section=settlement&task=bad');
  assert.deepEqual(readSettlementTask(l.href), { task: '', invalid: true }); const count = entries.length;
  assert.equal(n.replaceSettlementTask(''), true); assert.equal(entries.length, count); assert.equal(n.replaceSettlementTask(''), false);
  assert.throws(() => n.settlementTaskHrefFor('bad'));
});
test('legacy seisan remains parent and foreign child task is not a settlement error', () => {
  assert.deepEqual(readSettlementTask('https://example.test/?room=A&view=seisan'), { task: '', invalid: false });
  assert.deepEqual(readSettlementTask('https://example.test/?room=A&section=participants&task=import'), { task: '', invalid: false });
});
