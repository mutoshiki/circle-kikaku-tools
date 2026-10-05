import { createRoomStore } from '../../src/store/room-store.js';
import { createRoomSync } from '../../src/sync/room-sync.js';
import { createHistoryService, createMemoryStorage } from '../../src/services/history.js';
import { fixture } from '../reference.mjs';
import { memoryStorage, createFixtureServer } from './fixture-transport.mjs';
import { vehicleCostTargets } from '../../src/ui/vehicle-cost-target.js';

export function resultOf(runtime) {
  const { data, state } = runtime.store.domain.settlementInput(runtime.store.getSnapshot());
  return runtime.store.domain.settlement.calculateSettlement(data, state);
}

export async function createOperationsFixture({ shared = false, standalone = false } = {}) {
  let tick = 100000;
  const clock = { now: () => ++tick, isServerAligned: () => true };
  const store = createRoomStore({ initial: fixture, clientId: 'H-fixture', clock });
  if (standalone) {
    const { state } = store.domain.settlementInput(store.getSnapshot());
    state.standalone = { enabled: true, driverCount: '1', memberCount: '3', driverNames: ['仮運転手'] };
    store.command('settlement', { state });
  }
  const storage = memoryStorage(), rawStorage = createMemoryStorage();
  const server = createFixtureServer(store.getSnapshot()), transport = server.connect();
  const localStatus = Object.freeze({ kind: 'local' });
  const sync = shared ? createRoomSync({ store, storage, transport, clock, clientId: 'H-fixture', legacyLoadWrites: false })
    : { getSnapshot: () => localStatus, subscribe: () => () => {}, flush: async () => {}, dispose() {} };
  if (shared) { sync.start(); await Promise.resolve(); }
  const runtime = { roomId: 'H-fixture', store, storage, sync, history: createHistoryService({ storage: rawStorage, roomId: 'H-fixture', clock }), sampleDataEnabled: !shared };
  const { data, state } = store.domain.settlementInput(store.getSnapshot());
  const result = resultOf(runtime);
  const person = result.participants.find(p => !result.excludedNames.has(p.name) && !state.paid[p.name]);
  const payment = vehicleCostTargets(store.getSnapshot(), store.domain)[0];
  return { runtime, server, transport, rawStorage, keys: {
    collection: person ? { kind: 'collection', key: person.participantId ? `participant:${person.participantId}` : `name:${person.name}`, name: person.name } : null,
    payment: { kind: 'payment', key: payment.key, name: payment.car.name },
  }, dispose() { sync.dispose(); } };
}
