import {useLayoutEffect,useRef,useState} from 'react';
import {Accordion,AccordionItem,Checkbox,ContentSwitcher,Link,Switch} from '@carbon/react';
import {money,normalClick} from './OperationFeedback.jsx';
import {recordId} from './CollectionWorkspace.jsx';
import {costEntryId} from '../vehicle-costs/VehicleCosts.jsx';

export default function PaymentWorkspace({runtime,view,controller,snapshot,cache}) {
  const [filter,setFilter]=useState(()=>cache.read().filters.payment),[error,setError]=useState('');
  const removedFocus=useRef(null),pointer=useRef(false),active=useRef(true);
  useLayoutEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const rows=view.payments.filter(row=>filter==='all'||!row.paid||row.retained);
  useLayoutEffect(()=>{
    const removed=removedFocus.current;
    if(removed && !rows.some(row=>row.target.key===removed.key)) {
      if(snapshot.blocked)return;
      removedFocus.current=null;
      if(!removed.focused || document.activeElement!==document.body)return;
      const next=rows[Math.min(removed.index,rows.length-1)];
      (next && document.getElementById(recordId(next.target.key)) || document.getElementById('payment-filter'))?.focus({preventScroll:removed.pointer});
    }
  });
  function changeFilter(name){const record=cache.read();cache.write({...record,filters:{...record.filters,payment:name}},{expectedRevision:record.revision});setFilter(name);}
  async function toggle(row,checked,event,index){removedFocus.current={key:row.target.key,index,focused:document.activeElement===event.target,pointer:pointer.current};const result=await controller.toggle({target:row.target,checked});if(active.current && result.disposition==='unavailable')setError(controller.getSnapshot().reason);}
  return <section className="operations-workspace" onPointerDown={()=>{pointer.current=true;}} onKeyDown={()=>{pointer.current=false;}}><nav aria-label="精算の作業" className="operations-links"><Link href={runtime.navigation.settlementTaskHrefFor('collection')} onClick={event=>{if(normalClick(event)){event.preventDefault();runtime.navigation.navigateSettlementTask('collection');}}}>集金へ</Link><Link href={runtime.navigation.settlementTaskHrefFor('payments')} aria-current="page">支払い</Link></nav>
    <p role="status">未払い {view.summary.paymentRemainingCount}台・{money(view.summary.paymentRemainingAmount)}</p>
    <ContentSwitcher aria-label="支払い対象の表示" selectedIndex={filter==='all'?1:0} onChange={({name})=>changeFilter(name)}><Switch id="payment-filter" name="outstanding" text="未払い"/><Switch name="all" text="すべて"/></ContentSwitcher>
    {error && <p role="alert">{error}</p>}
    <ul className="operations-list" aria-label={`支払い対象 (${rows.length}台)`}>{rows.map((row,index)=><li className="operations-payment-row" key={row.target.key}>
      <div className="operations-payment-main"><div className="operations-record-summary"><h2>{row.name}</h2><strong>{money(row.amount)}</strong><p>運転手: {row.drivers.length?row.drivers.join('、'):'未設定'}{row.drivers.length>1?'（車単位で一括支払い）':''}</p><small>{row.paid?'支払い済み':'未払い'}</small></div><Checkbox id={recordId(row.target.key)} labelText="支払い済み" aria-label={`${row.name}の支払い済み`} checked={row.paid} disabled={!row.target.editable||snapshot.blocked} onChange={(event, {checked})=>void toggle(row,checked,event,index)}/></div>
      {row.target.reason && <p>{row.target.reason}</p>}{row.amount<0 && <p>現在計算の調整額です。内訳を確認してください。</p>}
      <Accordion size="sm"><AccordionItem title={`${row.name}の内訳（割勘 ${money(row.detail.adjustedSplitPay)}・部費 ${money(row.detail.adjustedClubPay)}）`}>
        <dl className="operations-amounts">{[['移動料金',row.detail.movementAmount],['割勘費用',row.detail.splitExtras],['部費費用',row.detail.clubExtras],['車出し協力代',row.detail.reward],['割勘の端数調整',row.detail.splitRound],['部費の端数調整',row.detail.clubRound],['集金分差引',row.detail.collectionOffset]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}{row.detail.extras.map((extra,index)=><div key={extra.id || index}><dt>{extra.name || '費用'}</dt><dd>{money(extra.amountValue)}</dd></div>)}</dl>
      </AccordionItem></Accordion>
      <Link id={costEntryId(row.target.key)} href={runtime.navigation.vehicleCostTaskHrefFor({carKey:row.target.key,returnTo:{section:'settlement'}})} onClick={event=>{if(normalClick(event)){event.preventDefault();runtime.navigation.navigateVehicleCostTask({carKey:row.target.key,returnTo:{section:'settlement'}});}}}>{row.name}の費用を入力</Link>
    </li>)}</ul>
    {!rows.length && <p>{view.payments.length?'現在の未払いの車はありません。「すべて」で記録を確認できます。':'車がありません。車割または精算ルールを確認してください。'}</p>}
  </section>;
}
