import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion, AccordionItem, Button, Callout, Checkbox, ComposedModal, ContainedList, ContainedListItem, ContentSwitcher, IconButton, InlineNotification, Modal, ModalBody, ModalFooter, ModalHeader,
  NumberInput, RadioButton, RadioButtonGroup,
  Select, SelectItem, Switch, Tag, TextArea, TextInput, Tile, OverflowMenu, OverflowMenuItem,
} from '@carbon/react';
import { Add, Copy, Edit, TrashCan } from '@carbon/icons-react';
import { beginSettlementEdit, beginStandaloneDriverNameEdit, commitSettlementEdit, collectionChange } from './settlement/edit.js';
import RoutePlanner from './RoutePlanner.jsx';
import useMediaQuery from '../hooks/useMediaQuery.js';
import InitialEmptyState from './InitialEmptyState.jsx';
import StandaloneDriverNameModal from './StandaloneDriverNameModal.jsx';

const money = value => `¥${Math.round(Number(value) || 0).toLocaleString('ja-JP')}`;
const hasNegativeValue = value => /^[-−]/.test(String(value ?? '').trim());
const negativeMoneyText = '金額は0円以上で入力してください。';
const negativeNumberText = '0以上の値を入力してください。';
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
function getExpenseFieldErrors(row, domain) {
  const name = String(row?.name ?? '').trim();
  const amount = String(row?.amount ?? '').trim();
  const parsedAmount = amount ? Number(amount.replace(/,/g, '')) : null;
  return {
    name: amount && !name ? '名目を入力してください。' : '',
    amount: hasNegativeValue(amount) ? negativeMoneyText : amount && !Number.isFinite(parsedAmount) ? '金額は数値で入力してください。' : '',
  };
}
function isMovementCalculationIssue(message) {
  return /(?:ガソリン代|タイムズ移動料金)を計算するため、/.test(message);
}
function isExpenseInputIssue(message) {
  return message.includes('追加した諸経費が未入力です。')
    || message.includes('諸経費に名目が空の行があります。')
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

function CostTypeControl({ domain, id, label, type, disabled = false, allowNegative = true, onChange }) {
  const normalized = domain.normalizeSettlementExtraType(type);
  const baseType = domain.getSettlementExtraBaseType(normalized);
  const negative = allowNegative && domain.isNegativeSettlementExtraType(normalized);
  const setBaseType = value => onChange(`${value}${negative ? '-minus' : ''}`);
  return <div className="settlement-cost-type-control"><RadioButtonGroup id={`${id}-group`} legendText={label} name={`${id}-type`} valueSelected={baseType} disabled={disabled} onChange={setBaseType} orientation="horizontal">
    <RadioButton id={`${id}-split`} value="split" labelText="割勘" />
    <RadioButton id={`${id}-club`} value="club" labelText="部費" />
  </RadioButtonGroup>
  {allowNegative ? <Checkbox id={`${id}-minus`} labelText={`${baseType === 'club' ? '部費' : '割勘'}の費用から差し引く`} helperText="入力した金額をマイナスの費用として扱います。" checked={negative} disabled={disabled} onChange={(_, { checked }) => onChange(`${baseType}${checked ? '-minus' : ''}`)} /> : null}</div>;
}

function MovementSettingsView({ car, domain, isMobile, movementAmount, movementLabel, movementFormula, movementType, movementErrors, movementTouched, movementAttempted, movementComplete, onBlurField, onOpenRoute, onRentalType, onMovementType, onUpdate }) {
  const times = domain.isTimesRentalCar(car);
  const input = (id, label, value, key) => {
    const error = movementTouched[key] || movementAttempted || String(value ?? '').trim() ? movementErrors[key] : '';
    return <TextInput id={id} labelText={label} inputMode="decimal" invalid={!!error} invalidText={error || negativeNumberText} value={value} onBlur={() => onBlurField(key)} onChange={event => onUpdate({ [key]: event.target.value })} />;
  };
  const previewAmount = movementComplete ? money(movementAmount) : money(0);
  return <div className="form-stack settlement-movement-form">
      <RadioButtonGroup legendText="車両種別" name="settlement-rental-type" valueSelected={car.rentalType} onChange={onRentalType} orientation="horizontal">
        <RadioButton id="settlement-rental-type" value="private" labelText="自家用車" />
        <RadioButton id="settlement-rental-times" value="times" labelText="タイムズ" />
      </RadioButtonGroup>
      <section className="settlement-form-section" aria-labelledby="settlement-movement-conditions-title"><h3 className="settlement-movement-section-title" id="settlement-movement-conditions-title">移動料金の計算条件</h3>
        {!movementComplete && <p className="cds--form__helper-text">計算する場合は、{times ? '移動距離を' : '移動距離・燃費・ガソリン単価をすべて'}入力してください。</p>}
        <div className="form-grid">
        <div className="distance-field">{input('settlement-distance', '移動距離（km）', car.dist, 'dist')}<Button kind="ghost" size={isMobile ? 'lg' : 'sm'} onClick={onOpenRoute}>移動距離計算ツール</Button></div>
        {!times && <>{input('settlement-eco', '燃費（km/L）', car.eco, 'eco')}{input('settlement-price', 'ガソリン単価（円/L）', car.price, 'price')}</>}
        </div></section>
      <CostTypeControl domain={domain} id="settlement-movement-type" label="移動料金の負担区分" type={movementType || 'split'} allowNegative={false} onChange={onMovementType} />
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

function CarEditor({ runtime, edit, onClose, onNotice, launcherButtonRef }) {
  const domain = runtime.store.domain.settlement;
  const isMobile = useMediaQuery('(max-width: 671px)');
  const [, render] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [view, setView] = useState('expense');
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
  const newExpenseIds = useRef(new Set());
  const [routeStatus, setRouteStatus] = useState({ primaryLabel: 'この距離を適用', disabled: true, hidePrimaryButton: false });
  const routeRef = useRef(null);
  const name = edit.car.name;
  const car = edit.state.cars[name];
  const { data } = runtime.store.domain.settlementInput(edit.session.base);
  const calculated = domain.calculateSettlement(data, domain.normalizeSettlementState(edit.state));
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
  const validationMessage = hasNegativeExpense ? negativeMoneyText : hasNegativeMovement ? '移動距離・燃費・ガソリン単価は0以上で入力してください。' : '';
  const getCostId = (row, index) => row.id || `extra-${index}`;
  const activeExtra = editable.find(({ row, index }) => getCostId(row, index) === activeCostId);
  const expenseFieldErrors = getExpenseFieldErrors(activeExtra?.row, domain);
  const expenseComplete = Object.values(expenseFieldErrors).every(message => !message);
  const candidates = getExtraCandidates(edit.state, domain, car);
  function changeView(nextView) { setContentAtBottom(false); setView(nextView); }
  function handleModalScroll(event) {
    if (!['expense', 'extra', 'movement', 'route'].includes(view) || !event.target?.classList?.contains('cds--modal-content')) return;
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
  function addExtra() { const row = { id: domain.createSettlementExtraId(), name: '', amount: '', type: 'split', pending: true }; newExpenseIds.current.add(row.id); update({ extras: [...car.extras, row] }); setActiveCostId(row.id); setExtraMode('add'); setExpenseTouched({}); setExpenseAttempted(false); setRemovedExpense(null); setReturnFocusId('#settlement-cost-add'); setError(''); setView('extra'); }
  function addCandidate(candidate) { const row = { id: domain.createSettlementExtraId(), ...candidate, pending: false }; update({ extras: [...car.extras, row] }); onNotice(`${candidate.name}を追加しました。保存すると反映されます。`); }
  function removeActiveExtra() {
    if (!activeExtra || extraMode !== 'edit' || domain.isTimesTimeFeeExtra(activeExtra.row)) return;
    const { row, index } = activeExtra;
    newExpenseIds.current.delete(row.id);
    setRemovedExpense({ row, index });
    update({ extras: car.extras.filter((_, rowIndex) => rowIndex !== index) });
    setActiveCostId('movement');
    setExpenseAttempted(false);
    setExpenseTouched({});
    setReturnFocusId('#settlement-cost-add');
    setError('');
    changeView('expense');
  }
  function undoRemoveExpense() {
    if (!removedExpense) return;
    const { row, index } = removedExpense;
    update({ extras: [...car.extras.slice(0, index), row, ...car.extras.slice(index)] });
    setRemovedExpense(null);
    setReturnFocusId(`#settlement-extra-edit-${index}`);
  }
  useEffect(() => {
    const firstExpenseError = ['name', 'amount'].find(key => expenseFieldErrors[key]);
    const movementFocusId = firstMovementError?.key === 'dist' ? 'distance' : firstMovementError?.key;
    const selector = view === 'expense' ? returnFocusId : view === 'extra' ? (expenseAttempted && firstExpenseError ? `#settlement-extra-${firstExpenseError}-${activeExtra?.index ?? 0}` : `#settlement-extra-name-${activeExtra?.index ?? 0}`) : view === 'movement' ? (movementAttempted && movementFocusId ? `#settlement-${movementFocusId}` : '#settlement-rental-type') : '#route-origin-action .cds--contained-list-item__content';
    const timer = setTimeout(() => {
      document.querySelector(selector)?.focus();
      if (view === 'movement' || view === 'route') {
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
  function showExpenseErrors(row) {
    const index = editable.find(({ row: item }) => item === row)?.index;
    if (index === undefined) return;
    setActiveCostId(getCostId(row, index));
    setExtraMode('edit');
    setExpenseAttempted(true);
    setExpenseTouched({ name: true, amount: true });
    setError('');
    changeView('extra');
  }
  async function save() {
    if (composing || saving) return;
    if (!movementValid) { setMovementAttempted(true); setError(''); changeView('movement'); return; }
    const invalidExpense = editable.find(({ row }) => Object.values(getExpenseFieldErrors(row, domain)).some(Boolean));
    if (invalidExpense) { showExpenseErrors(invalidExpense.row); return; }
    const emptyNewExpenseIds = new Set(editable
      .filter(({ row }) => newExpenseIds.current.has(row.id) && !String(row.name ?? '').trim() && !String(row.amount ?? '').trim())
      .map(({ row }) => row.id));
    if (emptyNewExpenseIds.size) {
      edit.state.cars[name] = { ...edit.state.cars[name], extras: edit.state.cars[name].extras.filter(row => !emptyNewExpenseIds.has(row.id)) };
      emptyNewExpenseIds.forEach(id => newExpenseIds.current.delete(id));
    }
    const { data } = runtime.store.domain.settlementInput(edit.session.base);
    const normalized = domain.normalizeSettlementState(edit.state);
    const result = domain.calculateSettlement(data, normalized);
    const issues = domain.getSettlementIssues(data, normalized, result);
    const messages = issues.messages.filter(message => message.startsWith(`${name}車の`) && !isMovementCalculationIssue(message) && !isExpenseInputIssue(message));
    if (messages.length) {
      const invalidExpense = editable.find(({ index }) => issues.fields.has(`${name}:extra:${index}:name`) || issues.fields.has(`${name}:extra:${index}:amount`));
      if (invalidExpense) { showExpenseErrors(invalidExpense.row); return; }
      setError(messages[0]); return;
    }
    setSaving(true); setError('');
    const before = getSettlementAmountSnapshot(runtime.store);
    try {
      await commitSettlementEdit(runtime, edit);
      onNotice(settlementSaveNotice(`${name}車の費用を保存しました。`, before, getSettlementAmountSnapshot(runtime.store)));
      onClose(true);
    }
    catch (caught) { setError(caught.message); setSaving(false); }
  }
  const primaryLabel = view === 'expense' ? '費用を保存' : view === 'extra' ? (extraMode === 'add' ? '費用を追加' : '変更を反映') : view === 'movement' ? `${movementLabel}を適用` : routeStatus.primaryLabel;
  const primaryDisabled = view === 'expense' ? saving || composing : view === 'extra' ? saving || composing || !expenseComplete : view === 'movement' ? !movementValid : view === 'route' ? routeStatus.disabled : false;
  const back = () => { if (view === 'route' && routeRef.current?.returnToPlanner()) return; changeView(view === 'route' ? 'movement' : 'expense'); };
  const submit = () => { if (view === 'expense') void save(); else if (view === 'extra') { setExpenseAttempted(true); if (expenseComplete) returnToList(); } else if (view === 'movement') { setMovementAttempted(true); if (movementValid) changeView('expense'); } else routeRef.current?.apply(); };
  const returnToList = () => { setError(''); changeView('expense'); };
  const modalHeading = view === 'route' ? '移動距離計算ツール' : view === 'movement' ? `${movementLabel}を設定` : view === 'extra' ? (extraMode === 'add' ? '費用を追加' : `${activeExtra?.row.name || '費用'}を編集`) : '費用を編集';
  return <ComposedModal className={`app-modal settlement-car-modal settlement-task-modal${view === 'movement' ? ' settlement-movement-modal' : view === 'route' ? ' settlement-route-modal' : ''}${contentAtBottom ? ' settlement-modal-at-bottom' : ''}`} onScrollCapture={handleModalScroll} open size={view === 'route' ? 'lg' : view === 'movement' ? 'md' : 'sm'} aria-label={`${name}車：${modalHeading}`} launcherButtonRef={launcherButtonRef} onClose={() => onClose(false)} preventCloseOnClickOutside selectorPrimaryFocus={view === 'route' ? '#route-origin-action .cds--contained-list-item__content' : view === 'movement' ? '#settlement-rental-type' : view === 'extra' ? `#settlement-extra-name-${activeExtra?.index ?? 0}` : returnFocusId}>
    <ModalHeader label={`${name}車`} title={modalHeading} iconDescription="閉じる" />
    <ModalBody hasScrollingContent={view === 'movement' || (['expense', 'extra'].includes(view) && contentHasOverflow)} aria-labelledby="settlement-car-modal-region-title">
      <span id="settlement-car-modal-region-title" className="cds--visually-hidden">{name}車：{modalHeading}の内容</span>
    {view === 'expense' && <div className="form-stack settlement-car-form" onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
      {(error || validationMessage) && <InlineNotification kind="error" title="入力内容を確認してください" subtitle={error || validationMessage} hideCloseButton lowContrast />}
      {removedExpense && <Callout className="settlement-cost-deleted" kind="success" titleId="settlement-cost-deleted-title" title={`${removedExpense.row.name || '費用'}を削除しました`} actionButtonLabel="元に戻す" onActionButtonClick={undoRemoveExpense} lowContrast />}
      <section className="settlement-form-section" aria-label="車両費用の編集">
      <p className="cds--form__helper-text">請求する費用だけ入力してください。未入力の費用は0円で計算します。</p>
      <ContainedList className="settlement-cost-editor" kind="disclosed" size="sm" label={<span className="cds--visually-hidden">車両費用</span>}>
        <ContainedListItem className="settlement-cost-list-item" action={<Button id="settlement-movement-edit" kind="ghost" size={isMobile ? 'md' : 'sm'} aria-label={`${movementLabel}の計算条件を編集`} onClick={() => { setReturnFocusId('#settlement-movement-edit'); changeView('movement'); }}>編集</Button>}>
            <div className="settlement-cost-summary"><span className="settlement-cost-summary__details"><span className="settlement-cost-summary__name">{movementLabel}</span><span className="settlement-cost-summary__meta">{extraTypeLabel(movement?.type || 'split')}</span></span><strong className="settlement-cost-summary__amount">{money(movementComplete ? movementAmount : 0)}</strong></div>
          </ContainedListItem>
          {editable.map(({ row, index }) => {
            const id = getCostId(row, index);
            const rawAmount = String(row.amount ?? '').trim();
            const signedAmount = domain.getSignedSettlementExtraAmount(row);
            const amount = `${signedAmount < 0 ? '−' : ''}${money(Math.abs(rawAmount ? signedAmount : 0))}`;
            return <Fragment key={id}>
              <ContainedListItem className="settlement-cost-list-item" action={<Button id={`settlement-extra-edit-${index}`} kind="ghost" size={isMobile ? 'md' : 'sm'} aria-label={`${row.name || '費用'}を編集`} onClick={() => { setActiveCostId(id); setExtraMode('edit'); setExpenseTouched({}); setExpenseAttempted(false); setReturnFocusId(`#settlement-extra-edit-${index}`); changeView('extra'); }}>編集</Button>}>
                <div className="settlement-cost-summary"><span className="settlement-cost-summary__details"><span className="settlement-cost-summary__name">{row.name || '新しい費用'}</span><span className="settlement-cost-summary__meta">{extraTypeLabel(row.type)}</span></span><strong className="settlement-cost-summary__amount">{amount}</strong></div>
              </ContainedListItem>
            </Fragment>;
          })}
        </ContainedList>
        <Button id="settlement-cost-add" className="settlement-cost-add-action" kind="ghost" size="sm" renderIcon={Add} onClick={addExtra}>新しい費用を追加</Button>
      {candidates.length > 0 && <section className="settlement-extra-candidates" aria-labelledby="settlement-extra-candidates-title"><h3 id="settlement-extra-candidates-title">企画内の費用</h3><ContainedList kind="disclosed" size="sm" label={<span className="cds--visually-hidden">企画内で登録済みの費用</span>}>{candidates.map(candidate => <ContainedListItem key={candidate.key} className="settlement-extra-candidate" action={<Button kind="ghost" size={isMobile ? 'md' : 'sm'} onClick={() => addCandidate(candidate)}>追加</Button>}><div className="settlement-extra-candidate__details"><strong>{candidate.name}</strong><span>{money(candidate.amount)} ・ {extraTypeLabel(candidate.type)}</span></div></ContainedListItem>)}</ContainedList></section>}</section>
    </div>}
    {view === 'extra' && activeExtra && <div className="form-stack settlement-car-form settlement-cost-editor-form" onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
      {error && <InlineNotification kind="error" title="入力内容を確認してください" subtitle={error} hideCloseButton lowContrast />}
      <section className="settlement-form-section" aria-label="費用の入力">
        <div className="settlement-cost-editor-fields">
          <TextInput id={`settlement-extra-name-${activeExtra.index}`} labelText="名目" invalid={!!expenseFieldErrors.name && (expenseTouched.name || expenseAttempted || !!String(activeExtra.row.amount ?? '').trim())} invalidText={expenseFieldErrors.name} value={activeExtra.row.name} readOnly={domain.isTimesTimeFeeExtra(activeExtra.row)} placeholder="例：駐車場代" onBlur={() => setExpenseTouched(current => ({ ...current, name: true }))} onChange={event => { updateExtraField(activeExtra.index, { name: event.target.value }); setError(''); }} />
          <TextInput id={`settlement-extra-amount-${activeExtra.index}`} labelText="金額（円）" helperText="未入力は0円で計算します。" inputMode="numeric" invalid={!!expenseFieldErrors.amount && (expenseTouched.amount || expenseAttempted || !!String(activeExtra.row.amount ?? '').trim())} invalidText={expenseFieldErrors.amount || negativeMoneyText} value={activeExtra.row.amount} onBlur={() => setExpenseTouched(current => ({ ...current, amount: true }))} onChange={event => { updateExtraField(activeExtra.index, { amount: event.target.value }); setError(''); }} />
        </div>
        <CostTypeControl domain={domain} id={`settlement-extra-type-${activeExtra.index}`} label="負担区分" type={activeExtra.row.type} onChange={type => updateExtra(activeExtra.index, { type })} />
        {extraMode === 'edit' && !domain.isTimesTimeFeeExtra(activeExtra.row) && <div className="settlement-cost-delete-action"><Button kind="danger--ghost" size={isMobile ? 'md' : 'sm'} renderIcon={TrashCan} onClick={removeActiveExtra}>{activeExtra.row.name || '費用'}を削除</Button></div>}
      </section>
    </div>}
    {view === 'movement' && <MovementSettingsView car={car} domain={domain} isMobile={isMobile} movementAmount={movementAmount} movementLabel={movementLabel} movementFormula={movementFormula} movementType={movement?.type} movementErrors={movementErrors} movementTouched={movementTouched} movementAttempted={movementAttempted} movementComplete={movementComplete} onBlurField={key => setMovementTouched(current => ({ ...current, [key]: true }))} onOpenRoute={() => changeView('route')} onRentalType={setRentalType} onMovementType={setMovementType} onUpdate={update} />}
    <div aria-hidden={view !== 'route'} style={{ display: view === 'route' ? undefined : 'none' }}><RoutePlanner ref={routeRef} runtime={runtime} isMobile={isMobile} isActive={view === 'route'} onStatusChange={setRouteStatus} onApply={value => { update({ dist: value }); changeView('movement'); onNotice('計算した距離を入力しました。'); }} /></div>
    </ModalBody>
    <ModalFooter primaryButtonText={view === 'route' && routeStatus.hidePrimaryButton ? undefined : primaryLabel} secondaryButtons={[{ buttonText: view === 'expense' ? 'キャンセル' : '戻る', onClick: view === 'expense' ? () => onClose(false) : view === 'extra' ? returnToList : back }]} primaryButtonDisabled={primaryDisabled} onRequestSubmit={submit} onRequestClose={() => onClose(false)} />
  </ComposedModal>;
}

function CollectionPrompt({ value, onChange, onSave, onClose }) {
  return <Modal className="app-modal" open size="xs" modalHeading="集金済みにする" closeButtonLabel="閉じる" primaryButtonText="保存" secondaryButtonText="キャンセル" onRequestSubmit={onSave} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus="#settlement-collector">
    <TextInput id="settlement-collector" labelText="集金した人" value={value} onChange={event => onChange(event.target.value)} />
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
  const [driverNameEdit, setDriverNameEdit] = useState(null);
  const standaloneDriverMenus = useRef(new Map());
  const [collector, setCollector] = useState(null);
  const [memo, setMemo] = useState(null);
  const [memoEditing, setMemoEditing] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionView, setCollectionView] = useState('all');
  const [pendingCollectionFocus, setPendingCollectionFocus] = useState(false);
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
    if (!openSettingsRequestId || openSettingsRequestId <= lastHandledSettingsRequest.current) return;
    lastHandledSettingsRequest.current = openSettingsRequestId;
    onOpenSettings?.({ standalone: true, launcherButtonRef: settlementStartRef });
    onSettingsRequestHandled?.(openSettingsRequestId);
  }, [openSettingsRequestId, onOpenSettings, onSettingsRequestHandled]);
  function closeEdit(setter, edit, saved) { if (!saved && edit && !edit.session.closed) runtime.store.cancelEdit(edit.session); setter(null); }
  function openCar(car, event) {
    carLauncherElement.current = event?.currentTarget || null;
    const edit = beginSettlementEdit(runtime.store, { car });
    edit.state.cars[car.name] = settlement.ensureTimesRentalExtras(edit.state.cars[car.name]);
    setCarEdit(edit);
  }
  function closeCarEditor(saved) {
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
    setCollector(null); setCollectionOpen(true); onNotice('集金状況を更新しました。');
    if (collectionView === 'unpaid') setPendingCollectionFocus(true);
  }
  function setCollectionStatus(person, checked) {
    if (checked && result.isStandaloneSettlement) {
      setCollector({ name: person.name, value: state.paidBy[person.name] || '' });
      setCollectionOpen(false);
      return;
    }
    collectionChange(runtime.store, { name: person.name, checked });
    if (checked && collectionView === 'unpaid') setPendingCollectionFocus(true);
  }
  async function copyUnpaid() {
    const names = result.participants.filter(person => !result.excludedNames.has(person.name) && !state.paid[person.name]).map(person => person.name);
    if (!names.length) { onNotice('未回収者はいません'); return; }
    try { await navigator.clipboard.writeText(names.join('、')); onNotice('未回収者をコピーしました'); }
    catch { onNotice('未回収者をコピーできませんでした'); }
  }
  function saveMemo() {
    if (memo === null) return;
    if (memo !== state.memo) runtime.store.command('settlement', { state: { ...state, memo } });
    setMemo(null); setMemoEditing(false); onNotice('精算メモを保存しました。');
  }
  function openMemoEditor() { setMemo(state.memo || ''); setMemoEditing(true); }
  function closeMemoEditor() { setMemo(null); setMemoEditing(false); }
  const countOnlyNeedsCounts = room.settlement?.standalone?.enabled === true && !result.isStandaloneSettlement;
  if (countOnlyNeedsCounts || (!result.participants.length && !result.isStandaloneSettlement)) return <section className="settlement-page">
    {room.settlement?.standalone?.enabled === true
      ? <div className="initial-empty-state" aria-labelledby="settlement-counts-missing-heading"><h2 id="settlement-counts-missing-heading">人数を設定してください</h2><p>人数だけで精算するには、運転手または同乗者の人数を設定します。</p><Button ref={settlementStartRef} onClick={() => onOpenSettings?.({ standalone: true, launcherButtonRef: settlementStartRef })}>人数を設定</Button><Button kind="ghost" onClick={() => onOpenSettings?.({ launcherButtonRef: settlementStartRef })}>通常の精算に切り替える</Button></div>
      : <InitialEmptyState headingId="settlement-initial-heading" title="精算を始める" description="参加者を追加するか、人数だけで精算を始められます。" primaryAction={{ label: hasFormApplication ? '参加者を確認' : '参加者を追加', onClick: onOpenParticipantRegistration }} alternateAction={{ label: '人数だけで精算', buttonRef: settlementStartRef, onClick: () => onOpenSettings?.({ standalone: true, launcherButtonRef: settlementStartRef }) }} roomStatus={roomStatus} />}
  </section>;
  return <section className="settlement-page" aria-label="精算">
    {visibleIssues.map(message => <InlineNotification key={message} kind={message.includes('企画者を選ぶ') ? 'info' : 'error'} title="設定を確認してください" subtitle={message} hideCloseButton lowContrast />)}
    <Tile className="settlement-card settlement-collection-card">
      <div className="settlement-section-heading"><div><h2>集金状況</h2><small className="settlement-collection-summary">1人あたり {money(result.perPerson)}</small></div>
        <Button ref={collectionTriggerRef} kind="ghost" size="sm" aria-expanded={collectionOpen} aria-controls="settlement-collection-modal" onClick={() => setCollectionOpen(true)}>集金を記録</Button>
      </div>
    </Tile>
    <Tile className="settlement-card settlement-vehicles-card">
      <div className="settlement-section-heading"><div><h2 ref={paymentHeadingRef} tabIndex="-1">各車への支払い</h2></div>
        <Button ref={settlementSettingsTriggerRef} className="settlement-settings-action" kind="ghost" size="sm" onClick={() => onOpenSettings?.({ launcherButtonRef: settlementSettingsTriggerRef })}>精算設定</Button>
      </div>
      <div className="settlement-car-list">{data.cars.map((car, index) => {
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
        const adjustmentAmount = amount => `${amount < 0 ? '−' : '+'}${money(Math.abs(amount))}`;
        const renderItems = (items, baseType) => items.filter(row => row.amountValue !== 0).map((row, rowIndex) => <div className="settlement-cost-item" key={row.id || `${row.name}-${rowIndex}`}><span>{row.name || '費用'}{row.isMovement || row.type === baseType ? '' : `（${extraTypeLabel(row.type)}）`}</span><span className="settlement-cost-item-amount">{`${row.amountValue < 0 ? '−' : ''}${money(Math.abs(row.amountValue))}`}</span></div>);
        const hasSplitDetails = splitItems.some(row => row.amountValue !== 0) || calc.splitRound !== 0 || calc.collectionOffset !== 0;
        const hasClubDetails = clubItems.some(row => row.amountValue !== 0) || calc.clubRound !== 0;
        const hasSavedManualExpenses = (carState.extras || []).some(row => !settlement.isDriverRewardExtra(row) && !settlement.isTimesDistanceFeeExtra(row) && !settlement.isGasMovementFeeExtra(row) && !settlement.isTimesTimeFeeExtra(row) && settlement.hasMeaningfulExtra(row));
        const hasSavedTimesFee = (carState.extras || []).some(row => settlement.isTimesTimeFeeExtra(row) && String(row.amount ?? '').trim());
        const hasSavedCarExpenses = movementComplete || hasSavedManualExpenses || hasSavedTimesFee;
        const breakdownAccessibleLabel = `「${carLabel}」支払い内訳`;
        return <article className="settlement-car" key={Number.isInteger(car.standaloneIndex) ? `standalone-${car.standaloneIndex}` : car.name} aria-labelledby={`settlement-car-${carId}`}>
          <div className="settlement-car-main">
            <div className="settlement-car-info">
              <h3 id={`settlement-car-${carId}`} aria-label={carLabel}>{car.name}車{calc.usesTimesRental && <span className="settlement-car-rental-label">（レンタカー）</span>}</h3>
              <div className="settlement-car-actions">
                <Button className="settlement-car-edit-action" kind="ghost" size="sm" aria-label={`${carLabel}の費用を${hasSavedCarExpenses ? '編集' : '入力'}`} onClick={event => openCar(car, event)}>{hasSavedCarExpenses ? '費用を編集' : '費用を入力'}</Button>
                {result.isStandaloneSettlement && Number.isInteger(car.standaloneIndex) && <OverflowMenu ref={node => node ? standaloneDriverMenus.current.set(car.standaloneIndex, node) : standaloneDriverMenus.current.delete(car.standaloneIndex)} ariaLabel={`${carLabel}の操作`} iconDescription={`${carLabel}の操作`} size={isMobile ? 'lg' : 'sm'} flipped><OverflowMenuItem itemText="運転手の名前を編集" onClick={() => openDriverNameEditor(car)} /></OverflowMenu>}
              </div>
              {calc.driverNames.length > 1 && <p>運転手：{calc.driverNames.join('、')}（車単位で一括支払い）</p>}
            </div>
          </div>
          <dl className="settlement-car-amounts" aria-label={`${carLabel}の支払い額`}>
            <div><dt>割勘</dt><dd>{money(calc.adjustedSplitPay)}</dd></div>
            <div><dt>部費</dt><dd>{money(calc.adjustedClubPay)}</dd></div>
          </dl>
          <Accordion className="settlement-car-breakdown" align="end" isFlush size="sm">
            <AccordionItem className="settlement-car-breakdown-item" title="支払い内訳" aria-label={breakdownAccessibleLabel}>
              <div className="settlement-cost-list">
                {hasSplitDetails && <section className="settlement-cost-group" aria-labelledby={`settlement-split-${carId}`}>
                  <h4 id={`settlement-split-${carId}`}>割勘</h4>
                  {splitItems.some(row => row.amountValue !== 0) && <div className="settlement-cost-items">{renderItems(splitItems, 'split')}</div>}
                  {(calc.splitRound !== 0 || calc.collectionOffset !== 0) && <div className="settlement-cost-adjustments">
                    {calc.splitRound !== 0 && <div className="settlement-cost-adjustment"><span>切り上げ分</span><strong>{adjustmentAmount(calc.splitRound)}</strong></div>}
                    {calc.collectionOffset !== 0 && <div className="settlement-cost-adjustment"><span>集金分差し引き</span><strong>−{money(calc.collectionOffset)}</strong></div>}
                  </div>}
                </section>}
                {hasClubDetails && <section className="settlement-cost-group" aria-labelledby={`settlement-club-${carId}`}>
                  <h4 id={`settlement-club-${carId}`}>部費</h4>
                  {clubItems.some(row => row.amountValue !== 0) && <div className="settlement-cost-items">{renderItems(clubItems, 'club')}</div>}
                  {calc.clubRound !== 0 && <div className="settlement-cost-adjustments"><div className="settlement-cost-adjustment"><span>切り上げ分</span><strong>{adjustmentAmount(calc.clubRound)}</strong></div></div>}
                </section>}
                {!hasSplitDetails && !hasClubDetails && <p className="settlement-cost-empty">該当する費用なし</p>}
              </div>
            </AccordionItem>
          </Accordion>
        </article>;
      })}</div>
    </Tile>
    <Tile className="settlement-card settlement-memo-card"><div className="settlement-section-heading"><div><h2>メモ</h2>{!memoEditing && <p>{state.memo?.trim() ? state.memo : 'メモなし'}</p>}</div>{!memoEditing && <Button kind="ghost" size="sm" onClick={openMemoEditor}>{state.memo?.trim() ? '編集' : 'メモを追加'}</Button>}</div>
      {memoEditing && <div className="settlement-memo-editor"><TextArea id="settlement-memo-editor" labelText="メモ" placeholder="例：レンタカー代は高橋さんが立替" rows={3} value={memo ?? ''} onChange={event => setMemo(event.target.value)} /><div className="settlement-memo-actions"><Button kind="tertiary" size="sm" onClick={saveMemo}>保存</Button><Button kind="ghost" size="sm" onClick={closeMemoEditor}>キャンセル</Button></div></div>}
    </Tile>
    <Modal id="settlement-collection-modal" className="app-modal settlement-collection-modal" open={collectionOpen} size="sm" hasScrollingContent modalHeading="集金状況" closeButtonLabel="閉じる" primaryButtonText="閉じる" secondaryButtonText="未回収者をコピー" onSecondarySubmit={copyUnpaid} onRequestSubmit={() => setCollectionOpen(false)} onRequestClose={() => setCollectionOpen(false)} launcherButtonRef={collectionTriggerRef} selectorPrimaryFocus=".settlement-collection-modal .cds--content-switcher-btn">
      <div className="settlement-collection-modal-content">
        <ContentSwitcher aria-label="集金対象者の表示" size="sm" lowContrast selectedIndex={collectionView === 'unpaid' ? 1 : 0} onChange={({ name }) => setCollectionView(name)}><Switch name="all" text="すべて" /><Switch name="unpaid" text="未回収" /></ContentSwitcher>
        <ContainedList className="settlement-collection-list" kind="on-page" size="lg" label={<span className="cds--visually-hidden">集金対象者</span>}>{result.participants.filter(person => collectionView !== 'unpaid' || (!result.excludedNames.has(person.name) && !state.paid[person.name])).map(person => {
                const excluded = result.excludedNames.has(person.name);
                const paid = !!state.paid[person.name];
                const label = state.paidBy[person.name] || person.name;
                if (excluded) return <ContainedListItem className="settlement-collection-row excluded" key={person.name} action={<Tag type="cool-gray" size="sm">集金不要</Tag>}><span><strong>{person.name}</strong><small>{result.driverNames.has(person.name) && result.driverCollectionOffset ? '支払額から差し引き済み' : '集金対象外'}</small></span></ContainedListItem>;
                const checkboxId = `settlement-paid-${person.name}`;
                return <ContainedListItem className="settlement-collection-row" key={person.name} action={<Checkbox id={checkboxId} labelText={`${label}の集金を記録`} aria-label={`${label}の集金を記録`} hideLabel checked={paid} onChange={(_, { checked }) => setCollectionStatus(person, checked)} />}><label className="settlement-collection-row__label" htmlFor={checkboxId}><span><strong>{label}</strong><small>{paid ? '回収済み' : '未回収'}</small></span><strong>{money(result.perPerson)}</strong></label></ContainedListItem>;
        })}</ContainedList>
      </div>
    </Modal>
    {carEdit && <CarEditor runtime={runtime} edit={carEdit} launcherButtonRef={carLauncherButtonRef} onNotice={onNotice} onClose={closeCarEditor} />}
    {driverNameEdit && <StandaloneDriverNameModal runtime={runtime} edit={driverNameEdit.edit} launcherButtonRef={driverNameEdit.launcherButtonRef} onNotice={onNotice} onClose={saved => closeEdit(setDriverNameEdit, driverNameEdit.edit, saved)} />}
    {collector && <CollectionPrompt value={collector.value} onChange={value => setCollector(current => ({ ...current, value }))} onSave={markCollected} onClose={() => { setCollector(null); setCollectionOpen(true); }} />}
  </section>;
}
