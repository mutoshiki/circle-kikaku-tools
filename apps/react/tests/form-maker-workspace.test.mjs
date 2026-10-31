import test from 'node:test';
import assert from 'node:assert/strict';
import { createFormMakerWorkspaceProps } from '../src/services/form-maker-workspace.js';

test('form workspace keeps reservation explicit and scopes its callbacks to the current room', async () => {
  const calls = [];
  const runtime = {
    roomId: 'ROOM-A',
    storage: { read: () => null },
    external: {
      prepareApplicationForm: async ({ room }) => { calls.push(['prepare', room]); return { roomId: 'ROOM-A', jobId: 'a'.repeat(32), token: 'secret' }; },
      acceptApplicationFormHandoff: async value => { calls.push(['handoff', value]); return true; },
    },
  };
  const room = { roomName: '秋名山企画', eventDate: '2026-11-02' };
  const props = createFormMakerWorkspaceProps({ runtime, room, active: false });
  assert.deepEqual(props.project, { roomId: 'ROOM-A', projectName: '秋名山企画', eventDate: '2026-11-02' });
  assert.equal(props.active, false);
  assert.equal(calls.length, 0, 'mounting the workspace must not reserve a form job');
  assert.equal((await props.createProjectLink()).roomId, 'ROOM-A');
  const ready = { roomId: 'ROOM-A', jobId: 'a'.repeat(32), token: 'capability' };
  assert.equal(await props.onHandoffReady(ready), true);
  assert.deepEqual(calls, [['prepare', room], ['handoff', ready]]);
});

test('form workspace receives only the explicitly configured session or the offline-safe session', async () => {
  const runtime = { roomId: 'ROOM-OFFLINE', storage: { read: () => null }, external: {} };
  const offline = createFormMakerWorkspaceProps({ runtime, room: {} });
  assert.equal((await offline.session.prepare()).accepting, false);
  assert.deepEqual(await offline.session.listJobs(), []);
  assert.equal(await offline.session.getJob('job'), null);
  await assert.rejects(offline.session.enqueue({}), /オフライン/);

  const configured = { prepare: async () => ({ accepting: true }) };
  runtime.external.formMakerSession = configured;
  assert.equal(createFormMakerWorkspaceProps({ runtime, room: {} }).session, configured);
});
