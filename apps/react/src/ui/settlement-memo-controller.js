export function createSettlementMemoController({runtime,operations,cache}) {
  const listeners=new Set();let draft=cache.read().memoDraft,disposed=false,snapshot,busy=false,error='';
  const current=()=>({openingMemo:runtime.store.getSnapshot().settlement.memo || '',resetGeneration:runtime.store.getSnapshot().resetGeneration});
  function conflict(){const latest=current();return !!draft && (latest.openingMemo!==draft.openingMemo || latest.resetGeneration!==draft.resetGeneration);}
  function persist(value){if(disposed)return false;const record=cache.read();if(JSON.stringify(record.memoDraft)!==JSON.stringify(draft))return false;const written=cache.write({...record,memoDraft:value},{expectedRevision:record.revision});if(written)draft=value;return written;}
  function refresh(){
    const operation=operations.getSnapshot().operation,receipt=operation?.receipt;
    if(draft && draft.raw!==draft.openingMemo && operation?.kind==='memo' && ['local','saved'].includes(receipt?.disposition) && receipt.patch['settlement/memo']===draft.raw && current().openingMemo===draft.raw && current().resetGeneration===draft.resetGeneration)persist(null);
    snapshot={editing:!!draft,raw:draft?.raw || '',dirty:!!draft && draft.raw!==draft.openingMemo,error:error || (conflict()?'メモが変更されています。控えを残して、現在のメモから編集し直してください。':''),frozen:busy || operations.getSnapshot().blocked};
    if(!disposed)listeners.forEach(listener=>listener());
  }
  function edit(){if(disposed || operations.getSnapshot().blocked)return false;if(!draft)persist({raw:current().openingMemo,...current()});error='';refresh();return true;}
  function setRaw(raw){if(disposed || !draft || snapshot.frozen)return false;const result=persist({...draft,raw});error='';refresh();return result;}
  async function save({composing=false}={}){
    if(disposed || !draft || snapshot.frozen || composing)return {receipt:null,disposition:'unavailable'};
    if(conflict()){refresh();return {receipt:null,disposition:'conflict'};}
    const submitted=draft;busy=true;error='';refresh();const result=await operations.publishMemo(submitted);
    if(!disposed){busy=false;if(['saved','local','unchanged'].includes(result.disposition) && draft===submitted)persist(null);else if(result.disposition==='unavailable')error=operations.getSnapshot().reason;refresh();}
    return result;
  }
  function cancel(){if(disposed || snapshot.frozen)return false;const result=persist(null);error='';refresh();return result;}
  function rebase(){if(disposed || !draft || snapshot.frozen)return false;const result=persist({...draft,...current()});error='';refresh();return result;}
  const stopStore=runtime.store.subscribe(refresh),stopOperations=operations.subscribe(refresh);refresh();
  return {getSnapshot:()=>snapshot,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},edit,setRaw,save,cancel,rebase,dispose(){disposed=true;stopStore();stopOperations();listeners.clear();}};
}
