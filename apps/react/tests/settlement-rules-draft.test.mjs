import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettlementRulesDraft } from '../src/ui/settlement-rules-draft.js';
const record = () => ({ fields: { driverReward: '1,000', 'standalone.driverNames': ['日本語'] }, before: { 'settlement/driverReward': '500' }, resetGeneration: 0, organizerId: null, receipt: null });
test('room-isolated raw recovery contains no room snapshot and leaves vehicle cache untouched', () => {
  const values = new Map([['sanpo-ui:vehicle-cost:v1:A:x', 'vehicle']]), storage = () => ({ getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) });
  const a = createSettlementRulesDraft({ roomId: 'draft-A', storage }), b = createSettlementRulesDraft({ roomId: 'draft-B', storage });
  a.write(record()); assert.deepEqual(a.read(), record()); assert.equal(b.read(), null);
  const payload = JSON.parse(values.get('sanpo-ui:settlement-rules:v1:draft-A'));
  assert.deepEqual(Object.keys(payload.data).sort(), ['before', 'fields', 'organizerId', 'receipt', 'resetGeneration']);
  a.clear(); assert.equal(a.read(), null); assert.equal(values.get('sanpo-ui:vehicle-cost:v1:A:x'), 'vehicle');
});
test('corrupt versions, shapes, fields and foreign financial receipts are not recovered', () => {
  for (const payload of ['bad', { version: 9, data: record() }, { version: 1, data: { ...record(), room: {} } }, { version: 1, data: { ...record(), fields: { cars: {} } } }, { version: 1, data: { ...record(), receipt: { patch: { 'participants/p1': {} } } } }]) {
    const cache = createSettlementRulesDraft({ roomId: crypto.randomUUID(), storage: () => ({ getItem: () => typeof payload === 'string' ? payload : JSON.stringify(payload) }) });
    assert.equal(cache.read(), null);
  }
});
test('throwing storage retains raw memory draft, marks recovery unavailable and can clear locally', () => {
  const cache = createSettlementRulesDraft({ roomId: crypto.randomUUID(), storage: () => { throw Error('blocked'); } });
  assert.equal(cache.read(), null); assert.equal(cache.isRecoverable(), false);
  assert.equal(cache.write(record()), false); assert.deepEqual(cache.read(), record());
  assert.equal(cache.clear(), false); assert.equal(cache.read(), null);
});
