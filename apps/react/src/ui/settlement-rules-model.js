import { writeSettlementDraft } from '../components/settlement/edit.js';
import { vehicleCostTargets, vehicleCostFees } from './vehicle-cost-target.js';

// This adapter orchestrates the protected domain; it never publishes a room.
export function projectSettlementRules({ room, edit, domain }) {
  const copy = structuredClone(edit);
  writeSettlementDraft({ domain }, copy);
  const patch = domain.sync.buildSettlementSettingsIntentPatch(edit.session.base, copy.session.draft);
  const candidateRoom = domain.sync.applyEntityPatchToObject(room, patch);
  const currentInput = domain.settlementInput(room), candidateInput = domain.settlementInput(candidateRoom);
  const current = domain.settlement.calculateSettlement(currentInput.data, currentInput.state);
  const candidate = domain.settlement.calculateSettlement(candidateInput.data, candidateInput.state);
  return { patch, candidateRoom, currentInput, candidateInput, current, candidate,
    readiness: settlementRulesReadiness({ room: candidateRoom, input: candidateInput, result: candidate, domain }) };
}

export function validateSettlementRules(state) {
  const fields = [];
  const negative = (value) => /^[-−]/.test(String(value ?? '').trim());
  if (state.standalone.enabled) {
    for (const key of ['driverCount', 'memberCount']) if (negative(state.standalone[key])) fields.push({ key: `standalone.${key}`, message: '0以上の人数を入力してください。' });
    if (!fields.length && (Number(state.standalone.driverCount) || 0) + (Number(state.standalone.memberCount) || 0) <= 0) fields.push({ key: 'standalone.driverCount', message: '精算する人数を入力してください。' });
  }
  if (negative(state.driverReward)) fields.push({ key: 'driverReward', message: '協力代は0円以上で入力してください。' });
  return { valid: fields.length === 0, fields };
}

export function settlementRulesSafety({ room, edit, organizerId = null, patch, domain }) {
  const issues = [];
  if (room.resetGeneration !== edit.session.base.resetGeneration) issues.push({ key: 'reset', reason: '企画がリセットされました。入力の控えを残しています。現在の精算を確認してください。', fieldKey: null });
  for (const path of Object.keys(patch)) {
    if (JSON.stringify(domain.sync.getSyncPathValue(room, path)) !== JSON.stringify(domain.sync.getSyncPathValue(edit.session.base, path))) {
      issues.push({ key: 'stale-settings', reason: '変更中の精算ルールが別の端末で更新されました。現在のルールから編集し直してください。', fieldKey: null });
      break;
    }
  }
  // An unchanged ID still must not silently acquire a different person's name.
  const id = organizerId ?? edit.session.base.settlement?.organizerParticipantId;
  if (id && !edit.state.standalone.enabled) {
    const person = room.participants?.[id], key = domain.canonical.normalizeNameKey;
    if (!person || key(person.name) !== key(edit.state.organizerName)) issues.push({ key: 'organizer-missing', reason: '選択した企画者が変更されています。企画者を選び直してください。', fieldKey: 'organizerName' });
    else if (Object.values(room.participants || {}).filter(value => key(value.name) === key(person.name)).length !== 1) issues.push({ key: 'organizer-ambiguous', reason: '同じ名前として扱われる参加者がいます。企画者を特定できません。', fieldKey: 'organizerName' });
  }
  return issues;
}

export function settlementRulesReadiness({ room, input, result, domain }) {
  const { data, state } = input, issues = [], owner = domain.settlement.getSettlementIssues(data, state, result);
  if (!result.participants.length) issues.push({ key: 'participants', message: '精算対象がいません。参加者を登録するか、人数を入力してください。', destination: { kind: state.standalone.enabled ? 'rule' : 'participants', fieldKey: 'standalone.driverCount' } });
  if (!data.cars.length) issues.push({ key: 'drivers', message: '車がありません。車割または人数だけの精算を確認してください。', destination: { kind: 'rule', fieldKey: 'standalone.enabled' } });
  if (!result.isStandaloneSettlement && state.organizerFree && result.participants.length && !state.organizerName) issues.push({ key: 'organizer', message: '企画者を選ぶと、免除対象を正確にできます。', destination: { kind: 'rule', fieldKey: 'organizerName' } });
  if (result.payerCount <= 0 && result.participants.length) issues.push({ key: 'payers', message: '現金を集める対象が0人です。免除・差し引きを確認してください。', destination: { kind: 'rule', fieldKey: 'driverCollectionRule' } });
  for (const target of vehicleCostTargets(room, domain)) {
    const name = target.car.name, car = domain.settlement.ensureDriverRewardExtra(state.cars[name] || {}, state);
    const fees = vehicleCostFees(car, domain);
    for (const key of owner.fields) {
      const prefix = `${name}:`; if (!key.startsWith(prefix)) continue;
      const field = key.slice(prefix.length), match = /^extra:(\d+):(name|amount)$/.exec(field);
      const row = match && car.extras[Number(match[1])];
      const fee = match ? fees.find(item => item.row === row) : fees[0];
      const label = match ? `${row?.name || '追加費用'}の${match[2] === 'name' ? '費用名' : '金額'}` : ({ dist: '移動距離', eco: '燃費', price: 'ガソリン単価' }[field] || field);
      // Stable IDs / standard keys only; no invented locator for an unknown row.
      const destination = target.editable && fee ? { kind: 'vehicle-cost', destination: { carKey: target.key, task: 'expense', expenseKey: fee.key, returnTo: { section: 'settlement' } } } : null;
      issues.push({ key, message: `${target.label}: ${label}を入力してください。${!target.editable ? target.reason : ''}`, destination });
    }
  }
  return issues;
}
