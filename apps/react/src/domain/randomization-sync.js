import { getRandomizationConditionsKey, normalizeRandomizationHistory, createRandomizationHistory } from './randomization-history.js';

const copy = value => structuredClone(value);

function setPath(target, path, value) {
  const parts = path.split('/');
  let cursor = target;
  for (const part of parts.slice(0, -1)) cursor = cursor[part] ||= {};
  cursor[parts.at(-1)] = copy(value);
}

function deletePath(target, path) {
  const parts = path.split('/');
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (!cursor?.[part] || typeof cursor[part] !== 'object') return;
    cursor = cursor[part];
  }
  if (cursor) delete cursor[parts.at(-1)];
}

function getHistory(room, type) {
  const key = getRandomizationConditionsKey(room, type);
  return normalizeRandomizationHistory(room?.allocations?.[type]?.randomization, key);
}

export function mergeRandomizationHistory({ remote = {}, base = {}, local = {}, next, intent }) {
  let result = copy(next);
  const intents = Array.isArray(intent) ? intent : intent ? [intent] : [];
  for (const item of intents) {
    const { type, epochId, conditionsKey, runIds = [] } = item || {};
    const currentKey = getRandomizationConditionsKey(remote, type);
    const resultingKey = getRandomizationConditionsKey(result, type);
    if (!resultingKey || resultingKey !== conditionsKey) {
      const error = new Error('割り当て条件が変更されたため、ランダム割り当て回数を同期できませんでした。');
      error.code = 'randomization/conditions-changed';
      throw error;
    }
    const baseHistory = getHistory(base, type);
    const remoteHistory = getHistory(remote, type);
    const localHistory = getHistory(local, type);
    if (currentKey === conditionsKey && remoteHistory && remoteHistory.epochId !== epochId && (!baseHistory || baseHistory.epochId !== remoteHistory.epochId)) {
      const error = new Error('別の端末で割り当て条件が変更されました。');
      error.code = 'randomization/conditions-changed';
      throw error;
    }
    if (localHistory && (localHistory.epochId !== epochId || localHistory.conditionsKey !== conditionsKey)) {
      const error = new Error('ランダム割り当て履歴が古いため同期できませんでした。');
      error.code = 'randomization/conditions-changed';
      throw error;
    }
    const resultingHistory = getHistory(result, type);
    const targetHistory = resultingHistory || (currentKey === conditionsKey && remoteHistory) || createRandomizationHistory(conditionsKey, epochId);
    const accepted = { ...targetHistory, runs: { ...targetHistory.runs } };
    for (const runId of runIds) if (typeof runId === 'string' && runId) accepted.runs[runId] = true;
    setPath(result, `allocations/${type}/randomization`, accepted);
  }
  return result;
}

export function withRandomizationSync(sync) {
  return Object.freeze({
    ...sync,
    buildEntityPatch(base, local, options) {
      const patch = sync.buildEntityPatch(base, local, options);
      for (const type of ['car', 'team']) {
        const before = base?.allocations?.[type]?.randomization;
        const after = local?.allocations?.[type]?.randomization;
        if (JSON.stringify(before) !== JSON.stringify(after)) patch[`allocations/${type}/randomization`] = copy(after ?? null);
      }
      return patch;
    },
    applyVersionedEntityPatch(remote, base, local, patch, requestVersion, operationId, operationAppliedAt, context = {}) {
      const entityPatch = { ...patch };
      for (const type of ['car', 'team']) delete entityPatch[`allocations/${type}/randomization`];
      let next = sync.applyVersionedEntityPatch(remote, base, local, entityPatch, requestVersion, operationId, operationAppliedAt);
      for (const type of ['car', 'team']) {
        const remoteKey = getRandomizationConditionsKey(remote, type);
        const nextKey = getRandomizationConditionsKey(next, type);
        const remoteRawHistory = remote?.allocations?.[type]?.randomization;
        const remoteHistory = getHistory(remote, type);
        if (remoteKey !== nextKey || (remoteRawHistory && !remoteHistory)) {
          const epochId = `sync-${String(operationId || requestVersion || 'operation')}-${type}`;
          const localHistory = getHistory(local, type);
          const resetHistory = localHistory?.conditionsKey === nextKey
            ? localHistory
            : createRandomizationHistory(nextKey, epochId);
          setPath(next, `allocations/${type}/randomization`, resetHistory);
        } else if (remoteHistory) {
          setPath(next, `allocations/${type}/randomization`, remoteHistory);
        } else {
          deletePath(next, `allocations/${type}/randomization`);
        }
      }
      return mergeRandomizationHistory({ remote, base, local, next, intent: context.randomizationIntents || [] });
    }
  });
}
