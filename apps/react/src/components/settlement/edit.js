// UI drafts use the legacy name projection; only the canonical patch is published.
export function beginSettlementEdit(store, { car, standalone = false } = {}) {
  const session = store.beginEdit({ kind: 'settlement', scope: car ? (car.participantId ? 'settlement-car' : '') : 'settlement-settings', participantId: car?.participantId || '' });
  session.name = car?.name || '';
  const { state } = store.domain.settlementInput(session.base);
  if (car) state.cars[car.name] = store.domain.settlement.ensureDriverRewardExtra(state.cars[car.name] || {}, state);
  if (standalone) {
    state.standalone.enabled = true;
    state.driverCollectionOffset = false;
    state.driverCollectionFree = false;
    state.organizerFree = false;
  }
  return { session, state, openingState: structuredClone(state), car };
}

export function writeSettlementDraft(store, edit) {
  const next = store.domain.canonical.settlementToStorage(store.domain.settlement.normalizeSettlementState(edit.state), edit.session.draft.participants);
  if (edit.session.scope === 'settlement-settings') {
    const opening = store.domain.canonical.settlementToStorage(store.domain.settlement.normalizeSettlementState(edit.openingState), edit.session.base.participants);
    const base = edit.session.base.settlement || {};
    for (const key of new Set([...Object.keys(opening), ...Object.keys(next)])) {
      if (JSON.stringify(next[key]) !== JSON.stringify(opening[key])) continue;
      if (Object.hasOwn(base, key)) next[key] = structuredClone(base[key]);
      else delete next[key];
    }
  }
  edit.session.draft.settlement = next;
}

export async function commitSettlementEdit(runtime, edit) {
  writeSettlementDraft(runtime.store, edit);
  runtime.store.commitEdit(edit.session, { close: false });
  await runtime.sync.flush();
  if (runtime.sync.getSnapshot().kind === 'error') throw new Error(runtime.sync.getSnapshot().message || '保存できませんでした。');
  runtime.store.cancelEdit(edit.session);
}

export function collectionChange(store, { name, checked, payment = false, collector }) {
  const { state } = store.domain.settlementInput(store.getSnapshot());
  const previous = payment ? { driverPaid: { ...state.driverPaid } } : { paid: { ...state.paid }, paidBy: { ...state.paidBy } };
  if (payment) state.driverPaid = { ...state.driverPaid, [name]: checked };
  else {
    state.paid = { ...state.paid, [name]: checked };
    state.paidBy = { ...state.paidBy };
    if (collector && checked) state.paidBy[name] = String(collector).trim();
    if (!checked) delete state.paidBy[name];
  }
  store.command('settlement', { state });
  return { previous, resetGeneration: store.getSnapshot().resetGeneration };
}

export function undoCollectionChange(store, undo) {
  if (undo.resetGeneration !== store.getSnapshot().resetGeneration) throw new Error('企画がリセットされました。');
  const { state } = store.domain.settlementInput(store.getSnapshot());
  // Deliberately preserve the legacy whole-map Undo semantics.
  Object.assign(state, undo.previous);
  store.command('settlement', { state });
}
