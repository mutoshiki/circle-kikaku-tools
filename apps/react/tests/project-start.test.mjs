import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateWorkspace } from '../src/services/project-workspace.js';
import { projectLastToolKey, readLastProjectTool, resolveProjectStart, writeLastProjectTool } from '../src/services/project-start.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), values };
}

test('explicit destination and standalone mode take priority over start defaults', () => {
  const workspace = createTemplateWorkspace({ templateId: 'circle-event' });
  assert.deepEqual(resolveProjectStart({ requestedToolId: 'settlement', workspace }), { toolId: 'settlement', reason: 'requested' });
  assert.equal(resolveProjectStart({ requestedToolId: 'participants', standalone: true, workspace }).toolId, 'participants');
  assert.equal(resolveProjectStart({ standalone: true, workspace }).toolId, 'settlement');
});

test('new projects start in the form when visible and participants otherwise', () => {
  assert.equal(resolveProjectStart({ workspace: createTemplateWorkspace({ templateId: 'circle-event' }), isNewProject: true }).toolId, 'application-form');
  assert.equal(resolveProjectStart({ workspace: createTemplateWorkspace({ templateId: 'personal' }), isNewProject: true }).toolId, 'participants');
});

test('existing projects use a valid local last tool, then useful populated/default screens', () => {
  const workspace = createTemplateWorkspace({ templateId: 'circle-event' });
  assert.equal(resolveProjectStart({ workspace, lastToolId: 'car', room: { participants: { p1: {} } } }).toolId, 'car');
  assert.equal(resolveProjectStart({ workspace, room: { participants: { p1: {} } } }).toolId, 'participants');
  assert.equal(resolveProjectStart({ workspace, room: { participants: {} } }).toolId, 'application-form');
});

test('hidden or disabled local history is ignored and an empty custom project falls back safely', () => {
  const workspace = createTemplateWorkspace({ templateId: 'circle-event' });
  workspace.tools.car.pinned = false;
  workspace.tabOrder = workspace.tabOrder.filter(id => id !== 'car');
  assert.equal(resolveProjectStart({ workspace, lastToolId: 'car' }).toolId, 'application-form');
  const empty = createTemplateWorkspace({ templateId: 'custom' });
  assert.equal(resolveProjectStart({ workspace: empty }).toolId, 'tools');
  assert.equal(resolveProjectStart({ workspace: empty, requestedToolId: 'car' }).toolId, 'car', 'a valid explicit deep link remains addressable even if currently hidden');
});

test('local last-tool storage is room-scoped, validates ids, and degrades when storage is unavailable', () => {
  const data = storage();
  assert.equal(writeLastProjectTool(data, 'ROOM A', 'participants'), true);
  assert.equal(data.getItem(projectLastToolKey('ROOM A')), 'participants');
  assert.equal(readLastProjectTool(data, 'ROOM A'), 'participants');
  assert.equal(readLastProjectTool(data, 'ROOM B'), null);
  data.setItem(projectLastToolKey('ROOM A'), 'unknown');
  assert.equal(readLastProjectTool(data, 'ROOM A'), null);
  assert.equal(readLastProjectTool({ getItem() { throw new Error('blocked'); } }, 'ROOM A'), null);
  assert.equal(writeLastProjectTool({ setItem() { throw new Error('blocked'); } }, 'ROOM A', 'participants'), false);
});
