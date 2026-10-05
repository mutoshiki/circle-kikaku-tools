import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { createRoomSync } from '../src/sync/room-sync.js';
import { fixture } from './reference.mjs';
import { memoryStorage, createFixtureServer } from './helpers/fixture-transport.mjs';
import { createSettlementRulesDraft } from '../src/ui/settlement-rules-draft.js';
import { createSettlementRulesController, prepareStandaloneRulesDraft } from '../src/ui/settlement-rules-controller.js';
function cacheFor() { const values = new Map(); return createSettlementRulesDraft({ roomId: crypto.randomUUID(), storage: () => ({ getItem: k => values.get(k), setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }) }); }
async function client(shared = false) {
  let tick = 100000; const clock = { now: () => ++tick, isServerAligned: () => true }, store = createRoomStore({ initial: fixture, clock, clientId: 'G-controller' }), storage = memoryStorage();
  const server = createFixtureServer(store.getSnapshot()), transport = server.connect();
  const sync = shared ? createRoomSync({ store, storage, transport, clientId: 'G-controller', clock, legacyLoadWrites: false }) : { getSnapshot: () => ({ kind: 'local' }), flush: async () => {}, dispose() {} };
  if (shared) { sync.start(); await Promise.resolve(); } return { store, storage, server, transport, sync };
}
test('raw fields and hidden mode input recover without intents; cancel discards only local input', async () => {
  const r = await client(), cache = cacheFor(), before = r.store.getSnapshot(); let c = createSettlementRulesController({ runtime: r, cache }), intents = 0; r.store.subscribeIntents(() => intents++);
  const initial = c.getSnapshot(); assert.equal(c.getSnapshot(), initial);
  c.setMode(true); c.updateField('standalone.driverCount', '0.5'); c.updateField('standalone.memberCount', '2'); c.updateField('standalone.driverNames', ['日本語変換中']); c.updateField('driverReward', '1,000'); c.setMode(false); c.dispose();
  c = createSettlementRulesController({ runtime: r, cache }); c.setMode(true);
  assert.equal(c.getSnapshot().state.standalone.driverCount, '0.5'); assert.deepEqual(c.getSnapshot().state.standalone.driverNames, ['日本語変換中']); assert.equal(c.getSnapshot().state.driverReward, '1,000');
  assert.equal(intents, 0); assert.equal(r.store.getSnapshot(), before); assert.equal(c.cancel(), true); assert.equal(cache.read(), null); c.dispose();
});
test('IME, all-group validation, simultaneous Save and no-op close produce the right intent count', async () => {
  const r = await client(), cache = cacheFor(); let c = createSettlementRulesController({ runtime: r, cache }), intents = 0; r.store.subscribeIntents(() => intents++);
  assert.equal((await c.save()).disposition, 'unchanged'); assert.equal(intents, 0); c.dispose();
  c = createSettlementRulesController({ runtime: r, cache }); c.updateField('driverReward', '−1'); assert.equal((await c.save()).disposition, 'invalid');
  c.updateField('driverReward', '1500'); assert.equal((await c.save({ composing: true })).disposition, 'composing'); assert.equal(intents, 0);
  await Promise.all([c.save(), c.save()]); assert.equal(intents, 1); assert.equal(c.getSnapshot().completion, 'local'); assert.equal(cache.read(), null); c.dispose();
});
test('latest cost and unrelated rules feed preview but same dirty path is stale and needs explicit restart', async () => {
  const r = await client(), cache = cacheFor(); let c = createSettlementRulesController({ runtime: r, cache }); c.updateField('rounding', '10');
  const remote = structuredClone(r.store.getSnapshot()); remote.settlement.carsByParticipantId.p_1xeyc8h.dist = '222'; remote.settlement.driverReward = '900'; r.store.receiveRemote(remote);
  assert.equal(c.getSnapshot().projection.candidateInput.state.cars['仮参加者A'].dist, '222'); assert.equal(c.getSnapshot().projection.candidateInput.state.driverReward, '900'); assert.equal(c.getSnapshot().state.rounding, '10');
  assert.equal(c.getSnapshot().writeIssues.length, 0); remote.settlement.rounding = '1'; r.store.receiveRemote(remote);
  assert.equal((await c.save()).disposition, 'unavailable'); c.dispose(); c = createSettlementRulesController({ runtime: r, cache });
  assert.equal(c.getSnapshot().state.rounding, '10'); assert.ok(c.getSnapshot().writeIssues.some(i => i.key === 'stale-settings'));
  assert.equal(c.restartFromCurrent(), true); assert.equal(c.getSnapshot().state.rounding, '1'); assert.equal(c.getSnapshot().dirty, false); c.dispose();
});
test('first edit of a previously untouched remotely updated setting uses its observed current baseline', async () => {
  const r = await client(), cache = cacheFor(), c = createSettlementRulesController({ runtime: r, cache });
  c.updateField('rounding', '10');
  const remote = structuredClone(r.store.getSnapshot()); remote.settlement.driverReward = '900'; r.store.receiveRemote(remote);
  assert.equal(c.getSnapshot().state.driverReward, '900');
  c.updateField('driverReward', '1500');
  assert.equal(c.getSnapshot().writeIssues.length, 0);
  assert.equal(cache.read().before['settlement/driverReward'], '900');
  c.dispose(); const resumed = createSettlementRulesController({ runtime: r, cache });
  assert.equal(resumed.getSnapshot().writeIssues.length, 0);
  assert.equal((await resumed.save()).disposition, 'local');
  assert.equal(r.store.getSnapshot().settlement.driverReward, '1500');
  assert.equal(r.store.getSnapshot().settlement.rounding, '10'); resumed.dispose();
});
test('standalone entrance sets existing defaults once locally and never overwrites recovery', async () => {
  const r = await client(), cache = cacheFor(); let intents = 0; r.store.subscribeIntents(() => intents++);
  assert.equal(prepareStandaloneRulesDraft({ runtime: r, cache }), true);
  const c = createSettlementRulesController({ runtime: r, cache }); assert.equal(c.getSnapshot().state.standalone.enabled, true); assert.equal(c.getSnapshot().state.driverCollectionOffset, false);
  c.updateField('driverReward', '1500'); assert.equal(prepareStandaloneRulesDraft({ runtime: r, cache }), false); assert.equal(cache.read().fields.driverReward, '1500'); assert.equal(intents, 0); c.dispose();
});
test('editing one standalone field preserves remotely updated siblings and previews the displayed mode', async () => {
  const r = await client(), cache = cacheFor(), c = createSettlementRulesController({ runtime: r, cache });
  const remote = structuredClone(r.store.getSnapshot());
  remote.settlement.standalone = { enabled: true, driverCount: '2', memberCount: '9', driverNames: ['NewA', 'NewB'] };
  r.store.receiveRemote(remote);
  assert.equal(c.getSnapshot().state.standalone.enabled, true);
  c.updateField('standalone.driverCount', '3');
  const expected = { enabled: true, driverCount: '3', memberCount: '9', driverNames: ['NewA', 'NewB', '車出し3'] };
  assert.deepEqual(c.getSnapshot().projection.candidateInput.state.standalone, expected);
  assert.equal(c.getSnapshot().writeIssues.length, 0);
  await c.save();
  assert.deepEqual(r.store.getSnapshot().settlement.standalone, expected); c.dispose();
});
test('untouched organizer identity follows current shared rules instead of the page opening selection', async () => {
  const r = await client(), room = structuredClone(r.store.getSnapshot());
  const ids = Object.keys(room.participants), first = ids[0], second = ids[1];
  room.settlement.organizerParticipantId = first; r.store.receiveRemote(room);
  const c = createSettlementRulesController({ runtime: r, cache: cacheFor() }); c.updateField('rounding', '10');
  const remote = structuredClone(r.store.getSnapshot()); remote.settlement.organizerParticipantId = second; r.store.receiveRemote(remote);
  assert.equal(c.getSnapshot().organizerId, second);
  assert.equal(c.getSnapshot().state.organizerName, remote.participants[second].name);
  assert.equal(c.getSnapshot().projection.candidateInput.state.organizerName, remote.participants[second].name);
  assert.equal(c.getSnapshot().writeIssues.length, 0);
  await c.save(); assert.equal(r.store.getSnapshot().settlement.organizerParticipantId, second); c.dispose();
});
test('reverting a field releases its old baseline before a later first edit of a remote value', async () => {
  const r = await client(), cache = cacheFor(), c = createSettlementRulesController({ runtime: r, cache });
  const original = c.getSnapshot().state.driverReward;
  c.updateField('driverReward', '1500'); c.updateField('driverReward', original);
  const remote = structuredClone(r.store.getSnapshot()); remote.settlement.driverReward = '900'; r.store.receiveRemote(remote);
  c.updateField('driverReward', '1600');
  assert.equal(c.getSnapshot().writeIssues.length, 0);
  assert.equal(cache.read().before['settlement/driverReward'], '900');
  c.dispose(); const resumed = createSettlementRulesController({ runtime: r, cache });
  assert.equal(resumed.getSnapshot().writeIssues.length, 0);
  assert.equal((await resumed.save()).disposition, 'local');
  assert.equal(r.store.getSnapshot().settlement.driverReward, '1600'); resumed.dispose();
});
test('reverting organizer selection releases its identity when a different shared organizer arrives', async () => {
  const r = await client(), room = structuredClone(r.store.getSnapshot()), ids = Object.keys(room.participants);
  room.settlement.organizerParticipantId = ids[0]; r.store.receiveRemote(room);
  const c = createSettlementRulesController({ runtime: r, cache: cacheFor() });
  c.setOrganizer(ids[1]); c.setOrganizer(ids[0]);
  const remote = structuredClone(r.store.getSnapshot()); remote.settlement.organizerParticipantId = ids[1]; r.store.receiveRemote(remote);
  assert.equal(c.getSnapshot().organizerId, ids[1]);
  assert.equal(c.getSnapshot().writeIssues.length, 0); c.dispose();
});
test('explicitly confirming the current organizer still fences later identity removal', async () => {
  const r = await client(), room = structuredClone(r.store.getSnapshot()), id = Object.keys(room.participants)[0];
  room.settlement.organizerParticipantId = id; r.store.receiveRemote(room);
  const cache = cacheFor(), c = createSettlementRulesController({ runtime: r, cache });
  c.setOrganizer(id); c.updateField('driverReward', '1500');
  const remote = structuredClone(r.store.getSnapshot()); delete remote.participants[id]; remote.settlement.organizerParticipantId = '';
  r.store.receiveRemote(remote);
  assert.ok(c.getSnapshot().writeIssues.some(issue => issue.key === 'organizer-missing')); c.dispose();
  const resumed = createSettlementRulesController({ runtime: r, cache });
  assert.ok(resumed.getSnapshot().writeIssues.some(issue => issue.key === 'organizer-missing')); resumed.dispose();
});
test('storage failures retain input and report no reload guarantee', async () => {
  const r = await client(), cache = createSettlementRulesDraft({ roomId: crypto.randomUUID(), storage: () => { throw Error('blocked'); } });
  const c = createSettlementRulesController({ runtime: r, cache }); c.updateField('driverReward', '1500'); assert.equal(c.getSnapshot().recoverable, false); assert.equal(c.getSnapshot().state.driverReward, '1500'); c.dispose();
  const d = createSettlementRulesController({ runtime: r, cache }); assert.equal(d.getSnapshot().state.driverReward, '1500'); d.cancel(); d.dispose();
});
test('denied payload is frozen through recovery, retry publishes no second command and succeeds', async () => {
  const r = await client(true), cache = cacheFor(); try {
    let intents = 0; r.store.subscribeIntents(() => intents++); let c = createSettlementRulesController({ runtime: r, cache }); c.updateField('driverReward', '1500'); r.transport.failOnce(Error('permission denied'));
    assert.equal((await c.save()).disposition, 'failed'); assert.equal(c.cancel(), false); c.updateField('driverReward', '999'); assert.equal(c.getSnapshot().state.driverReward, '1500'); c.dispose();
    c = createSettlementRulesController({ runtime: r, cache }); assert.equal((await c.retry()).disposition, 'saved'); assert.equal(intents, 1); assert.equal(cache.read(), null); c.dispose();
  } finally { r.sync.dispose(); }
});
test('disposed save completion cannot clear a newer same-room draft or publish UI completion', async () => {
  const r = await client(true), cache = cacheFor(); let release; const held = new Promise(resolve => release = resolve), flush = r.sync.flush.bind(r.sync);
  r.sync = { ...r.sync, flush: async () => { await flush(); await held; } };
  try {
    const old = createSettlementRulesController({ runtime: r, cache }); old.updateField('rounding', '10'); const pending = old.save(); await new Promise(resolve => setTimeout(resolve, 0)); old.dispose();
    const observed = createSettlementRulesController({ runtime: r, cache }); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(observed.getSnapshot().completion, 'saved'); observed.dispose();
    const newer = createSettlementRulesController({ runtime: r, cache }); newer.updateField('driverReward', '1500'); release(); await pending;
    assert.equal(cache.read().fields.driverReward, '1500'); assert.equal(old.getSnapshot().completion, null); newer.dispose();
  } finally { release(); r.sync.dispose(); }
});
test('unknown receipt is observed without publication and cannot be discarded or rebased', async () => {
  const r = await client(true), cache = cacheFor(); try {
    let c = createSettlementRulesController({ runtime: r, cache }); c.updateField('rounding', '10'); r.transport.setOnline(false); await c.save(); const record = cache.read(); c.dispose();
    r.storage.remove('outbox'); record.receipt.canRetry = false; record.receipt.disposition = 'unresolved'; cache.write(record);
    const writes = r.server.writes(); c = createSettlementRulesController({ runtime: r, cache }); await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(c.getSnapshot().receipt.disposition, 'unresolved'); assert.equal(c.cancel(), false); assert.equal(c.confirmCurrent(), false); assert.equal(c.restartFromCurrent(), false); assert.equal(r.server.writes(), writes); c.dispose();
  } finally { r.sync.dispose(); }
});

test('stored dual flags and nonstandard rounding are not migrated by opening or unrelated Save', async () => {
  const r = await client(), room = structuredClone(r.store.getSnapshot()); Object.assign(room.settlement, { rounding: '50', driverCollectionOffset: true, driverCollectionFree: true }); r.store.receiveRemote(room);
  const c = createSettlementRulesController({ runtime: r, cache: cacheFor() }); c.updateField('driverReward', '1500');
  assert.deepEqual(c.getSnapshot().projection.patch, { 'settlement/driverReward': '1500' });
  await c.save(); assert.equal(r.store.getSnapshot().settlement.rounding, '50'); assert.equal(r.store.getSnapshot().settlement.driverCollectionOffset, true); assert.equal(r.store.getSnapshot().settlement.driverCollectionFree, true); c.dispose();
});
test('organizer deletion and reset preserve raw draft and require explicit re-edit', async () => {
  const r = await client(), cache = cacheFor(), c = createSettlementRulesController({ runtime: r, cache }); c.setOrganizer('p_1xeyc8h'); c.updateField('driverReward', '1500');
  const remote = structuredClone(r.store.getSnapshot()); delete remote.participants.p_1xeyc8h; r.store.receiveRemote(remote);
  assert.ok(c.getSnapshot().writeIssues.some(i => i.key === 'organizer-missing')); assert.equal((await c.save()).disposition, 'unavailable');
  remote.resetGeneration++; r.store.receiveRemote(remote); assert.ok(c.getSnapshot().writeIssues.some(i => i.key === 'reset')); assert.equal(cache.read().fields.driverReward, '1500'); c.dispose();
});
test('recovered accepted-then-adjusted result can discard its copy without inverse write or replay', async () => {
  const r = await client(true), cache = cacheFor(); let release; const held = new Promise(resolve => release = resolve), flush = r.sync.flush.bind(r.sync); r.sync = { ...r.sync, flush: async () => { await flush(); await held; } };
  try {
    const c = createSettlementRulesController({ runtime: r, cache }); c.updateField('rounding', '10'); const pending = c.save(); await new Promise(resolve => setTimeout(resolve, 0)); const recovery = cache.read(); c.dispose();
    const remote = r.server.get(); remote.settlement.rounding = '1'; r.server.replace(remote); await new Promise(resolve => setTimeout(resolve, 0));
    cache.write(recovery); const restored = createSettlementRulesController({ runtime: r, cache }); await new Promise(resolve => setTimeout(resolve, 0)); const writes = r.server.writes();
    assert.equal(restored.getSnapshot().receipt.disposition, 'adjusted'); assert.equal(restored.confirmCurrent(), true); assert.equal(cache.read(), null); assert.equal(r.server.writes(), writes);
    release(); await pending; assert.equal(r.store.getSnapshot().settlement.rounding, '1'); restored.dispose();
  } finally { release(); r.sync.dispose(); }
});
