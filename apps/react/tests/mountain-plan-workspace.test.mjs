import test from 'node:test';
import assert from 'node:assert/strict';
import { createMountainPlanWorkspaceProps } from '../src/services/mountain-plan-workspace.js';

test('mountain workspace gets the current project context without copying participant data', () => {
  const notice = () => {};
  const props = createMountainPlanWorkspaceProps({
    runtime: { roomId: 'ROOM-123' },
    room: { roomName: '秋名山登山企画', meta: { applicationSync: { title: '秋名山登山企画', eventDate: '2026-11-03' } } },
    active: false,
    onNotice: notice,
  });
  assert.deepEqual(props, {
    project: { roomId: 'ROOM-123', projectName: '秋名山登山企画', eventDate: '2026-11-03' },
    active: false,
    onNotice: notice,
  });
  assert.equal('participants' in props.project, false);
});

test('mountain workspace falls back to room date and a safe project label', () => {
  const props = createMountainPlanWorkspaceProps({ runtime: { roomId: 'ROOM-234' }, room: { roomName: '合宿', eventDate: '2026-10-21' } });
  assert.deepEqual(props.project, { roomId: 'ROOM-234', projectName: '合宿', eventDate: '2026-10-21' });
});

test('mountain workspace passes debug-sample mode only when explicitly isolated', () => {
  const props = createMountainPlanWorkspaceProps({ runtime: { roomId: 'DEBUG-SAMPLE-001', debugSample: true }, room: {} });
  assert.equal(props.project.debugSample, true);
});
