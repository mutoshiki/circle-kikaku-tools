import {inspectLocalHistory,previewHistoryRestore,historyImpact} from './project-history-model.js';
import {equalOperationValue,sameBusinessState} from './settlement-operations-model.js';
export function createProjectHistoryController({runtime,operations,rawStorage}) {
  const listeners=new Set();let snapshot,disposed=false,saveIssue='',status='',confirmation=null,confirmationId=0,undoGuard=null,restoreRun=null;
  const room=()=>runtime.store.getSnapshot();
  const businessEqual=(before,after)=>sameBusinessState({before,after,domain:runtime.store.domain});
  function targetPresent(item){return inspectLocalHistory({history:runtime.history,storage:rawStorage}).items.some(value=>equalOperationValue(value,item));}
  function refresh(){
    const inspected=inspectLocalHistory({history:runtime.history,storage:rawStorage}),currentRoom=room(),op=operations.getSnapshot().operation;
    if(undoGuard && (!businessEqual(undoGuard.after,currentRoom) || currentRoom.resetGeneration!==undoGuard.after.resetGeneration || op!==undoGuard.operation))undoGuard=null;
    if(restoreRun?.published && !restoreRun.operation && op?.kind==='restore' && op.historyTime===restoreRun.item.time)restoreRun.operation=op;
    if(restoreRun?.operation===op && op?.receipt && ['saved','local'].includes(op.receipt.disposition) && !operations.getSnapshot().blocked){
      if(op.appliedRoom && businessEqual(op.appliedRoom,currentRoom) && runtime.history.canUndo())undoGuard={before:restoreRun.before,after:structuredClone(currentRoom),operation:op};
      restoreRun=null;
    }else if(restoreRun?.operation===op && ['adjusted','reset'].includes(op?.receipt?.disposition))restoreRun=null;
    if(confirmation && (!businessEqual(confirmation.opening,currentRoom) || confirmation.opening.resetGeneration!==currentRoom.resetGeneration || confirmation.kind==='restore' && !targetPresent(confirmation.item) || confirmation.kind==='undo' && !undoGuard))confirmation={...confirmation,stale:true};
    const items=inspected.items.map((item,index)=>{const preview=previewHistoryRestore({room:currentRoom,item});return {item,key:`history-${index}-${item?.time || 0}`,current:!!item?.data && businessEqual(item.data,currentRoom),available:preview.available,reason:preview.reason};});
    snapshot={items,loadIssue:saveIssue || inspected.message,status,confirmation,operation:op,canUndo:!!undoGuard && runtime.history.canUndo() && !operations.getSnapshot().blocked,blocked:operations.getSnapshot().blocked || inspected.kind!=='ready'};
    if(!disposed)listeners.forEach(listener=>listener());
  }
  function saveSnapshot(){
    if(disposed)return false;const inspected=inspectLocalHistory({history:runtime.history,storage:rawStorage});
    if(inspected.kind!=='ready' || operations.getSnapshot().blocked || runtime.storage.read('outbox')){saveIssue=inspected.message || '共有保存の結果を確認してから、この端末へ保存してください。';refresh();return false;}
    const saved=runtime.history.save(runtime.store.getSnapshot()),after=inspectLocalHistory({history:runtime.history,storage:rawStorage});
    const verified=after.kind==='ready' && after.items.some(item=>item?.time===saved.time && equalOperationValue(item.data,saved.data));
    saveIssue=verified?'':'この端末に履歴を保存できませんでした。保存先の容量・アクセスを確認してください。';status=verified && inspected.items[0]?.time===saved.time && equalOperationValue(inspected.items[0].data,saved.data)?'同じ状態が保存されています':'';refresh();return verified;
  }
  function selectRestore(item){
    if(disposed || operations.getSnapshot().blocked || !targetPresent(item))return false;
    const preview=previewHistoryRestore({room:room(),item});if(!preview.available){saveIssue=preview.reason;refresh();return false;}
    confirmation={id:++confirmationId,kind:'restore',item:structuredClone(item),opening:structuredClone(room()),impact:preview.impact,stale:false};refresh();return true;
  }
  function selectUndo(){
    refresh();if(disposed || !snapshot.canUndo)return false;
    confirmation={id:++confirmationId,kind:'undo',opening:structuredClone(room()),impact:historyImpact(room(),undoGuard.before),stale:false};refresh();return true;
  }
  async function confirm(kind,{understood=false}={}){
    refresh();if(disposed || !understood || confirmation?.kind!==kind || operations.getSnapshot().blocked)return {receipt:null,disposition:'unavailable'};
    if(confirmation.stale){refresh();return {receipt:null,disposition:'conflict'};}
    const selected=confirmation;confirmation=null;undoGuard=null;restoreRun=null;
    if(kind==='restore')restoreRun={before:selected.opening,item:selected.item,published:false,operation:null};
    const result=operations.publishHistory({kind,historyTime:selected.item?.time,perform:()=>{
      const applied=kind==='restore'?runtime.history.restore(runtime.store,selected.item):runtime.history.undo(runtime.store);
      if(restoreRun)restoreRun.published=true;return applied;
    }});refresh();const outcome=await result;if(!disposed)refresh();return outcome;
  }
  function cancelConfirmation(){confirmation=null;refresh();}
  const stopStore=runtime.store.subscribe(refresh),stopOperations=operations.subscribe(refresh);refresh();
  return {getSnapshot:()=>snapshot,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},saveSnapshot,selectRestore,selectUndo,confirmRestore:options=>confirm('restore',options),confirmUndo:options=>confirm('undo',options),cancelConfirmation,dispose(){disposed=true;stopStore();stopOperations();listeners.clear();}};
}
