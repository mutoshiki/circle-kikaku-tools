import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomain } from '../src/domain/index.js';
import { createProjectDomain } from '../src/services/project-domain.js';
import { createDebugSampleProject } from '../src/services/debug-sample-project.js';
import { createRuntime } from '../src/runtime.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), keys: () => [...values.keys()] };
}

test('all-tools debug fixture is synthetic and contains linked, editable tool data', () => {
  const domain = createDomain({ clientId: 'debug-fixture' });
  const project = createProjectDomain({ settlement: domain.settlement });
  const sample = createDebugSampleProject({ projectDomain: project, now: 1_800_000_000_000 });
  const migrated = domain.migrate(sample);

  assert.equal(sample.roomName, 'デバッグ用サンプル企画');
  assert.equal(sample.lastUpdatedBy, 'debug-sample');
  assert.equal(sample.meta.applicationSync.sample, true);
  assert.equal(Object.keys(sample.meta.applicationSync.applicants).length, 5);
  assert.ok(Object.keys(migrated.participants).length >= 8);
  assert.ok(Object.keys(migrated.allocations.car.groups).length >= 2);
  assert.ok(Object.keys(migrated.allocations.team.groups).length >= 2);
  assert.ok(Object.values(migrated.settlement.carsByParticipantId).some(car => (car.extras || []).length));
  assert.ok(Object.values(sample.meta.applicationSync.applicants).every(person => /^応募者\d{2}$/.test(person.name)));
  assert.ok(Object.values(migrated.participants).every(person => !/藤原|高橋|秋名山/.test(person.name)));
});

test('debug-sample URL forces isolated local-only storage even in production-configured runtime', async () => {
  const priorWindow = globalThis.window;
  const session = storage();
  globalThis.window = { sessionStorage: session };
  const local = storage();
  const history = { state: null, replaceState(_state, _title, value) { this.href = String(value); } };
  const runtime = await createRuntime({
    location: { href: 'https://example.test/?debugSample=all-tools&view=participants' },
    history,
    storage: local,
    crypto: globalThis.crypto,
    routeService: { calculate: () => { throw new Error('should remain disabled'); } },
  }, { VITE_REACT_SYNC_MODE: 'production', VITE_REACT_FIREBASE_CONFIG: '{"projectId":"production"}' });
  try {
    runtime.start();
    assert.equal(runtime.debugSample, true);
    assert.match(runtime.roomId, /^DEBUG-[A-F0-9]{16}$/);
    assert.equal(runtime.sync.getSnapshot().kind, 'local');
    assert.equal(runtime.store.getSnapshot().roomName, 'デバッグ用サンプル企画');
    assert.equal(runtime.workspace.getSnapshot().status, 'ready');
    assert.deepEqual(runtime.workspace.getSnapshot().workspace.tabOrder, ['application-form', 'submission-documents', 'mountain-plan', 'participants', 'car', 'team', 'settlement']);
    assert.equal(local.keys().some(key => key.startsWith('sanpo-react:v1:')), false);
    assert.equal(session.keys().some(key => key.includes(runtime.roomId)), true);
  } finally {
    await runtime.dispose();
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});
