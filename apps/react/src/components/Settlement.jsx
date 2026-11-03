import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion, Button, Callout, Checkbox, ComposedModal, ContainedList, ContainedListItem, ContentSwitcher, IconButton, InlineNotification, Modal, ModalBody, ModalFooter, ModalHeader,
  NumberInput, RadioButton, RadioButtonGroup, Link,
  Select, SelectItem, Switch, Tag, TextArea, TextInput, Tile, OverflowMenu, OverflowMenuItem,
} from '@carbon/react';
import { Add, Copy, Edit, TrashCan } from '@carbon/icons-react';
import { assertSettlementExtraTargetCurrent, beginSettlementEdit, beginStandaloneDriverNameEdit, commitSettlementEdit, collectionChange } from './settlement/edit.js';
import DistanceGuide from './settlement/DistanceGuide.jsx';
import { readDistanceGuideHidden, writeDistanceGuideHidden } from '../services/distance-guide-preference.js';
import { clearSettlementCarCheckpoint, readSettlementCarCheckpoint, writeSettlementCarCheckpoint } from '../services/settlement-car-checkpoint.js';
import useMediaQuery from '../hooks/useMediaQuery.js';
import InitialEmptyState from './InitialEmptyState.jsx';
import StandaloneDriverNameModal from './StandaloneDriverNameModal.jsx';
import SettlementPaymentRow from './settlement/SettlementPaymentRow.jsx';

const money = value => {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded < 0 ? '−' : ''}¥${Math.abs(rounded).toLocaleString('ja-JP')}`;
};
const hasNegativeValue = value => /^[-−]/.test(String(value ?? '').trim());
const negativeMoneyText = '金額は0円以上で入力してください。';
const negativeNumberText = '0以上の値を入力してください。';
const sessionStorageOrNull = () => { try { return window.sessionStorage; } catch { return null; } };
const extraTypeLabel = type => ({ split: '割勘', club: '部費', 'split-minus': '割勘から差し引き', 'club-minus': '部費から差し引き' })[type] || '割勘';
const movementFieldDefinitions = times => times
  ? [{ key: 'dist', label: '移動距離' }]
  : [{ key: 'dist', label: '移動距離' }, { key: 'eco', label: '燃費' }, { key: 'price', label: 'ガソリン単価' }];
function movementFieldError(value, label, { allowZero = true } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const number = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(number)) return `${label}は数値で入力してください。`;
  if (number < 0 || (!allowZero && number === 0)) return `${label}は${allowZero ? '0以上' : '0より大きい値'}を入力してください。`;
  return '';
}
function getMovementErrors(car, domain) {
  const fields = movementFieldDefinitions(domain.isTimesRentalCar(car));
  return Object.fromEntries(fields.map(({ key, label }) => [key, movementFieldError(car?.[key], label, { allowZero: key !== 'eco' })]));
}
function getExpenseFieldErrors(row) {
  const name = String(row?.name ?? '').trim();
  const amount = String(row?.amount ?? '').trim();
  const parsedAmount = amount ? Number(amount.replace(/,/g, '')) : null;
  return {
    name: !name ? '費用名を入力してください。' : '',
    amount: !amount ? '金額を入力してください。' : hasNegativeValue(amount) ? negativeMoneyText : !Number.isFinite(parsedAmount) ? '金額は0円以上の数値で入力してください。' : '',
  };
}
function isMovementCalculationIssue(message) {
  return /(?:ガソリン代|タイムズ移動料金)を計算するため、/.test(message);
}
function isExpenseInputIssue(message) {
  return message.includes('追加費用が未入力です。')
    || message.includes('追加費用に費用名がない行があります。')
    || /車の「.+」の金額が空です。/.test(message);
}

function getSettlementAmountSnapshot(store) {
  const snapshot = store.getSnapshot();
  const { data, state } = store.domain.settlementInput(snapshot);
  const result = store.domain.settlement.calculateSettlement(data, state);
  const hasRecordedCollections = result.participants.some(person => !result.excludedNames.has(person.name) && state.paid[person.name]);
  return { amount: result.perPerson, hasRecordedCollections };
}

function settlementSaveNotice(label, before, after) {
  if (before.amount === after.amount) return label;
  const change = `1人あたりの集金額が ${money(before.amount)} から ${money(after.amount)} に変更されました。`;
  return `${label} ${change}${after.hasRecordedCollections ? ' 記録済みの集金状況を確認してください。' : ''}`;
}

function CostTypeControl({ domain, id, label = '支払元', type, disabled = false, allowNegative = true, onChange }) {
  const normalized = domain.normalizeSettlementExtraType(type);
  const baseType = domain.getSettlementExtraBaseType(normalized);
  const negative = allowNegative && domain.isNegativeSettlementExtraType(normalized);
  const setBaseType = value => onChange(`${value}${negative ? '-minus' : ''}`);
  return <div className="settlement-cost-type-control"><RadioButtonGroup id={`${id}-group`} legendText={label} name={`${id}-type`} valueSelected={baseType} disabled={disabled} onChange={setBaseType} orientation="horizontal">
    <RadioButton id={`${id}-split`} value="split" labelText="割勘" />
    <RadioButton id={`${id}-club`} value="club" labelText="部費" />
  </RadioButtonGroup>
  {allowNegative ? <Checkbox id={`${id}-minus`} labelText={`${baseType === 'club' ? '部費' : '割勘'}から差し引く`} checked={negative} disabled={disabled} onChange={(_, { checked }) => onChange(`${baseType}${checked ? '-minus' : ''}`)} /> : null}</div>;
}

function MovementSettingsView({ car, domain, isMobile, movementAmount, movementLabel, movementFormula, movementType, movementErrors, movementTouched, movementAttempted, movementComplete, showDistanceGuide, onBlurField, onOpenGuide, onOpenMaps, onRentalType, onMovementType, onUpdate }) {
  const times = domain.isTimesRentalCar(car);
  const input = (id, label, value, key) => {
    const error = movementTouched[key] || movementAttempted || String(value ?? '').trim() ? movementErrors[key] : '';
    return <TextInput id={id} labelText={label} inputMode="decimal" invalid={!!error} invalidText={error || negativeNumberText} value={value} onBlur={() => onBlurField(key)} onChange={event => onUpdate({ [key]: event.target.value })} />;
  };
  const previewAmount = movementComplete ? money(movementAmount) : money(0);
  return <div className="form-stack settlement-movement-form">
      <RadioButtonGroup legendText="車の種類" name="settlement-rental-type" valueSelected={car.rentalType} onChange={onRentalType} orientation="horizontal">
        <RadioButton id="settlement-rental-type" value="private" labelText="自家用車" />
        <RadioButton id="settlement-rental-times" value="times" labelText="タイムズ" />
      </RadioButtonGroup>
      <section className="settlement-form-section" aria-labelledby="settlement-movement-conditions-title"><h3 className="settlement-movement-section-title" id="settlement-movement-conditions-title">{times ? '距離料金の計算条件' : 'ガソリン代の計算条件'}</h3>
        {!movementComplete && <p className="cds--form__helper-text">計算する場合は、{times ? '移動距離を' : '移動距離・燃費・ガソリン単価をすべて'}入力してください。</p>}
        <div className="form-grid">
        <div className="distance-field">{input('settlement-distance', '移動距離（km）', car.dist, 'dist')}{showDistanceGuide ? <Button className="settlement-route-distance-action" kind="ghost" size={isMobile ? 'lg' : 'sm'} onClick={onOpenGuide}>Googleマップで距離を確認</Button> : <Link className="settlement-route-distance-action" href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" onClick={onOpenMaps}>Googleマップで距離を確認</Link>}{!showDistanceGuide && <Button kind="ghost" size="sm" onClick={onOpenGuide}>操作方法</Button>}</div>
        {!times && <>{input('settlement-eco', '燃費（km/L）', car.eco, 'eco')}{input('settlement-price', 'ガソリン単価（円/L）', car.price, 'price')}</>}
        </div></section>
      <CostTypeControl domain={domain} id="settlement-movement-type" type={movementType || 'split'} allowNegative={false} onChange={onMovementType} />
      <Tile className="settlement-movement-preview" aria-label={`${movementLabel} ${previewAmount}。計算条件: ${movementFormula}`}><span>{movementLabel}の金額</span><strong>{previewAmount}</strong></Tile>
    </div>;
}

function getExtraCandidates(state, domain, currentCar) {
  const candidates = new Map();
  Object.values(state.cars || {}).flatMap(car => car.extras || []).forEach(row => {
    const name = String(row?.name || '').trim();
    const amount = String(row?.amount ?? '').trim();
    const type = domain.normalizeSettlementExtraType(row?.type);
    const numericAmount = Number(amount.replace(/,/g, ''));
    if (!name || !amount || !Number.isFinite(numericAmount) || domain.isDriverRewardExtra(row) || domain.isGasMovementFeeExtra(row) || domain.isTimesDistanceFeeExtra(row) || domain.isTimesTimeFeeExtra(row)) return;
    const key = `${name}\u0000${numericAmount}\u0000${type}`;
    if (currentCar.extras.some(existing => {
      const existingAmount = Number(String(existing?.amount ?? '').trim().replace(/,/g, ''));
      return String(existing?.name ?? '').trim() === name
        && Number.isFinite(existingAmount)
        && existingAmount === numericAmount
        && domain.normalizeSettlementExtraType(existing.type) === type;
    })) return;
    if (!candidates.has(key)) candidates.set(key, { key, name, amount: String(numericAmount), type });
  });
  return [...candidates.values()];
}

function CarEditor({ runtime, edit: initialEdit, onEditChange, onClose, onNotice, launcherButtonRef }) {
  const domain = runtime.store.domain.settlement;
  const isMobile = useMediaQuery('(max-width: 671px)');
  const [, render] = useState(0);
  const [edit, setEdit] = useState(initialEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [view, setView] = useState(edit.restoredView || 'expense');
  const [contentAtBottom, setContentAtBottom] = useState(false);
  const [movementTouched, setMovementTouched] = useState({});
  const [movementAttempted, setMovementAttempted] = useState(false);
  const [expenseTouched, setExpenseTouched] = useState({});
  const [expenseAttempted, setExpenseAttempted] = useState(false);
  const [activeCostId, setActiveCostId] = useState('movement');
  const [extraMode, setExtraMode] = useState('edit');
  const [removedExpense, setRemovedExpense] = useState(null);
  const [contentHasOverflow, setContentHasOverflow] = useState(false);
  const [returnFocusId, setReturnFocusId] = useState('#settlement-movement-edit');
  const [distanceGuideHidden, setDistanceGuideHidden] = useState(() => readDistanceGuideHidden(runtime.preferenceStorage));
  const name = initialEdit.car.name;
  const participantId = initialEdit.car.participantId || '';
  const liveSnapshot = runtime.store.getSnapshot();
  const { data: liveData, state: liveState } = runtime.store.domain.settlementInput(liveSnapshot);
  const liveCar = liveData.cars.find(item => participantId ? item.participantId === participantId : item.name === name);
  const car = view === 'expense'
    ? domain.ensureTimesRentalExtras(liveState.cars[name] || liveCar || {})
    : edit.state.cars[name];
  const data = runtime.store.domain.settlementInput(edit.session.base).data;
  const calculated = domain.calculateSettlement(view === 'expense' ? liveData : data, domain.normalizeSettlementState(view === 'expense' ? liveState : edit.state));
  const calculatedCar = calculated.cars.find(row => row.name === name);
  const update = changes => { edit.state.cars[name] = { ...car, ...changes }; render(value => value + 1); };
  const updateExtra = (index, changes) => update({ extras: car.extras.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row) });
  const updateExtraField = (index, changes) => {
    const next = { ...car.extras[index], ...changes };
    const empty = !String(next.name ?? '').trim() && !String(next.amount ?? '').trim();
    updateExtra(index, { ...changes, pending: empty && !domain.isTimesTimeFeeExtra(next) });
  };
  const movement = car.extras.find(row => domain.isTimesRentalCar(car) ? domain.isTimesDistanceFeeExtra(row) : domain.isGasMovementFeeExtra(row));
  const movementLabel = domain.isTimesRentalCar(car) ? 'タイムズ移動料金' : 'ガソリン代';
  const movementAmount = calculatedCar?.movementAmount ?? 0;
  const movementErrors = getMovementErrors(car, domain);
  const movementFields = movementFieldDefinitions(domain.isTimesRentalCar(car));
  const firstMovementError = movementFields.find(field => movementErrors[field.key]);
  const movementComplete = movementFields.every(({ key }) => String(car[key] ?? '').trim()) && Object.values(movementErrors).every(message => !message);
  const movementValid = Object.values(movementErrors).every(message => !message);
  const movementFormula = domain.isTimesRentalCar(car)
    ? (movementComplete ? `移動距離 ${Number(car.dist).toLocaleString('ja-JP')}km` : '移動距離を入力してください')
    : (movementComplete ? `${Number(car.dist).toLocaleString('ja-JP')}km ÷ ${car.eco}km/L × ${car.price}円/L` : '移動距離・燃費・ガソリン単価を入力してください');
  const editable = car.extras.map((row, index) => ({ row, index })).filter(({ row }) => !domain.isDriverRewardExtra(row) && !domain.isTimesDistanceFeeExtra(row) && !domain.isGasMovementFeeExtra(row));
  const hasNegativeMovement = movementFields.some(({ key }) => hasNegativeValue(car[key]));
  const hasNegativeExpense = editable.some(({ row }) => hasNegativeValue(row.amount));
  const validationMessage = hasNegativeExpense ? negativeMoneyText : hasNegativeMovement ? '移動距離・燃費・ガソリン単価は0以上の数値で入力してください。' : '';
  const getCostId = (row, index) => row.id || `extra-${index}`;
  const activeExtra = editable.find(({ row, index }) => getCostId(row, index) === activeCostId);
  const expenseFieldErrors = getExpenseFieldErrors(activeExtra?.row);
  const expenseComplete = Object.values(expenseFieldErrors).every(message => !message);
  const candidates = getExtraCandidates(view === 'expense' ? liveState : edit.state, domain, car);
  function changeView(nextView) { setContentAtBottom(false); setView(nextView); }
  function beginOperationEdit() {
    if (edit?.session && !edit.session.closed) runtime.store.cancelEdit(edit.session);
    const currentData = runtime.store.domain.settlementInput(runtime.store.getSnapshot()).data;
    const currentCar = currentData.cars.find(item => participantId ? item.participantId === participantId : item.name === name);
    if (!currentCar) throw new Error('対象の車が見つかりません。画面を開き直してください。');
    const next = beginSettlementEdit(runtime.store, { car: currentCar });
    next.state.cars[name] = domain.ensureTimesRentalExtras(next.state.cars[name]);
    setEdit(next);
    onEditChange(next);
    return next;
  }
  function refreshList(focusId = returnFocusId) {
    if (edit?.session && !edit.session.closed) runtime.store.cancelEdit(edit.session);
    const currentData = runtime.store.domain.settlementInput(runtime.store.getSnapshot()).data;
    const currentCar = currentData.cars.find(item => participantId ? item.participantId === participantId : item.name === name);
    if (!currentCar) { onClose(false); return; }
    const next = beginSettlementEdit(runtime.store, { car: currentCar });
    setEdit(next);
    onEditChange(next);
    setReturnFocusId(focusId);
    setError('');
    changeView('expense');
  }
  function handleModalScroll(event) {
    if (!['expense', 'extra', 'movement', 'distance-guide'].includes(view) || !event.target?.classList?.contains('cds--modal-content')) return;
    const content = event.target;
    const hasOverflow = content.scrollHeight > content.clientHeight + 1;
    const atBottom = !hasOverflow || content.scrollTop + content.clientHeight >= content.scrollHeight - 2;
    setContentAtBottom(current => current === atBottom ? current : atBottom);
  }
  function setRentalType(rentalType) { update(domain.ensureTimesRentalExtras({ ...car, rentalType })); }
  function setMovementType(type) {
    const index = car.extras.findIndex(row => domain.isTimesRentalCar(car) ? domain.isTimesDistanceFeeExtra(row) : domain.isGasMovementFeeExtra(row));
    if (index >= 0) updateExtra(index, { type });
    else update({ extras: [...car.extras, { id: domain.createSettlementExtraId(), name: 'ガソリン代', amount: '', type }] });
  }
  function openMovementEditor() {
    try {
      beginOperationEdit();
      setMovementTouched({});
      setMovementAttempted(false);
      setReturnFocusId('#settlement-movement-edit');
      changeView('movement');
    } catch (caught) { setError(caught.message); }
  }
  function addExtra() {
    try {
      const next = beginOperationEdit();
      const row = { id: domain.createSettlementExtraId(), name: '', amount: '', type: 'split', pending: true };
      next.state.cars[name] = { ...next.state.cars[name], extras: [...next.state.cars[name].extras, row] };
      setEdit(next);
      setActiveCostId(row.id);
      setExtraMode('add');
      setExpenseTouched({});
      setExpenseAttempted(false);
      setRemovedExpense(null);
      setReturnFocusId('#settlement-cost-add');
      setError('');
      changeView('extra');
    } catch (caught) { setError(caught.message); }
  }
  function openExtraEditor(id, focusId) {
    try {
      beginOperationEdit();
      setActiveCostId(id);
      setExtraMode('edit');
      setExpenseTouched({});
      setExpenseAttempted(false);
      setReturnFocusId(focusId);
      setError('');
      changeView('extra');
    } catch (caught) { setError(caught.message); }
  }
  async function addCandidate(candidate) {
    if (saving) return;
    let next;
    try {
      next = beginOperationEdit();
      const row = { id: domain.createSettlementExtraId(), ...candidate, pending: false };
      next.state.cars[name] = { ...next.state.cars[name], extras: [...next.state.cars[name].extras, row] };
      assertSettlementExtraTargetCurrent(runtime.store, next, { id: row.id, expected: null, intended: row });
      setSaving(true);
      await commitSettlementEdit(runtime, next);
      onNotice(`${candidate.name}を追加しました。`);
      refreshList('#settlement-cost-add');
    } catch (caught) { setError(caught.message); }
    finally { setSaving(false); }
  }
  async function removeActiveExtra() {
    if (!activeExtra || extraMode !== 'edit' || domain.isTimesTimeFeeExtra(activeExtra.row)) return;
    if (saving) return;
    const { row, index } = activeExtra;
    const original = runtime.store.domain.settlementInput(edit.session.base).state.cars[name]?.extras?.find(item => item.id === row.id) || null;
    try {
      assertSettlementExtraTargetCurrent(runtime.store, edit, { id: row.id, expected: original, intended: null });
      edit.state.cars[name] = { ...edit.state.cars[name], extras: edit.state.cars[name].extras.filter(item => item.id !== row.id) };
      setSaving(true);
      setError('');
      await commitSettlementEdit(runtime, edit);
      setRemovedExpense({ row, index });
      setActiveCostId('movement');
      setExpenseAttempted(false);
      setExpenseTouched({});
      refreshList('#settlement-cost-add');
    } catch (caught) { setError(caught.message); }
    finally { setSaving(false); }
  }
  async function undoRemoveExpense() {
    if (!removedExpense || saving) return;
    const { row, index } = removedExpense;
    let next;
    try {
      next = beginOperationEdit();
      assertSettlementExtraTargetCurrent(runtime.store, next, { id: row.id, expected: null, intended: row });
      const extras = [...next.state.cars[name].extras];
      extras.splice(Math.max(0, Math.min(index, extras.length)), 0, row);
      next.state.cars[name] = { ...next.state.cars[name], extras };
      setSaving(true);
      await commitSettlementEdit(runtime, next);
      setRemovedExpense(null);
      refreshList(`#settlement-extra-edit-${index}`);
    } catch (caught) { setError(caught.message); }
    finally { setSaving(false); }
  }
  useEffect(() => {
    const firstExpenseError = ['name', 'amount'].find(key => expenseFieldErrors[key]);
    const movementFocusId = firstMovementError?.key === 'dist' ? 'distance' : firstMovementError?.key;
    const selector = view === 'expense' ? returnFocusId : view === 'extra' ? (expenseAttempted && firstExpenseError ? `#settlement-extra-${firstExpenseError}-${activeExtra?.index ?? 0}` : `#settlement-extra-name-${activeExtra?.index ?? 0}`) : view === 'movement' ? (movementAttempted && movementFocusId ? `#settlement-${movementFocusId}` : '#settlement-rental-type') : '#distance-guide-open-maps';
    const timer = setTimeout(() => {
      document.querySelector(selector)?.focus();
      if (view === 'movement' || view === 'distance-guide') {
        const content = document.querySelector('.settlement-car-modal .cds--modal-content');
        if (content) setContentAtBottom(content.scrollHeight <= content.clientHeight + 1);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [view, activeExtra?.index, returnFocusId, movementAttempted, expenseAttempted]);
  useEffect(() => {
    if (!['expense', 'extra'].includes(view)) {
      setContentHasOverflow(false);
      return undefined;
    }
    const body = document.querySelector('.settlement-car-modal .cds--modal-content');
    const content = body?.querySelector('.settlement-car-form');
    if (!body || !content) return undefined;
    const measure = () => {
      const hasOverflow = body.scrollHeight > body.clientHeight + 1;
      const atBottom = !hasOverflow || body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
      setContentHasOverflow(current => current === hasOverflow ? current : hasOverflow);
      setContentAtBottom(current => current === atBottom ? current : atBottom);
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(body);
    resizeObserver.observe(content);
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(content, { childList: true, subtree: true, characterData: true });
    return () => { resizeObserver.disconnect(); mutationObserver.disconnect(); };
  }, [view, activeCostId, car.extras.length, candidates.length]);
  async function save() {
    if (composing || saving) return;
    if (view === 'movement' && !movementValid) { setMovementAttempted(true); setError(''); return; }
    if (view === 'extra' && !expenseComplete) { setExpenseAttempted(true); return; }
    if (!['extra', 'movement'].includes(view) || !edit?.session || edit.session.closed) return;
    let successLabel;
    if (view === 'extra') {
      const { row, index } = activeExtra;
      const intended = { ...row, pending: false };
      const expected = runtime.store.domain.settlementInput(edit.session.base).state.cars[name]?.extras?.find(item => item.id === row.id) || null;
      try {
        assertSettlementExtraTargetCurrent(runtime.store, edit, { id: row.id, expected, intended });
      } catch (caught) { setError(caught.message); return; }
      edit.state.cars[name] = { ...edit.state.cars[name], extras: edit.state.cars[name].extras.map((item, rowIndex) => rowIndex === index ? intended : item) };
      successLabel = `${intended.name}を保存しました。`;
    } else {
      successLabel = `${movementLabel}を保存しました。`;
    }
    setSaving(true);
    setError('');
    const before = getSettlementAmountSnapshot(runtime.store);
    try {
      await commitSettlementEdit(runtime, edit);
      onNotice(settlementSaveNotice(successLabel, before, getSettlementAmountSnapshot(runtime.store)));
      setSaving(false);
      refreshList(view === 'extra' ? `#settlement-extra-edit-${activeExtra?.index ?? 0}` : '#settlement-movement-edit');
    }
    catch (caught) { setError(caught.message); setSaving(false); }
  }
  const primaryLabel = view === 'expense' ? '閉じる' : ['extra', 'movement'].includes(view) ? '保存' : undefined;
  const primaryDisabled = saving || composing;
  const back = () => changeView(view === 'distance-guide' ? 'movement' : 'expense');
  const submit = () => { if (view === 'expense') onClose(false); else if (view === 'extra') { setExpenseAttempted(true); void save(); } else if (view === 'movement') { setMovementAttempted(true); void save(); } };
  function openGoogleMaps() {
    writeDistanceGuideHidden(runtime.preferenceStorage, distanceGuideHidden);
    try {
      const baseState = domain.normalizeSettlementState(runtime.store.domain.settlementInput(edit.session.base).state);
      const draftState = domain.normalizeSettlementState(edit.state);
      writeSettlementCarCheckpoint(sessionStorageOrNull(), {
        roomId: runtime.roomId,
        carName: name,
        baseCar: baseState.cars[name],
        draftCar: draftState.cars[name],
        resetGeneration: runtime.store.getSnapshot().resetGeneration,
      });
    } catch { /* Manual distance entry remains available when tab storage is blocked. */ }
    if (view === 'distance-guide') changeView('movement');
  }
  const returnToList = () => refreshList(view === 'extra' ? `#settlement-extra-edit-${activeExtra?.index ?? 0}` : '#settlement-movement-edit');
  const modalHeading = view === 'distance-guide' ? 'Googleマップで移動距離を確認' : view === 'movement' ? `${movementLabel}を設定` : view === 'extra' ? (extraMode === 'add' ? '費用を追加' : '費用を編集') : '費用一覧';
  return <ComposedModal className={`app-modal settlement-car-modal settlement-task-modal${view === 'movement' ? ' settlement-movement-modal' : view === 'distance-guide' ? ' settlement-distance-guide-modal' : ''}${contentAtBottom ? ' settlement-modal-at-bottom' : ''}`} onScrollCapture={handleModalScroll} open size={view === 'distance-guide' ? 'lg' : view === 'movement' ? 'md' : 'sm'} aria-label={`${name}車：${modalHeading}`} launcherButtonRef={launcherButtonRef} onClose={() => onClose(false)} preventCloseOnClickOutside selectorPrimaryFocus={view === 'distance-guide' ? '#distance-guide-open-maps' : view === 'movement' ? '#settlement-rental-type' : view === 'extra' ? `#settlement-extra-name-${activeExtra?.index ?? 0}` : returnFocusId}>
    <ModalHeader label={`${name}車`} title={modalHeading} iconDescription="閉じる" />
    <ModalBody hasScrollingContent={view === 'movement' || view === 'distance-guide' || (['expense', 'extra'].includes(view) && contentHasOverflow)} aria-labelledby="settlement-car-modal-region-title">
      <span id="settlement-car-modal-region-title" className="cds--visually-hidden">{name}車：{modalHeading}の内容</span>
    {view === 'expense' && <div className="form-stack settlement-car-form" onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
      {(error || validationMessage) && <InlineNotification kind="error" title="入力内容を確認してください" subtitle={error || validationMessage} hideCloseButton lowContrast />}
      {removedExpense && <Callout className="settlement-cost-deleted" kind="success" titleId="settlement-cost-deleted-title" title={`${removedExpense.row.name || '費用'}を削除しました`} actionButtonLabel="元に戻す" onActionButtonClick={undoRemoveExpense} lowContrast />}
      <section className="settlement-form-section" aria-label="車両費用の編集">
      <ContainedList className="settlement-cost-editor" kind="disclosed" size="sm" label={<span className="cds--visually-hidden">車両費用</span>}>
        <ContainedListItem className="settlement-cost-list-item" action={<Button id="settlement-movement-edit" kind="ghost" size={isMobile ? 'md' : 'sm'} aria-label={`${movementLabel}の計算条件を編集`} onClick={openMovementEditor}>編集</Button>}>
            <div className="settlement-cost-summary"><span className="settlement-cost-summary__details"><span className="settlement-cost-summary__name">{movementLabel}</span><span className="settlement-cost-summary__meta">{extraTypeLabel(movement?.type || 'split')}</span></span><strong className="settlement-cost-summary__amount">{money(movementComplete ? movementAmount : 0)}</strong></div>
          </ContainedListItem>
          {editable.map(({ row, index }) => {
            const id = getCostId(row, index);
            const rawAmount = String(row.amount ?? '').trim();
            const signedAmount = domain.getSignedSettlementExtraAmount(row);
            const amount = money(rawAmount ? signedAmount : 0);
            return <Fragment key={id}>
              <ContainedListItem className="settlement-cost-list-item" action={<Button id={`settlement-extra-edit-${index}`} kind="ghost" size={isMobile ? 'md' : 'sm'} aria-label={`${row.name || '費用'}を編集`} onClick={() => openExtraEditor(id, `#settlement-extra-edit-${index}`)}>編集</Button>}>
                <div className="settlement-cost-summary"><span className="settlement-cost-summary__details"><span className="settlement-cost-summary__name">{row.name || '新しい費用'}</span><span className="settlement-cost-summary__meta">{extraTypeLabel(row.type)}</span></span><strong className="settlement-cost-summary__amount">{amount}</strong></div>
              </ContainedListItem>
            </Fragment>;
          })}
        </ContainedList>
        <Button id="settlement-cost-add" className="settlement-cost-add-action" kind="ghost" size="sm" renderIcon={Add} onClick={addExtra}>新しい費用を追加</Button>
      {candidates.length > 0 && <section className="settlement-extra-candidates" aria-labelledby="settlement-extra-candidates-title"><h3 id="settlement-extra-candidates-title">企画内の費用</h3><ContainedList kind="disclosed" size="sm" label={<span className="cds--visually-hidden">企画内で登録済みの費用</span>}>{candidates.map(candidate => <ContainedListItem key={candidate.key} className="settlement-extra-candidate" action={<Button kind="ghost" size={isMobile ? 'md' : 'sm'} disabled={saving} onClick={() => addCandidate(candidate)}>追加</Button>}><div className="settlement-extra-candidate__details"><strong>{candidate.name}</strong><span>{money(candidate.amount)} ・ {extraTypeLabel(candidate.type)}</span></div></ContainedListItem>)}</ContainedList></section>}</section>
    </div>}
    {view === 'extra' && activeExtra && <div className="form-stack settlement-car-form settlement-cost-editor-form" onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
      {error && <InlineNotification kind="error" title="入力内容を確認してください" subtitle={error} hideCloseButton lowContrast />}
      <section className="settlement-form-section" aria-label="費用の入力">
        <div className="settlement-cost-editor-fields">
          <TextInput id={`settlement-extra-name-${activeExtra.index}`} labelText="費用名" invalid={!!expenseFieldErrors.name && (expenseTouched.name || expenseAttempted || !!String(activeExtra.row.amount ?? '').trim())} invalidText={expenseFieldErrors.name} value={activeExtra.row.name} readOnly={domain.isTimesTimeFeeExtra(activeExtra.row)} placeholder="例：駐車場代" onBlur={() => setExpenseTouched(current => ({ ...current, name: true }))} onChange={event => { updateExtraField(activeExtra.index, { name: event.target.value }); setError(''); }} />
          <TextInput id={`settlement-extra-amount-${activeExtra.index}`} labelText="金額（円）" inputMode="numeric" invalid={!!expenseFieldErrors.amount && (expenseTouched.amount || expenseAttempted || !!String(activeExtra.row.amount ?? '').trim())} invalidText={expenseFieldErrors.amount || negativeMoneyText} value={activeExtra.row.amount} onBlur={() => setExpenseTouched(current => ({ ...current, amount: true }))} onChange={event => { updateExtraField(activeExtra.index, { amount: event.target.value }); setError(''); }} />
        </div>
        <CostTypeControl domain={domain} id={`settlement-extra-type-${activeExtra.index}`} type={activeExtra.row.type} onChange={type => updateExtra(activeExtra.index, { type })} />
        {extraMode === 'edit' && !domain.isTimesTimeFeeExtra(activeExtra.row) && <div className="settlement-cost-delete-action"><Button kind="danger--ghost" size={isMobile ? 'md' : 'sm'} renderIcon={TrashCan} disabled={saving} onClick={removeActiveExtra}>この費用を削除</Button></div>}
      </section>
    </div>}
    {view === 'movement' && <MovementSettingsView car={car} domain={domain} isMobile={isMobile} movementAmount={movementAmount} movementLabel={movementLabel} movementFormula={movementFormula} movementType={movement?.type} movementErrors={movementErrors} movementTouched={movementTouched} movementAttempted={movementAttempted} movementComplete={movementComplete} showDistanceGuide={!distanceGuideHidden} onBlurField={key => setMovementTouched(current => ({ ...current, [key]: true }))} onOpenGuide={() => changeView('distance-guide')} onRentalType={setRentalType} onMovementType={setMovementType} onUpdate={update} />}
    {view === 'distance-guide' && <DistanceGuide checked={distanceGuideHidden} onCheckedChange={setDistanceGuideHidden} onOpenMaps={openGoogleMaps} />}
    </ModalBody>
    <ModalFooter primaryButtonText={primaryLabel} secondaryButtons={view === 'expense' ? [] : [{ buttonText: ['extra', 'movement'].includes(view) ? 'キャンセル' : '戻る', onClick: ['extra', 'movement'].includes(view) ? returnToList : back }]} primaryButtonDisabled={primaryDisabled} onRequestSubmit={submit} onRequestClose={() => onClose(false)} />
  </ComposedModal>;
}

function CollectionPrompt({ value, onChange, onSave, onClose }) {
  return <Modal className="app-modal" open size="xs" modalHeading="集金済みにする" closeButtonLabel="閉じる" primaryButtonText="集金済みにする" secondaryButtonText="キャンセル" onRequestSubmit={onSave} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus="#settlement-collector">
    <TextInput id="settlement-collector" labelText="支払った人の名前（任意）" value={value} onChange={event => onChange(event.target.value)} />
  </Modal>;
}

export default function Settlement({ runtime, room, onNotice, onOpenParticipantRegistration, onOpenSettings, participantStartRef, openSettingsRequestId = null, onSettingsRequestHandled, roomStatus }) {
  const { data, state } = runtime.store.domain.settlementInput(room);
  const isMobile = useMediaQuery('(max-width: 671px)');
  const settlement = runtime.store.domain.settlement;
  const result = settlement.calculateSettlement(data, state);
  const hasFormApplication = runtime.store.domain.applicants.validApplicationSync(room.meta?.applicationSync);
  const issues = settlement.getSettlementIssues(data, state, result);
  const visibleIssues = issues.messages.filter(message => !isMovementCalculationIssue(message) && !isExpenseInputIssue(message));
  const settlementStartRef = useRef(null);
  const settlementSettingsTriggerRef = useRef(null);
  const paymentHeadingRef = useRef(null);
  const carLauncherElement = useRef(null);
  const carLauncherButtonRef = useMemo(() => ({ get current() { return carLauncherElement.current?.isConnected ? carLauncherElement.current : paymentHeadingRef.current; } }), []);
  const lastHandledSettingsRequest = useRef(0);
  const [carEdit, setCarEdit] = useState(null);
  const checkpointRestoreAttempted = useRef('');
  const [driverNameEdit, setDriverNameEdit] = useState(null);
  const standaloneDriverMenus = useRef(new Map());
  const [collector, setCollector] = useState(null);
  const [memo, setMemo] = useState(null);
  const [memoEditing, setMemoEditing] = useState(false);
  const memoActionRef = useRef(null);
  const memoFocusReturn = useRef(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionView, setCollectionView] = useState('all');
  const [pendingCollectionFocus, setPendingCollectionFocus] = useState(false);
  useEffect(() => {
    if (roomStatus?.hasLoadedRoom === false || carEdit) return;
    const attemptedKey = `${runtime.roomId}:${room.resetGeneration ?? 0}`;
    if (checkpointRestoreAttempted.current === attemptedKey) return;
    const checkpoint = readSettlementCarCheckpoint(sessionStorageOrNull(), runtime.roomId);
    if (!checkpoint) { checkpointRestoreAttempted.current = attemptedKey; return; }
    checkpointRestoreAttempted.current = attemptedKey;
    if (checkpoint.resetGeneration !== runtime.store.getSnapshot().resetGeneration) {
      clearSettlementCarCheckpoint(sessionStorageOrNull(), runtime.roomId);
      return;
    }
    const currentCar = data.cars.find(car => car.name === checkpoint.carName);
    if (!currentCar) {
      clearSettlementCarCheckpoint(sessionStorageOrNull(), runtime.roomId);
      onNotice('編集中の車が見つかりません。現在の企画を確認してください。');
      return;
    }
    const sameValue = (left, right) => {
      if (Object.is(left, right)) return true;
      if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
      if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
      const leftKeys = Object.keys(left).sort();
      const rightKeys = Object.keys(right).sort();
      return sameValue(leftKeys, rightKeys) && leftKeys.every(key => sameValue(left[key], right[key]));
    };
    const currentState = settlement.normalizeSettlementState(state);
    if (!sameValue(currentState.cars[checkpoint.carName], checkpoint.baseCar)) {
      clearSettlementCarCheckpoint(sessionStorageOrNull(), runtime.roomId);
      onNotice('別の端末で車の費用が更新されたため、未保存の入力は復元していません。');
      return;
    }
    const edit = beginSettlementEdit(runtime.store, { car: currentCar });
    edit.state.cars[checkpoint.carName] = structuredClone(checkpoint.draftCar);
    edit.restoredView = 'movement';
    setCarEdit(edit);
  }, [runtime, room, roomStatus?.hasLoadedRoom, carEdit, data.cars, state, settlement, onNotice]);
  const collectionTriggerRef = useRef(null);
  useEffect(() => {
    if (!pendingCollectionFocus || !collectionOpen) return undefined;
    const timer = setTimeout(() => {
      const modal = document.getElementById('settlement-collection-modal');
      const target = modal?.querySelector('.settlement-collection-row:not(.excluded) .cds--checkbox')
        || modal?.querySelector('.cds--content-switcher-btn[aria-selected="true"]');
      target?.focus();
      setPendingCollectionFocus(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [collectionOpen, collectionView, pendingCollectionFocus]);
  useEffect(() => {
    if (memoEditing) {
      requestAnimationFrame(() => document.getElementById('settlement-memo-editor')?.focus());
      return undefined;
    }
    if (!memoFocusReturn.current) return undefined;
    memoFocusReturn.current = false;
    requestAnimationFrame(() => memoActionRef.current?.focus());
    return undefined;
  }, [memoEditing]);
  useEffect(() => {
    if (!openSettingsRequestId || openSettingsRequestId <= lastHandledSettingsRequest.current) return;
    lastHandledSettingsRequest.current = openSettingsRequestId;
    onOpenSettings?.({ standalone: true, launcherButtonRef: settlementStartRef });
    onSettingsRequestHandled?.(openSettingsRequestId);
  }, [openSettingsRequestId, onOpenSettings, onSettingsRequestHandled]);
  function closeEdit(setter, edit, saved) { if (!saved && edit && !edit.session.closed) runtime.store.cancelEdit(edit.session); setter(null); }
  function openCar(car, event, fallbackRef) {
    carLauncherElement.current = event?.currentTarget || fallbackRef?.current || null;
    const edit = beginSettlementEdit(runtime.store, { car });
    edit.state.cars[car.name] = settlement.ensureTimesRentalExtras(edit.state.cars[car.name]);
    setCarEdit(edit);
  }
  function closeCarEditor(saved) {
    clearSettlementCarCheckpoint(sessionStorageOrNull(), runtime.roomId);
    closeEdit(setCarEdit, carEdit, saved);
    requestAnimationFrame(() => carLauncherButtonRef.current?.focus());
  }
  function openDriverNameEditor(car) {
    try {
      const edit = beginStandaloneDriverNameEdit(runtime.store, car.standaloneIndex);
      const launcher = standaloneDriverMenus.current.get(car.standaloneIndex);
      setDriverNameEdit({ edit, launcherButtonRef: { current: launcher } });
    } catch (error) { onNotice(error.message || '運転手の名前を編集できませんでした。'); }
  }
  function markCollected() {
    collectionChange(runtime.store, { name: collector.name, checked: true, collector: collector.value || collector.name });
    setCollector(null); setCollectionOpen(true); onNotice(`${collector.name}を集金済みにしました。`);
    if (collectionView === 'unpaid') setPendingCollectionFocus(true);
  }
  function setCollectionStatus(person, checked) {
    if (checked && result.isStandaloneSettlement) {
      setCollector({ name: person.name, value: state.paidBy[person.name] || '' });
      setCollectionOpen(false);
      return;
    }
    collectionChange(runtime.store, { name: person.name, checked });
    onNotice(`${person.name}を${checked ? '集金済みにしました' : '未集金に戻しました'}。`);
    if (checked && collectionView === 'unpaid') setPendingCollectionFocus(true);
  }
  async function copyUnpaid() {
    const names = result.participants.filter(person => !result.excludedNames.has(person.name) && !state.paid[person.name]).map(person => person.name);
    if (!names.length) { onNotice('未集金の人はいません。'); return; }
    try { await navigator.clipboard.writeText(names.join('、')); onNotice(`未集金の${names.length}人をコピーしました。`); }
    catch { onNotice('名前をコピーできませんでした。'); }
  }
  function saveMemo() {
    if (memo === null) return;
    if (memo !== state.memo) runtime.store.command('settlement', { state: { ...state, memo } });
    memoFocusReturn.current = true;
    setMemo(null); setMemoEditing(false); onNotice('精算メモを保存しました。');
  }
  function openMemoEditor() { memoFocusReturn.current = false; setMemo(state.memo || ''); setMemoEditing(true); }
  function closeMemoEditor() { memoFocusReturn.current = true; setMemo(null); setMemoEditing(false); }
  const countOnlyNeedsCounts = room.settlement?.standalone?.enabled === true && !result.isStandaloneSettlement;
  if (countOnlyNeedsCounts || (!result.participants.length && !result.isStandaloneSettlement)) return <section className="settlement-page">
    {room.settlement?.standalone?.enabled === true
      ? <div className="initial-empty-state" aria-labelledby="settlement-counts-missing-heading"><h2 id="settlement-counts-missing-heading">人数を設定してください</h2><p>人数だけで精算するには、運転手または同乗者の人数を設定します。</p><Button ref={settlementStartRef} onClick={() => onOpenSettings?.({ standalone: true, launcherButtonRef: settlementStartRef })}>人数を設定</Button><Button kind="ghost" onClick={() => onOpenSettings?.({ launcherButtonRef: settlementStartRef })}>通常の精算に切り替える</Button></div>
      : <InitialEmptyState headingId="settlement-initial-heading" title="精算" description="参加者を登録するか、人数を入力して精算できます。" primaryAction={{ label: '人数だけで精算', buttonRef: settlementStartRef, onClick: () => onOpenSettings?.({ standalone: true, launcherButtonRef: settlementStartRef }) }} alternateAction={{ label: hasFormApplication ? '参加者を確認' : '参加者を追加', onClick: onOpenParticipantRegistration }} roomStatus={roomStatus} />}
  </section>;
  const memoText = state.memo?.trim();
  return <section className="settlement-page" aria-label="精算">
    {visibleIssues.map(message => <InlineNotification key={message} kind={message.includes('集金対象外にする企画者を') ? 'info' : 'error'} title="設定を確認してください" subtitle={message} hideCloseButton lowContrast />)}
    <Tile role="region" aria-label="集金" className="settlement-card settlement-collection-card">
      <div className="settlement-collection-summary">
        <div className="settlement-collection-summary__header">
          <span>1人あたりの集金額</span>
          <Button ref={settlementSettingsTriggerRef} className="settlement-settings-action" kind="ghost" size="sm" onClick={() => onOpenSettings?.({ launcherButtonRef: settlementSettingsTriggerRef })}>精算設定</Button>
        </div>
        <div className="settlement-collection-summary__actions">
          <strong className="settlement-collection-summary__amount">{money(result.perPerson)}</strong>
          <Button ref={collectionTriggerRef} kind="primary" size="md" aria-expanded={collectionOpen} aria-controls="settlement-collection-modal" onClick={() => setCollectionOpen(true)}>集金を記録</Button>
        </div>
      </div>
    </Tile>
    <Tile ref={paymentHeadingRef} tabIndex="-1" className="settlement-card settlement-vehicles-card">
      {data.cars.length === 0 ? <p className="settlement-cars-empty">車が登録されていません</p> : <Accordion className="settlement-car-list" align="end" isFlush size="sm">{data.cars.map((car, index) => {
        const calc = result.cars.find(row => row.name === car.name);
        if (!calc) return null;
        const carLabel = `${car.name}車${calc.usesTimesRental ? '（レンタカー）' : ''}`;
        const carId = Number.isInteger(car.standaloneIndex) ? car.standaloneIndex : index;
        const movementLabel = calc.usesTimesRental ? 'タイムズ移動料金' : 'ガソリン代';
        const carState = state.cars?.[car.name] || {};
        const movementUncalculated = Object.values(getMovementErrors(carState, settlement)).some(Boolean);
        const movementComplete = movementFieldDefinitions(settlement.isTimesRentalCar(carState)).every(({ key }) => String(carState[key] ?? '').trim()) && !movementUncalculated;
        const movementItem = { id: `movement-${carId}`, isMovement: true, name: movementLabel, amountValue: calc.movementAmount, type: calc.movementType };
        const splitItems = [...(calc.movementBaseType === 'split' ? [movementItem] : []), ...calc.extras.filter(row => row.baseType === 'split')];
        const clubItems = [...(calc.movementBaseType === 'club' ? [movementItem] : []), ...calc.extras.filter(row => row.baseType === 'club')];
        const adjustmentAmount = amount => {
          const rounded = Math.round(Number(amount) || 0);
          return rounded === 0 ? money(0) : `${rounded < 0 ? '−' : '+'}${money(Math.abs(rounded))}`;
        };
        const renderItems = (items, baseType) => items.filter(row => row.amountValue !== 0).map((row, rowIndex) => <div className="settlement-cost-item" key={row.id || `${row.name}-${rowIndex}`}><span>{row.name || '費用'}{row.isMovement || row.type === baseType ? '' : `（${extraTypeLabel(row.type)}）`}</span><span className="settlement-cost-item-amount">{money(row.amountValue)}</span></div>);
        const hasSplitDetails = splitItems.some(row => row.amountValue !== 0) || calc.splitRound !== 0 || calc.collectionOffset !== 0;
        const hasClubDetails = clubItems.some(row => row.amountValue !== 0) || calc.clubRound !== 0;
        const compactPayment = calc.adjustedClubPay === 0;
        const hasSavedManualExpenses = (carState.extras || []).some(row => !settlement.isDriverRewardExtra(row) && !settlement.isTimesDistanceFeeExtra(row) && !settlement.isGasMovementFeeExtra(row) && !settlement.isTimesTimeFeeExtra(row) && settlement.hasMeaningfulExtra(row));
        const hasSavedTimesFee = (carState.extras || []).some(row => settlement.isTimesTimeFeeExtra(row) && String(row.amount ?? '').trim());
        const hasSavedCarExpenses = movementComplete || hasSavedManualExpenses || hasSavedTimesFee;
        const driverMenu = result.isStandaloneSettlement && Number.isInteger(car.standaloneIndex) && <OverflowMenu ref={node => node ? standaloneDriverMenus.current.set(car.standaloneIndex, node) : standaloneDriverMenus.current.delete(car.standaloneIndex)} ariaLabel={`${carLabel}の操作`} iconDescription={`${carLabel}の操作`} size={isMobile ? 'lg' : 'sm'} flipped><OverflowMenuItem itemText="運転手の名前を編集" onClick={() => openDriverNameEditor(car)} /></OverflowMenu>;
        const compactItems = [...splitItems, ...clubItems].filter(row => row.amountValue !== 0).map((row, rowIndex) => <div className="settlement-cost-item" key={row.id || `${row.name}-${rowIndex}`}><span>{row.name || '費用'}</span><span className="settlement-cost-item-amount">{money(row.amountValue)}</span></div>);
        const compactAdjustments = <div className="settlement-cost-adjustments">
          {calc.splitRound !== 0 && <div className="settlement-cost-adjustment"><span>切り上げ分</span><strong>{adjustmentAmount(calc.splitRound)}</strong></div>}
          {calc.collectionOffset !== 0 && <div className="settlement-cost-adjustment"><span>運転手の集金分</span><strong>{money(-Math.abs(calc.collectionOffset))}</strong></div>}
          {calc.clubRound !== 0 && <div className="settlement-cost-adjustment"><span>切り上げ分</span><strong>{adjustmentAmount(calc.clubRound)}</strong></div>}
        </div>;
        const details = compactPayment ? <div className="settlement-cost-list">
          {compactItems.length > 0 && <div className="settlement-cost-items">{compactItems}</div>}
          {(calc.splitRound !== 0 || calc.collectionOffset !== 0 || calc.clubRound !== 0) && compactAdjustments}
          {compactItems.length === 0 && calc.splitRound === 0 && calc.collectionOffset === 0 && calc.clubRound === 0 && <p className="settlement-cost-empty">内訳に表示する費用はありません。</p>}
        </div> : <div className="settlement-cost-list">
                {hasSplitDetails && <section className="settlement-cost-group" aria-labelledby={`settlement-split-${carId}`}>
                  <h4 id={`settlement-split-${carId}`}>割勘の内訳（{money(calc.adjustedSplitPay)}）</h4>
                  {splitItems.some(row => row.amountValue !== 0) && <div className="settlement-cost-items">{renderItems(splitItems, 'split')}</div>}
                  {(calc.splitRound !== 0 || calc.collectionOffset !== 0) && <div className="settlement-cost-adjustments">
                    {calc.splitRound !== 0 && <div className="settlement-cost-adjustment"><span>切り上げ分</span><strong>{adjustmentAmount(calc.splitRound)}</strong></div>}
                    {calc.collectionOffset !== 0 && <div className="settlement-cost-adjustment"><span>運転手の集金分</span><strong>{money(-Math.abs(calc.collectionOffset))}</strong></div>}
                  </div>}
                </section>}
                {hasClubDetails && <section className="settlement-cost-group" aria-labelledby={`settlement-club-${carId}`}>
                  <h4 id={`settlement-club-${carId}`}>部費の内訳（{money(calc.adjustedClubPay)}）</h4>
                  {clubItems.some(row => row.amountValue !== 0) && <div className="settlement-cost-items">{renderItems(clubItems, 'club')}</div>}
                  {calc.clubRound !== 0 && <div className="settlement-cost-adjustments"><div className="settlement-cost-adjustment"><span>切り上げ分</span><strong>{adjustmentAmount(calc.clubRound)}</strong></div></div>}
                </section>}
                {!hasSplitDetails && !hasClubDetails && <p className="settlement-cost-empty">内訳に表示する費用はありません。</p>}
              </div>;
        return <SettlementPaymentRow key={Number.isInteger(car.standaloneIndex) ? `standalone-${car.standaloneIndex}` : car.name}
          rowId={String(carId)} carLabel={carLabel} carName={`${car.name}車`} rentalLabel={calc.usesTimesRental ? '（レンタカー）' : ''} driverNames={calc.driverNames}
          splitAmount={money(calc.adjustedSplitPay)} clubAmount={money(calc.adjustedClubPay)} compactAmount={compactPayment} hasSavedCarExpenses={hasSavedCarExpenses} details={details} driverMenu={driverMenu}
          onEdit={(event, fallbackRef) => openCar(car, event, fallbackRef)} />;
      })}</Accordion>}
    </Tile>
    <Tile className="settlement-card settlement-memo-card">
      {memoEditing
        ? <div className="settlement-memo-editor"><TextArea id="settlement-memo-editor" labelText="メモ" placeholder="例：レンタカー代は高橋さんが立替" rows={3} value={memo ?? ''} onChange={event => setMemo(event.target.value)} /><div className="settlement-memo-actions"><Button kind="tertiary" size="sm" onClick={saveMemo}>保存</Button><Button kind="ghost" size="sm" onClick={closeMemoEditor}>キャンセル</Button></div></div>
        : memoText
          ? <div className="settlement-section-heading"><div><h2>メモ</h2><p>{state.memo}</p></div><Button ref={memoActionRef} kind="ghost" size="sm" onClick={openMemoEditor}>編集</Button></div>
          : <Button ref={memoActionRef} className="settlement-memo-add-action" kind="ghost" size="sm" renderIcon={Add} onClick={openMemoEditor}>メモを追加</Button>}
    </Tile>
    <Modal id="settlement-collection-modal" className="app-modal settlement-collection-modal" open={collectionOpen} size="sm" hasScrollingContent modalHeading="集金状況" closeButtonLabel="閉じる" primaryButtonText="閉じる" secondaryButtonText="未集金の人をコピー" onSecondarySubmit={copyUnpaid} onRequestSubmit={() => setCollectionOpen(false)} onRequestClose={() => setCollectionOpen(false)} launcherButtonRef={collectionTriggerRef} selectorPrimaryFocus=".settlement-collection-modal .cds--content-switcher-btn">
      <div className="settlement-collection-modal-content">
        <ContentSwitcher aria-label="集金対象者の表示" size="sm" lowContrast selectedIndex={collectionView === 'unpaid' ? 1 : 0} onChange={({ name }) => setCollectionView(name)}><Switch name="all" text="すべて" /><Switch name="unpaid" text="未集金" /></ContentSwitcher>
        <ContainedList className="settlement-collection-list" kind="on-page" size="lg" label={<span className="cds--visually-hidden">集金対象者</span>}>{result.participants.filter(person => collectionView !== 'unpaid' || (!result.excludedNames.has(person.name) && !state.paid[person.name])).map(person => {
                const excluded = result.excludedNames.has(person.name);
                const paid = !!state.paid[person.name];
                const label = state.paidBy[person.name] || person.name;
                if (excluded) return <ContainedListItem className="settlement-collection-row excluded" key={person.name} action={<Tag type="cool-gray" size="sm">集金不要</Tag>}><span><strong>{person.name}</strong><small>{result.driverNames.has(person.name) && result.driverCollectionOffset ? '支払額から差し引き' : '集金対象外'}</small></span></ContainedListItem>;
                const checkboxId = `settlement-paid-${person.name}`;
                return <ContainedListItem className="settlement-collection-row" key={person.name} action={<Checkbox id={checkboxId} labelText={`${label}の集金を記録`} aria-label={`${label}の集金を記録`} hideLabel checked={paid} onChange={(_, { checked }) => setCollectionStatus(person, checked)} />}><label className="settlement-collection-row__label" htmlFor={checkboxId}><span><strong>{label}</strong><small>{paid ? '集金済み' : '未集金'}</small></span><strong>{money(result.perPerson)}</strong></label></ContainedListItem>;
        })}</ContainedList>
      </div>
    </Modal>
    {carEdit && <CarEditor runtime={runtime} edit={carEdit} onEditChange={setCarEdit} launcherButtonRef={carLauncherButtonRef} onNotice={onNotice} onClose={closeCarEditor} />}
    {driverNameEdit && <StandaloneDriverNameModal runtime={runtime} edit={driverNameEdit.edit} launcherButtonRef={driverNameEdit.launcherButtonRef} onNotice={onNotice} onClose={saved => closeEdit(setDriverNameEdit, driverNameEdit.edit, saved)} />}
    {collector && <CollectionPrompt value={collector.value} onChange={value => setCollector(current => ({ ...current, value }))} onSave={markCollected} onClose={() => { setCollector(null); setCollectionOpen(true); }} />}
  </section>;
}
