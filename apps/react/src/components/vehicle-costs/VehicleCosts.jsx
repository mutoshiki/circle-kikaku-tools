import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Button, Column, ContainedList, ContainedListItem, Grid, InlineLoading, InlineNotification, Link, OverflowMenu, OverflowMenuItem, Select, SelectItem } from '@carbon/react';
import { breakpoints } from '@carbon/layout';
import useMediaQuery from '../../hooks/useMediaQuery.js';
import { vehicleCostTargets, vehicleCostFees, validateVehicleCost } from '../../ui/vehicle-cost-target.js';
import { createVehicleCostController } from '../../ui/vehicle-cost-controller.js';
import { createVehicleCostDraft } from '../../ui/vehicle-cost-draft.js';
import ExpenseEditor, { costFieldId } from './ExpenseEditor.jsx';
import { createVehicleRouteController } from '../../ui/vehicle-route-controller.js';
import VehicleRoute, { routeStopId } from './VehicleRoute.jsx';
import PlaceSearch from './PlaceSearch.jsx';

export const costEntryId = key => `vehicle-cost-open-${encodeURIComponent(key)}`;
export function CostLink({runtime,destination,children,...props}) {
  return <Link {...props} href={runtime.navigation.vehicleCostTaskHrefFor(destination)} onClick={event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) { event.preventDefault(); runtime.navigation.navigateVehicleCostTask(destination); } }}>{children}</Link>;
}
const cacheFor = (runtime,key) => createVehicleCostDraft({storage:()=>sessionStorage,roomId:runtime.roomId,carKey:key});

function CarWorkspace({runtime,target,destination,onPageChange,onReturn}) {
  const controller = useMemo(() => createVehicleCostController({runtime,target,cache:cacheFor(runtime,target.key)}), [runtime,target.key]);
  useEffect(() => () => controller.dispose(), [controller]);
  const snapshot = useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const [attempted,setAttempted] = useState(false), [candidate,setCandidate] = useState('');
  const desktop = useMediaQuery(`(min-width: ${breakpoints.lg.width})`);
  const active = useRef(true);
  const routeController=useMemo(()=>{
    const routeCache=cacheFor(runtime,`itinerary:${target.key}`);
    return createVehicleRouteController({roomId:runtime.roomId,carKey:target.key,service:runtime.routeService,routeDraft:runtime.routeDraft,working:routeCache.read(),rememberWorking:value=>routeCache.write(value)});
  },[runtime,target.key]);
  useEffect(()=>()=>routeController.dispose(),[routeController]);
  useLayoutEffect(()=>routeController.setContext({task:destination.task,stopKey:destination.stopKey}),[routeController,destination.task,destination.stopKey]);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const fee = snapshot.fees.find(f => f.key === destination.expenseKey && f.editable) || snapshot.fees[0];
  const domain = runtime.store.domain.settlement, car = snapshot.edit?.state.cars[target.car.name];
  const calculated = snapshot.preview.cars.find(c => c.name === target.car.name);
  const navigate = changes => runtime.navigation.navigateVehicleCostTask({carKey:target.key,returnTo:destination.returnTo,...changes});
  useEffect(() => {
    if (destination.task === 'expense' && !snapshot.fees.some(f=>f.key===destination.expenseKey && f.editable)) {
      runtime.navigation.replaceVehicleCostTask({carKey:target.key,returnTo:destination.returnTo});
    }
  }, [destination.task,destination.expenseKey,snapshot.fees,runtime,target.key,destination.returnTo]);
  const feeLabel = f => f.kind === 'movement' ? '移動条件' : f.row?.name || '追加費用';
  const stopLabel=destination.stopKey==='origin'?'出発地':destination.stopKey==='destination'?'目的地':destination.stopKey==='new-waypoint'?'経由地':`経由地 ${routeController.getSnapshot().stopKeys.waypoints.indexOf(destination.stopKey)+1}`;
  const title = destination.task === 'route-search' ? `${stopLabel}を検索` : destination.task === 'route' ? '移動距離を計算' : destination.task === 'expense' ? `${feeLabel(fee)}を編集` : `${target.label}の費用`;
  useEffect(()=>{if(destination.task==='route-search' && !['origin','destination','new-waypoint',...routeController.getSnapshot().stopKeys.waypoints].includes(destination.stopKey))runtime.navigation.replaceVehicleCostTask({carKey:target.key,task:'route',returnTo:destination.returnTo});},[destination.task,destination.stopKey,routeController,runtime,target.key]);
  useEffect(() => { onPageChange({title,description:`${target.label}の距離・費用を入力します。`,metadata:[{label:snapshot.dirty?'保存前の合計':'保存済み合計',value:`${Number(calculated?.totalPay || 0).toLocaleString('ja-JP')}円`},{label:'走行距離',value:`${car?.dist || '未入力'}km`} ]}); }, [onPageChange,title,target.label,calculated?.totalPay,snapshot.dirty,car?.dist]);
  const savedReturn = () => onReturn({destination:destination.returnTo || {section:'vehicle-costs'},focusId:destination.returnTo?.section === 'organization-car' ? `allocation-cost-${destination.returnTo.groupId}` : costEntryId(target.key)});
  async function save() {
    setAttempted(true);
    const result = await controller.save();
    if (!active.current) return;
    if (result.disposition === 'invalid') {
      const first = controller.getSnapshot().issues.fields[0];
      if (first) onReturn({destination:{section:'vehicle-costs',carKey:target.key,task:'expense',expenseKey:first.feeKey,returnTo:destination.returnTo},focusId:costFieldId(first.feeKey,first.field)});
    } else if (['saved','local'].includes(result.disposition)) savedReturn();
  }
  function add() { const key = controller.addExtra(); if (key) navigate({task:'expense',expenseKey:key}); }
  const candidates = new Map();
  for (const row of Object.values(runtime.store.domain.settlementInput(runtime.store.getSnapshot()).state.cars).flatMap(c=>c.extras || [])) {
    const name = row.name?.trim();
    if (name && !domain.isDriverRewardExtra(row) && !domain.isGasMovementFeeExtra(row) && !domain.isTimesDistanceFeeExtra(row) && !domain.isTimesTimeFeeExtra(row) && !candidates.has(name)) candidates.set(name,row);
  }
  const reuse = <div className="vehicle-cost-reuse"><Select id="vehicle-cost-reuse" labelText="登録済み費用" value={candidate} disabled={snapshot.frozen} onChange={event=>setCandidate(event.target.value)}><SelectItem value="" text="費用を選択" />{[...candidates.keys()].map(name=><SelectItem key={name} value={name} text={name} />)}</Select><Button kind="tertiary" type="button" disabled={!candidate || snapshot.frozen} onClick={()=>{const key=controller.reuseExtra(candidates.get(candidate)); if(key)navigate({task:'expense',expenseKey:key});}}>登録済みから追加</Button></div>;
  if (!car) return <p role="status">対象車の費用を開けません。車両費用の一覧を確認してください。</p>;
  return <div className="vehicle-cost-workspace">
    <div className="vehicle-cost-links">{destination.task === 'route-search' ? <Link href={runtime.navigation.vehicleCostTaskHrefFor({carKey:target.key,task:'route',returnTo:destination.returnTo})} onClick={event=>{if(event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey){event.preventDefault();onReturn({destination:{section:'vehicle-costs',carKey:target.key,task:'route',returnTo:destination.returnTo},focusId:destination.stopKey==='new-waypoint'?'vehicle-route-add':routeStopId(destination.stopKey)});}}}>ルートに戻る</Link> : destination.task === 'route' ? <Link href={runtime.navigation.vehicleCostTaskHrefFor({carKey:target.key,task:'expense',expenseKey:'movement',returnTo:destination.returnTo})} onClick={event=>{if(event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey){event.preventDefault();onReturn({destination:{section:'vehicle-costs',carKey:target.key,task:'expense',expenseKey:'movement',returnTo:destination.returnTo},focusId:'vehicle-route-launch'});}}}>移動条件に戻る</Link> : destination.task ? <CostLink runtime={runtime} destination={{carKey:target.key,returnTo:destination.returnTo}}>費目一覧に戻る</CostLink> : <CostLink runtime={runtime} destination={{}}>車一覧に戻る</CostLink>}{destination.returnTo?.section === 'organization-car' && <Link href={runtime.navigation.allocationTaskHrefFor('car','group',destination.returnTo.groupId)} onClick={event=>{if(event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey){event.preventDefault();onReturn({destination:destination.returnTo,focusId:`allocation-cost-${destination.returnTo.groupId}`});}}}>車割へ戻る</Link>}</div>
    <p role="status">{snapshot.status || (snapshot.dirty ? '未保存の入力あり' : '保存済みの費用')}{!snapshot.recoverable && '。この端末では再読み込み後に下書きを復元できません。'}</p>
    {snapshot.unavailable && <InlineNotification kind="error" title="保存先を確認してください" subtitle="入力は残しています。現在の費用を確認してから開き直してください。" hideCloseButton lowContrast />}
    {snapshot.receipt && <Button kind="tertiary" disabled={snapshot.saving || snapshot.unavailable} onClick={async()=>{const result=await controller.retry();if(active.current && ['saved','local'].includes(result.disposition))savedReturn();}}>共有保存を再試行</Button>}
    {snapshot.saving && <InlineLoading description="車両費用を保存しています" />}
    {attempted && !snapshot.issues.valid && <p role="status">入力を確認してください。この車の未入力・無効な費用を表示します。</p>}
    {destination.task === 'route-search' ? <PlaceSearch controller={routeController} stopKey={destination.stopKey} onResolved={()=>navigate({task:'route'})} /> : destination.task === 'route' ? <VehicleRoute controller={routeController} onSearch={Object.assign(key=>navigate({task:'route-search',stopKey:key}),{href:key=>runtime.navigation.vehicleCostTaskHrefFor({carKey:target.key,task:'route-search',stopKey:key,returnTo:destination.returnTo})})} onApply={value=>{controller.updateField('movement','dist',value);navigate({task:'expense',expenseKey:'movement'});}} /> : <Grid fullWidth className="vehicle-cost-grid">
      {(desktop || destination.task !== 'expense') && <Column sm={4} md={8} lg={6}><ContainedList label="費目一覧" size="lg">{snapshot.fees.map(f => <ContainedListItem key={f.key} action={<div className="vehicle-cost-actions">{f.editable && <CostLink runtime={runtime} destination={{carKey:target.key,task:'expense',expenseKey:f.key,returnTo:destination.returnTo}} aria-label={`${feeLabel(f)}を編集`} aria-current={f.key === fee.key && destination.task === 'expense' ? 'page' : undefined}>編集</CostLink>}{f.removable && <OverflowMenu size="lg" flipped ariaLabel={`${feeLabel(f)}の操作`} iconDescription={`${feeLabel(f)}の操作`}><OverflowMenuItem isDelete itemText="削除" disabled={snapshot.frozen} onClick={()=>{controller.removeExtra(f.key);navigate({task:'expense',expenseKey:'movement'});}} /></OverflowMenu>}</div>}><div className="vehicle-cost-row"><strong>{feeLabel(f)}</strong><span>{f.kind === 'movement' ? Number(calculated?.movementAmount || 0).toLocaleString('ja-JP') : `${domain.isNegativeSettlementExtraType(f.row?.type) ? '−' : ''}${Number(f.row?.amount || 0).toLocaleString('ja-JP')}`}円</span><span>{domain.getSettlementExtraBaseType(f.row?.type) === 'club' ? '部費' : '割勘'}</span></div></ContainedListItem>)}</ContainedList>{!desktop && <div className="vehicle-cost-actions"><Button kind="tertiary" disabled={snapshot.frozen} onClick={add}>費用を追加</Button>{reuse}</div>}</Column>}
      {(desktop || destination.task === 'expense') && <Column sm={4} md={8} lg={10}><ExpenseEditor snapshot={{...snapshot,car,domain,target,activeFee:fee,attempted}} onFieldChange={controller.updateField} onRentalType={controller.setRentalType} onMovementType={controller.setMovementType} onAdd={add} onReuse={reuse} onRoute={()=>navigate({task:'route'})} onSave={save} onCancel={()=>{if(controller.cancel())savedReturn();}} /></Column>}
    </Grid>}
  </div>;
}

export default function VehicleCosts({runtime,room,resolved,destination,onNotice,onPageChange,onReturn}) {
  const targets = vehicleCostTargets(room,runtime.store.domain), target = targets.find(t=>t.key===destination.carKey);
  useEffect(()=>{
    if (resolved && (destination.invalid || destination.carKey && !target)) {
      onNotice({kind:'error',title:'対象車が見つかりません。車両費用の一覧を確認してください。'});
      runtime.navigation.replaceVehicleCostTask();
    }
  },[resolved,destination.invalid,destination.carKey,!!target,runtime,onNotice]);
  if (!resolved) return <InlineLoading description="車両費用を読み込んでいます" />;
  if (target?.editable) return <CarWorkspace key={target.key} runtime={runtime} target={target} destination={destination} onPageChange={onPageChange} onReturn={onReturn} />;
  const {data,state}=runtime.store.domain.settlementInput(room), result=runtime.store.domain.settlement.calculateSettlement(data,state);
  return targets.length ? <ContainedList label="車両費用" size="lg">{targets.map(t=>{const calc=result.cars.find(c=>c.name===t.car.name), cached=cacheFor(runtime,t.key).read(), issues=validateVehicleCost({data,state,target:t,domain:runtime.store.domain,fees:vehicleCostFees(state.cars[t.car.name] || {extras:[]},runtime.store.domain)});return <ContainedListItem key={t.key} action={t.editable && <CostLink id={costEntryId(t.key)} runtime={runtime} destination={{carKey:t.key}} aria-label={`${t.label}の費用を入力`}>入力</CostLink>}><div className="vehicle-cost-row"><strong>{t.label}</strong><span>走行距離 {state.cars[t.car.name]?.dist || '未入力'}km</span><span>保存済み合計 {Number(calc?.totalPay || 0).toLocaleString('ja-JP')}円</span>{!issues.valid && <span>入力を確認してください</span>}{cached && <span>未保存の入力あり</span>}{!t.editable && <p>{t.reason}</p>}</div></ContainedListItem>;})}</ContainedList> : <p>費用を入力する車がありません。車割、または精算設定の人数だけの精算を確認してください。</p>;
}
