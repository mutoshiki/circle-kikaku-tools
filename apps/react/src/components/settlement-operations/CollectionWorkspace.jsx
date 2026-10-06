import {useLayoutEffect,useReducer,useRef,useState} from 'react';
import {Button,Checkbox,ContainedList,ContainedListItem,ContentSwitcher,Link,Switch,TextInput} from '@carbon/react';
import {money,normalClick} from './OperationFeedback.jsx';
import {equalOperationValue} from '../../ui/settlement-operations-model.js';
export const recordId=key=>`settlement-record-${encodeURIComponent(key)}`;

export default function CollectionWorkspace({runtime,view,controller,snapshot,cache}) {
  const [filter,setFilter]=useState(()=>cache.read().filters.collection);
  const [,render]=useReducer(value=>value+1,0),draft=cache.read().collectorDraft;
  const [error,setError]=useState(''),[copyStatus,setCopyStatus]=useState(''),[copyFallback,setCopyFallback]=useState('');
  const composing=useRef(false),active=useRef(true),input=useRef(null),startFocus=useRef(false),removedFocus=useRef(null),pointer=useRef(false);
  useLayoutEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const rows=view.collections.filter(row=>filter==='all'||!row.excluded&&(!row.paid||row.retained)||draft?.targetKey===row.target.key);
  const rawDraft=draft && view.collections.find(row=>row.target.key===draft.targetKey);
  const stale=!!draft && (!rawDraft || rawDraft.target.context!==draft.context);
  function persistDraft(value){const record=cache.read();if(cache.write({...record,collectorDraft:value},{expectedRevision:record.revision}))render();}
  useLayoutEffect(()=>{
    if(startFocus.current){startFocus.current=false;input.current?.focus();}
    const removed=removedFocus.current;
    if(removed && (removed.editor ? !draft : !rows.some(row=>row.target.key===removed.key))) {
      if(snapshot.blocked || draft)return;
      removedFocus.current=null;
      if(!removed.focused || document.activeElement!==document.body) return;
      const next=removed.editor && rows.find(row=>row.target.key===removed.key) || rows[Math.min(removed.index,rows.length-1)];
      (next && document.getElementById(recordId(next.target.key)) || document.getElementById('collection-filter'))?.focus({preventScroll:removed.pointer});
    }
  });
  function changeFilter(name){const record=cache.read();cache.write({...record,filters:{...record.filters,collection:name}},{expectedRevision:record.revision});setFilter(name);}
  function cancel(){removedFocus.current={key:draft.targetKey,index:rows.findIndex(row=>row.target.key===draft.targetKey),focused:true,pointer:pointer.current,editor:true};persistDraft(null);setError('');}
  async function record(row,checked,event,index){
    setError('');
    if(checked && row.standalone){startFocus.current=true;persistDraft({targetKey:row.target.key,context:row.target.context,raw:''});return;}
    removedFocus.current={key:row.target.key,index,focused:document.activeElement===event.target,pointer:pointer.current};
    const outcome=await controller.toggle({target:row.target,checked});
    if(active.current && outcome.disposition==='unavailable')setError(controller.getSnapshot().reason);
  }
  async function submit(event){event.preventDefault();if(composing.current || stale || snapshot.blocked)return;
    removedFocus.current={key:draft.targetKey,index:rows.findIndex(row=>row.target.key===draft.targetKey),focused:event.currentTarget.contains(document.activeElement),pointer:pointer.current,editor:true};
    const submitted=draft, outcome=await controller.toggle({target:rawDraft.target,checked:true,collector:draft.raw || rawDraft.target.name});
    if(!active.current)return;
    if(outcome.disposition==='unchanged' && equalOperationValue(cache.read().collectorDraft,submitted)){persistDraft(null);setError('');}
    else if(outcome.disposition==='unavailable')setError(controller.getSnapshot().reason);
  }
  async function copyUnpaid(){const names=view.collections.filter(row=>!row.excluded&&!row.paid).map(row=>row.target.name).join('、');
    if(!names){setCopyStatus('現在の未集金者はいません');return;}
    try{await navigator.clipboard.writeText(names);if(active.current){setCopyStatus('未集金者をコピーしました');setCopyFallback('');}}
    catch{if(active.current){setCopyStatus('コピーできませんでした。名前を選択してコピーしてください。');setCopyFallback(names);}}
  }
  const editor=draft && <li className="operations-inline-editor" key="collector-editor"><form aria-label="集金した人を記録" onSubmit={submit} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}>
    <TextInput ref={input} id="collection-collector" labelText="集金した人" helperText={`対象: ${rawDraft?.target.name || '変更された対象'}`} value={draft.raw} readOnly={snapshot.blocked} invalid={!!error||stale} invalidText={stale?'精算対象が変わりました。入力を控えて、現在の対象で編集し直してください。':error} onChange={event=>persistDraft({...draft,raw:event.target.value})}/>
    <div className="operations-actions"><Button type="submit" disabled={snapshot.blocked||stale}>記録</Button><Button kind="secondary" type="button" disabled={snapshot.blocked} onClick={cancel}>キャンセル</Button></div>
  </form></li>;
  return <section className="operations-workspace" onPointerDown={()=>{pointer.current=true;}} onKeyDown={()=>{pointer.current=false;}}>
    <nav aria-label="精算の作業" className="operations-links"><Link href={runtime.navigation.settlementTaskHrefFor('collection')} aria-current="page">集金</Link><Link href={runtime.navigation.settlementTaskHrefFor('payments')} onClick={event=>{if(normalClick(event)){event.preventDefault();runtime.navigation.navigateSettlementTask('payments');}}}>支払いへ</Link></nav>
    <p role="status">集金済み {view.result.paidCount}/{view.result.payerCount}人・未集金 {money(view.result.unpaidAmount)}</p>
    <div className="operations-toolbar"><ContentSwitcher aria-label="集金対象者の表示" selectedIndex={filter==='all'?1:0} onChange={({name})=>changeFilter(name)}><Switch id="collection-filter" name="outstanding" text="未集金"/><Switch name="all" text="すべて"/></ContentSwitcher><Button kind="ghost" size="sm" onClick={copyUnpaid}>未集金者をコピー</Button></div>
    {copyStatus && <p role="status">{copyStatus}</p>}{copyFallback && <p>{copyFallback}</p>}{error && !draft && <p role="alert">{error}</p>}
    <ContainedList kind="on-page" size="lg" label={`集金対象者 (${rows.length}人)`}>{rows.flatMap((row,index)=>[
      <ContainedListItem key={row.target.key} action={!row.excluded && <Checkbox className="operations-collection-check" id={recordId(row.target.key)} labelText={<span className="operations-check-label">集金済み</span>} aria-label={`${row.target.name}の集金済み`} checked={row.paid} disabled={!row.target.editable||snapshot.blocked||!!draft} onChange={(event,{checked})=>void record(row,checked,event,index)}/>}>
        <div className={`operations-record-summary${row.excluded?'':' operations-collection-summary'}`}><strong>{row.target.name}</strong><span>{money(row.amount)}</span><small>{row.excluded?row.excludedReason || '集金対象外':row.paid?'集金済み':'未集金'}</small>{row.collector && <small>集金した人: {row.collector}</small>}{row.target.reason && <p>{row.target.reason}</p>}</div>
      </ContainedListItem>, ...(draft?.targetKey===row.target.key?[editor]:[]),
    ])}</ContainedList>
    {stale && !rawDraft && editor && <ul className="operations-list">{editor}</ul>}
    {!rows.length && <p>{view.collections.length?'現在の未集金者はいません。「すべて」で記録を確認できます。':'精算対象がいません。参加者または精算ルールを確認してください。'}</p>}
  </section>;
}
