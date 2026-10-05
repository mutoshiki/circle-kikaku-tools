import { beginSettlementEdit } from '../components/settlement/edit.js';
import { RULE_FIELDS } from './settlement-rules-draft.js';
import { projectSettlementRules, validateSettlementRules, settlementRulesSafety } from './settlement-rules-model.js';
import { publishSettlementRulesEdit, settleSettlementRulesSave } from './settlement-rules-save.js';

const copy = value => structuredClone(value);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const get = (state, key) => key.startsWith('standalone.') ? state.standalone[key.slice(11)] : state[key];
const set = (state, key, value) => { if (key.startsWith('standalone.')) state.standalone[key.slice(11)] = copy(value); else state[key] = copy(value); };
const newRecord = room => ({ fields: {}, before: {}, resetGeneration: room.resetGeneration, organizerId: null, receipt: null });
const statusText = disposition => ({ pending: '共有保存中', failed: '共有保存に失敗しました。入力の控えを残しています。', unresolved: '保存結果を確認できません。入力の控えを残しています。', adjusted: '同時編集により結果が変わりました。現在の精算を確認してください。', reset: '企画がリセットされました。現在の精算を確認してください。', saved: '共有保存済み', local: 'この端末に保存', unchanged: '変更はありません' })[disposition] || '';

export function prepareStandaloneRulesDraft({ runtime, cache }) {
  if (cache.read()) return false;
  const room = runtime.store.getSnapshot(), state = runtime.store.domain.settlementInput(room).state;
  const seed = beginSettlementEdit(runtime.store, { standalone: true }), record = newRecord(room);
  for (const key of RULE_FIELDS) if (!same(get(state, key), get(seed.state, key))) record.fields[key] = copy(get(seed.state, key));
  // Recover against the actual canonical settings, not the seeded openingState.
  seed.openingState = copy(state);
  const { patch } = projectSettlementRules({ room, edit: seed, domain: runtime.store.domain });
  for (const path of Object.keys(patch)) record.before[path] = copy(runtime.store.domain.sync.getSyncPathValue(room, path) ?? null);
  cache.write(record); runtime.store.cancelEdit(seed.session); return true;
}

export function createSettlementRulesController({ runtime, cache }) {
  const domain = runtime.store.domain, listeners = new Set();
  let record = cache.read() || newRecord(runtime.store.getSnapshot()), persistedRecord = cache.read();
  let edit = beginSettlementEdit(runtime.store), receipt = record.receipt, status = statusText(receipt?.disposition);
  let saving = false, closed = false, disposed = false, pending = null, snapshot, completion = null;
  // Reconstruct only original dirty-path values in memory. Never persist a room.
  edit.session.base = domain.sync.applyEntityPatchToObject(edit.session.base, record.before);
  edit.session.base.resetGeneration = record.resetGeneration;
  edit.session.draft = copy(edit.session.base);
  edit.state = domain.settlementInput(edit.session.base).state; edit.openingState = copy(edit.state);
  for (const [key, value] of Object.entries(record.fields)) set(edit.state, key, value);
  const ownsRecovery = () => same(cache.read(), persistedRecord);
  function refresh() {
    const room = runtime.store.getSnapshot();
    const currentState = domain.settlementInput(room).state;
    // Untouched fields belong to the current shared room. Only actively edited
    // canonical paths retain their acquisition baseline for conflict checks.
    edit.session.base = domain.sync.applyEntityPatchToObject(room, record.before);
    edit.session.base.resetGeneration = record.resetGeneration;
    edit.session.draft = copy(edit.session.base);
    for (const key of RULE_FIELDS) if (!Object.hasOwn(record.fields, key)) {
      set(edit.state, key, get(currentState, key));
      set(edit.openingState, key, get(currentState, key));
    }
    edit.session.draft.participants = copy(room.participants);
    const projection = projectSettlementRules({ room, edit, domain });
    const state = copy(currentState);
    for (const [key, value] of Object.entries(record.fields)) set(state, key, value);
    const writeIssues = receipt ? [] : settlementRulesSafety({ room, edit, patch: projection.patch, organizerId: record.organizerId, domain });
    snapshot = { state, projection, validation: validateSettlementRules(state), writeIssues,
      organizerId: record.organizerId ?? room.settlement?.organizerParticipantId ?? null,
      dirty: !!receipt || Object.keys(record.fields).length > 0, recoverable: cache.isRecoverable(), receipt,
      frozen: saving || closed || !!receipt || disposed, status, saving, completion };
    if (!disposed) for (const listener of listeners) listener();
  }
  function persist() {
    record.receipt = receipt;
    if (ownsRecovery()) { cache.write(record); persistedRecord = copy(record); }
    refresh();
  }
  function clearRecovery() { if (ownsRecovery()) { cache.clear(); persistedRecord = null; } }
  function close(disposition) {
    const owned = ownsRecovery(); clearRecovery(); closed = true;
    if (!disposed && owned) completion = disposition;
    if (!edit.session.closed) runtime.store.cancelEdit(edit.session);
    receipt = null; record.fields = {}; record.before = {}; status = statusText(disposition); refresh();
  }
  function updateField(key, value) {
    if (snapshot.frozen || !RULE_FIELDS.includes(key)) return;
    const room = runtime.store.getSnapshot();
    const wasOwned = Object.hasOwn(record.fields, key);
    // A field becomes ours at its first edit, not when the page was opened.
    // Existing dirty paths keep their original baseline and conflict checks.
    if (!Object.hasOwn(record.fields, key)) set(edit.openingState, key, get(domain.settlementInput(room).state, key));
    set(edit.state, key, value);
    if (same(get(edit.openingState, key), value)) delete record.fields[key]; else record.fields[key] = copy(value);
    if (key === 'organizerName' && wasOwned && !Object.hasOwn(record.fields, key)) record.organizerId = null;
    const { patch } = projectSettlementRules({ room: runtime.store.getSnapshot(), edit, domain });
    for (const path of Object.keys(record.before)) if (!Object.hasOwn(patch, path)) delete record.before[path];
    for (const path of Object.keys(patch)) if (!Object.hasOwn(record.before, path)) {
      const before = copy(domain.sync.getSyncPathValue(room, path) ?? null);
      record.before[path] = before;
      edit.session.base = domain.sync.applyEntityPatchToObject(edit.session.base, { [path]: before });
    }
    persist();
  }
  async function settle(retry = false, observe = false) {
    const result = await settleSettlementRulesSave(runtime, receipt, { retry, observe, onReceipt(value) { receipt = value; if (!closed) persist(); } });
    receipt = result.receipt; status = statusText(result.disposition);
    if (['saved', 'local'].includes(result.disposition)) close(result.disposition); else persist();
    return result;
  }
  function save({ composing = false } = {}) {
    if (composing) return Promise.resolve({ disposition: 'composing', receipt });
    if (pending) return pending;
    if (closed || disposed || receipt) return Promise.resolve({ disposition: receipt?.disposition || 'closed', receipt });
    refresh();
    if (!snapshot.validation.valid) return Promise.resolve({ disposition: 'invalid', receipt });
    if (snapshot.writeIssues.length) return Promise.resolve({ disposition: 'unavailable', receipt });
    if (!Object.keys(snapshot.projection.patch).length) { close('unchanged'); return Promise.resolve({ disposition: 'unchanged', receipt: null }); }
    saving = true; status = '保存中'; refresh();
    pending = (async () => {
      try {
        receipt = publishSettlementRulesEdit(runtime, edit, { organizerId: record.organizerId }); persist();
        return await settle();
      } catch (error) { status = receipt ? statusText('unresolved') : error.message; persist(); return { disposition: receipt ? 'unresolved' : 'unavailable', receipt }; }
      finally { saving = false; pending = null; refresh(); }
    })(); return pending;
  }
  function retry() {
    if (pending) return pending;
    if (!receipt || closed || disposed) return Promise.resolve({ disposition: 'closed', receipt });
    saving = true; refresh();
    pending = settle(true).finally(() => { saving = false; pending = null; refresh(); }); return pending;
  }
  const observe = () => {
    if (receipt && !pending && !saving && !closed && !disposed) pending = settle(false, true).finally(() => { pending = null; refresh(); });
  };
  const unsubscribe = runtime.store.subscribe(refresh), unsubscribeSync = runtime.sync.subscribe?.(observe);
  refresh(); queueMicrotask(observe);
  return {
    getSnapshot: () => snapshot, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }, updateField,
    setMode(enabled) { updateField('standalone.enabled', enabled === true); },
    setDriverRule(rule) { if (!['normal', 'offset', 'free'].includes(rule)) return; updateField('driverCollectionOffset', rule === 'offset'); updateField('driverCollectionFree', rule === 'free'); },
    setOrganizer(id) {
      if (snapshot.frozen) return;
      const person = runtime.store.getSnapshot().participants?.[id];
      if (id && !person) return;
      record.organizerId = id || ''; updateField('organizerName', person?.name || '');
    },
    save, retry,
    cancel() { if (receipt || saving || disposed || closed) return false; close(null); return true; },
    confirmCurrent() {
      if (saving || disposed || !receipt || !(receipt.disposition === 'reset' || receipt.disposition === 'adjusted' && receipt.acknowledged)) return false;
      close(null); return true;
    },
    restartFromCurrent() {
      if (receipt || saving || disposed || closed) return false;
      if (!edit.session.closed) runtime.store.cancelEdit(edit.session);
      clearRecovery(); record = newRecord(runtime.store.getSnapshot()); edit = beginSettlementEdit(runtime.store); status = ''; refresh(); return true;
    },
    dispose() { disposed = true; unsubscribe(); unsubscribeSync?.(); listeners.clear(); if (!edit.session.closed) runtime.store.cancelEdit(edit.session); refresh(); },
  };
}
