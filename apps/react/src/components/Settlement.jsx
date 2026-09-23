import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Accordion, AccordionItem, Button, Checkbox, ContainedList, ContainedListItem, ContentSwitcher, ExpandableTile, IconButton, InlineNotification, Modal,
  NumberInput, ProgressIndicator, ProgressStep, RadioButton, RadioButtonGroup,
  Select, SelectItem, Switch, Tag, TextArea, TextInput, Tile, TileAboveTheFoldContent, TileBelowTheFoldContent,
} from '@carbon/react';
import { Add, ChevronRight, Copy, Edit, TrashCan } from '@carbon/icons-react';
import { beginSettlementEdit, commitSettlementEdit, collectionChange } from './settlement/edit.js';
import RoutePlanner from './RoutePlanner.jsx';
import useMediaQuery from '../hooks/useMediaQuery.js';

const money = value => `¥${Math.round(Number(value) || 0).toLocaleString('ja-JP')}`;
const extraTypeLabel = type => ({ split: '割勘', club: '部費', 'split-minus': '割勘 −', 'club-minus': '部費 −' })[type] || '割勘';

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
  const driverRule = state.driverCollectionFree ? 'free' : state.driverCollectionOffset ? 'offset' : 'normal';
  async function save() {
    if (composing || saving) return;
    setSaving(true); setError('');
    try { await commitSettlementEdit(runtime, edit); onNotice('精算設定を保存しました。'); onClose(true); }
    catch (caught) { setError(caught.message); setSaving(false); }
  }
  function go(next) {
    if (next > step && step === 0 && state.standalone.enabled && ((Number(state.standalone.driverCount) || 0) + (Number(state.standalone.memberCount) || 0) <= 0)) {
      setError('運転手または同乗者の人数を入力してください。');
      return;
    }
    setError(''); setStep(Math.max(0, Math.min(2, next)));
  }
  return <Modal className="app-modal settlement-settings-modal" open size="lg" hasScrollingContent modalHeading="精算設定を編集" primaryButtonText={step === 2 ? '保存' : '次へ'} secondaryButtons={[{ buttonText: 'キャンセル', onClick: () => onClose(false) }, { buttonText: '戻る', onClick: () => go(step - 1) }]} primaryButtonDisabled={saving || composing} onRequestSubmit={() => step === 2 ? save() : go(step + 1)} onRequestClose={() => onClose(false)} preventCloseOnClickOutside selectorPrimaryFocus="#settlement-mode-normal">
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
        <NumberInput id="settlement-driver-count" label="運転手の人数" min={0} max={99} allowEmpty value={state.standalone.driverCount} onChange={(_, { value }) => updateStandalone({ driverCount: String(value) })} />
        <NumberInput id="settlement-member-count" label="同乗者の人数" min={0} max={99} allowEmpty value={state.standalone.memberCount} onChange={(_, { value }) => updateStandalone({ memberCount: String(value) })} />
        {Array.from({ length: Number(state.standalone.driverCount) || 0 }, (_, index) => <TextInput key={index} id={`settlement-driver-name-${index}`} labelText={`運転手${index + 1}の名前`} value={state.standalone.driverNames[index] || ''} onChange={event => { const names = [...state.standalone.driverNames]; names[index] = event.target.value; updateStandalone({ driverNames: names }); }} />)}
      </div>}
      <RadioButtonGroup legendText="端数単位" name="settlement-rounding" valueSelected={state.rounding} onChange={value => update({ rounding: String(value) })} orientation="vertical">
        {['1', '10', '100'].map(value => <RadioButton key={value} id={`settlement-rounding-${value}`} value={value} labelText={`${value}円単位`} />)}
      </RadioButtonGroup></section>}
      {step === 1 && <section className="settlement-settings-step" aria-labelledby="settlement-reward-title"><h3 id="settlement-reward-title">車出し協力代</h3><div className="form-grid">
        <TextInput id="settlement-driver-reward" labelText="1台あたりの協力代（円）" inputMode="numeric" value={state.driverReward} onChange={event => update({ driverReward: event.target.value })} />
        <RadioButtonGroup legendText="協力代の負担" name="settlement-reward-type" valueSelected={state.driverRewardType} onChange={value => update({ driverRewardType: value })} orientation="vertical">
          <RadioButton id="settlement-reward-split" value="split" labelText="参加者で割勘" />
          <RadioButton id="settlement-reward-club" value="club" labelText="部費から支払う" />
        </RadioButtonGroup>
      </div></section>}
      {step === 2 && <section className="settlement-settings-step" aria-labelledby="settlement-collection-title"><h3 id="settlement-collection-title">集金ルール</h3><RadioButtonGroup legendText="運転手分の集金" name="settlement-driver-rule" valueSelected={driverRule} onChange={value => update({ driverCollectionOffset: value === 'offset', driverCollectionFree: value === 'free' })} orientation="vertical">
        <RadioButton id="settlement-driver-normal" value="normal" labelText="集金する" />
        <RadioButton id="settlement-driver-offset" value="offset" labelText="支払額から控除" />
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
  {allowNegative ? <Checkbox id={`${id}-minus`} labelText="減額対象" checked={negative} disabled={disabled} onChange={(_, { checked }) => onChange(`${baseType}${checked ? '-minus' : ''}`)} /> : null}</div>;
}

function MovementSettingsView({ car, domain, movementAmount, movementLabel, movementFormula, onOpenRoute, onRentalType, onUpdate }) {
  const times = domain.isTimesRentalCar(car);
  const input = (id, label, value, key) => <TextInput id={id} labelText={label} inputMode="decimal" value={value} onChange={event => onUpdate({ [key]: event.target.value })} />;
  return <div className="form-stack settlement-movement-form">
      <RadioButtonGroup legendText="車両種別" name="settlement-rental-type" valueSelected={car.rentalType} onChange={onRentalType} orientation="horizontal">
        <RadioButton id="settlement-rental-type" value="private" labelText="自家用車" />
        <RadioButton id="settlement-rental-times" value="times" labelText="タイムズ" />
      </RadioButtonGroup>
      <section className="settlement-form-section" aria-labelledby="settlement-movement-conditions-title"><h3 className="settlement-movement-section-title" id="settlement-movement-conditions-title">移動料金の計算条件</h3><div className="form-grid">
        <div className="distance-field">{input('settlement-distance', '移動距離（km）', car.dist, 'dist')}<Button kind="tertiary" size="sm" onClick={onOpenRoute}>ルートから距離を計算</Button></div>
        {!times && <>{input('settlement-eco', '燃費（km/L）', car.eco, 'eco')}{input('settlement-price', 'ガソリン単価（円/L）', car.price, 'price')}</>}
      </div></section>
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
  function addExtra() { const row = { id: domain.createSettlementExtraId(), name: '', amount: '', type: 'split', pending: true }; update({ extras: [...car.extras, row] }); setActiveCostId(row.id); }
  function addCandidate(candidate) { const row = { id: domain.createSettlementExtraId(), ...candidate, pending: false }; update({ extras: [...car.extras, row] }); setActiveCostId(row.id); }
  function removeExtra(index) { const removed = car.extras[index]; update({ extras: car.extras.filter((_, rowIndex) => rowIndex !== index) }); if (getCostId(removed, index) === activeCostId) setActiveCostId('movement'); }
  useEffect(() => {
    const selector = view === 'expense' ? '#settlement-movement-type-split' : view === 'movement' ? '#settlement-rental-type' : '#route-origin-action .cds--contained-list-item__content';
    const timer = setTimeout(() => {
      document.querySelector(selector)?.focus();
      if (view === 'movement' || view === 'route') {
        const content = document.querySelector('.settlement-car-modal .cds--modal-content');
        if (content) setContentAtBottom(content.scrollHeight <= content.clientHeight + 1);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [view]);
  async function save() {
    if (composing || saving) return;
    const { data } = runtime.store.domain.settlementInput(edit.session.base);
    const normalized = domain.normalizeSettlementState(edit.state);
    const result = domain.calculateSettlement(data, normalized);
    const issues = domain.getSettlementIssues(data, normalized, result);
    const messages = issues.messages.filter(message => message.startsWith(`${name}車の`));
    if (messages.length) { setError(messages[0]); return; }
    setSaving(true); setError('');
    try { await commitSettlementEdit(runtime, edit); onNotice(`${name}車の費用を保存しました。`); onClose(true); }
    catch (caught) { setError(caught.message); setSaving(false); }
  }
  const primaryLabel = view === 'expense' ? '保存' : view === 'movement' ? `${movementLabel}を適用` : routeStatus.primaryLabel;
  const primaryDisabled = view === 'expense' ? saving || composing : view === 'route' ? routeStatus.disabled : false;
  const back = () => { if (view === 'route' && routeRef.current?.returnToPlanner()) return; changeView(view === 'route' ? 'movement' : 'expense'); };
  const submit = () => { if (view === 'expense') void save(); else if (view === 'movement') changeView('expense'); else routeRef.current?.apply(); };
  return <Modal className={`app-modal settlement-car-modal settlement-task-modal${view === 'movement' ? ' settlement-movement-modal' : view === 'route' ? ' settlement-route-modal' : ''}${contentAtBottom && view !== 'expense' ? ' settlement-movement-at-bottom' : ''}`} onScrollCapture={handleModalScroll} open size={view === 'route' ? 'lg' : 'md'} hasScrollingContent={view !== 'route'} closeButtonLabel="閉じる" modalAriaLabel={`${name}車の費用を編集`} modalLabel={`${name}車`} modalHeading={view === 'expense' ? '費用を編集' : view === 'movement' ? `${movementLabel}を設定` : '移動距離を計算'} primaryButtonText={view === 'route' && routeStatus.hidePrimaryButton ? undefined : primaryLabel} secondaryButtons={[{ buttonText: view === 'expense' ? 'キャンセル' : '戻る', onClick: view === 'expense' ? () => onClose(false) : back }]} primaryButtonDisabled={primaryDisabled} onRequestSubmit={submit} onRequestClose={() => onClose(false)} preventCloseOnClickOutside selectorPrimaryFocus={view === 'route' ? '#route-origin-action .cds--contained-list-item__content' : '#settlement-movement-type-split'}>
    {view === 'expense' && <div className="form-stack settlement-car-form" onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}>
      {error && <InlineNotification kind="error" title="入力内容を確認してください" subtitle={error} hideCloseButton lowContrast />}
      <section className="settlement-form-section" aria-label="車両費用の編集">
        <ContainedList className="settlement-cost-editor" kind="disclosed" size="sm" label={<span className="cds--visually-hidden">車両費用</span>}>
          <ContainedListItem className={`settlement-cost-list-item${activeCostId === 'movement' ? ' settlement-cost-list-item--active' : ''}`} onClick={() => changeView('movement')} aria-current={activeCostId === 'movement' ? 'true' : undefined} action={<ChevronRight className="settlement-cost-editor-chevron" size={16} aria-hidden="true" />}>
            <span className="settlement-cost-summary"><strong>{movementLabel}</strong><span className="settlement-cost-summary__amount"><strong>{money(movementAmount)}</strong><Tag type="cool-gray" size="sm">自動計算</Tag></span></span>
          </ContainedListItem>
          {activeCostId === 'movement' && <ContainedListItem className="settlement-cost-editor-details-row"><div className="settlement-cost-editor-details" aria-live="polite">
            <CostTypeControl domain={domain} id="settlement-movement-type" label="負担区分" type={movement?.type || 'split'} allowNegative={false} onChange={setMovementType} />
          </div></ContainedListItem>}
          {editable.map(({ row, index }) => {
            const id = getCostId(row, index);
            const timesTime = domain.isTimesTimeFeeExtra(row);
            const amount = String(row.amount || '').trim() ? money(row.amount) : '金額未入力';
            const isActive = activeCostId === id;
            return <Fragment key={id}>
              <ContainedListItem className={`settlement-cost-list-item${isActive ? ' settlement-cost-list-item--active' : ''}${timesTime ? '' : ' settlement-cost-list-item--deletable'}`} onClick={() => setActiveCostId(id)} aria-current={isActive ? 'true' : undefined} action={timesTime ? null : <Button kind="danger--ghost" size="sm" renderIcon={TrashCan} onClick={event => { event.stopPropagation(); removeExtra(index); }}>削除</Button>}>
                <span className="settlement-cost-summary"><strong>{row.name || '新しい費用'}</strong><strong className="settlement-cost-summary__amount">{amount}</strong></span>
              </ContainedListItem>
              {isActive && activeExtra && <ContainedListItem className="settlement-cost-editor-details-row"><div className="settlement-cost-editor-details" aria-live="polite">
                <div className="settlement-cost-editor-fields">
                  <TextInput id={`settlement-extra-name-${activeExtra.index}`} size="sm" labelText="名目" value={activeExtra.row.name} readOnly={domain.isTimesTimeFeeExtra(activeExtra.row)} placeholder="例：駐車場代" onChange={event => updateExtra(activeExtra.index, { name: event.target.value, pending: false })} />
                  <TextInput id={`settlement-extra-amount-${activeExtra.index}`} size="sm" labelText="金額" inputMode="numeric" value={activeExtra.row.amount} onChange={event => updateExtra(activeExtra.index, { amount: event.target.value, pending: false })} />
                </div>
                <CostTypeControl domain={domain} id={`settlement-extra-type-${activeExtra.index}`} label="負担区分" type={activeExtra.row.type} onChange={type => updateExtra(activeExtra.index, { type })} />
              </div></ContainedListItem>}
            </Fragment>;
          })}
        </ContainedList>
        <Button kind="tertiary" size="sm" renderIcon={Add} onClick={addExtra}>費用を追加</Button>
      {candidates.length > 0 && <Accordion className="settlement-extra-candidates" align="end"><AccordionItem title={`登録済みの費用から追加（${candidates.length}件）`}>{candidates.map(candidate => <Button key={`${candidate.name}-${candidate.type}`} kind="ghost" size="sm" renderIcon={Add} onClick={() => addCandidate(candidate)}>{`${candidate.name} ${money(candidate.amount)}（${extraTypeLabel(candidate.type)}）を追加`}</Button>)}</AccordionItem></Accordion>}</section>
    </div>}
    {view === 'movement' && <MovementSettingsView car={car} domain={domain} movementAmount={movementAmount} movementLabel={movementLabel} movementFormula={movementFormula} onOpenRoute={() => changeView('route')} onRentalType={setRentalType} onUpdate={update} />}
    <div aria-hidden={view !== 'route'} style={{ display: view === 'route' ? undefined : 'none' }}><RoutePlanner ref={routeRef} runtime={runtime} onStatusChange={setRouteStatus} onApply={value => { update({ dist: value }); changeView('movement'); onNotice('計算した距離を入力しました。'); }} /></div>
  </Modal>;
}

function CollectionPrompt({ value, onChange, onSave, onClose }) {
  return <Modal open size="xs" modalHeading="集金済みにする" primaryButtonText="保存" secondaryButtonText="キャンセル" onRequestSubmit={onSave} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus="#settlement-collector">
    <TextInput id="settlement-collector" labelText="集金した人" value={value} onChange={event => onChange(event.target.value)} />
  </Modal>;
}

function SettingRows({ state, result }) {
  const mode = result.isStandaloneSettlement ? `人数だけ（運転手${result.standaloneCounts.driverCount}人・その他${result.standaloneCounts.memberCount}人）` : '通常精算';
  const driver = result.driverCollectionOffset ? '支払い額から控除' : result.driverCollectionFree ? '対象外' : '参加者と同じく集金';
  const excluded = [state.organizerFree && `企画者${state.organizerName ? `（${state.organizerName}）` : ''}`, result.driverCollectionFree && '運転手'].filter(Boolean).join('・') || 'なし';
  return <dl className="settlement-setting-list">
    <div><dt>精算モード</dt><dd>{mode}</dd></div><div><dt>端数</dt><dd>{state.rounding}円単位</dd></div>
    <div><dt>協力代</dt><dd>{Number(result.reward) ? `1台 ${money(result.reward)}（${result.driverRewardType === 'club' ? '部費' : '割勘'}）` : 'なし'}</dd></div>
    <div><dt>運転手分</dt><dd>{driver}</dd></div><div><dt>集金対象外</dt><dd>{excluded}</dd></div>
    <div><dt>設定結果</dt><dd>集金対象 {result.payerCount}人・運転手 {result.driverNames.size}人・1人あたり {money(result.perPerson)}</dd></div>
  </dl>;
}

export default function Settlement({ runtime, room, onNotice }) {
  const { data, state } = runtime.store.domain.settlementInput(room);
  const settlement = runtime.store.domain.settlement;
  const result = settlement.calculateSettlement(data, state);
  const issues = settlement.getSettlementIssues(data, state, result);
  const [settingsEdit, setSettingsEdit] = useState(null);
  const [carEdit, setCarEdit] = useState(null);
  const [collector, setCollector] = useState(null);
  const [memo, setMemo] = useState(null);
  const [expandedDriverPayments, setExpandedDriverPayments] = useState({});
  const [collectionView, setCollectionView] = useState('all');
  const paidCars = result.cars.filter(car => state.driverPaid[car.name]);
  const paymentRemaining = result.cars.filter(car => !state.driverPaid[car.name]).reduce((sum, car) => sum + car.adjustedTotalPay, 0);
  function closeEdit(setter, edit, saved) { if (!saved && edit && !edit.session.closed) runtime.store.cancelEdit(edit.session); setter(null); }
  function openCar(car) {
    const edit = beginSettlementEdit(runtime.store, { car });
    edit.state.cars[car.name] = settlement.ensureTimesRentalExtras(edit.state.cars[car.name]);
    setCarEdit(edit);
  }
  function markCollected() {
    collectionChange(runtime.store, { name: collector.name, checked: true, collector: collector.value || collector.name });
    setCollector(null); onNotice('集金状況を更新しました。');
  }
  function paymentChange(name, checked) { collectionChange(runtime.store, { name, checked, payment: true }); onNotice('支払い状況を更新しました。'); }
  async function copyUnpaid() {
    const names = result.participants.filter(person => !result.excludedNames.has(person.name) && !state.paid[person.name]).map(person => person.name);
    if (!names.length) { onNotice('未回収者はいません'); return; }
    try { await navigator.clipboard.writeText(names.join('、')); onNotice('未回収者をコピーしました'); }
    catch { onNotice('未回収者をコピーできませんでした'); }
  }
  function saveMemo() {
    if (memo === null || memo === state.memo) return;
    runtime.store.command('settlement', { state: { ...state, memo } }); setMemo(null); onNotice('精算メモを保存しました。');
  }
  if (!result.participants.length && !result.isStandaloneSettlement) return <section className="settlement-page"><div className="empty-state"><h1>精算</h1><p>参加者がいません</p></div></section>;
  return <section className="settlement-page" aria-label="精算">
    <Tile className="settlement-card">
      <div className="settlement-section-heading"><div><h1>精算状況</h1><p>集金・支払いの進捗と残りの作業を確認できます。</p></div></div>
      <div className="settlement-status-grid">
        <div><span>集金</span><strong>{result.paidCount}/{result.payerCount}人・残り {money(result.unpaidAmount)}</strong><small>{money(result.expectedCollected - result.unpaidAmount)} / {money(result.expectedCollected)}</small></div>
        <div><span>支払い</span><strong>{paidCars.length}/{result.cars.length}台・残り {money(paymentRemaining)}</strong><small>支払い済み {money(result.cars.filter(car => state.driverPaid[car.name]).reduce((sum, car) => sum + car.adjustedTotalPay, 0))}</small></div>
        <div className={issues.messages.length ? 'has-issue' : ''}><span>要確認</span><strong>{issues.messages.length ? `${issues.messages.length}件` : 'なし'}</strong></div>
      </div>
    </Tile>
    <Tile className="settlement-card">
      <div className="settlement-section-heading"><div><h2>精算設定</h2><p>精算額の計算に使う設定を確認・変更できます。</p></div><Button kind="tertiary" renderIcon={Edit} onClick={() => setSettingsEdit(beginSettlementEdit(runtime.store))}>精算設定を編集</Button></div>
      <SettingRows state={state} result={result} />
      {issues.messages.map(message => <InlineNotification key={message} kind={message.includes('企画者を選ぶ') ? 'info' : 'error'} title="設定を確認してください" subtitle={message} hideCloseButton lowContrast />)}
    </Tile>
    <Tile className="settlement-card">
      <div className="settlement-section-heading"><div><h2>集金チェック</h2><p>参加者ごとの集金状況を確認・記録できます。</p><small>回収済み {result.paidCount}/{result.payerCount}人・残り {money(result.unpaidAmount)}</small></div><div className="settlement-collection-tools"><ContentSwitcher aria-label="集金チェックの表示" size="sm" lowContrast selectedIndex={collectionView === 'unpaid' ? 1 : 0} onChange={({ name }) => setCollectionView(name)}><Switch name="all" text="すべて" /><Switch name="unpaid" text="未回収のみ" /></ContentSwitcher><Button kind="ghost" size="sm" renderIcon={Copy} onClick={copyUnpaid}>未回収者をコピー</Button></div></div>
      <div className="settlement-check-list">{result.participants.filter(person => collectionView !== 'unpaid' || (!result.excludedNames.has(person.name) && !state.paid[person.name])).map(person => {
        const excluded = result.excludedNames.has(person.name);
        const paid = !!state.paid[person.name];
        const label = state.paidBy[person.name] || person.name;
        if (excluded) return <div className="settlement-check-row excluded" key={person.name}><span><strong>{person.name}</strong><small>{result.driverNames.has(person.name) && result.driverCollectionOffset ? '支払額から差し引き済み' : '集金対象外'}</small></span><Tag type="cool-gray" size="sm">集金不要</Tag></div>;
        return <div className="settlement-check-row" key={person.name}><Checkbox id={`settlement-paid-${person.name}`} labelText={`${label}の集金チェック`} hideLabel checked={paid} onChange={(_, { checked }) => checked && result.isStandaloneSettlement ? setCollector({ name: person.name, value: state.paidBy[person.name] || '' }) : collectionChange(runtime.store, { name: person.name, checked })} /><span><strong>{label}</strong><small>{paid ? '回収済み' : '未回収'}</small></span><strong>{money(result.perPerson)}</strong></div>;
      })}</div>
    </Tile>
    <Tile className="settlement-card">
      <div className="settlement-section-heading"><div><h2>運転手への支払い</h2><p className="settlement-driver-payment-description cds--type-body-compact-01">各車の支払額・状態を確認できます。</p><small className="settlement-payment-summary cds--type-body-compact-01">支払い済み <strong>{paidCars.length}/{result.cars.length}台</strong>・残り <strong>{money(paymentRemaining)}</strong></small></div></div>
      <div className="settlement-car-list">{data.cars.map(car => {
        const calc = result.cars.find(row => row.name === car.name);
        if (!calc) return null;
        const carLabel = `${car.name}車${calc.usesTimesRental ? '（レンタカー）' : ''}`;
        const expanded = !!expandedDriverPayments[car.name];
        return <ExpandableTile className="settlement-car" key={car.name} expanded={expanded}
          onClick={() => setExpandedDriverPayments(current => ({ ...current, [car.name]: !current[car.name] }))}
          tileCollapsedIconText={`${carLabel}の内訳を表示`} tileExpandedIconText={`${carLabel}の内訳を隠す`}>
          <TileAboveTheFoldContent>
            <div className="settlement-car-above">
              <div className="settlement-car-main">
                <div className="settlement-car-info">
                  <h3>{carLabel}</h3>
                  <p>運転手：{calc.driverNames.join('、') || '未設定'}{calc.driverNames.length > 1 && '（車単位で一括支払い）'}</p>
                  <div className="settlement-car-payment"><span className="cds--type-body-compact-01">支払額</span><strong className="cds--type-productive-heading-03">{money(calc.adjustedTotalPay)}</strong></div>
                </div>
                <div className="settlement-car-actions">
                  <div className="settlement-car-status-row"><Tag type={state.driverPaid[car.name] ? 'green' : 'cool-gray'} size="sm">{state.driverPaid[car.name] ? '支払い済み' : '未払い'}</Tag>
                    <Checkbox id={`settlement-driver-paid-${car.name}`} labelText="支払い済みにする" checked={!!state.driverPaid[car.name]} onChange={(_, { checked }) => paymentChange(car.name, checked)} />
                  </div>
                  <Button className="settlement-car-edit-action" kind="ghost" renderIcon={Edit} onClick={() => openCar(car)}>費用を編集</Button>
                </div>
              </div>
              <div className="settlement-car-split-summary"><span className="cds--type-label-01">割勘 {money(calc.adjustedSplitPay)}・部費 {money(calc.adjustedClubPay)}</span></div>
            </div>
          </TileAboveTheFoldContent>
          <TileBelowTheFoldContent>
            <div className="settlement-cost-list">
              <div><span>{calc.usesTimesRental ? 'タイムズ移動料金' : 'ガソリン代'}</span><strong>{money(calc.movementAmount)}</strong></div>
              {calc.extras.map((row, index) => <div key={row.id || index}><span>{row.name || '費用'}（{extraTypeLabel(row.type)}）</span><strong>{row.amountValue < 0 ? '−' : ''}{money(Math.abs(row.amountValue))}</strong></div>)}
              <div className="settlement-cost-total"><span>合計</span><strong>{money(calc.adjustedTotalPay)}</strong></div>
            </div>
          </TileBelowTheFoldContent>
        </ExpandableTile>;
      })}</div>
    </Tile>
    <Tile className="settlement-card"><div className="settlement-section-heading"><div><h2>精算メモ</h2><p>精算に関するメモや、あとで確認することを記録できます。</p></div></div><TextArea id="settlement-memo" labelText="精算メモ" hideLabel placeholder="例：レンタカー代は高橋さんが立替" rows={5} value={memo ?? state.memo} onChange={event => setMemo(event.target.value)} onBlur={saveMemo} /></Tile>
    {settingsEdit && <SettingsModal runtime={runtime} edit={settingsEdit} onNotice={onNotice} onClose={saved => closeEdit(setSettingsEdit, settingsEdit, saved)} />}
    {carEdit && <CarEditor runtime={runtime} edit={carEdit} onNotice={onNotice} onClose={saved => closeEdit(setCarEdit, carEdit, saved)} />}
    {collector && <CollectionPrompt value={collector.value} onChange={value => setCollector(current => ({ ...current, value }))} onSave={markCollected} onClose={() => setCollector(null)} />}
  </section>;
}
