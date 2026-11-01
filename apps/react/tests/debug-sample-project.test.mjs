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

  assert.equal(sample.roomName, '秋の登山企画（サンプル）');
  assert.equal(sample.lastUpdatedBy, 'debug-sample');
  assert.equal(sample.meta.applicationSync.sample, true);
  assert.equal(Object.keys(sample.meta.applicationSync.applicants).length, 15);
  assert.equal(sample.meta.applicationSync.responseCount, 15);
  assert.equal(Object.keys(migrated.participants).length, 13);
  assert.ok(Object.keys(migrated.allocations.car.groups).length >= 2);
  assert.ok(Object.keys(migrated.allocations.team.groups).length >= 2);
  assert.ok(Object.values(migrated.settlement.carsByParticipantId).some(car => (car.extras || []).length));
  const participantNames = new Set(Object.values(migrated.participants).map(person => person.name));
  const applicantNames = new Set(Object.values(sample.meta.applicationSync.applicants).map(person => person.name));
  assert.deepEqual([...participantNames].filter(name => applicantNames.has(name)).length, 13);
  assert.equal([...participantNames].filter(name => !applicantNames.has(name)).length, 0);
  assert.deepEqual(Object.values(migrated.allocations.car.placements).filter(item => item.kind === 'waiting').length, 0);
  assert.deepEqual(Object.values(migrated.allocations.team.placements).filter(item => item.kind === 'waiting').length, 0);
  assert.ok(sample.eventDate < new Date(1_800_000_000_000).toISOString().slice(0, 10));
  assert.deepEqual(sample.overview.timetableItems.map(item => item.time), ['06:30', '07:00', '09:30', '10:00', '12:10', '12:30', '16:34', '17:00', '19:30']);
  assert.match(sample.overview.timetableItems[0].title, /新宿駅西口/);
  assert.match(sample.overview.timetableItems[2].title, /高峰高原ビジターセンター/);
  assert.match(sample.overview.timetableItems[4].title, /黒斑山山頂/);
  assert.match(sample.overview.timetableItems.at(-1).title, /解散/);
  assert.equal(Object.values(sample.settlement.paid).filter(Boolean).length, 12);
  assert.equal(Object.values(sample.settlement.driverPaid).filter(Boolean).length, 3);
  assert.equal(sample.settlement.organizerName, sample.cars[0].name);
  assert.ok([...participantNames].every(name => !/参加者\d+|応募者\d+/.test(name)));
  assert.ok(Object.values(sample.meta.applicationSync.applicants).every(person => person.grade >= 1 && person.grade <= 4));
  assert.ok(Object.values(sample.meta.applicationSync.applicants).filter(person => person.canDrive).every(person => person.capacity >= 1 && person.capacity <= 20));
});

test('sample team allocation assigns everyone within the editor capacity for every sample car count', () => {
  const domain = createDomain({ clientId: 'debug-fixture-capacity' });
  const project = createProjectDomain({ settlement: domain.settlement });
  for (const carCount of [2, 3, 4, 5]) {
    const migrated = domain.migrate(project.createSampleAppData({ carCount }));
    const team = migrated.allocations.team;
    assert.equal(Object.values(team.placements).filter(item => item.kind === 'waiting').length, 0, `${carCount} cars leaves a team member unassigned`);
    for (const group of Object.values(team.groups)) {
      const assigned = Object.values(team.placements).filter(item => item.kind === 'member' && item.groupId === group.id).length;
      assert.ok(assigned <= group.capacity, `${carCount} cars overfills team ${group.id}`);
    }
  }
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
    assert.equal(runtime.store.getSnapshot().roomName, '秋の登山企画（サンプル）');
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
