import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorage } from '../src/services/history.js';
import { createOperationsCache } from '../src/ui/settlement-operations-draft.js';

test('stale completion cannot clear a newer raw draft and filters survive clear', () => {
  const storage=createMemoryStorage(), cache=createOperationsCache({roomId:'H',storage:()=>storage});
  let next=cache.read(); next.collectorDraft={targetKey:'name:参加者1',context:'mode1',raw:'  未変換  '};
  assert.equal(cache.write(next,{expectedRevision:next.revision}),true);
  const oldRevision=cache.read().revision; next=cache.read(); next.collectorDraft.raw='  新しい入力  '; next.filters.collection='all';
  cache.write(next,{expectedRevision:next.revision});
  assert.equal(cache.clear('collectorDraft',{expectedRevision:oldRevision}),false);
  assert.equal(cache.read().collectorDraft.raw,'  新しい入力  ');
  const recovered=createOperationsCache({roomId:'H',storage:()=>storage});
  assert.equal(recovered.read().collectorDraft.raw,'  新しい入力  ');
  assert.equal(recovered.clear('collectorDraft',{expectedRevision:recovered.read().revision}),true);
  assert.equal(recovered.read().filters.collection,'all');
});

test('quota failure retains memory draft and warns that refresh is not assured', () => {
  const cache=createOperationsCache({roomId:'H',storage:()=>({getItem:()=>null,setItem:()=>{throw Error('quota');}})});
  const record=cache.read();record.memoDraft={raw:'  メモ  ',openingMemo:'旧',resetGeneration:0};
  assert.equal(cache.write(record,{expectedRevision:record.revision}),true);
  assert.equal(cache.read().memoDraft.raw,'  メモ  ');
  assert.ok(cache.getWarning());
});

test('broad patch, token fields and unknown monetary paths cannot enter recovery storage', () => {
  const storage=createMemoryStorage(), cache=createOperationsCache({roomId:'H',storage:()=>storage});
  const broad=cache.read(); broad.operation={kind:'restore',targetKey:'history',resetGeneration:0,receipt:{patch:{editLockPassphrase:'secret'}}};
  assert.equal(cache.write(broad,{expectedRevision:0}),false);
  const token=cache.read(); token.authToken='secret'; assert.equal(cache.write(token,{expectedRevision:0}),false);
  const narrow=cache.read(); narrow.operation={kind:'memo',targetKey:'memo',resetGeneration:0,receipt:{patch:{'participants/p/name':'wrong'}}};
  assert.equal(cache.write(narrow,{expectedRevision:0}),false);
  assert.equal(storage.getItem('sanpo-ui:settlement-operations:v1:H'),null);
});

test('corrupt or wrong-version cache is not replayed or silently overwritten', () => {
  for(const raw of ['{bad','{"version":99}']) {
    const storage=createMemoryStorage();storage.setItem('sanpo-ui:settlement-operations:v1:H',raw);
    const cache=createOperationsCache({roomId:'H',storage:()=>storage});
    assert.equal(cache.read().operation,null); assert.ok(cache.getWarning());
    assert.equal(storage.getItem('sanpo-ui:settlement-operations:v1:H'),raw);
  }
});

test('narrow exact receipts and compact broad identifiers survive recovery without new room copies', () => {
  const storage=createMemoryStorage(), cache=createOperationsCache({roomId:'H',storage:()=>storage});
  const record=cache.read(); record.operation={kind:'memo',targetKey:'memo',resetGeneration:0,receipt:{type:'memo',label:'メモ',operationId:'op1',resetGeneration:0,diagnosticCount:0,disposition:'failed',canRetry:true,patch:{'settlement/memo':'新'},before:{'settlement/memo':'旧'}}};
  assert.equal(cache.write(record,{expectedRevision:0}),true);
  assert.deepEqual(createOperationsCache({roomId:'H',storage:()=>storage}).read().operation,record.operation);
  const broad=cache.read(); broad.operation={kind:'restore',targetKey:'history',operationId:'op2',resetGeneration:0,historyTime:1000,disposition:'pending'};
  assert.equal(cache.write(broad,{expectedRevision:broad.revision}),true);
  const recovered=createOperationsCache({roomId:'H',storage:()=>storage}).read().operation;
  assert.equal(recovered.operationId,'op2'); assert.equal(recovered.receipt,undefined);
});
