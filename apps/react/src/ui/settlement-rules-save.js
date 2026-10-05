import { writeSettlementDraft } from '../components/settlement/edit.js';
import { allocationSaveReceipt, settleAllocationSave } from './allocation-save.js';
import { projectSettlementRules, settlementRulesSafety } from './settlement-rules-model.js';

export function publishSettlementRulesEdit(runtime, edit, { organizerId = null } = {}) {
  const domain = runtime.store.domain, room = runtime.store.getSnapshot();
  const { patch } = projectSettlementRules({ room, edit, domain });
  const unsafe = settlementRulesSafety({ room, edit, organizerId, patch, domain });
  if (unsafe.length) throw new Error(unsafe[0].reason);
  if (!Object.keys(patch).length) return null;
  writeSettlementDraft(runtime.store, edit);
  const intent = runtime.store.commitEdit(edit.session, { close: false });
  return allocationSaveReceipt(runtime, intent, { type: 'settlement-rules', label: '精算ルール' });
}
export function settleSettlementRulesSave(runtime, receipt, options) {
  return settleAllocationSave(runtime, receipt, options);
}
