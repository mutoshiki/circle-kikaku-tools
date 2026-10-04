import { useRef, useState } from 'react';
import {
  Accordion, AccordionItem, Button, Checkbox, ContainedList, ContainedListItem, ContentSwitcher, InlineNotification,
  Link, Switch, Tag, TextArea, TextInput, Tile,
} from '@carbon/react';
import { collectionChange } from './settlement/edit.js';
import { createSettlementRulesDraft } from '../ui/settlement-rules-draft.js';
import { prepareStandaloneRulesDraft } from '../ui/settlement-rules-controller.js';
import { vehicleCostTargets } from '../ui/vehicle-cost-target.js';
import { costEntryId } from './vehicle-costs/VehicleCosts.jsx';
import useMediaQuery from '../hooks/useMediaQuery.js';
import { notice } from '../ui/task-contracts.js';
import TaskModal from './TaskModal.jsx';

const money = value => `¥${Math.round(Number(value) || 0).toLocaleString('ja-JP')}`;
const extraTypeLabel = type => ({ split: '割勘', club: '部費', 'split-minus': '割勘から差し引き', 'club-minus': '部費から差し引き' })[type] || '割勘';

// Restore the original brief prompt; collection redesign remains Phase H.
function CollectionPrompt({ value, onChange, onSave, onClose }) {
  return <TaskModal taskId="settlement-collector" open size="xs" modalHeading="集金済みにする" primaryButtonText="保存" secondaryButtonText="キャンセル" onRequestSubmit={onSave} onRequestClose={onClose} preventCloseOnClickOutside selectorPrimaryFocus="#settlement-collector">
    <TextInput id="settlement-collector" labelText="集金した人" value={value} onChange={event => onChange(event.target.value)} />
  </TaskModal>;
}
export default function Settlement({ runtime, room, onNotice, embedded = false }) {
  const { data, state } = runtime.store.domain.settlementInput(room);
  const isMobile = useMediaQuery('(max-width: 671px)');
  const settlement = runtime.store.domain.settlement;
  const result = settlement.calculateSettlement(data, state);
  const issues = settlement.getSettlementIssues(data, state, result);
  const [collector, setCollector] = useState(null);
  const [memo, setMemo] = useState(null);
  const [memoEditing, setMemoEditing] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionView, setCollectionView] = useState('unpaid');
  const collectionTriggerRef = useRef(null);
  const rulesCache = createSettlementRulesDraft({ roomId: runtime.roomId, storage: () => sessionStorage });
  const cachedRules = rulesCache.read();
  const rulesEntry = <div className="rules-parent-entry"><Link id="settlement-rules-entry" href={runtime.navigation.settlementTaskHrefFor('rules')} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); runtime.navigation.navigateSettlementTask('rules'); } }}>精算ルール</Link>{cachedRules && <span>{cachedRules.receipt ? 'ルールの保存結果を確認してください' : '未保存のルールあり'}</span>}</div>;
  function openCar(car) {
    const target = vehicleCostTargets(room, runtime.store.domain).find(t=>car.participantId ? t.car.participantId === car.participantId : t.car.name === car.name);
    if (target) runtime.navigation.navigateVehicleCostTask({carKey:target.key,returnTo:{section:'settlement'}});
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
  if (!result.participants.length && !result.isStandaloneSettlement) return <section className="settlement-page"><div className="empty-state">{!embedded && <h1>精算</h1>}<p>参加者がいません。参加者を登録するか、人数だけで精算できます。</p><div className="rules-actions"><Link href={runtime.navigation.taskHrefFor('import')} onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); runtime.navigation.navigateTask('import'); } }}>参加者を登録</Link><Button kind="tertiary" onClick={() => { prepareStandaloneRulesDraft({ runtime, cache: rulesCache }); runtime.navigation.navigateSettlementTask('rules'); }}>人数だけで精算</Button></div>{rulesEntry}</div></section>;
  return <section className="settlement-page" aria-label="精算">
    {rulesEntry}
    {issues.messages.map(message => <InlineNotification key={message} kind={message.includes('企画者を選ぶ') ? 'info' : 'error'} title="設定を確認してください" subtitle={message} hideCloseButton lowContrast />)}
    <Tile className="settlement-card settlement-vehicles-card">
      <div className="settlement-section-heading"><div>{embedded ? <h2>各車への支払い</h2> : <h1>各車への支払い</h1>}</div>
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
                <Button id={costEntryId(car.participantId ? `participant:${car.participantId}` : `name:${car.name}`)} className="settlement-car-edit-action" kind="ghost" size="sm" aria-label={`${car.name}車の費用を入力`} onClick={() => openCar(car)}>費用を入力</Button>
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
    <TaskModal taskId="settlement-collection-review" id="settlement-collection-modal" className="settlement-collection-modal" open={collectionOpen} size="sm" hasScrollingContent modalHeading="集金を確認" closeButtonLabel="閉じる" primaryButtonText="閉じる" secondaryButtonText="未回収者をコピー" onSecondarySubmit={copyUnpaid} onRequestSubmit={() => setCollectionOpen(false)} onRequestClose={() => setCollectionOpen(false)} launcherButtonRef={collectionTriggerRef} selectorPrimaryFocus=".settlement-collection-modal .cds--content-switcher-btn">
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
    </TaskModal>
    {collector && <CollectionPrompt value={collector.value} onChange={value => setCollector(current => ({ ...current, value }))} onSave={markCollected} onClose={() => setCollector(null)} />}
  </section>;
}
