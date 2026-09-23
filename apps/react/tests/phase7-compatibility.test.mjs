import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { createRoomSync } from '../src/sync/room-sync.js';
import { beginSettlementEdit, commitSettlementEdit } from '../src/components/settlement/edit.js';
import { createFixtureServer, memoryStorage } from './helpers/fixture-transport.mjs';
import { createReference, fixture, plain, semanticRoom } from './reference.mjs';

const clock = { now: () => 1000, isServerAligned: () => true };
async function drain(client) {
  await Promise.resolve();
  await client.sync.flush();
  await Promise.resolve();
  await client.sync.flush();
}

test('legacy and React mixed clients preserve semantic state, concurrent extras, patches and reload', async () => {
  const legacy = createReference({ now: 1000, clientId: 'legacy-client' });
  const initial = plain(legacy.migrateAppData(fixture));
  const server = createFixtureServer(initial);
  const store = createRoomStore({ initial, clientId: 'react-client', clock });
  const storage = memoryStorage();
  const sync = createRoomSync({ store, storage, transport: server.connect(), clientId: 'react-client', clock, legacyLoadWrites: false });

  const car = store.domain.settlementInput(store.getSnapshot()).data.cars[0];
  const edit = beginSettlementEdit(store, { car });
  edit.state.cars[car.name].extras.push({ id: 'react-extra', name: 'React駐車代', amount: '300', type: 'club-minus' });
  let reactIntent;
  const stop = store.subscribeIntents(intent => { reactIntent = intent; });
  await commitSettlementEdit({ store, sync: { flush: async () => {}, getSnapshot: () => ({ kind: 'local' }) } }, edit);
  stop();
  const pending = sync.enqueue(reactIntent);
  const carPath = `settlement/carsByParticipantId/${car.participantId}/`;
  assert.ok(Object.hasOwn(pending.patch, `${carPath}extras`));
  assert.ok(Object.keys(pending.patch).every(path => path.startsWith(carPath)));

  const legacyBase = plain(legacy.migrateAppData(server.get()));
  const legacyLocal = structuredClone(legacyBase);
  const otherId = Object.keys(legacyLocal.participants).find(id => id !== car.participantId);
  legacyLocal.participants[otherId].name = 'Legacy更新名';
  legacyLocal.settlement.carsByParticipantId[car.participantId].extras.push({ id: 'legacy-extra', name: 'Legacy高速代', amount: '900', type: 'split' });
  const legacyPatch = plain(legacy.SanpoEntitySyncTest.buildEntityPatch(legacyBase, legacyLocal));
  await server.connect().transaction(current => plain(legacy.SanpoEntitySyncTest.applyVersionedEntityPatch(current, legacyBase, legacyLocal, legacyPatch, 1, 'op_legacy_1', 1000)));

  sync.start();
  await drain({ sync });
  const saved = server.get();
  const extras = saved.settlement.carsByParticipantId[car.participantId].extras;
  assert.equal(saved.participants[otherId].name, 'Legacy更新名');
  assert.ok(extras.some(row => row.id === 'legacy-extra'));
  assert.ok(extras.some(row => row.id === 'react-extra'));
  assert.equal(storage.read('outbox'), null);

  const legacyRead = plain(legacy.migrateAppData(saved));
  const reactRead = plain(store.domain.migrate(saved));
  assert.deepEqual(semanticRoom(reactRead), semanticRoom(legacyRead));
  for (const type of ['car', 'team']) {
    assert.deepEqual(plain(store.domain.canonical.projectAllocation(reactRead, type)), plain(legacy.SanpoCanonicalState.projectAllocation(legacyRead, type)));
  }
  assert.deepEqual(plain(store.domain.canonical.settlementToUi(reactRead.settlement, reactRead.participants)), plain(legacy.SanpoCanonicalState.settlementToUi(legacyRead.settlement, legacyRead.participants)));

  const reloaded = createRoomStore({ initial: saved, clientId: 'reload', clock }).getSnapshot();
  assert.deepEqual(semanticRoom(reloaded), semanticRoom(legacyRead));
  assert.equal(reloaded.schemaVersion, 6);
  sync.dispose();
});
