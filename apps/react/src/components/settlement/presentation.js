const movementFields = timesRental => timesRental
  ? [{ key: 'dist', label: '移動距離' }]
  : [{ key: 'dist', label: '移動距離' }, { key: 'eco', label: '燃費' }, { key: 'price', label: 'ガソリン単価' }];

function fieldError(value, label, { allowZero = true } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const number = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(number)) return `${label}は数値で入力してください。`;
  if (number < 0 || (!allowZero && number === 0)) return `${label}は${allowZero ? '0以上' : '0より大きい値'}を入力してください。`;
  return '';
}

const money = value => {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded < 0 ? '−' : ''}¥${Math.abs(rounded).toLocaleString('ja-JP')}`;
};

export function getPaymentSourcePresentation(total, split, club) {
  const totalValue = Number(total) || 0;
  const splitValue = Number(split) || 0;
  const clubValue = Number(club) || 0;
  if (totalValue > 0 && splitValue > 0 && clubValue === 0) return [{ id: 'single', label: '全額集金から', value: null }];
  if (totalValue > 0 && clubValue > 0 && splitValue === 0) return [{ id: 'single', label: '全額部費から', value: null }];
  return [
    ...(splitValue !== 0 ? [{ id: 'split', label: totalValue <= 0 ? '集金分' : '集金から', value: money(splitValue) }] : []),
    ...(clubValue !== 0 ? [{ id: 'club', label: totalValue <= 0 ? '部費分' : '部費から', value: money(clubValue) }] : []),
  ];
}

export function getMovementInputStatus(car, settlement) {
  const fields = movementFields(settlement.isTimesRentalCar(car));
  const errors = Object.fromEntries(fields.map(({ key, label }) => [key, fieldError(car?.[key], label, { allowZero: key !== 'eco' })]));
  const missingFields = fields.filter(({ key }) => !String(car?.[key] ?? '').trim());
  const invalidFields = fields.filter(({ key }) => errors[key]);
  return {
    kind: invalidFields.length ? 'invalid' : missingFields.length ? 'missing' : 'ready',
    fields,
    errors,
    missingFields,
    invalidFields,
  };
}

export function getVehicleExpenseStatus(car, settlement) {
  const movement = getMovementInputStatus(car, settlement);
  const extras = (car?.extras || []).filter(row => !row.pending && !settlement.isDriverRewardExtra(row)
    && !settlement.isTimesDistanceFeeExtra(row) && !settlement.isGasMovementFeeExtra(row)
    && !settlement.isTimesTimeFeeExtra(row) && settlement.hasMeaningfulExtra(row));
  const savedManualExpenses = extras.filter(row => String(row.name || '').trim() && String(row.amount ?? '').trim()
    && !fieldError(row.amount, '金額') && !/^[-−]/.test(String(row.amount).trim()));
  const partialManualExpenses = extras.some(row => {
    const hasName = Boolean(String(row.name || '').trim());
    const amount = String(row.amount ?? '').trim();
    return hasName !== Boolean(amount) || (hasName && Boolean(amount) && Boolean(fieldError(amount, '金額')));
  });
  const timeFeeRows = (car?.extras || []).filter(row => settlement.isTimesTimeFeeExtra(row));
  const timeFee = timeFeeRows.some(row => settlement.isTimesTimeFeeExtra(row)
    && String(row.amount ?? '').trim() && !fieldError(row.amount, '金額'));
  const invalidTimeFee = timeFeeRows.some(row => String(row.amount ?? '').trim() && Boolean(fieldError(row.amount, '金額')));
  return {
    movement,
    savedManualExpenses,
    hasSavedExpenses: savedManualExpenses.length > 0 || timeFee || movement.kind === 'ready',
    hasPartialExpenses: partialManualExpenses || invalidTimeFee || (movement.kind !== 'ready' && (movement.fields.some(({ key }) => String(car?.[key] ?? '').trim()) || (settlement.isTimesRentalCar(car) && timeFee))),
  };
}
