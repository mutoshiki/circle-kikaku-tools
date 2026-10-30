import test from 'node:test';
import assert from 'node:assert/strict';
import { setToolAvailability, setToolPinned, movePinnedTool } from '../src/services/project-workspace-actions.js';
import { createTemplateWorkspace } from '../src/services/project-workspace.js';
import { requestedToolFromView, resolveWorkspaceSelection, workspaceTabs } from '../src/services/project-workspace-routing.js';

test('tool availability, pinning, and order are independent and keep Tools available', () => {
  const initial = createTemplateWorkspace({ templateId: 'personal' });
  const unpinned = setToolPinned(initial, 'car', false);
  assert.equal(unpinned.tools.car.enabled, true);
  assert.equal(unpinned.tools.car.pinned, false);
  const removed = setToolAvailability(unpinned, 'car', false);
  assert.equal(removed.tools.car.enabled, false);
  assert.deepEqual(removed.tabOrder, ['participants', 'settlement']);
  const restored = setToolAvailability(removed, 'car', true);
  assert.equal(restored.tools.car.enabled, true);
  assert.equal(restored.tools.car.pinned, false);
});

test('pinning and moving preserve every pinned tool without a tab-count cap', () => {
  const workspace = createTemplateWorkspace({ templateId: 'custom', customTools: ['participants', 'car', 'team', 'settlement', 'application-form', 'submission-documents', 'mountain-plan'] });
  assert.equal(workspace.tabOrder.length, 7);
  const moved = movePinnedTool(workspace, 'mountain-plan', 0);
  assert.equal(moved.tabOrder[0], 'mountain-plan');
  assert.equal(moved.tabOrder.length, 7);
});

test('legacy views and tool ids resolve without changing existing routes', () => {
  assert.equal(requestedToolFromView('seisan'), 'settlement');
  assert.equal(requestedToolFromView('car'), 'car');
  assert.equal(requestedToolFromView('sheet'), 'car');
  assert.equal(requestedToolFromView('unknown'), null);
});

test('unpinned enabled tools open inside Tools and disabled links fall back safely', () => {
  const workspace = createTemplateWorkspace({ templateId: 'personal' });
  workspace.tools.car.pinned = false;
  workspace.tabOrder = workspace.tabOrder.filter(id => id !== 'car');
  assert.deepEqual(resolveWorkspaceSelection(workspace, 'car'), { tabId: 'tools', toolId: 'car' });
  assert.deepEqual(resolveWorkspaceSelection(workspace, 'team'), { tabId: 'settlement', toolId: null });
  assert.deepEqual(resolveWorkspaceSelection(workspace, null), { tabId: 'settlement', toolId: null });
});

test('Tools always remains visible and registered pinned tools have no hard count limit', () => {
  const workspace = createTemplateWorkspace({ templateId: 'custom', customTools: ['participants', 'car', 'team', 'settlement', 'application-form', 'submission-documents', 'mountain-plan'] });
  assert.deepEqual(workspaceTabs(workspace).map(tool => tool.id), [...workspace.tabOrder, 'tools']);
});
