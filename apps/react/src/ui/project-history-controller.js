import {inspectLocalHistory} from './project-history-model.js';
import {equalOperationValue,sameBusinessState} from './settlement-operations-model.js';
export function createProjectHistoryController({runtime,operations,rawStorage}) {
  const listeners=new Set();let snapshot,disposed=false,saveIssue='',status='';
  function refresh(){
    const inspected=inspectLocalHistory({history:runtime.history,storage:rawStorage}),room=runtime.store.getSnapshot();
    const items=inspected.items.map((item,index)=>({item,key:`history-${index}-${item?.time || 0}`,current:!!item?.data && sameBusinessState({before:item.data,after:room,domain:runtime.store.domain})}));
    snapshot={items,loadIssue:saveIssue || inspected.message,status,confirmation:null,operation:operations.getSnapshot().operation,canUndo:false,blocked:operations.getSnapshot().blocked || inspected.kind!=='ready'};
    if(!disposed)listeners.forEach(listener=>listener());
  }
  function saveSnapshot(){
    if(disposed)return false;const inspected=inspectLocalHistory({history:runtime.history,storage:rawStorage});
    if(inspected.kind!=='ready' || operations.getSnapshot().blocked || runtime.storage.read('outbox')){saveIssue=inspected.message || '共有保存の結果を確認してから、この端末へ保存してください。';refresh();return false;}
    const saved=runtime.history.save(runtime.store.getSnapshot()),after=inspectLocalHistory({history:runtime.history,storage:rawStorage});
    const verified=after.kind==='ready' && after.items.some(item=>item?.time===saved.time && equalOperationValue(item.data,saved.data));
    saveIssue=verified?'':'この端末に履歴を保存できませんでした。保存先の容量・アクセスを確認してください。';status=verified && inspected.items[0]?.time===saved.time && equalOperationValue(inspected.items[0].data,saved.data)?'同じ状態が保存されています':'';refresh();return verified;
  }
  const stopStore=runtime.store.subscribe(refresh),stopOperations=operations.subscribe(refresh);refresh();
  return {getSnapshot:()=>snapshot,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},saveSnapshot,dispose(){disposed=true;stopStore();stopOperations();listeners.clear();}};
}
