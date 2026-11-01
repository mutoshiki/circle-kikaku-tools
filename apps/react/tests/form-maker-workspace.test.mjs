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

test('form workspace does not treat an unused room reservation as an already submitted job', async () => {
  const reservationJobId = 'b'.repeat(32);
  const runtime = {
    roomId: 'P9A93LMQ',
    storage: { read: key => key === 'applicationFormReservation' ? { roomId: 'P9A93LMQ', jobId: reservationJobId } : null },
    external: {
      prepareApplicationForm: async () => ({ roomId: 'P9A93LMQ', jobId: reservationJobId, token: 'capability' }),
    },
  };

  const props = createFormMakerWorkspaceProps({ runtime, room: { roomName: 'P9 test' } });

  assert.equal(props.project.jobId, undefined, 'a reservation is passed to the enqueue callback, not as an existing job');
  assert.deepEqual(await props.createProjectLink(), { roomId: 'P9A93LMQ', jobId: reservationJobId, token: 'capability' });
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

test('all-tools sample provides editable form input values and never enables external form creation', async () => {
  const runtime = { roomId: 'DEBUG-ROOM-001', debugSample: true, storage: { read: () => null }, external: {} };
  const room = { roomName: 'デバッグ用サンプル企画', meta: { applicationSync: { eventDate: '2026-11-07' } } };
  const props = createFormMakerWorkspaceProps({ runtime, room });

  assert.equal(props.sampleMode, true);
  assert.deepEqual(props.project.sampleInput, {
    planName: 'デバッグ用サンプル企画',
    editorEmail: 'sample-editor@example.invalid',
    eventDate: '2026-11-07',
    deadline: '2026-11-05',
    description: '集合場所：新宿駅西口。集合時刻：6:30。持ち物：雨具・飲料・昼食。雨天時は前日18時までに連絡します。',
  });
  assert.equal((await props.session.prepare()).accepting, false);
});
