import { beginSettlementEdit, writeSettlementDraft } from '../components/settlement/edit.js';
import { allocationSaveReceipt, settleAllocationSave } from './allocation-save.js';
import { resolveVehicleCostTarget, vehicleCostTargets } from './vehicle-cost-target.js';

export function beginVehicleCostEdit(runtime, target) {
  const current = resolveVehicleCostTarget(vehicleCostTargets(runtime.store.getSnapshot(), runtime.store.domain), target.key);
  if (!current?.editable) throw new Error(current?.reason || '対象車が見つかりません。車両費用の一覧を確認してください。');
  const edit = beginSettlementEdit(runtime.store, { car: current.car });
  edit.session.scope = 'settlement-car';
  // Standalone names can already map to a participant through the unchanged
  // conversion owner. Select that exact existing path, not a new cost account.
  if (!edit.session.participantId) {
    edit.session.participantId = runtime.store.domain.canonical.findParticipantIdByName(edit.session.base.participants, current.car.name);
  }
  return edit;
}

export function publishVehicleCostEdit(runtime, edit) {
  if (edit.session.base.resetGeneration !== runtime.store.getSnapshot().resetGeneration) throw new Error('企画がリセットされました。現在の費用を確認してください。');
  const current = vehicleCostTargets(runtime.store.getSnapshot(), runtime.store.domain).find(target => target.car.participantId ? target.car.participantId === edit.car.participantId : !edit.car.participantId && target.car.name === edit.car.name);
  if (!current?.editable || current.car.name !== edit.car.name) throw new Error(current?.reason || '対象車が変更されています。現在の費用を確認してください。');
  writeSettlementDraft(runtime.store, edit);
  const intent = runtime.store.commitEdit(edit.session, { close: false });
  return allocationSaveReceipt(runtime, intent, { type: 'cost', label: `${edit.car.name}車の費用` });
}

export function settleVehicleCostSave(runtime, receipt, options) {
  return settleAllocationSave(runtime, receipt, options);
}
