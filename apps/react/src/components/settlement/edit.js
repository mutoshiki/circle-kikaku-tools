// UI drafts use the legacy name projection; only the canonical patch is published.
export function initializeStandaloneCounts(standalone = {}) {
  return {
    ...standalone,
    driverCount: String(standalone.driverCount ?? '').trim() === '' ? '0' : String(standalone.driverCount),
    memberCount: String(standalone.memberCount ?? '').trim() === '' ? '0' : String(standalone.memberCount),
    driverNames: Array.isArray(standalone.driverNames) ? [...standalone.driverNames] : [],
  };
}

export function beginSettlementEdit(store, { car, standalone = false, scope } = {}) {
  const session = store.beginEdit({ kind: 'settlement', scope: scope ?? (car ? (car.participantId ? 'settlement-car' : '') : 'settlement-settings'), participantId: car?.participantId || '' });
  session.name = car?.name || '';
  const { state } = store.domain.settlementInput(session.base);
  const openingState = structuredClone(state);
  if (car) state.cars[car.name] = store.domain.settlement.ensureDriverRewardExtra(state.cars[car.name] || {}, state);
  if (standalone) {
    state.standalone.enabled = true;
    state.standalone = initializeStandaloneCounts(state.standalone);
    state.driverCollectionOffset = false;
    state.driverCollectionFree = false;
    state.organizerFree = false;
  }
  return { session, state, openingState, car };
}

export function beginStandaloneDriverNameEdit(store, standaloneIndex) {
  const index = Number(standaloneIndex);
  if (!Number.isInteger(index) || index < 0) throw new Error('編集する車を確認できません。');
  const edit = beginSettlementEdit(store, { scope: '' });
  const { data } = store.domain.settlementInput(edit.session.base);
  const car = data.cars.find(item => item.standaloneIndex === index);
  if (!edit.state.standalone.enabled || !car) throw new Error('編集する車が見つかりません。');
  const guardedPaths = ['participants', 'settlement/standalone', 'settlement/carsByName', 'settlement/paidByName', 'settlement/paidCollectorByName', 'settlement/driverPaidByName', 'settlement/routePlanner'];
  edit.session.precondition = guardedPaths.map(path => ({ path, value: structuredClone(path.split('/').reduce((value, key) => value?.[key], edit.session.base)) }));
  return { ...edit, standaloneIndex: index, oldName: car.name, driverName: car.name === `車出し${index + 1}` ? '' : edit.state.standalone.driverNames[index] || '', otherCarNames: data.cars.filter(item => item.standaloneIndex !== index).map(item => item.name) };
}

export function applyStandaloneDriverName(edit, settlement, value) {
  const index = edit.standaloneIndex;
  const count = Number(settlement.standalone?.driverCount) || 0;
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  const nextName = normalized || `車出し${index + 1}`;
  const otherCar = edit.otherCarNames.includes(nextName);
  const passengerCount = Number(settlement.standalone?.memberCount) || 0;
  const isSyntheticPassenger = Array.from({ length: passengerCount }, (_, passengerIndex) => `参加者${passengerIndex + 1}`).includes(nextName);
  const isParticipantName = Object.values(edit.session.base.participants || {}).some(person => String(person.name || '').trim() === nextName);
  if (index < 0 || index >= count) return { ok: false, error: '対象の車が変更されました。画面を開き直してください。' };
  if (otherCar || isSyntheticPassenger || isParticipantName) return { ok: false, error: '別の車または参加者と同じ名前は使えません。' };
  const oldName = edit.oldName;
  const maps = ['cars', 'paid', 'paidBy', 'driverPaid'];
  if (nextName !== oldName && maps.some(key => Object.hasOwn(settlement[key] || {}, nextName))) return { ok: false, error: 'この名前には既に精算記録があります。別の名前を入力してください。' };

  const nextStandalone = { ...settlement.standalone, driverNames: [...(settlement.standalone.driverNames || [])] };
  nextStandalone.driverNames[index] = normalized;
  settlement.standalone = nextStandalone;
  if (nextName !== oldName) {
    for (const key of maps) {
      const map = settlement[key] || {};
      if (!Object.hasOwn(map, oldName)) continue;
      settlement[key] = { ...map, [nextName]: map[oldName] };
      delete settlement[key][oldName];
    }
    if (settlement.routePlanner?.targetCarName === oldName) settlement.routePlanner = { ...settlement.routePlanner, targetCarName: nextName };
  }
  edit.driverName = normalized;
  return { ok: true, name: nextName };
}

export function assertStandaloneDriverNameTargetCurrent(store, edit) {
  const { data, state } = store.domain.settlementInput(store.getSnapshot());
  const current = data.cars.find(car => car.standaloneIndex === edit.standaloneIndex);
  if (!state.standalone.enabled || !current || current.name !== edit.oldName) throw new Error('対象の車が別の端末で変更されました。画面を開き直してください。');
  const sameValue = (left, right) => {
    if (Object.is(left, right)) return true;
    if (left === undefined || right === undefined || left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
    if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return sameValue(leftKeys, rightKeys) && leftKeys.every(key => sameValue(left[key], right[key]));
  };
  const conflict = new Error('対象の車または精算情報が別の端末で変更されました。画面を開き直してください。');
  const currentCarNames = data.cars.filter(car => car.standaloneIndex !== edit.standaloneIndex).map(car => car.name);
  if (!sameValue(currentCarNames, edit.otherCarNames)) throw conflict;
  for (const key of ['cars', 'paid', 'paidBy', 'driverPaid']) {
    if (!sameValue(state[key] || {}, edit.state[key] || {})) throw conflict;
  }
  if (!sameValue(state.routePlanner?.targetCarName, edit.state.routePlanner?.targetCarName)) throw conflict;
  const participantNames = participants => Object.values(participants || {}).map(person => String(person.name || '').trim()).sort();
  if (!sameValue(participantNames(store.getSnapshot().participants), participantNames(edit.session.base.participants))) throw conflict;
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
