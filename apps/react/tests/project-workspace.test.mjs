import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOL_REGISTRY, TEMPLATE_REGISTRY, createTemplateWorkspace,
  legacyWorkspace, normalizeWorkspace, resolveInitialTool, createWorkspaceSync,
} from '../src/services/project-workspace.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
}

test('templates provide versioned initial tool selections without forcing dependencies', () => {
  assert.deepEqual(TEMPLATE_REGISTRY.personal.tools, ['participants', 'car', 'settlement']);
  assert.deepEqual(TEMPLATE_REGISTRY['circle-mountain'].tools, ['application-form', 'submission-documents', 'mountain-plan', 'participants', 'car', 'team', 'settlement']);
  assert.deepEqual(TEMPLATE_REGISTRY['circle-event'].tools, ['application-form', 'participants', 'car', 'team', 'settlement']);
  const custom = createTemplateWorkspace({ templateId: 'custom', customTools: [], now: 1 });
  assert.deepEqual(custom.tabOrder, []);
  assert.equal(resolveInitialTool(custom), 'tools');
  assert.ok(TOOL_REGISTRY.some(tool => tool.id === 'tools' && tool.system));
});

test('new templates pin their chosen tools and initial route prefers settlement then first tool', () => {
  const workspace = createTemplateWorkspace({ templateId: 'personal', now: 123 });
  assert.equal(workspace.template.id, 'personal');
  assert.equal(workspace.template.version, 1);
  assert.deepEqual(workspace.tabOrder, ['participants', 'car', 'settlement']);
  assert.equal(workspace.tools.settlement.pinned, true);
  assert.equal(resolveInitialTool(workspace), 'settlement');
  assert.equal(resolveInitialTool({ tools: { car: { enabled: true, pinned: true } }, tabOrder: ['car'] }), 'car');
});

test('legacy projects get a virtual four-tool workspace and unknown settings are normalized safely', () => {
  const legacy = legacyWorkspace();
  assert.deepEqual(legacy.tabOrder, ['participants', 'car', 'team', 'settlement']);
  const normalized = normalizeWorkspace({
    schemaVersion: 1,
    template: { id: 'custom', version: 1 },
    tools: { car: { enabled: true, pinned: false }, team: { enabled: true, pinned: true }, 'unknown-tool': { enabled: true, pinned: true } },
    tabOrder: ['team', 'team', 'car', 'unknown-tool'], revision: 7,
  });
  assert.deepEqual(normalized.tabOrder, ['team']);
  assert.deepEqual(Object.keys(normalized.tools), ['car', 'team']);
  assert.equal(resolveInitialTool(normalized), 'team');
});

test('workspace normalization never permits a pinned but disabled tool', () => {
  const normalized = normalizeWorkspace({ schemaVersion: 1, tools: { car: { enabled: false, pinned: true } }, tabOrder: ['car'] });
  assert.equal(normalized.tools.car.pinned, false);
  assert.deepEqual(normalized.tabOrder, []);
});

test('workspace changes synchronize across clients and reject a stale revision without overwriting remote state', async () => {
  let remote = null;
  const listeners = new Set();
  const transport = {
    subscribeWorkspace(listener) { listeners.add(listener); queueMicrotask(() => listener(remote)); return () => listeners.delete(listener); },
    async transactionWorkspace(updater) {
      const next = updater(remote);
      if (next === undefined) return { committed: false, value: remote };
      remote = next;
      for (const listener of listeners) listener(remote);
      return { committed: true, value: remote };
    },
  };
  const left = createWorkspaceSync({ roomId: 'ROOM1234', transport, storage: memoryStorage() });
  const right = createWorkspaceSync({ roomId: 'ROOM1234', transport, storage: memoryStorage() });
  left.start(); right.start();
  await new Promise(resolve => setTimeout(resolve, 0));
  const initial = createTemplateWorkspace({ templateId: 'personal', now: 10 });
  await left.ensure(initial);
  const updated = normalizeWorkspace({ ...remote, tools: { ...remote.tools, team: { enabled: true, pinned: true } }, tabOrder: [...remote.tabOrder, 'team'], revision: 1, updatedAt: 20 });
  assert.equal((await left.save(updated, 0)).ok, true);
  const stale = await right.save(createTemplateWorkspace({ templateId: 'circle-event', now: 30 }), 0);
  assert.equal(stale.ok, false);
  assert.equal(normalizeWorkspace(remote).tools.team.enabled, true);
  assert.deepEqual(left.getSnapshot().workspace.tabOrder, ['participants', 'car', 'settlement', 'team']);
  assert.deepEqual(right.getSnapshot().workspace.tabOrder, ['participants', 'car', 'settlement', 'team']);
  left.dispose(); right.dispose();
});

test('workspace stays loading and rejects edits until the first remote snapshot arrives', async () => {
  let deliverSnapshot;
  let writes = 0;
  const transport = {
    subscribeWorkspace(listener) { deliverSnapshot = listener; return () => {}; },
    async transactionWorkspace(updater) { writes += 1; return { committed: false, value: updater(null) }; },
  };
  const sync = createWorkspaceSync({ roomId: 'SLOWROOM01', transport, storage: memoryStorage() });
  sync.start();
  assert.equal(sync.getSnapshot().status, 'loading');
  const earlySave = await sync.save(createTemplateWorkspace({ templateId: 'personal', now: 10 }), 0);
  assert.equal(earlySave.ok, false);
  assert.equal(writes, 0);

  const remote = createTemplateWorkspace({ templateId: 'circle-event', now: 20 });
  deliverSnapshot(remote);
  assert.equal(sync.getSnapshot().status, 'ready');
  assert.equal(sync.getSnapshot().workspace.template.id, 'circle-event');
  assert.deepEqual(sync.getSnapshot().workspace.tabOrder, ['application-form', 'participants', 'car', 'team', 'settlement']);
  assert.equal(writes, 0);
  sync.dispose();
});

test('workspace ensure preserves existing remote settings and surfaces transport errors', async () => {
  const existing = createTemplateWorkspace({ templateId: 'circle-event', now: 10 });
  const transport = {
    subscribeWorkspace(listener) { queueMicrotask(() => listener(existing)); return () => {}; },
    async transactionWorkspace(updater) { return { committed: false, value: existing }; },
  };
  const sync = createWorkspaceSync({ roomId: 'ROOM1234', transport, storage: memoryStorage() });
  sync.start();
  await new Promise(resolve => setTimeout(resolve, 0));
  await sync.ensure(createTemplateWorkspace({ templateId: 'personal', now: 20 }));
  assert.equal(sync.getSnapshot().workspace.template.id, 'circle-event');
  const failed = createWorkspaceSync({ roomId: 'ROOM1234', transport: { subscribeWorkspace(_listener, onError) { queueMicrotask(() => onError(new Error('denied'))); return () => {}; } }, storage: memoryStorage() });
  failed.start();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(failed.getSnapshot().status, 'error');
  failed.dispose(); sync.dispose();
});

test('saving the first edit to a virtual legacy workspace initializes the missing remote workspace', async () => {
  let remote = null;
  const transport = {
    subscribeWorkspace(listener) { queueMicrotask(() => listener(remote)); return () => {}; },
    async transactionWorkspace(updater) {
      const next = updater(remote);
      if (next === undefined) return { committed: false, value: remote };
      // Mirror the deployed RTDB rule: first creation requires revision 0.
      if (remote == null && next.revision !== 0 || remote != null && next.revision !== remote.revision + 1) throw new Error('PERMISSION_DENIED');
      remote = next;
      return { committed: true, value: remote };
    },
  };
  const sync = createWorkspaceSync({ roomId: 'LEGACY01', transport, storage: memoryStorage() });
  sync.start();
  await new Promise(resolve => setTimeout(resolve, 0));
  const current = sync.getSnapshot().workspace;
  const edited = normalizeWorkspace({ ...current, tools: { ...current.tools, 'application-form': { enabled: true, pinned: true } }, tabOrder: [...current.tabOrder, 'application-form'] });
  const saved = await sync.save(edited, current.revision);
  assert.equal(saved.ok, true);
  assert.deepEqual(normalizeWorkspace(remote).tabOrder, ['participants', 'car', 'team', 'settlement', 'application-form']);
  assert.equal(normalizeWorkspace(remote).revision, 0);
  const secondEdit = normalizeWorkspace({ ...sync.getSnapshot().workspace, tools: { ...sync.getSnapshot().workspace.tools, team: { enabled: false, pinned: false } }, tabOrder: sync.getSnapshot().workspace.tabOrder.filter(id => id !== 'team') });
  const savedAgain = await sync.save(secondEdit, sync.getSnapshot().workspace.revision);
  assert.equal(savedAgain.ok, true);
  assert.equal(normalizeWorkspace(remote).revision, 1);
  assert.deepEqual(normalizeWorkspace(remote).tabOrder, ['participants', 'car', 'settlement', 'application-form']);
  sync.dispose();
});
test('virtual legacy workspace is not cached before explicit template initialization', async () => {
  const storage = memoryStorage();
  const sync = createWorkspaceSync({ roomId: 'NEWROOM01', storage });
  sync.start();
  assert.equal(storage.getItem('sanpo-workspace:v1:NEWROOM01'), null);
  const created = createTemplateWorkspace({ templateId: 'personal', now: 2 });
  await sync.ensure(created);
  assert.equal(sync.getSnapshot().workspace.tools.team.enabled, false);
  assert.equal(sync.getSnapshot().workspace.template.id, 'personal');
  sync.dispose();
});
