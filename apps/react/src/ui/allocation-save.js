// UI receipt only. It never reruns a command, stores a room snapshot, or treats
// another operation's drained outbox as proof of this operation's acceptance.
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
}
const equal = (a, b) => JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
const diagnostics = runtime => runtime.sync.getDiagnostics?.() || [];

export function allocationReceiptAffectsPresentation(receipt, type) {
  return Object.entries(receipt?.patch || {}).some(([path, value]) => {
    if (path === 'resetGeneration' || path.startsWith(`allocations/${type}/`)) return true;
    if (/^participants\/[^/]+\/name$/.test(path)) return true;
    if (/^participants\/[^/]+$/.test(path)) return value?.name !== receipt.before?.[path]?.name;
    return false;
  });
}

export function allocationSaveReceipt(runtime, intent, { type, label }) {
  if (!intent) return null;
  const entry = runtime.storage.read('outbox');
  const belongs = entry && equal(entry.patch, intent.patch) && entry.baseSnapshot?.resetGeneration === intent.base.resetGeneration;
  const sync = runtime.store.domain.sync;
  return { type, label, resetGeneration: intent.base.resetGeneration, operationId: belongs ? entry.id : '',
    patch: structuredClone(intent.patch), before: Object.fromEntries(Object.keys(intent.patch).map(path => [path, structuredClone(sync.getSyncPathValue(intent.base, path) ?? null)])),
    diagnosticCount: diagnostics(runtime).length, disposition: runtime.sync.enqueue ? 'pending' : 'local', canRetry: false };
}

export async function settleAllocationSave(runtime, receipt, { retry = false, observe = false, onReceipt = () => {} } = {}) {
  function result(disposition, changes = {}) {
    receipt = receipt ? { ...receipt, ...changes, disposition } : null;
    onReceipt(receipt);
    return { receipt, disposition };
  }
  if (!receipt) return result('local');
  const latest = () => runtime.store.getSnapshot();
  const base = () => runtime.storage.read('base');
  const reset = () => latest().resetGeneration !== receipt.resetGeneration || base() && base().resetGeneration !== receipt.resetGeneration;
  if (reset()) return result('reset', { canRetry: false });
  if (!runtime.sync.enqueue) return result('local');
  if (receipt.acknowledged) return result(receipt.disposition, { canRetry: false });
  const accepted = () => receipt.operationId && base()?.syncOperations?.[receipt.operationId];
  function acknowledgedResult() {
    const outcome = runtime.store.domain.sync.summarizeSyncOutcome(ordered(receipt.patch), {}, ordered(base()));
    return result(outcome.adjustedPaths.length ? 'adjusted' : 'saved', { acknowledged: true, canRetry: false });
  }
  if (accepted()) return acknowledgedResult();
  if (['adjusted', 'reset'].includes(receipt.disposition)) return result(receipt.disposition, { canRetry: false });

  let pending = runtime.storage.read('outbox');
  if (retry && receipt.canRetry && pending?.id !== receipt.operationId) {
    // A proved rejection is not authority to overwrite later edits on the same
    // paths. Only unchanged authoritative values may receive the old payload.
    const beforeOutcome = runtime.store.domain.sync.summarizeSyncOutcome(ordered(receipt.before), {}, ordered(base() || {}));
    if (beforeOutcome.adjustedPaths.length) return result('adjusted', { canRetry: false });
    // Don't replace another action's one-record outbox. Let its owner finish.
    if (pending) return result('unresolved');
    const sync = runtime.store.domain.sync;
    const entry = runtime.sync.enqueue({ base: sync.applyEntityPatchToObject(base() || latest(), receipt.before), local: sync.applyEntityPatchToObject(latest(), receipt.patch), patch: receipt.patch }, { allowPatchFallback: false });
    receipt = { ...receipt, operationId: entry.id, canRetry: false, disposition: 'pending', diagnosticCount: diagnostics(runtime).length };
    onReceipt(receipt);
    pending = entry;
  }
  if (pending?.id === receipt.operationId && !observe) await runtime.sync.flush();
  if (reset()) return result('reset', { canRetry: false });
  if (accepted()) return acknowledgedResult();
  const ownRejection = diagnostics(runtime).slice(receipt.diagnosticCount).some(item => item.kind === 'rejected' && equal([...item.paths].sort(), Object.keys(receipt.patch).sort()));
  if (ownRejection) return result('failed', { canRetry: true });
  if (runtime.storage.read('outbox')?.id === receipt.operationId) return result(observe && runtime.sync.getSnapshot().kind === 'saving' ? 'pending' : 'failed', { canRetry: true });
  return result(receipt.canRetry ? 'failed' : 'unresolved');
}
