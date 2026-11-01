export const TOOL_REGISTRY = Object.freeze([
  { id: 'application-form', label: '応募フォーム', view: 'application-form' },
  { id: 'submission-documents', label: '学務書類', view: 'submission-documents' },
  { id: 'mountain-plan', label: '登山計画書', view: 'mountain-plan' },
  { id: 'participants', label: '参加者', view: 'participants' },
  { id: 'car', label: '車割', view: 'car' },
  { id: 'team', label: '班割', view: 'team' },
  { id: 'settlement', label: '精算', view: 'seisan' },
  { id: 'tools', label: 'タブを編集', view: 'tools', system: true },
]);

export const TEMPLATE_REGISTRY = Object.freeze({
  personal: { id: 'personal', version: 1, label: '個人利用', tools: ['participants', 'car', 'settlement'] },
  'circle-mountain': { id: 'circle-mountain', version: 1, label: 'サークル登山企画', tools: ['application-form', 'submission-documents', 'mountain-plan', 'participants', 'car', 'team', 'settlement'] },
  'circle-event': { id: 'circle-event', version: 1, label: 'サークル通常企画', tools: ['application-form', 'participants', 'car', 'team', 'settlement'] },
  custom: { id: 'custom', version: 1, label: 'カスタム', tools: [] },
});

const toolIds = new Set(TOOL_REGISTRY.filter(tool => !tool.system).map(tool => tool.id));
const legacyToolIds = ['participants', 'car', 'team', 'settlement'];
const recordsFor = (ids, { pinned = true } = {}) => Object.fromEntries(ids.map(id => [id, { enabled: true, pinned }]));

export function createTemplateWorkspace({ templateId, customTools = [], now = Date.now() } = {}) {
  const template = TEMPLATE_REGISTRY[templateId];
  if (!template) throw new Error('企画テンプレートが見つかりません。');
  const ids = templateId === 'custom' ? [...new Set(customTools)].filter(id => toolIds.has(id)) : [...template.tools];
  const timestamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return {
    schemaVersion: 1,
    template: { id: template.id, version: template.version },
    tools: Object.fromEntries([...toolIds].map(id => [id, { enabled: ids.includes(id), pinned: ids.includes(id) }])),
    tabOrder: ids,
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function legacyWorkspace() {
  return {
    schemaVersion: 1,
    template: null,
    tools: recordsFor(legacyToolIds),
    tabOrder: [...legacyToolIds],
    revision: 0,
    createdAt: 0,
    updatedAt: 0,
    virtual: true,
  };
}

export function normalizeWorkspace(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const tools = {};
  for (const id of toolIds) {
    const record = input.tools?.[id];
    if (!record || typeof record !== 'object') continue;
    const enabled = record.enabled === true;
    tools[id] = { enabled, pinned: enabled && record.pinned === true };
  }
  const pinnedIds = Object.entries(tools).filter(([, record]) => record.enabled && record.pinned).map(([id]) => id);
  const seen = new Set();
  const tabOrder = [];
  for (const id of Array.isArray(input.tabOrder) ? input.tabOrder : []) {
    if (typeof id !== 'string' || !pinnedIds.includes(id) || seen.has(id)) continue;
    seen.add(id);
    tabOrder.push(id);
  }
  for (const id of pinnedIds) if (!seen.has(id)) tabOrder.push(id);
  const templateId = input.template?.id;
  const knownTemplate = templateId && TEMPLATE_REGISTRY[templateId];
  const template = knownTemplate && Number(input.template?.version) === knownTemplate.version
    ? { id: knownTemplate.id, version: knownTemplate.version }
    : null;
  return {
    schemaVersion: 1,
    template,
    tools,
    tabOrder,
    revision: Math.max(0, Math.floor(Number(input.revision) || 0)),
    createdAt: Math.max(0, Number(input.createdAt) || 0),
    updatedAt: Math.max(0, Number(input.updatedAt) || 0),
  };
}

export function resolveInitialTool(workspace) {
  const normalized = normalizeWorkspace(workspace);
  if (normalized.tools.settlement?.pinned) return 'settlement';
  return normalized.tabOrder[0] || 'tools';
}

export const workspaceCacheKey = roomId => `sanpo-workspace:v1:${encodeURIComponent(String(roomId || '').trim())}`;

export function createWorkspaceSync({ roomId, transport = null, storage }) {
  const cacheKey = workspaceCacheKey(roomId);
  let started = false;
  let unsubscribe;
  let storageListener;
  const listeners = new Set();
  let snapshot = Object.freeze({ status: 'loading', workspace: legacyWorkspace(), error: null });

  function publish(status, workspace, error = null) {
    snapshot = Object.freeze({ status, workspace: normalizeWorkspace(workspace), error: error ? String(error.message || error) : null });
    // A legacy fallback is virtual: caching it before first explicit save would
    // turn the old four-tab view into persisted settings and override new templates.
    if (!workspace?.virtual) {
      try { storage?.setItem(cacheKey, JSON.stringify(snapshot.workspace)); } catch { /* Cache is optional; the remote remains authoritative. */ }
    }
    for (const listener of listeners) listener();
  }

  function cachedWorkspace() {
    try {
      const value = storage?.getItem(cacheKey);
      return value ? normalizeWorkspace(JSON.parse(value)) : null;
    } catch { return null; }
  }

  function onStorage(event) {
    if (event.key !== cacheKey || !event.newValue) return;
    let incoming;
    try { incoming = normalizeWorkspace(JSON.parse(event.newValue)); }
    catch { return; }
    if (incoming.revision < snapshot.workspace.revision) return;
    publish('ready', incoming);
  }

  function start() {
    if (started) return;
    started = true;
    if (typeof globalThis.addEventListener === 'function') {
      storageListener = onStorage;
      globalThis.addEventListener('storage', storageListener);
    }
    const cached = cachedWorkspace();
    if (cached) publish('loading', cached);
    if (transport?.subscribeWorkspace) {
      unsubscribe = transport.subscribeWorkspace(value => {
        publish('ready', value ? normalizeWorkspace(value) : legacyWorkspace());
      }, error => publish('error', snapshot.workspace, error));
    } else {
      publish('ready', cached || legacyWorkspace());
    }
  }

  async function ensure(initialWorkspace) {
    const initial = normalizeWorkspace(initialWorkspace);
    if (!started) throw new Error('workspace sync has not started');
    if (snapshot.status === 'error') throw new Error(snapshot.error || 'workspace could not be read');
    if (transport?.transactionWorkspace) {
      const result = await transport.transactionWorkspace(current => current == null ? initial : undefined);
      const workspace = normalizeWorkspace(result.value || initial);
      publish('ready', workspace);
      return { created: Boolean(result.committed), workspace };
    }
    try {
      const existing = storage?.getItem(cacheKey);
      if (existing) {
        const workspace = normalizeWorkspace(JSON.parse(existing));
        publish('ready', workspace);
        return { created: false, workspace };
      }
      storage?.setItem(cacheKey, JSON.stringify(initial));
      publish('ready', initial);
      return { created: true, workspace: initial };
    } catch (error) { publish('error', snapshot.workspace, error); throw error; }
  }

  async function save(candidate, expectedRevision) {
    if (!started || snapshot.status !== 'ready') return { ok: false, error: snapshot.error || 'workspace is not ready' };
    const next = normalizeWorkspace(candidate);
    const revision = Math.max(0, Math.floor(Number(expectedRevision) || 0));
    if (transport?.transactionWorkspace) {
      let conflict = false;
      const result = await transport.transactionWorkspace(current => {
        if (current == null) {
          // Existing rooms may still use the virtual legacy workspace. Persist
          // its first explicit tab edit instead of treating the absent sidecar
          // as a cross-device revision conflict.
          if (revision !== 0 || Number(snapshot.workspace.createdAt || 0) !== 0) { conflict = true; return undefined; }
          const now = Date.now();
          return { ...next, revision: 1, createdAt: now, updatedAt: now };
        }
        if (Number(current.revision || 0) !== revision) { conflict = true; return undefined; }
        return { ...next, revision: revision + 1, createdAt: Number(current.createdAt || next.createdAt || Date.now()), updatedAt: Date.now() };
      });
      const workspace = normalizeWorkspace(result.value || snapshot.workspace);
      publish('ready', workspace);
      return result.committed ? { ok: true, workspace } : { ok: false, conflict, workspace };
    }
    if (Number(snapshot.workspace.revision || 0) !== revision) return { ok: false, conflict: true, workspace: snapshot.workspace };
    const workspace = normalizeWorkspace({ ...next, revision: revision + 1, createdAt: snapshot.workspace.createdAt || Date.now(), updatedAt: Date.now() });
    try { storage?.setItem(cacheKey, JSON.stringify(workspace)); }
    catch (error) { return { ok: false, error: String(error.message || error), workspace: snapshot.workspace }; }
    publish('ready', workspace);
    return { ok: true, workspace };
  }

  function dispose() {
    unsubscribe?.();
    unsubscribe = null;
    if (storageListener) globalThis.removeEventListener?.('storage', storageListener);
    storageListener = null;
    started = false;
  }
  return Object.freeze({ start, dispose, ensure, save, getSnapshot: () => snapshot, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } });
}
