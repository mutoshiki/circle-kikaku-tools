// UI-owned retry receipt, not a second room/outbox protocol. It retains only
// the existing command's changed paths and their original values, never a
// whole room snapshot, another feature's draft, or a handoff token.
export function participantSaveReceipt(sync, intent, operation = {}) {
  if (!intent) return null;
  return {
    resetGeneration: intent.base.resetGeneration,
    operationId: operation.id || '',
    patch: structuredClone(intent.patch),
    before: Object.fromEntries(Object.keys(intent.patch).map(path => [path, structuredClone(sync.getSyncPathValue(intent.base, path) ?? null)])),
  };
}

export function retryParticipantSave(runtime, receipt) {
  const latest = runtime.store.getSnapshot();
  if (receipt.resetGeneration !== latest.resetGeneration) throw new Error('企画がリセットされました。下書きをキャンセルして、開き直してください。');
  const sync = runtime.store.domain.sync;
  return runtime.sync.enqueue({
    base: sync.applyEntityPatchToObject(runtime.storage.read('base') || latest, receipt.before),
    local: sync.applyEntityPatchToObject(latest, receipt.patch),
    patch: receipt.patch,
  }, { allowPatchFallback: true });
}

// RTDB serializes object keys in a different order. Compare every value,
// including timestamps and placement fields, without treating key order as
// a user-visible adjustment. Arrays retain their order.
function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
}

export async function completeParticipantSave(runtime, receipt, onRetry = () => {}) {
  const generation = receipt?.resetGeneration ?? runtime.store.getSnapshot().resetGeneration;
  const checkReset = () => {
    if (runtime.store.getSnapshot().resetGeneration !== generation) throw new Error('企画がリセットされました。キャンセルして開き直してください。');
  };
  const acknowledged = () => receipt?.operationId && runtime.store.getSnapshot().syncOperations?.[receipt.operationId];
  async function drain() {
    while (runtime.storage.read('outbox')) {
      await runtime.sync.flush();
      checkReset();
      if (runtime.sync.getSnapshot().kind === 'error') throw new Error('端末には内容を反映しましたが、共有保存に失敗しました。接続や権限を確認して再試行してください。');
    }
  }
  checkReset();
  const adjustmentError = '同時編集により登録・選択内容が調整されました。参加者一覧を確認してください。下書きは残しています。';
  if (receipt?.adjusted) throw new Error(adjustmentError);
  // A retained UI draft is not authorization to issue an acknowledged intent
  // again. Later participant edits remain owned by their existing operations.
  if (acknowledged()) return;
  await drain();
  if (receipt && runtime.sync.enqueue && !acknowledged()) {
    const operation = retryParticipantSave(runtime, receipt);
    receipt = { ...receipt, operationId: operation.id };
    onRetry(receipt);
    await drain();
  }
  checkReset();
  if (receipt && runtime.store.domain.sync.summarizeSyncOutcome(ordered(receipt.patch), {}, ordered(runtime.store.getSnapshot())).adjustedPaths.length) {
    onRetry({ ...receipt, adjusted: true });
    throw new Error(adjustmentError);
  }
}
