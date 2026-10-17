const copy = value => structuredClone(value);
const legacyFields = ['waiting', 'cars', 'carPlans', 'activeCarPlanId', 'lastAutoAssignLabel', 'activeAllocationType', 'trayMinimized'];

function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (left === undefined || right === undefined || left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return sameValue(leftKeys, rightKeys) && leftKeys.every(key => sameValue(left[key], right[key]));
}

// Owns exactly one room subscription, one intent subscription and one retry timer.
// No React effects, DOM reads, modal lookups or browser globals live here.
export function createRoomSync({ store, storage, transport, clientId, clock, timers = globalThis, legacyLoadWrites = true }) {
  const { migrate, sync } = store.domain;
  let started = false;
  let epoch = 0;
  let unsubscribeRoom;
  let unsubscribeIntents;
  let retryTimer;
  let inFlight;
  let remote = storage.read('base', null);
  let sequence = Number(storage.read('sequence', 0));
  let hasLoadedRoom = false;
  let status = Object.freeze({ kind: 'local', message: 'ローカル保存', error: null, hasLoadedRoom });
  const listeners = new Set();
  const diagnostics = [];
  function setStatus(kind, message, error = null) {
    status = Object.freeze({ kind, message, error: error ? String(error.message || error) : null, hasLoadedRoom });
    for (const listener of listeners) listener();
  }
  function markRoomLoaded() {
    if (hasLoadedRoom) return;
    hasLoadedRoom = true;
    status = Object.freeze({ ...status, hasLoadedRoom });
    for (const listener of listeners) listener();
  }
  function record(kind, message, patch = {}) { diagnostics.push({ kind, message, paths: Object.keys(patch), at: clock.now() }); }
  function clearOutbox(id) { if (storage.read('outbox')?.id === id) storage.remove('outbox'); }
  function rememberBase(room) { remote = migrate(room); storage.write('base', remote); }
  function applyRemote(room) {
    rememberBase(room);
    const pending = storage.read('outbox');
    store.receiveRemote(pending ? pending.snapshot : remote);
    storage.write('room', store.getSnapshot());
  }
  function enqueue(intent, { forceCanonical = false, allowPatchFallback = false } = {}) {
    const requestVersion = ++sequence;
    storage.write('sequence', sequence);
    const snapshot = copy(intent.local);
    snapshot.lastUpdatedBy = clientId;
    snapshot.lastUpdatedAt = clock.now();
    snapshot.revision = Math.max(Number(remote?.revision || 0), Number(snapshot.revision || 0)) + 1;
    const baseSnapshot = copy(intent.base || remote || {});
    const patch = intent.patch || sync.buildEntityPatch(baseSnapshot, snapshot, { forceCanonical });
    const previousEntry = storage.read('outbox');
    const combinedPatch = previousEntry && !forceCanonical ? { ...previousEntry.patch, ...patch } : patch;
    const id = `op_${clientId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48)}_${requestVersion}_${clock.now().toString(36)}`;
    const previousIntents = previousEntry?.randomizationIntents || [];
    const candidates = [...previousIntents, ...(intent.randomizationIntent ? [intent.randomizationIntent] : [])];
    const mergedIntents = new Map();
    for (const candidate of candidates) {
      const history = store.domain.randomization.normalizeRandomizationHistory(snapshot.allocations?.[candidate.type]?.randomization, store.domain.randomization.getRandomizationConditionsKey(snapshot, candidate.type));
      if (!history || history.epochId !== candidate.epochId || history.conditionsKey !== candidate.conditionsKey) continue;
      const key = `${candidate.type}:${candidate.epochId}:${candidate.conditionsKey}`;
      const current = mergedIntents.get(key) || { type: candidate.type, epochId: candidate.epochId, conditionsKey: candidate.conditionsKey, runIds: [] };
      current.runIds = [...new Set([...current.runIds, ...(candidate.runIds || [])])];
      mergedIntents.set(key, current);
    }
    const randomizationIntents = [...mergedIntents.values()];
    const entry = { id, operationId: id, requestVersion, snapshot, baseSnapshot, patch: copy(combinedPatch), precondition: copy(intent.precondition || null), randomizationIntents, createdAt: clock.now(), forceCanonical, allowPatchFallback };
    // Deliberately retains the existing one-record-per-room outbox contract.
    storage.write('outbox', entry);
    storage.write('room', snapshot);
    setStatus('saving', '保存中...');
    if (started) void flush();
    return entry;
  }
  function cleanup(current, entry) {
    const result = migrate(current && Object.keys(current).length ? current : entry.snapshot);
    for (const field of legacyFields) delete result[field];
    result.lastUpdatedAt = Number(result.lastUpdatedAt || clock.now());
    result.lastUpdatedBy = String(result.lastUpdatedBy || clientId);
    result.revision = Math.max(0, Number(current?.revision || result.revision || 0)) + 1;
    result.syncOperations ||= {};
    result.syncOperations[entry.id] = { clock: Number(result.syncClock || 0), clientId, appliedAt: Number(entry.snapshot.lastUpdatedAt || 0) };
    const retained = Object.entries(result.syncOperations).sort(([, a], [, b]) => Number(a.clock || 0) - Number(b.clock || 0) || Number(a.appliedAt || 0) - Number(b.appliedAt || 0));
    while (retained.length > 256) delete result.syncOperations[retained.shift()[0]];
    return result;
  }
  async function fallback(entry) {
    if (!transport.update || !sync.patchHasDomainChanges(entry.patch)) return null;
    const patch = copy(entry.patch);
    delete patch.revision;
    patch.lastUpdatedAt = Number(entry.snapshot.lastUpdatedAt || 0);
    patch.lastUpdatedBy = String(entry.snapshot.lastUpdatedBy || clientId);
    patch[`syncOperations/${entry.id}`] = { clock: Number(entry.snapshot.syncClock || 0), clientId, appliedAt: Number(entry.snapshot.lastUpdatedAt || 0) };
    // Legacy behavior: a precise update has no transaction epoch/version check.
    await transport.update(patch);
    record('adjusted', '競合時に項目単位で共有データを保存', patch);
    return entry.snapshot;
  }
  async function commit(entry, currentEpoch) {
    let result;
    try {
      let duplicate = false;
      let reset = false;
      let preconditionFailed = false;
      let randomizationConditionsChanged = false;
      const response = await transport.transaction(current => {
        if (sync.isUnsupportedRemoteSchema(current)) throw new Error(`Remote schema ${current.schemaVersion} is newer than this client`);
        if (Number(current?.resetGeneration || 0) !== Number(entry.baseSnapshot?.resetGeneration || 0)) { reset = true; return undefined; }
        if (current?.syncOperations?.[entry.id]) { duplicate = true; return undefined; }
        if (entry.precondition && !entry.precondition.every(({ path, value }) => sameValue(sync.getSyncPathValue(current || {}, path), value))) { preconditionFailed = true; return undefined; }
        if (entry.forceCanonical) return cleanup(current, entry);
        try {
          return sync.applyVersionedEntityPatch(current || {}, entry.baseSnapshot, entry.snapshot, entry.patch, entry.requestVersion, entry.id, Number(entry.snapshot.lastUpdatedAt || 0), { randomizationIntents: entry.randomizationIntents || [] });
        } catch (error) {
          if (error?.code === 'randomization/conditions-changed') { randomizationConditionsChanged = true; return undefined; }
          throw error;
        }
      });
      if (randomizationConditionsChanged) {
        result = migrate(response.value || remote || {});
        if (!started || currentEpoch !== epoch) return null;
        clearOutbox(entry.id);
        applyRemote(result);
        record('rejected', '割り当て条件変更により古いランダム割り当て履歴を破棄', entry.patch);
        setStatus('error', '割り当て条件が変更されたため、古いランダム割り当てを反映しませんでした。', new Error('割り当て条件が変更されました。'));
        return result;
      }
      if (preconditionFailed) {
        result = migrate(response.value || remote || {});
        if (!started || currentEpoch !== epoch) return null;
        clearOutbox(entry.id);
        applyRemote(result);
        record('rejected', '同時編集により運転手名の変更を中止', entry.patch);
        setStatus('error', '別の端末で精算情報が変更されました。画面を開き直してください。', new Error('別の端末で精算情報が変更されました。'));
        return result;
      }
      if (!response.committed && !duplicate && !reset) throw new Error('Firebase entity transaction was not committed');
      result = migrate(response.value || {});
      if (reset) record('adjusted', 'リセット後の古い保存を破棄', entry.patch);
    } catch (error) {
      if (!entry.precondition && !entry.randomizationIntents?.length && entry.allowPatchFallback && sync.isTransactionRetryExhausted(error)) {
        try { result = await fallback(entry); } catch (fallbackError) { error = fallbackError; }
      }
      if (!result) {
        if (!started || currentEpoch !== epoch) return null;
        const permanent = sync.isPermanentSyncError(error);
        if (permanent) clearOutbox(entry.id);
        record(permanent ? 'rejected' : 'failed', permanent ? '共有保存を拒否、再送停止' : '共有データの保存に失敗', entry.patch);
        setStatus('error', permanent ? '保存を拒否、再送停止' : '保存失敗', error);
        throw error;
      }
    }
    if (!started || currentEpoch !== epoch) return result;
    clearOutbox(entry.id);
    applyRemote(result);
    const outcome = sync.summarizeSyncOutcome(entry.patch, entry.snapshot, result);
    record(outcome.adjustedPaths.length ? 'adjusted' : 'saved', outcome.adjustedPaths.length ? '同時編集を調整' : '共有データを保存', entry.patch);
    setStatus('connected', '同期完了');
    return result;
  }
  function flush() {
    if (!started) return Promise.resolve(null);
    if (inFlight) return inFlight;
    const entry = storage.read('outbox');
    if (!entry) return Promise.resolve(null);
    if (sync.isExpiredSyncOutbox(entry, clock.now())) {
      clearOutbox(entry.id);
      record('rejected', '期限切れの未送信データを破棄', entry.patch);
      if (remote) applyRemote(remote);
      setStatus('error', '24時間を超えた未送信データを安全のため破棄しました。');
      return Promise.resolve(null);
    }
    const currentEpoch = epoch;
    inFlight = (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!started || epoch !== currentEpoch) return null;
        try { return await commit(entry, currentEpoch); }
        catch {
          if (!started || epoch !== currentEpoch || storage.read('outbox')?.id !== entry.id || attempt === 2) return null;
          await new Promise(resolve => {
            retryTimer = { handle: timers.setTimeout(() => { retryTimer = null; resolve(); }, 900 * (attempt + 1)), resolve };
          });
        }
      }
      return null;
    })().finally(() => {
      inFlight = null;
      const pending = storage.read('outbox');
      if (started && pending && (pending.id !== entry.id || currentEpoch !== epoch)) void flush();
    });
    return inFlight;
  }
  function onValue(raw, currentEpoch) {
    if (!started || currentEpoch !== epoch) return;
    if (sync.isUnsupportedRemoteSchema(raw)) { setStatus('error', 'この端末は共有データの新版に未対応です'); return; }
    const pending = storage.read('outbox');
    if (pending && Number(pending.baseSnapshot?.resetGeneration || 0) !== Number(raw?.resetGeneration || 0)) {
      clearOutbox(pending.id);
      record('adjusted', 'リセット後の古い保存を破棄', pending.patch);
    }
    if (raw === null) {
      const local = storage.read('room');
      rememberBase({});
      markRoomLoaded();
      if (!storage.read('outbox') && local && legacyLoadWrites) enqueue({ base: {}, local }, { forceCanonical: true });
      else if (storage.read('outbox')) void flush();
      else { store.receiveRemote({}); setStatus('connected', '同期完了'); }
      return;
    }
    const needsCleanup = Number(raw.schemaVersion || 1) < 6 || !raw.allocations?.car || !raw.allocations?.team || Object.hasOwn(raw, 'activeAllocationType') || Object.hasOwn(raw, 'trayMinimized');
    applyRemote(raw);
    markRoomLoaded();
    if (storage.read('outbox')) { if (!inFlight) void flush(); }
    else if (needsCleanup && legacyLoadWrites) enqueue({ base: remote, local: remote }, { forceCanonical: true });
    else setStatus('connected', '同期完了');
  }
  function start() {
    if (started) return;
    started = true;
    const currentEpoch = ++epoch;
    unsubscribeIntents = store.subscribeIntents(intent => enqueue(intent, { allowPatchFallback: true }));
    unsubscribeRoom = transport.subscribe(value => onValue(value, currentEpoch), error => { if (started && epoch === currentEpoch) setStatus('error', '接続できませんでした', error); });
  }
  function dispose() {
    if (!started) return;
    started = false;
    epoch++;
    unsubscribeRoom?.(); unsubscribeRoom = null;
    unsubscribeIntents?.(); unsubscribeIntents = null;
    if (retryTimer) { timers.clearTimeout(retryTimer.handle); retryTimer.resolve(); retryTimer = null; }
  }
  return Object.freeze({ start, dispose, flush, enqueue, getSnapshot: () => status, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }, getDiagnostics: () => copy(diagnostics) });
}
