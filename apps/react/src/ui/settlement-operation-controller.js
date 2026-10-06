import { createRoomStore } from '../store/room-store.js';
import { collectionChange } from '../components/settlement/edit.js';
import { allocationSaveReceipt, settleAllocationSave } from './allocation-save.js';
import { equalOperationValue, moneyTargetPaths, operationNeedsReview, resolveMoneyTarget } from './settlement-operations-model.js';

const broad = kind => ['restore','undo','sample'].includes(kind);
const domainPaths = patch => Object.keys(patch || {}).filter(path=>!['revision','lastUpdatedAt','lastUpdatedBy'].includes(path));
const copy = value => structuredClone(value);

export function createSettlementOperationController({runtime,cache}) {
  const domain=runtime.store.domain, listeners=new Set();
  let operation=cache.read().operation, persistedOperation=copy(operation);
  let busy=false, disposed=false, pending=null, snapshot, error='';
  if (operation && broad(operation.kind)) {
    const entry=runtime.storage.read('outbox');
    const localReview=!runtime.sync.enqueue && (operation.disposition==='local' || operation.disposition==='accepted-needs-review' && operation.acknowledged===true);
    if (entry?.id===operation.operationId) operation={...operation,receipt:allocationSaveReceipt(runtime,{base:entry.baseSnapshot,local:entry.snapshot,patch:entry.patch},{type:operation.kind,label:'履歴の変更'})};
    else operation={...operation,receipt:null,disposition:localReview ? 'accepted-needs-review' : 'unresolved',acknowledged:localReview};
  }
  function refresh() {
    if(operation?.receipt && ['local','saved'].includes(operation.receipt.disposition) && !matchesCurrent(operation.receipt)) operation.receipt={...operation.receipt,disposition:'adjusted',acknowledged:true,canRetry:false};
    const foreign=runtime.storage.read('outbox');
    const blocked=busy || operationNeedsReview(operation) || !!foreign;
    snapshot={operation,blocked,reason:error || (busy?'記録を保存しています。':operationNeedsReview(operation)?'前の記録の保存結果を確認してください。':foreign?'別の変更を保存しています。完了後に記録してください。':''),cacheWarning:cache.getWarning()};
    if(!disposed) for(const listener of listeners) listener();
  }
  function matchesCurrent(receipt) {
    const room=runtime.store.getSnapshot();
    return receipt.resetGeneration===room.resetGeneration && domainPaths(receipt.patch).every(path=>equalOperationValue(domain.sync.getSyncPathValue(room,path) ?? null,receipt.patch[path]));
  }
  function persist() {
    if(disposed) return;
    const record=cache.read();
    if(!equalOperationValue(record.operation,persistedOperation)) return;
    let value=operation;
    if(value) {
      const {kind,targetKey,resetGeneration,receipt}=value;
      value=broad(kind) ? {kind,targetKey,resetGeneration,operationId:receipt?.operationId || value.operationId || '',disposition:receipt?.disposition || value.disposition,acknowledged:receipt?.acknowledged===true || value.acknowledged===true,...(value.historyTime===undefined?{}:{historyTime:value.historyTime})} : {kind,targetKey,resetGeneration,receipt};
    }
    if(cache.write({...record,operation:value},{expectedRevision:record.revision})) persistedOperation=copy(value);
  }
  function unavailable(message) { error=message;refresh();return Promise.resolve({receipt:null,disposition:'unavailable'}); }
  function acceptedBroadAfterRefresh() {
    const base=runtime.storage.read('base'), op=operation;
    if(op?.operationId && base?.syncOperations?.[op.operationId]) operation={...op,disposition:'accepted-needs-review',acknowledged:true};
    else if(op && runtime.store.getSnapshot().resetGeneration!==op.resetGeneration) operation={...op,disposition:'reset'};
    else if(op && op.disposition!=='accepted-needs-review') operation={...op,disposition:'unresolved'};
    persist();refresh();return {receipt:null,disposition:operation?.disposition || 'local'};
  }
  async function settle({retry=false,observe=false}={}) {
    if(!operation?.receipt) return acceptedBroadAfterRefresh();
    const current=operation;
    const result=await settleAllocationSave(runtime,current.receipt,{retry,observe,onReceipt(receipt){
      if(!disposed && operation===current) { current.receipt=receipt;persist();refresh(); }
    }});
    if(!disposed && operation===current) {
      current.receipt=result.receipt;
      if(['saved','local'].includes(result.disposition) && !matchesCurrent(result.receipt)) current.receipt={...result.receipt,disposition:'adjusted',acknowledged:true,canRetry:false};
      persist();refresh();return {receipt:current.receipt,disposition:current.receipt?.disposition || result.disposition};
    }
    return result;
  }
  function run(kind,targetKey,perform,{allowedPaths=null,historyTime}={}) {
    refresh();
    if(disposed || snapshot.blocked) return unavailable(snapshot.reason || 'この操作を開始できません。');
    busy=true;error='';refresh();
    let intent=null, intentCount=0, appliedRoom;
    const expectedKind=broad(kind)?'restore':'settlement';
    const unsubscribe=runtime.store.subscribeIntents(value=>{
      // Existing applicant reconciliation can emit a nested intent during
      // restore notification. It remains service-owned, not a second H command
      // or a payload to merge into our one-record recovery receipt.
      if(broad(kind) && value.kind==='syncApplicantDetails')return;
      intentCount++;if(value.kind===expectedKind)intent=value;
    });
    try { perform();appliedRoom=copy(runtime.store.getSnapshot()); }
    catch(e) { busy=false;return unavailable('記録できませんでした。現在の内容を確認してください。'); }
    finally { unsubscribe(); }
    if(!intent) { busy=false;refresh();return Promise.resolve({receipt:null,disposition:'unchanged'}); }
    const receipt=allocationSaveReceipt(runtime,intent,{type:kind,label:kind==='memo'?'メモ':broad(kind)?'履歴の変更':'金銭記録'});
    operation={kind,targetKey,resetGeneration:intent.base.resetGeneration,receipt,appliedRoom,...(historyTime===undefined?{}:{historyTime})};
    if(intentCount!==1 || allowedPaths && domainPaths(intent.patch).some(path=>!allowedPaths.includes(path))) {
      receipt.disposition='unresolved'; receipt.canRetry=false;
      error='変更範囲を確認できません。現在の内容を確認してください。';persist();busy=false;refresh();
      return Promise.resolve({receipt,disposition:'unresolved'});
    }
    persist();refresh();
    pending=settle().finally(()=>{busy=false;pending=null;refresh();});
    return pending;
  }
  function toggle({target,checked,collector}) {
    refresh();
    if(disposed || snapshot.blocked) return unavailable(snapshot.reason || 'この操作を開始できません。');
    if(typeof checked!=='boolean') return unavailable('記録状態を確認してください。');
    const room=runtime.store.getSnapshot();
    const current=resolveMoneyTarget({room,domain,kind:target?.kind,key:target?.key});
    if(!current?.editable || current.name!==target.name || target.context && target.context!==current.context) return unavailable(current?.reason || '対象が変更されています。現在の一覧を確認してください。');
    const {state}=domain.settlementInput(room), paid=current.kind==='payment'?state.driverPaid[current.name]:state.paid[current.name];
    const changesCollector=current.kind==='collection' && (checked && collector!==undefined ? (state.paidBy[current.name] || '')!==String(collector).trim() : !checked && !!state.paidBy[current.name]);
    if(!!paid===checked && !changesCollector) return Promise.resolve({receipt:null,disposition:'unchanged'});
    const allowedPaths=moneyTargetPaths(current);
    const change={name:current.name,checked,payment:current.kind==='payment',collector};
    const preview=createRoomStore({initial:room});let previewIntent;preview.subscribeIntents(value=>{previewIntent=value;});
    collectionChange(preview,change);
    if(domainPaths(previewIntent?.patch).some(path=>!path.startsWith('settlement/'))) return unavailable('他の情報も変更されるため、保存を止めました。現在の内容を確認してください。');
    // The unchanged helper normalizes the entire legacy projection. Publish
    // only its selected monetary paths through the existing edit owner so a
    // checkbox does not normalize unrelated costs/routes/settings.
    const patch=Object.fromEntries(Object.entries(previewIntent?.patch || {}).filter(([path])=>allowedPaths.includes(path)));
    return run(current.kind,current.key,()=>{
      const edit=runtime.store.beginEdit({kind:'settlement'});
      edit.draft=domain.sync.applyEntityPatchToObject(edit.draft,patch);
      try { runtime.store.commitEdit(edit); } finally { if(!edit.closed) runtime.store.cancelEdit(edit); }
    },{allowedPaths});
  }
  function publishMemo({openingMemo,raw,resetGeneration}) {
    const room=runtime.store.getSnapshot();
    if(room.resetGeneration!==resetGeneration || (room.settlement.memo || '')!==openingMemo) return unavailable('メモが変更されています。入力の控えを残して、現在のメモから編集し直してください。');
    if(raw===openingMemo) return Promise.resolve({receipt:null,disposition:'unchanged'});
    return run('memo','memo',()=>{
      const edit=runtime.store.beginEdit({kind:'settlement'});edit.draft.settlement.memo=raw;
      try { runtime.store.commitEdit(edit); } finally { if(!edit.closed) runtime.store.cancelEdit(edit); }
    },{allowedPaths:['settlement/memo']});
  }
  function publishHistory({kind,historyTime,perform}) {
    if(!broad(kind) || kind==='sample' && !runtime.sampleDataEnabled) return unavailable('この企画では操作できません。');
    return run(kind,historyTime===undefined?kind:`history:${historyTime}`,perform,{historyTime});
  }
  function retry() {
    if(pending) return pending;
    if(disposed || !operation?.receipt?.canRetry) {refresh();return Promise.resolve({receipt:operation?.receipt || null,disposition:operation?.receipt?.disposition || operation?.disposition || 'local'});}
    busy=true;refresh();pending=settle({retry:true}).finally(()=>{busy=false;pending=null;refresh();});return pending;
  }
  function observe() {
    if(pending) return pending;
    if(disposed || !operation) return Promise.resolve({receipt:null,disposition:'local'});
    if(['saved','local'].includes(operation.receipt?.disposition)) {refresh();return Promise.resolve({receipt:operation.receipt,disposition:operation.receipt.disposition});}
    pending=settle({observe:true}).finally(()=>{pending=null;refresh();});return pending;
  }
  function confirmCurrent() {
    const receipt=operation?.receipt, disposition=receipt?.disposition || operation?.disposition;
    const terminal=disposition==='reset' && runtime.store.getSnapshot().resetGeneration!==operation.resetGeneration || ['adjusted','accepted-needs-review'].includes(disposition) && (receipt?.acknowledged || operation?.acknowledged);
    if(busy || disposed || !terminal) return false;
    operation=null;error='';persist();refresh();return true;
  }
  const unsubscribeStore=runtime.store.subscribe(()=>{refresh();queueMicrotask(observe);});
  const unsubscribeSync=runtime.sync.subscribe?.(()=>{refresh();queueMicrotask(observe);});
  refresh();
  return {getSnapshot:()=>snapshot,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},toggle,publishMemo,publishHistory,retry,observe,confirmCurrent,dispose(){disposed=true;unsubscribeStore();unsubscribeSync?.();listeners.clear();}};
}
