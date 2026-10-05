import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { createRoomSync } from '../src/sync/room-sync.js';
import { fixture } from './reference.mjs';
import { memoryStorage, createFixtureServer } from './helpers/fixture-transport.mjs';
import { beginSettlementEdit } from '../src/components/settlement/edit.js';
import { publishSettlementRulesEdit, settleSettlementRulesSave } from '../src/ui/settlement-rules-save.js';
export async function rulesClient(shared = true) {
  let tick = 100000; const clock = { now: () => ++tick, isServerAligned: () => true };
  const store = createRoomStore({ initial: fixture, clock, clientId: 'G-rules' }), storage = memoryStorage(), server = createFixtureServer(store.getSnapshot()), transport = server.connect();
  const sync = shared ? createRoomSync({ store, storage, transport, clientId: 'G-rules', clock, legacyLoadWrites: false }) : { getSnapshot: () => ({ kind: 'local' }), flush: async () => {}, dispose() {} };
  if (shared) { sync.start(); await Promise.resolve(); }
  return { store, storage, server, transport, sync };
}
test('settings bridge preserves latest car costs and protected maps; noop and cancel never publish', async () => {
  const r = await rulesClient(false), before = r.store.getSnapshot(), edit = beginSettlementEdit(r.store); let intents = 0; r.store.subscribeIntents(() => intents++);
  assert.equal(publishSettlementRulesEdit(r, edit), null); assert.equal(intents, 0);
  const cancelled = beginSettlementEdit(r.store); cancelled.state.driverReward = '1500'; r.store.cancelEdit(cancelled.session); assert.equal(intents, 0);
  edit.state.rounding = '10'; const remote = structuredClone(before); remote.settlement.carsByParticipantId.p_1xeyc8h.dist = '222'; r.store.receiveRemote(remote);
  const receipt = publishSettlementRulesEdit(r, edit); assert.deepEqual(receipt.patch, { 'settlement/rounding': '10' });
  const expected = structuredClone(remote.settlement); expected.rounding = '10'; assert.deepEqual(r.store.getSnapshot().settlement, expected);
  for (const key of ['participants', 'allocations', 'overview']) assert.deepEqual(r.store.getSnapshot()[key], before[key]);
  assert.equal((await settleSettlementRulesSave(r, receipt)).disposition, 'local'); assert.equal(intents, 1);
});
test('denied operation retries exact setting patch; own acceptance and not global status prove success', async () => {
  const r = await rulesClient(); try {
    let intents = 0; r.store.subscribeIntents(() => intents++); const edit = beginSettlementEdit(r.store); edit.state.rounding = '10';
    r.transport.failOnce(Error('permission denied')); const receipt = publishSettlementRulesEdit(r, edit);
    const first = await settleSettlementRulesSave(r, receipt); assert.equal(first.disposition, 'failed'); assert.equal(first.receipt.canRetry, true);
    const result = await settleSettlementRulesSave(r, first.receipt, { retry: true }); assert.equal(result.disposition, 'saved'); assert.equal(intents, 1);
    assert.deepEqual(result.receipt.patch, { 'settlement/rounding': '10' }); assert.ok(r.storage.read('base').syncOperations[result.receipt.operationId]);
  } finally { r.sync.dispose(); }
});
test('unknown empty outbox and foreign outbox are not acceptance, accepted rules never replay later edits', async () => {
  const r = await rulesClient(); try {
    const edit = beginSettlementEdit(r.store); edit.state.rounding = '10'; const receipt = publishSettlementRulesEdit(r, edit); await r.sync.flush();
    const base = r.storage.read('base'), proof = base.syncOperations[receipt.operationId]; delete base.syncOperations[receipt.operationId]; r.storage.write('base', base);
    const writes = r.server.writes(); assert.equal((await settleSettlementRulesSave(r, receipt, { retry: true })).disposition, 'unresolved'); assert.equal(r.server.writes(), writes);
    r.storage.write('outbox', { id: 'foreign', patch: { 'roomName': 'different' } }); assert.equal((await settleSettlementRulesSave(r, receipt)).disposition, 'unresolved'); r.storage.remove('outbox');
    base.syncOperations[receipt.operationId] = proof; r.storage.write('base', base);
    const acknowledged = await settleSettlementRulesSave(r, receipt); assert.equal(acknowledged.disposition, 'saved');
    const later = beginSettlementEdit(r.store); later.state.rounding = '1'; publishSettlementRulesEdit(r, later); await r.sync.flush(); const laterWrites = r.server.writes();
    assert.equal((await settleSettlementRulesSave(r, receipt)).disposition, 'adjusted');
    await settleSettlementRulesSave(r, acknowledged.receipt, { retry: true }); assert.equal(r.server.writes(), laterWrites); assert.equal(r.server.get().settlement.rounding, '1');
    const reset = structuredClone(r.store.getSnapshot()); reset.resetGeneration++; r.store.receiveRemote(reset);
    assert.equal((await settleSettlementRulesSave(r, receipt)).disposition, 'reset');
  } finally { r.sync.dispose(); }
});
