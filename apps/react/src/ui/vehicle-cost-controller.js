import { beginVehicleCostEdit, publishVehicleCostEdit, settleVehicleCostSave } from './vehicle-cost-save.js';
import { vehicleCostTargets, vehicleCostFees, validateVehicleCost } from './vehicle-cost-target.js';

const copy = value => structuredClone(value);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const statusText = disposition => ({ pending: '共有保存中', failed: '共有保存に失敗しました。端末には反映済みです。', unresolved: '保存結果を確認できません。', adjusted: '同時編集により内容が変わりました。現在の費用を確認してください。', saved: '共有保存済み', local: 'この端末に保存', reset: '企画がリセットされました。現在の費用を確認してください。' })[disposition] || '';

export function createVehicleCostController({ runtime, target, cache }) {
  const listeners = new Set(), domain = runtime.store.domain, settlement = domain.settlement;
  let record = cache.read() || { fields: {}, before: {}, added: [], removed: [], resetGeneration: runtime.store.getSnapshot().resetGeneration, name: target.car.name };
  let edit, unavailable = false, status = '', saving = false, closed = false, disposed = false;
  let receipt = record.receipt || null, snapshot, pending;
  if (receipt) status = statusText(receipt.disposition);
  try { edit = beginVehicleCostEdit(runtime, target); } catch (error) { unavailable = true; status = error.message; }
  const car = () => edit?.state.cars[target.car.name];
  const fees = () => car() ? vehicleCostFees(car(), domain) : [];
  const fee = key => fees().find(row => row.key === key);
  const movementType = value => value?.extras?.find(row => settlement.isTimesRentalCar(value) ? settlement.isTimesDistanceFeeExtra(row) : settlement.isGasMovementFeeExtra(row))?.type || 'split';
  const fieldValue = (key, field) => key === 'movement' ? field === 'movementType' ? movementType(car()) : car()?.[field] : fee(key)?.row?.[field];
  if (edit) {
    if (record.resetGeneration !== edit.session.base.resetGeneration || record.name !== target.car.name) unavailable = true;
    if (!receipt) for (const [key, changes] of Object.entries(record.before || {})) for (const [field, value] of Object.entries(changes)) {
      if (record.added?.some(row => key === `extra:${row.id}`)) continue;
      if (key === 'standard:times-time' && record.fields?.movement?.rentalType === 'times' && !settlement.isTimesRentalCar(car())) continue;
      if (!same(fieldValue(key, field), value)) unavailable = true;
    }
    // Retain stale input for inspection/recovery, but never publish it by guessing.
    for (const row of record.added || []) if (!car().extras.some(extra => extra.id === row.id)) car().extras.push(copy(row));
    for (const [key, fields] of Object.entries(record.fields || {})) {
      if (key === 'movement') {
        const { movementType: burden, ...inputs } = fields;
        Object.assign(car(), inputs);
        if (inputs.rentalType) edit.state.cars[target.car.name] = settlement.ensureDriverRewardExtra(car(), edit.state);
        if (burden) {
          const movement = fee('movement').row;
          if (movement) movement.type = burden;
        }
      }
      else if (fee(key)) Object.assign(fee(key).row, fields);
      else unavailable = true;
    }
    for (const key of record.removed || []) car().extras = car().extras.filter(row => row !== fee(key)?.row);
  }
  if (unavailable && !status) status = '下書きの対象や保存前の値が変わっています。入力は残しています。現在の費用を確認してください。';
  function refresh() {
    const room = runtime.store.getSnapshot(), current = vehicleCostTargets(room, domain).find(t => t.key === target.key);
    if (!current?.editable || current.car.name !== target.car.name || room.resetGeneration !== record.resetGeneration) unavailable = true;
    const currentInput = domain.settlementInput(room);
    // Preview consumes current global rules, with this edit's input. Shared
    // publication still compares its original edit session, preserving merge.
    const previewState = car() ? { ...currentInput.state, cars: { ...currentInput.state.cars, [target.car.name]: car() } } : currentInput.state;
    const currentFees = fees();
    snapshot = { edit, fees: currentFees, issues: edit ? validateVehicleCost({ data: currentInput.data, state: previewState, target: current || target, domain, fees: currentFees }) : { fields: [], valid: false },
      dirty: !!receipt || Object.keys(record.fields || {}).length > 0 || !!record.added?.length || !!record.removed?.length,
      recoverable: cache.isRecoverable(), receipt, frozen: saving || !!receipt || closed || unavailable, unavailable, status,
      preview: settlement.calculateSettlement(currentInput.data, settlement.normalizeSettlementState(previewState)), saving };
    if (!disposed) for (const listener of listeners) listener();
  }
  function persist() {
    record.receipt = receipt;
    cache.write(record);
    refresh();
  }
  function remember(key, field) {
    record.before[key] ||= {};
    if (!Object.hasOwn(record.before[key], field)) record.before[key][field] = copy(field === 'movementType' ? movementType(edit.openingState.cars[target.car.name]) : fieldValue(key, field) ?? '');
  }
  function updateField(key, field, value) {
    if (snapshot.frozen) return;
    if (key !== 'movement' && !fee(key)?.editable) return;
    const allowed = key === 'movement' ? ['dist', 'eco', 'price'] : ['name', 'amount', 'type'];
    if (!allowed.includes(field)) return;
    remember(key, field);
    record.fields[key] ||= {};
    record.fields[key][field] = String(value);
    if (key === 'movement') car()[field] = String(value); else fee(key).row[field] = String(value);
    persist();
  }
  function add(row) {
    if (snapshot.frozen) return null;
    const extra = { id: settlement.createSettlementExtraId(), ...row };
    record.added.push(copy(extra)); car().extras.push(extra); persist(); return `extra:${extra.id}`;
  }
  function setRentalType(type) {
    if (snapshot.frozen) return;
    remember('movement', 'rentalType'); record.fields.movement ||= {}; record.fields.movement.rentalType = type;
    edit.state.cars[target.car.name] = settlement.ensureDriverRewardExtra(settlement.ensureTimesRentalExtras({ ...car(), rentalType: type }), edit.state);
    persist();
  }
  function setMovementType(type) {
    if (snapshot.frozen) return;
    remember('movement', 'movementType'); record.fields.movement ||= {}; record.fields.movement.movementType = type;
    let row = fee('movement').row;
    if (!row) {
      row = { id: settlement.createSettlementExtraId(), name: settlement.isTimesRentalCar(car()) ? 'タイムズ距離料金' : 'ガソリン代', amount: '', type };
      car().extras.push(row); record.added.push(copy(row));
    }
    row.type = type; persist();
  }
  function removeExtra(key) {
    if (snapshot.frozen || !fee(key)?.removable) return key;
    const row = fee(key).row;
    if (record.added.some(extra => extra.id === row.id)) record.added = record.added.filter(extra => extra.id !== row.id);
    else { record.removed.push(key); record.before[key] = { ...row }; }
    delete record.fields[key];
    car().extras = car().extras.filter(extra => extra !== row); persist(); return 'movement';
  }
  async function settle(retry = false, observe = false) {
    const result = await settleVehicleCostSave(runtime, receipt, { retry, observe, onReceipt(value) { receipt = value; if (!closed) persist(); } });
    receipt = result.receipt; status = statusText(result.disposition);
    if (['saved', 'local'].includes(result.disposition)) {
      closed = true; cache.clear(); if (edit && !edit.session.closed) runtime.store.cancelEdit(edit.session);
      record = { ...record, fields: {}, before: {}, added: [], removed: [] }; receipt = null;
    } else { if (result.disposition === 'reset') unavailable = true; persist(); }
    refresh(); return result;
  }
  async function save({ composing = false } = {}) {
    if (composing) return { disposition: 'composing', receipt };
    if (pending) return pending;
    if (unavailable) return { disposition: 'unavailable', receipt };
    if (closed || receipt) return { disposition: receipt?.disposition || 'closed', receipt };
    refresh();
    if (!snapshot.issues.valid) return { disposition: 'invalid', receipt };
    saving = true; status = '保存中'; refresh();
    pending = (async () => {
      try { receipt = publishVehicleCostEdit(runtime, edit); persist(); return await settle(); }
      catch (error) { status = receipt ? statusText('unresolved') : error.message; if (receipt) persist(); refresh(); return { disposition: receipt ? 'unresolved' : 'unavailable', receipt }; }
      finally { saving = false; pending = null; refresh(); }
    })();
    return pending;
  }
  async function retry() {
    if (pending) return pending;
    if (!receipt || unavailable) return { disposition: unavailable ? 'unavailable' : 'closed', receipt };
    saving = true; refresh();
    pending = settle(true).finally(() => { saving = false; pending = null; refresh(); }); return pending;
  }
  const unsubscribe = runtime.store.subscribe(refresh);
  const unsubscribeSync = runtime.sync.subscribe?.(() => {
    if (receipt && !saving && !pending && !closed) void settle(false, true);
  });
  refresh();
  return { getSnapshot: () => snapshot, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }, updateField, setRentalType, setMovementType,
    addExtra: () => add({ name: '', amount: '', type: 'split', pending: true }), reuseExtra: row => add({ name: row.name, amount: row.amount, type: row.type, pending: false }), removeExtra, save, retry,
    cancel() { if (receipt || saving) return false; closed = true; cache.clear(); if (edit && !edit.session.closed) runtime.store.cancelEdit(edit.session); record.fields = {}; record.added = []; record.removed = []; refresh(); return true; },
    dispose() { disposed = true; unsubscribe(); unsubscribeSync?.(); listeners.clear(); if (edit && !edit.session.closed) runtime.store.cancelEdit(edit.session); },
  };
}
