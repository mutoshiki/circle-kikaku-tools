// UI identities select existing domain targets; they never become room IDs.
const rowLocators = new WeakMap();
let locatorSequence = 0;

export function vehicleCostTargets(room, domain) {
  const { data } = domain.settlementInput(room);
  const counts = new Map();
  for (const car of data.cars) counts.set(car.name, (counts.get(car.name) || 0) + 1);
  const participantCounts = new Map();
  for (const person of Object.values(room.participants || {})) participantCounts.set(person.name, (participantCounts.get(person.name) || 0) + 1);
  const ordinals = new Map();
  return data.cars.map(car => {
    const ambiguous = counts.get(car.name) > 1 || participantCounts.get(car.name) > 1;
    const ordinal = (ordinals.get(car.name) || 0) + 1;
    ordinals.set(car.name, ordinal);
    return {
      key: car.participantId ? `participant:${car.participantId}` : `name:${car.name}`,
      car,
      label: `${car.name}車${counts.get(car.name) > 1 ? `（${ordinal}）` : ''}`,
      editable: !ambiguous,
      reason: ambiguous ? '同名の参加者がいるため、費用の保存先を特定できません。現在の費用を確認してください。' : '',
    };
  });
}

export function resolveVehicleCostTarget(targets, key) {
  return targets.find(target => target.key === key) || null;
}

export function vehicleCostTargetForGroup(room, domain, groupId) {
  return vehicleCostTargets(room, domain).find(target => target.car.groupId === groupId) || null;
}

export function vehicleCostFees(carState, domain) {
  const settlement = domain.settlement;
  const movement = carState.extras?.find(row => settlement.isTimesRentalCar(carState) ? settlement.isTimesDistanceFeeExtra(row) : settlement.isGasMovementFeeExtra(row));
  const fees = [{ key: 'movement', row: movement || null, kind: 'movement', editable: true, removable: false }];
  for (const row of carState.extras || []) {
    if (settlement.isTimesDistanceFeeExtra(row) || settlement.isGasMovementFeeExtra(row)) continue;
    if (!row.id && !rowLocators.has(row)) rowLocators.set(row, `local:${++locatorSequence}`);
    const reward = settlement.isDriverRewardExtra(row);
    const standard = reward || settlement.isTimesTimeFeeExtra(row);
    fees.push({ key: row.id ? `extra:${row.id}` : standard ? reward ? 'standard:reward' : 'standard:times-time' : rowLocators.get(row), row, kind: reward ? 'reward' : standard ? 'times-time' : 'extra', editable: !reward, removable: !standard });
  }
  return fees;
}

export function validateVehicleCost({ data, state, target, domain, fees }) {
  const settlement = domain.settlement;
  const normalized = settlement.normalizeSettlementState(state);
  const car = settlement.ensureDriverRewardExtra(normalized.cars[target.car.name], normalized);
  const targetData = { ...data, cars: [target.car] };
  const result = settlement.calculateSettlement(targetData, normalized);
  const readiness = settlement.getSettlementIssues(targetData, normalized, result);
  const fields = [];
  const add = (feeKey, field, message) => {
    if (!fields.some(issue => issue.feeKey === feeKey && issue.field === field)) fields.push({ feeKey, field, message });
  };
  // These are structured field keys from the unchanged owner, not translated messages.
  const prefix = `${target.car.name}:`;
  for (const key of readiness.fields) {
    if (!key.startsWith(prefix)) continue;
    const field = key.slice(prefix.length);
    if (['dist', 'eco', 'price'].includes(field)) add('movement', field, '計算に必要な0より大きい値を入力してください。');
    else {
      const match = /^extra:(\d+):(name|amount)$/.exec(field);
      if (!match) continue;
      const row = car.extras[Number(match[1])];
      const fee = row && fees.find(f => f.row && (row.id ? f.row.id === row.id : f.row.name === row.name && f.row.amount === row.amount && f.row.type === row.type));
      if (fee) add(fee.key, match[2], match[2] === 'name' ? '費用名を入力してください。' : '金額を入力してください。');
    }
  }
  const rawCar = state.cars[target.car.name];
  for (const field of settlement.isTimesRentalCar(rawCar) ? ['dist'] : ['dist', 'eco', 'price']) {
    if (/^[-−]/.test(String(rawCar[field] ?? '').trim())) add('movement', field, '0以上の値を入力してください。');
  }
  for (const fee of fees) {
    if (fee.kind !== 'movement' && fee.editable && /^[-−]/.test(String(fee.row?.amount ?? '').trim())) add(fee.key, 'amount', '金額は0円以上で入力してください。');
  }
  return { fields, valid: target.editable && fields.length === 0 };
}
