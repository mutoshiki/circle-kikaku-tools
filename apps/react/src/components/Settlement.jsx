import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Accordion, AccordionItem, Button, Checkbox, ContainedList, ContainedListItem, ContentSwitcher, IconButton, InlineNotification, Modal,
  OverflowMenu, OverflowMenuItem,
  NumberInput, ProgressIndicator, ProgressStep, RadioButton, RadioButtonGroup,
  Select, SelectItem, Switch, Tag, TextArea, TextInput, Tile,
} from '@carbon/react';
import { Add, Copy, Edit } from '@carbon/icons-react';
import { beginSettlementEdit, commitSettlementEdit, collectionChange } from './settlement/edit.js';
import RoutePlanner from './RoutePlanner.jsx';
import useMediaQuery from '../hooks/useMediaQuery.js';
import { notice } from '../ui/task-contracts.js';

const money = value => `¥${Math.round(Number(value) || 0).toLocaleString('ja-JP')}`;
const hasNegativeValue = value => /^[-−]/.test(String(value ?? '').trim());
const negativeMoneyText = '金額は0円以上で入力してください。';
const negativeNumberText = '0以上の値を入力してください。';
const extraTypeLabel = type => ({ split: '割勘', club: '部費', 'split-minus': '割勘から差し引き', 'club-minus': '部費から差し引き' })[type] || '割勘';

function SettingsModal({ runtime, edit, onClose, onNotice }) {
  const [, render] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [step, setStep] = useState(0);
  const isMobile = useMediaQuery('(max-width: 671px)');
  const state = edit.state;
  const update = changes => { Object.assign(state, changes); render(value => value + 1); };
  const updateStandalone = changes => update({ standalone: { ...state.standalone, ...changes } });
  const invalidDriverCount = state.standalone.enabled && hasNegativeValue(state.standalone.driverCount);
  const invalidMemberCount = state.standalone.enabled && hasNegativeValue(state.standalone.memberCount);
  const invalidReward = hasNegativeValue(state.driverReward);
  const invalidCurrentStep = step === 0 ? invalidDriverCount || invalidMemberCount : step === 1 && invalidReward;
  const driverRule = state.driverCollectionFree ? 'free' : state.driverCollectionOffset ? 'offset' : 'normal';
  async function save() {
    if (composing || saving || invalidDriverCount || invalidMemberCount || invalidReward) return;
    setSaving(true); setError('');
    try { await commitSettlementEdit(runtime, edit); onClose(true); }
    catch (caught) { setError(caught.message); setSaving(false); }
  }
  function go(next) {
    if (next > step && step === 0 && (invalidDriverCount || invalidMemberCount)) return;
    if (next > step && step === 1 && invalidReward) return;
    if (next > step && step === 0 && state.standalone.enabled && ((Number(state.standalone.driverCount) || 0) + (Number(state.standalone.memberCount) || 0) <= 0)) {
      setError('運転手または同乗者の人数を入力してください。');
      return;
    }
    setError(''); setStep(Math.max(0, Math.min(2, next)));
  }
  return <Modal className="app-modal settlement-settings-modal" open size="lg" hasScrollingContent modalHeading="精算設定を編集" primaryButtonText={step === 2 ? '保存' : '次へ'} secondaryButtons={[{ buttonText: 'キャンセル', onClick: () => onClose(false) }, { buttonText: '戻る', onClick: () => go(step - 1) }]} primaryButtonDisabled={saving || composing || invalidCurrentStep} onRequestSubmit={() => step === 2 ? save() : go(step + 1)} onRequestClose={() => onClose(false)} preventCloseOnClickOutside selectorPrimaryFocus="#settlement-mode-normal">
    <div className="form-stack settlement-settings-form" onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
      <ProgressIndicator id="settlement-settings-progress" className="settlement-settings-progress" currentIndex={step} vertical={isMobile} spaceEqually={!isMobile} aria-label="精算設定の進行状況">
        {['精算方法', '車出し協力代', '集金ルール'].map((label, index) => <ProgressStep key={label} label={label} current={step === index} complete={step > index} />)}
      </ProgressIndicator>
      {error && <InlineNotification kind="error" title="保存できませんでした" subtitle={error} hideCloseButton lowContrast />}
      {step === 0 && <section className="settlement-settings-step" aria-labelledby="settlement-method-title"><h3 id="settlement-method-title">精算方法</h3><RadioButtonGroup legendText="精算方法" name="settlement-mode" valueSelected={state.standalone.enabled ? 'standalone' : 'normal'} onChange={value => updateStandalone({ enabled: value === 'standalone' })} orientation="vertical">
        <RadioButton id="settlement-mode-normal" value="normal" labelText="参加者を登録して精算" />
        <RadioButton id="settlement-mode-standalone" value="standalone" labelText="人数だけで精算" />
      </RadioButtonGroup>
      {state.standalone.enabled && <div className="form-grid">
        <NumberInput id="settlement-driver-count" label="運転手の人数" min={0} max={99} allowEmpty invalid={invalidDriverCount} invalidText="人数は0以上で入力してください。" value={state.standalone.driverCount} onChange={(_, { value }) => updateStandalone({ driverCount: String(value) })} />
        <NumberInput id="settlement-member-count" label="同乗者の人数" min={0} max={99} allowEmpty invalid={invalidMemberCount} invalidText="人数は0以上で入力してください。" value={state.standalone.memberCount} onChange={(_, { value }) => updateStandalone({ memberCount: String(value) })} />
        {Array.from({ length: Number(state.standalone.driverCount) || 0 }, (_, index) => <TextInput key={index} id={`settlement-driver-name-${index}`} labelText={`運転手${index + 1}の名前`} value={state.standalone.driverNames[index] || ''} onChange={event => { const names = [...state.standalone.driverNames]; names[index] = event.target.value; updateStandalone({ driverNames: names }); }} />)}
      </div>}
      <RadioButtonGroup legendText="端数単位" name="settlement-rounding" valueSelected={state.rounding} onChange={value => update({ rounding: String(value) })} orientation="vertical">
        {['1', '10', '100'].map(value => <RadioButton key={value} id={`settlement-rounding-${value}`} value={value} labelText={`${value}円単位`} />)}
      </RadioButtonGroup></section>}
      {step === 1 && <section className="settlement-settings-step" aria-labelledby="settlement-reward-title"><h3 id="settlement-reward-title">車出し協力代</h3><div className="form-grid">
        <TextInput id="settlement-driver-reward" labelText="1台あたりの協力代（円）" inputMode="numeric" invalid={invalidReward} invalidText={negativeMoneyText} value={state.driverReward} onChange={event => update({ driverReward: event.target.value })} />
        <RadioButtonGroup legendText="協力代の負担" name="settlement-reward-type" valueSelected={state.driverRewardType} onChange={value => update({ driverRewardType: value })} orientation="vertical">
          <RadioButton id="settlement-reward-split" value="split" labelText="参加者で割勘" />
          <RadioButton id="settlement-reward-club" value="club" labelText="部費から支払う" />
        </RadioButtonGroup>
      </div></section>}
      {step === 2 && <section className="settlement-settings-step" aria-labelledby="settlement-collection-title"><h3 id="settlement-collection-title">集金ルール</h3><RadioButtonGroup legendText="運転手分の集金" name="settlement-driver-rule" valueSelected={driverRule} onChange={value => update({ driverCollectionOffset: value === 'offset', driverCollectionFree: value === 'free' })} orientation="vertical">
        <RadioButton id="settlement-driver-normal" value="normal" labelText="集金する" />
        <RadioButton id="settlement-driver-offset" value="offset" labelText="支払額から差し引く" />
        <RadioButton id="settlement-driver-free" value="free" labelText="集金対象外" />
      </RadioButtonGroup>
      {!state.standalone.enabled && <Select id="settlement-organizer" labelText="企画者" value={state.organizerName} onChange={event => update({ organizerName: event.target.value })}>
        <SelectItem value="" text="選択してください" />
        {Object.values(edit.session.base.participants || {}).sort((a, b) => a.name.localeCompare(b.name, 'ja')).map(person => <SelectItem key={person.id} value={person.name} text={person.name} />)}
      </Select>}
      {!state.standalone.enabled && <RadioButtonGroup legendText="企画者分の集金" name="settlement-organizer-rule" valueSelected={state.organizerFree ? 'free' : 'collect'} onChange={value => update({ organizerFree: value === 'free' })} orientation="vertical">
        <RadioButton id="settlement-organizer-collect" value="collect" labelText="集金する" />
        <RadioButton id="settlement-organizer-free" value="free" labelText="集金対象外" />
      </RadioButtonGroup>}</section>}
    </div>
  </Modal>;
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

function MovementSettingsView({ car, domain, movementAmount, movementLabel, movementFormula, movementType, onOpenRoute, onRentalType, onMovementType, onUpdate }) {
  const times = domain.isTimesRentalCar(car);
  const input = (id, label, value, key) => <TextInput id={id} labelText={label} inputMode="decimal" invalid={hasNegativeValue(value)} invalidText={negativeNumberText} value={value} onChange={event => onUpdate({ [key]: event.target.value })} />;
  return <div className="form-stack settlement-movement-form">
      <RadioButtonGroup legendText="車両種別" name="settlement-rental-type" valueSelected={car.rentalType} onChange={onRentalType} orientation="horizontal">
        <RadioButton id="settlement-rental-type" value="private" labelText="自家用車" />
        <RadioButton id="settlement-rental-times" value="times" labelText="タイムズ" />
      </RadioButtonGroup>
      <section className="settlement-form-section" aria-labelledby="settlement-movement-conditions-title"><h3 className="settlement-movement-section-title" id="settlement-movement-conditions-title">移動料金の計算条件</h3><div className="form-grid">
        <div className="distance-field">{input('settlement-distance', '移動距離（km）', car.dist, 'dist')}<Button kind="ghost" size="sm" onClick={onOpenRoute}>ルートから距離を計算</Button></div>
        {!times && <>{input('settlement-eco', '燃費（km/L）', car.eco, 'eco')}{input('settlement-price', 'ガソリン単価（円/L）', car.price, 'price')}</>}
      </div></section>
      <CostTypeControl domain={domain} id="settlement-movement-type" label="移動料金の負担区分" type={movementType || 'split'} allowNegative={false} onChange={onMovementType} />
      <Tile className="settlement-movement-preview" aria-label={`計算した${movementLabel} ${money(movementAmount)}。計算条件: ${movementFormula}`}><span>計算した{movementLabel}</span><strong>{money(movementAmount)}</strong></Tile>
    </div>;
}

function getExtraCandidates(state, domain) {
  const candidates = new Map();
  Object.values(state.cars || {}).flatMap(car => car.extras || []).forEach(row => {
    const name = String(row?.name || '').trim();
    if (!name || domain.isDriverRewardExtra(row) || domain.isGasMovementFeeExtra(row) || domain.isTimesDistanceFeeExtra(row) || domain.isTimesTimeFeeExtra(row) || candidates.has(name)) return;
    candidates.set(name, { name, amount: String(row.amount || ''), type: domain.normalizeSettlementExtraType(row.type) });
  });
  return [...candidates.values()];
}

function CarEditor({ runtime, edit, onClose, onNotice }) {
  const domain = runtime.store.domain.settlement;
  const [, render] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [view, setView] = useState('expense');
  const [contentAtBottom, setContentAtBottom] = useState(false);
  const [activeCostId, setActiveCostId] = useState('movement');
  const [extraMode, setExtraMode] = useState('edit');
  const [returnFocusId, setReturnFocusId] = useState('#settlement-movement-menu');
  const [routeStatus, setRouteStatus] = useState({ primaryLabel: 'この距離を適用', disabled: true, hidePrimaryButton: false });
  const routeRef = useRef(null);
  const name = edit.car.name;
  const car = edit.state.cars[name];
  const { data } = runtime.store.domain.settlementInput(edit.session.base);
  const calculated = domain.calculateSettlement(data, domain.normalizeSettlementState(edit.state));
  const calculatedCar = calculated.cars.find(row => row.name === name);
  const update = changes => { edit.state.cars[name] = { ...car, ...changes }; render(value => value + 1); };
  const updateExtra = (index, changes) => update({ extras: car.extras.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row) });
  const movement = car.extras.find(row => domain.isTimesRentalCar(car) ? domain.isTimesDistanceFeeExtra(row) : domain.isGasMovementFeeExtra(row));
  const movementLabel = domain.isTimesRentalCar(car) ? 'タイムズ移動料金' : 'ガソリン代';
  const movementAmount = calculatedCar?.movementAmount ?? 0;
  const movementFormula = domain.isTimesRentalCar(car)
    ? (Number(car.dist) > 0 ? `移動距離 ${Number(car.dist).toLocaleString('ja-JP')}km` : '移動距離を入力してください')
    : (Number(car.dist) > 0 && Number(car.eco) > 0 && Number(car.price) > 0 ? `${Number(car.dist).toLocaleString('ja-JP')}km ÷ ${car.eco}km/L × ${car.price}円/L` : '移動距離・燃費・ガソリン単価を入力してください');
  const editable = car.extras.map((row, index) => ({ row, index })).filter(({ row }) => !domain.isDriverRewardExtra(row) && !domain.isTimesDistanceFeeExtra(row) && !domain.isGasMovementFeeExtra(row));
  const movementFields = domain.isTimesRentalCar(car) ? ['dist'] : ['dist', 'eco', 'price'];
  const hasNegativeMovement = movementFields.some(key => hasNegativeValue(car[key]));
  const hasNegativeExpense = editable.some(({ row }) => hasNegativeValue(row.amount));
  const validationMessage = hasNegativeExpense ? negativeMoneyText : hasNegativeMovement ? '移動距離・燃費・ガソリン単価は0以上で入力してください。' : '';
  const getCostId = (row, index) => row.id || `extra-${index}`;
  const activeExtra = editable.find(({ row, index }) => getCostId(row, index) === activeCostId);
  const candidates = getExtraCandidates(edit.state, domain);
  function changeView(nextView) { setContentAtBottom(false); setView(nextView); }
  function handleModalScroll(event) {
    if (!['movement', 'route'].includes(view) || !event.target?.classList?.contains('cds--modal-content')) return;
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
  function addExtra() { const row = { id: domain.createSettlementExtraId(), name: '', amount: '', type: 'split', pending: true }; update({ extras: [...car.extras, row] }); setActiveCostId(row.id); setExtraMode('add'); setReturnFocusId('#settlement-cost-add'); setError(''); setView('extra'); }
  function addCandidate(candidate) { const row = { id: domain.createSettlementExtraId(), ...candidate, pending: false }; update({ extras: [...car.extras, row] }); setActiveCostId(row.id); setExtraMode('add'); setReturnFocusId('#settlement-cost-add'); setError(''); setView('extra'); }
  function removeExtra(index) { const removed = car.extras[index]; update({ extras: car.extras.filter((_, rowIndex) => rowIndex !== index) }); if (getCostId(removed, index) === activeCostId) setActiveCostId('movement'); }
  useEffect(() => {
    const selector = view === 'expense' ? returnFocusId : view === 'extra' ? `#settlement-extra-name-${activeExtra?.index ?? 0}` : view === 'movement' ? '#settlement-rental-type' : '#route-origin-action .cds--contained-list-item__content';
    const timer = setTimeout(() => {
      document.querySelector(selector)?.focus();
      if (view === 'movement' || view === 'route') {
        const content = document.querySelector('.settlement-car-modal .cds--modal-content');
        if (content) setContentAtBottom(content.scrollHeight <= content.clientHeight + 1);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [view, activeExtra?.index, returnFocusId]);
  async function save() {
    if (composing || saving) return;
    if (hasNegativeExpense || hasNegativeMovement) { setError(validationMessage); return; }
    const { data } = runtime.store.domain.settlementInput(edit.session.base);
    const normalized = domain.normalizeSettlementState(edit.state);
    const result = domain.calculateSettlement(data, normalized);
    const issues = domain.getSettlementIssues(data, normalized, result);
    const messages = issues.messages.filter(message => message.startsWith(`${name}車の`));
    if (messages.length) { setError(messages[0]); return; }
    setSaving(true); setError('');
    try { await commitSettlementEdit(runtime, edit); onClose(true); }
    catch (caught) { setError(caught.message); setSaving(false); }
  }
  const primaryLabel = view === 'expense' ? '費用を保存' : view === 'extra' ? (extraMode === 'add' ? '費用を追加' : '変更を反映') : view === 'movement' ? `${movementLabel}を適用` : routeStatus.primaryLabel;
  const primaryDisabled = ['expense', 'extra'].includes(view) ? saving || composing || hasNegativeExpense || hasNegativeMovement : view === 'movement' ? hasNegativeMovement : view === 'route' ? routeStatus.disabled : false;
  const back = () => { if (view === 'route' && routeRef.current?.returnToPlanner()) return; changeView(view === 'route' ? 'movement' : 'expense'); };
  const submit = () => { if (view === 'expense') void save(); else if (view === 'extra') returnToList(); else if (view === 'movement') changeView('expense'); else routeRef.current?.apply(); };
  const returnToList = () => { setError(''); changeView('expense'); };
  return <Modal className={`app-modal settlement-car-modal settlement-task-modal${view === 'movement' ? ' settlement-movement-modal' : view === 'route' ? ' settlement-route-modal' : ''}${contentAtBottom && view !== 'expense' ? ' settlement-movement-at-bottom' : ''}`} onScrollCapture={handleModalScroll} open size={view === 'route' ? 'lg' : 'md'} hasScrollingContent={view !== 'route'} closeButtonLabel="閉じる" modalAriaLabel={`${name}車の費用を編集`} modalLabel={`${name}車`} modalHeading={view === 'route' ? '移動距離を計算' : view === 'movement' ? `${movementLabel}を設定` : '費用を編集'} primaryButtonText={view === 'route' && routeStatus.hidePrimaryButton ? undefined : primaryLabel} secondaryButtons={[{ buttonText: view === 'expense' ? 'キャンセル' : '戻る', onClick: view === 'expense' ? () => onClose(false) : view === 'extra' ? returnToList : back }]} primaryButtonDisabled={primaryDisabled} onRequestSubmit={submit} onRequestClose={() => onClose(false)} preventCloseOnClickOutside selectorPrimaryFocus={view === 'route' ? '#route-origin-action .cds--contained-list-item__content' : view === 'movement' ? '#settlement-rental-type' : view === 'extra' ? `#settlement-extra-name-${activeExtra?.index ?? 0}` : returnFocusId}>
    {view === 'expense' && <div className="form-stack settlement-car-form" onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
      {(error || validationMessage) && <InlineNotification kind="error" title="入力内容を確認してください" subtitle={error || validationMessage} hideCloseButton lowContrast />}
      <section className="settlement-form-section" aria-label="車両費用の編集">
        <ContainedList className="settlement-cost-editor" kind="disclosed" size="sm" label={<span className="cds--visually-hidden">車両費用</span>}>
          <ContainedListItem className="settlement-cost-list-item" action={<OverflowMenu id="settlement-movement-menu" aria-label={`${movementLabel}の操作`} iconDescription={`${movementLabel}の操作`} align="bottom-right" size="sm" flipped>
            <OverflowMenuItem itemText="計算条件を編集" onClick={() => { setReturnFocusId('#settlement-movement-menu'); changeView('movement'); }} />
          </OverflowMenu>}>
            <div className="settlement-cost-summary"><strong>{movementLabel}</strong><span className="settlement-cost-summary__amount"><strong>{money(movementAmount)}</strong></span></div>
          </ContainedListItem>
          {editable.map(({ row, index }) => {
            const id = getCostId(row, index);
            const timesTime = domain.isTimesTimeFeeExtra(row);
            const rawAmount = String(row.amount ?? '').trim();
            const signedAmount = domain.getSignedSettlementExtraAmount(row);
            const amount = rawAmount ? `${signedAmount < 0 ? '−' : ''}${money(Math.abs(signedAmount))}` : '金額未入力';
            return <Fragment key={id}>
              <ContainedListItem className="settlement-cost-list-item" action={<OverflowMenu id={`settlement-extra-menu-${index}`} aria-label={`${row.name || '費用'}の操作`} iconDescription={`${row.name || '費用'}の操作`} align="bottom-right" size="sm" flipped>
                <OverflowMenuItem itemText="編集" onClick={() => { setActiveCostId(id); setExtraMode('edit'); setReturnFocusId(`#settlement-extra-menu-${index}`); changeView('extra'); }} />
                {!timesTime && <OverflowMenuItem itemText="削除" hasDivider isDelete onClick={() => removeExtra(index)} />}
              </OverflowMenu>}>
                <div className="settlement-cost-summary"><strong>{row.name || '新しい費用'}</strong><strong className="settlement-cost-summary__amount">{amount}</strong></div>
              </ContainedListItem>
            </Fragment>;
          })}
        </ContainedList>
        <Button id="settlement-cost-add" className="settlement-cost-add-action" kind="tertiary" size="sm" renderIcon={Add} onClick={addExtra}>費用を追加</Button>
      {candidates.length > 0 && <section className="settlement-extra-candidates" aria-labelledby="settlement-extra-candidates-title"><h3 id="settlement-extra-candidates-title">登録済みから追加</h3><ContainedList kind="disclosed" size="sm" label={<span className="cds--visually-hidden">登録済みの費用</span>}>{candidates.map(candidate => <ContainedListItem key={`${candidate.name}-${candidate.type}`} className="settlement-extra-candidate" action={<IconButton kind="ghost" size="sm" label={`${candidate.name}を追加`} align="bottom-right" renderIcon={Add} onClick={() => addCandidate(candidate)} />}><div><strong>{candidate.name}</strong><span>{money(candidate.amount)} ・ {extraTypeLabel(candidate.type)}</span></div></ContainedListItem>)}</ContainedList></section>}</section>
    </div>}
    {view === 'extra' && activeExtra && <div className="form-stack settlement-car-form settlement-cost-editor-form" onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
      {(error || validationMessage) && <InlineNotification kind="error" title="入力内容を確認してください" subtitle={error || validationMessage} hideCloseButton lowContrast />}
      <section className="settlement-form-section" aria-label="費用の入力">
        <div className="settlement-cost-editor-fields">
          <TextInput id={`settlement-extra-name-${activeExtra.index}`} labelText="名目" value={activeExtra.row.name} readOnly={domain.isTimesTimeFeeExtra(activeExtra.row)} placeholder="例：駐車場代" onChange={event => updateExtra(activeExtra.index, { name: event.target.value, pending: false })} />
          <TextInput id={`settlement-extra-amount-${activeExtra.index}`} labelText="金額（円）" inputMode="numeric" invalid={hasNegativeValue(activeExtra.row.amount)} invalidText={negativeMoneyText} value={activeExtra.row.amount} onChange={event => updateExtra(activeExtra.index, { amount: event.target.value, pending: false })} />
        </div>
        <CostTypeControl domain={domain} id={`settlement-extra-type-${activeExtra.index}`} label="負担区分" type={activeExtra.row.type} onChange={type => updateExtra(activeExtra.index, { type })} />
      </section>
    </div>}
    {view === 'movement' && <MovementSettingsView car={car} domain={domain} movementAmount={movementAmount} movementLabel={movementLabel} movementFormula={movementFormula} movementType={movement?.type} onOpenRoute={() => changeView('route')} onRentalType={setRentalType} onMovementType={setMovementType} onUpdate={update} />}
    <div aria-hidden={view !== 'route'} style={{ display: view === 'route' ? undefined : 'none' }}><RoutePlanner ref={routeRef} runtime={runtime} onStatusChange={setRouteStatus} onApply={value => { update({ dist: value }); changeView('movement'); }} /></div>
  </Modal>;
}

function CollectionPrompt({ value, onChange, onSave, onClose }) {
  return <Modal open size="xs" modalHeading="集金済みにする" primaryButtonText="保存" secondaryButtonText="キャンセル" onRequestSubmit={onSave} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus="#settlement-collector">
    <TextInput id="settlement-collector" labelText="集金した人" value={value} onChange={event => onChange(event.target.value)} />
  </Modal>;
}

export default function Settlement({ runtime, room, onNotice, embedded = false }) {
  const { data, state } = runtime.store.domain.settlementInput(room);
  const isMobile = useMediaQuery('(max-width: 671px)');
  const settlement = runtime.store.domain.settlement;
  const result = settlement.calculateSettlement(data, state);
  const issues = settlement.getSettlementIssues(data, state, result);
  const [settingsEdit, setSettingsEdit] = useState(null);
  const [carEdit, setCarEdit] = useState(null);
  const [collector, setCollector] = useState(null);
  const [memo, setMemo] = useState(null);
  const [memoEditing, setMemoEditing] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionView, setCollectionView] = useState('unpaid');
  const collectionTriggerRef = useRef(null);
  function closeEdit(setter, edit, saved) { if (!saved && edit && !edit.session.closed) runtime.store.cancelEdit(edit.session); setter(null); }
  function openCar(car) {
    const edit = beginSettlementEdit(runtime.store, { car });
    edit.state.cars[car.name] = settlement.ensureTimesRentalExtras(edit.state.cars[car.name]);
    setCarEdit(edit);
  }
  function markCollected() {
    collectionChange(runtime.store, { name: collector.name, checked: true, collector: collector.value || collector.name });
    setCollector(null);
  }
  async function copyUnpaid() {
    const names = result.participants.filter(person => !result.excludedNames.has(person.name) && !state.paid[person.name]).map(person => person.name);
    if (!names.length) { onNotice(notice.info('未回収者はいません', { placement: 'toast' })); return; }
    try { await navigator.clipboard.writeText(names.join('、')); onNotice(notice.success('未回収者をコピーしました', { placement: 'toast' })); }
    catch { onNotice(notice.error('未回収者をコピーできませんでした', { placement: 'toast' })); }
  }
  function saveMemo() {
    if (memo === null) return;
    if (memo !== state.memo) runtime.store.command('settlement', { state: { ...state, memo } });
    setMemo(null); setMemoEditing(false);
  }
  function openMemoEditor() { setMemo(state.memo || ''); setMemoEditing(true); }
  function closeMemoEditor() { setMemo(null); setMemoEditing(false); }
  if (!result.participants.length && !result.isStandaloneSettlement) return <section className="settlement-page"><div className="empty-state">{!embedded && <h1>精算</h1>}<p>参加者がいません</p></div></section>;
  return <section className="settlement-page" aria-label="精算">
    {issues.messages.map(message => <InlineNotification key={message} kind={message.includes('企画者を選ぶ') ? 'info' : 'error'} title="設定を確認してください" subtitle={message} hideCloseButton lowContrast />)}
    <Tile className="settlement-card settlement-vehicles-card">
      <div className="settlement-section-heading"><div>{embedded ? <h2>各車への支払い</h2> : <h1>各車への支払い</h1>}</div>
        <Button className="settlement-settings-action" kind="ghost" size="sm" renderIcon={Edit} aria-label="精算設定を編集" onClick={() => setSettingsEdit(beginSettlementEdit(runtime.store))}>精算設定</Button>
      </div>
      <div className="settlement-car-list">{data.cars.map((car, index) => {
        const calc = result.cars.find(row => row.name === car.name);
        if (!calc) return null;
        const carLabel = `${car.name}車${calc.usesTimesRental ? '（レンタカー）' : ''}`;
        const carId = index;
        const movementLabel = calc.usesTimesRental ? 'タイムズ移動料金' : 'ガソリン代';
        const movementItem = { id: `movement-${carId}`, isMovement: true, name: movementLabel, amountValue: calc.movementAmount, type: calc.movementType };
        const splitItems = [...(calc.movementBaseType === 'split' ? [movementItem] : []), ...calc.extras.filter(row => row.baseType === 'split')];
        const clubItems = [...(calc.movementBaseType === 'club' ? [movementItem] : []), ...calc.extras.filter(row => row.baseType === 'club')];
        const adjustmentAmount = amount => `${amount < 0 ? '−' : '+'}${money(Math.abs(amount))}`;
        const renderItems = (items, baseType) => items.filter(row => row.amountValue !== 0).map((row, rowIndex) => <div className="settlement-cost-item" key={row.id || `${row.name}-${rowIndex}`}><span>{row.name || '費用'}{row.isMovement || row.type === baseType ? '' : `（${extraTypeLabel(row.type)}）`}</span><strong>{row.amountValue < 0 ? '−' : ''}{money(Math.abs(row.amountValue))}</strong></div>);
        const hasSplitDetails = splitItems.some(row => row.amountValue !== 0) || calc.splitRound !== 0 || calc.collectionOffset !== 0;
        const hasClubDetails = clubItems.some(row => row.amountValue !== 0) || calc.clubRound !== 0;
        const breakdownTitle = `割勘 ${money(calc.adjustedSplitPay)}・部費 ${money(calc.adjustedClubPay)}`;
        return <article className="settlement-car" key={car.name} aria-labelledby={`settlement-car-${carId}`}>
          <div className="settlement-car-main">
            <div className="settlement-car-info">
              <h2 id={`settlement-car-${carId}`}>{carLabel}</h2>
              <div className="settlement-car-actions">
                <Button className="settlement-car-edit-action" kind="ghost" size="sm" onClick={() => openCar(car)}>費用を入力</Button>
              </div>
              {calc.driverNames.length > 1 && <p>運転手：{calc.driverNames.join('、')}（車単位で一括支払い）</p>}
            </div>
          </div>
          <Accordion className="settlement-car-breakdown" size="sm">
            <AccordionItem title={breakdownTitle}>
              <div className="settlement-cost-list">
                <section className="settlement-cost-group" aria-labelledby={`settlement-split-${carId}`}>
                  <h3 id={`settlement-split-${carId}`}>割勘</h3>
                  {renderItems(splitItems, 'split')}
                  {calc.splitRound !== 0 && <div className="settlement-cost-adjustment"><span>端数処理</span><strong>{adjustmentAmount(calc.splitRound)}</strong></div>}
                  {calc.collectionOffset !== 0 && <div className="settlement-cost-adjustment"><span>集金分差し引き</span><strong>−{money(calc.collectionOffset)}</strong></div>}
                  {!hasSplitDetails && <p className="settlement-cost-empty">対象なし</p>}
                </section>
                <section className="settlement-cost-group" aria-labelledby={`settlement-club-${carId}`}>
                  <h3 id={`settlement-club-${carId}`}>部費</h3>
                  {renderItems(clubItems, 'club')}
                  {calc.clubRound !== 0 && <div className="settlement-cost-adjustment"><span>端数処理</span><strong>{adjustmentAmount(calc.clubRound)}</strong></div>}
                  {!hasClubDetails && <p className="settlement-cost-empty">対象なし</p>}
                </section>
              </div>
            </AccordionItem>
          </Accordion>
        </article>;
      })}</div>
    </Tile>
    <Tile className="settlement-card settlement-collection-card">
      <div className="settlement-section-heading"><div><h2>集金チェック</h2><small className="settlement-collection-summary"><span>{result.paidCount}/{result.payerCount}人</span><span>残り {money(result.unpaidAmount)}</span></small></div>
        <Button ref={collectionTriggerRef} kind="ghost" size="sm" aria-expanded={collectionOpen} aria-controls="settlement-collection-modal" onClick={() => setCollectionOpen(true)}>集金を確認</Button>
      </div>
      </Tile>
    <Tile className="settlement-card settlement-memo-card"><div className="settlement-section-heading"><div><h2>メモ</h2>{!memoEditing && <p>{state.memo?.trim() ? state.memo : 'メモなし'}</p>}</div>{!memoEditing && <Button kind="ghost" size="sm" onClick={openMemoEditor}>{state.memo?.trim() ? '編集' : 'メモを追加'}</Button>}</div>
      {memoEditing && <div className="settlement-memo-editor"><TextArea id="settlement-memo-editor" labelText="メモ" placeholder="例：レンタカー代は高橋さんが立替" rows={3} value={memo ?? ''} onChange={event => setMemo(event.target.value)} /><div className="settlement-memo-actions"><Button kind="tertiary" size="sm" onClick={saveMemo}>保存</Button><Button kind="ghost" size="sm" onClick={closeMemoEditor}>キャンセル</Button></div></div>}
    </Tile>
    <Modal id="settlement-collection-modal" className="settlement-collection-modal" open={collectionOpen} size="sm" hasScrollingContent modalHeading="集金を確認" closeButtonLabel="閉じる" primaryButtonText="閉じる" secondaryButtonText="未回収者をコピー" onSecondarySubmit={copyUnpaid} onRequestSubmit={() => setCollectionOpen(false)} onRequestClose={() => setCollectionOpen(false)} launcherButtonRef={collectionTriggerRef} selectorPrimaryFocus=".settlement-collection-modal .cds--content-switcher-btn">
      <div className="settlement-collection-modal-content">
        <ContentSwitcher aria-label="集金対象者の表示" size="sm" lowContrast selectedIndex={collectionView === 'unpaid' ? 1 : 0} onChange={({ name }) => setCollectionView(name)}><Switch name="all" text="すべて" /><Switch name="unpaid" text="未回収" /></ContentSwitcher>
        <ContainedList className="settlement-collection-list" kind="on-page" size="lg" label={<span className="cds--visually-hidden">集金対象者</span>}>{result.participants.filter(person => collectionView !== 'unpaid' || (!result.excludedNames.has(person.name) && !state.paid[person.name])).map(person => {
                const excluded = result.excludedNames.has(person.name);
                const paid = !!state.paid[person.name];
                const label = state.paidBy[person.name] || person.name;
                if (excluded) return <ContainedListItem className="settlement-collection-row excluded" key={person.name} action={<Tag type="cool-gray" size="sm">集金不要</Tag>}><span><strong>{person.name}</strong><small>{result.driverNames.has(person.name) && result.driverCollectionOffset ? '支払額から差し引き済み' : '集金対象外'}</small></span></ContainedListItem>;
                return <ContainedListItem className="settlement-collection-row" key={person.name} action={<Checkbox id={`settlement-paid-${person.name}`} labelText={`${label}の集金チェック`} hideLabel checked={paid} onChange={(_, { checked }) => checked && result.isStandaloneSettlement ? setCollector({ name: person.name, value: state.paidBy[person.name] || '' }) : collectionChange(runtime.store, { name: person.name, checked })} />}><span><strong>{label}</strong><small>{paid ? '回収済み' : '未回収'}</small></span><strong>{money(result.perPerson)}</strong></ContainedListItem>;
        })}</ContainedList>
      </div>
    </Modal>
    {settingsEdit && <SettingsModal runtime={runtime} edit={settingsEdit} onNotice={onNotice} onClose={saved => closeEdit(setSettingsEdit, settingsEdit, saved)} />}
    {carEdit && <CarEditor runtime={runtime} edit={carEdit} onNotice={onNotice} onClose={saved => closeEdit(setCarEdit, carEdit, saved)} />}
    {collector && <CollectionPrompt value={collector.value} onChange={value => setCollector(current => ({ ...current, value }))} onSave={markCollected} onClose={() => setCollector(null)} />}
  </section>;
}
