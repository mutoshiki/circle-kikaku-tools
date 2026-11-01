import test from 'node:test';
import assert from 'node:assert/strict';
import { setToolAvailability, setToolPinned, movePinnedTool, setToolTabVisibility } from '../src/services/project-workspace-actions.js';
import { createTemplateWorkspace, normalizeWorkspace } from '../src/services/project-workspace.js';
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

test('tab visibility uses one setting, appends shown tools, and preserves workspace data', () => {
  const initial = createTemplateWorkspace({ templateId: 'personal', now: 123 });
  initial.tools['application-form'] = { enabled: true, pinned: false };
  initial.tools.team = { enabled: true, pinned: false };

  const shown = setToolTabVisibility(initial, 'application-form', true);
  assert.deepEqual(shown.tools['application-form'], { enabled: true, pinned: true });
  assert.deepEqual(shown.tabOrder, ['participants', 'car', 'settlement', 'application-form']);
  assert.deepEqual(shown.tools.team, { enabled: true, pinned: false });
  assert.deepEqual(shown.template, initial.template);

  const hidden = setToolTabVisibility(shown, 'application-form', false);
  assert.deepEqual(hidden.tools['application-form'], { enabled: false, pinned: false });
  assert.deepEqual(hidden.tabOrder, ['participants', 'car', 'settlement']);
  assert.deepEqual(hidden.tools.team, { enabled: true, pinned: false });
  assert.deepEqual(hidden.template, initial.template);
});

test('tab visibility does not duplicate existing tabs or modify unknown tools', () => {
  const initial = createTemplateWorkspace({ templateId: 'personal' });
  const shown = setToolTabVisibility(initial, 'car', true);
  assert.deepEqual(shown.tabOrder, ['participants', 'car', 'settlement']);
  assert.deepEqual(setToolTabVisibility(initial, 'unknown-tool', true), initial);
});

test('legacy views and tool ids resolve without changing existing routes', () => {
  assert.equal(requestedToolFromView('seisan'), 'settlement');
  assert.equal(requestedToolFromView('car'), 'car');
  assert.equal(requestedToolFromView('sheet'), 'car');
  assert.equal(requestedToolFromView('unknown'), null);
});

test('links to hidden tools open the tab editor without changing settings', () => {
  const workspace = createTemplateWorkspace({ templateId: 'personal' });
  workspace.tools.car.pinned = false;
  workspace.tabOrder = workspace.tabOrder.filter(id => id !== 'car');
  assert.deepEqual(resolveWorkspaceSelection(workspace, 'car'), { tabId: 'tools', toolId: null, hiddenToolId: 'car' });
  assert.equal(workspace.tools.car.enabled, true);
  assert.deepEqual(resolveWorkspaceSelection(workspace, 'team'), { tabId: 'tools', toolId: null, hiddenToolId: 'team' });
  assert.deepEqual(resolveWorkspaceSelection(workspace, null), { tabId: 'settlement', toolId: null });
});

test('Tools always remains visible and registered pinned tools have no hard count limit', () => {
  const workspace = createTemplateWorkspace({ templateId: 'custom', customTools: ['participants', 'car', 'team', 'settlement', 'application-form', 'submission-documents', 'mountain-plan'] });
  assert.deepEqual(workspaceTabs(workspace).map(tool => tool.id), [...workspace.tabOrder, 'tools']);
  assert.equal(workspaceTabs(workspace).at(-1).label, 'タブを編集');
});

test('legacy enabled and pinned combinations do not change while loading and only both true show a tab', () => {
  for (const enabled of [false, true]) {
    for (const pinned of [false, true]) {
      const normalized = createTemplateWorkspace({ templateId: 'personal' });
      normalized.tools.car = { enabled, pinned };
      normalized.tabOrder = ['car'];

      const loaded = normalizeWorkspace(normalized);
      const visible = workspaceTabs(loaded).some(tool => tool.id === 'car');
      assert.equal(visible, enabled && pinned, `enabled=${enabled}, pinned=${pinned}`);
      if (enabled && !pinned) assert.deepEqual(loaded.tools.car, { enabled: true, pinned: false });
    }
  }
});

test('all tools can be hidden while the editor remains the only tab and hidden links stay non-mutating', () => {
  const workspace = createTemplateWorkspace({ templateId: 'personal' });
  for (const tool of Object.keys(workspace.tools)) {
    workspace.tools[tool] = { enabled: false, pinned: false };
  }
  workspace.tabOrder = [];

  assert.deepEqual(workspaceTabs(workspace).map(tool => tool.id), ['tools']);
  assert.deepEqual(resolveWorkspaceSelection(workspace, null), { tabId: 'tools', toolId: null });
  assert.deepEqual(resolveWorkspaceSelection(workspace, 'car'), { tabId: 'tools', toolId: null, hiddenToolId: 'car' });
  assert.equal(workspace.tools.car.enabled, false);
  assert.deepEqual(workspace.tabOrder, []);
});

test('reordering handles both ends of a long tab list', () => {
  const workspace = createTemplateWorkspace({ templateId: 'custom', customTools: ['participants', 'car', 'team', 'settlement', 'application-form', 'submission-documents', 'mountain-plan'] });
  const first = movePinnedTool(workspace, 'mountain-plan', 0);
  assert.equal(first.tabOrder[0], 'mountain-plan');
  const last = movePinnedTool(first, 'mountain-plan', first.tabOrder.length - 1);
  assert.equal(last.tabOrder.at(-1), 'mountain-plan');
  assert.equal(last.tabOrder.length, 7);
});
