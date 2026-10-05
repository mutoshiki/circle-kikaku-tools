import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsFixture} from './helpers/settlement-operations-fixture.mjs';
import {createOperationsCache} from '../src/ui/settlement-operations-draft.js';
import {createSettlementOperationController} from '../src/ui/settlement-operation-controller.js';
import {createSettlementMemoController} from '../src/ui/settlement-memo-controller.js';
async function setup(t){const r=await createOperationsFixture();t.after(r.dispose);const cache=createOperationsCache({roomId:r.runtime.roomId,storage:()=>r.rawStorage}),operations=createSettlementOperationController({runtime:r.runtime,cache});t.after(operations.dispose);const memo=createSettlementMemoController({runtime:r.runtime,cache,operations});t.after(memo.dispose);return {...r,cache,operations,memo};}
test('memo raw draft survives owner recreation and cancel never writes',async t=>{
  const {runtime,cache,operations,memo}=await setup(t);const before=runtime.store.getSnapshot();memo.edit();memo.setRaw('  控え\n ');memo.dispose();
  const next=createSettlementMemoController({runtime,cache,operations});t.after(next.dispose);assert.equal(next.getSnapshot().raw,'  控え\n ');assert.equal(next.getSnapshot().editing,true);next.cancel();assert.deepEqual(runtime.store.getSnapshot(),before);assert.equal(cache.read().memoDraft,null);
});
test('memo save preserves concurrent payment and cost edits',async t=>{
  const {runtime,memo}=await setup(t);memo.edit();memo.setRaw('  精算連絡  ');
  const edit=runtime.store.beginEdit({kind:'settlement'});edit.draft.settlement.driverPaidByParticipantId ||= {};edit.draft.settlement.driverPaidByParticipantId.extra=true;const car=Object.values(edit.draft.settlement.carsByParticipantId)[0];car.dist='333';runtime.store.commitEdit(edit);
  const latest=structuredClone(runtime.store.getSnapshot());let intent;const stop=runtime.store.subscribeIntents(value=>{intent=value;});assert.equal((await memo.save()).disposition,'local');stop();
  assert.deepEqual(Object.keys(intent.patch).filter(path=>!['revision','lastUpdatedAt','lastUpdatedBy'].includes(path)),['settlement/memo']);
  const after=runtime.store.getSnapshot();assert.equal(after.settlement.memo,'  精算連絡  ');assert.deepEqual(after.settlement.driverPaidByParticipantId,latest.settlement.driverPaidByParticipantId);assert.deepEqual(after.settlement.carsByParticipantId,latest.settlement.carsByParticipantId);assert.equal(memo.getSnapshot().editing,false);
});
test('memo conflict fences publish, retains raw and explicit rebase uses current memo',async t=>{
  const {runtime,memo}=await setup(t);memo.edit();memo.setRaw('自分の控え');const edit=runtime.store.beginEdit({kind:'settlement'});edit.draft.settlement.memo='他者のメモ';runtime.store.commitEdit(edit);
  let writes=0;runtime.store.subscribeIntents(()=>writes++);assert.equal((await memo.save()).disposition,'conflict');assert.equal(writes,0);assert.match(memo.getSnapshot().error,/変更/);assert.equal(memo.getSnapshot().raw,'自分の控え');assert.equal(memo.rebase(),true);assert.equal(memo.getSnapshot().raw,'自分の控え');await memo.save();assert.equal(writes,1);
});
test('memo IME and unchanged save publish nothing',async t=>{
  const {runtime,memo}=await setup(t);let writes=0;runtime.store.subscribeIntents(()=>writes++);memo.edit();memo.setRaw('変換途中');assert.equal((await memo.save({composing:true})).disposition,'unavailable');assert.equal(writes,0);memo.cancel();memo.edit();assert.equal((await memo.save()).disposition,'unchanged');assert.equal(writes,0);
});
test('disposed memo completion cannot clear a newer recovered draft',async t=>{
  const {runtime,cache,operations,memo}=await setup(t);memo.edit();memo.setRaw('古い');memo.dispose();const record=cache.read();cache.write({...record,memoDraft:{...record.memoDraft,raw:'新しい'}},{expectedRevision:record.revision});assert.equal((await memo.save()).disposition,'unavailable');assert.equal(cache.read().memoDraft.raw,'新しい');assert.equal(runtime.store.getSnapshot().settlement.memo || '','');
});
test('held memo publication freezes cancel and double submit, retry sends one exact intent',async t=>{
  const r=await createOperationsFixture({shared:true});t.after(r.dispose);const cache=createOperationsCache({roomId:r.runtime.roomId,storage:()=>r.rawStorage}),operations=createSettlementOperationController({runtime:r.runtime,cache}),memo=createSettlementMemoController({runtime:r.runtime,cache,operations});t.after(memo.dispose);t.after(operations.dispose);
  const original=r.transport.transaction;let release;const held=new Promise(resolve=>{release=resolve;});r.transport.transaction=async fn=>{await held;return original(fn);};r.transport.failOnce(Error('permission_denied'));
  let writes=0;r.runtime.store.subscribeIntents(()=>writes++);memo.edit();memo.setRaw('保存待ち');const first=memo.save();assert.equal(memo.getSnapshot().frozen,true);assert.equal(memo.cancel(),false);assert.equal((await memo.save()).disposition,'unavailable');release();assert.equal((await first).disposition,'failed');assert.equal(memo.getSnapshot().editing,true);assert.equal(writes,1);assert.equal((await operations.retry()).disposition,'saved');assert.equal(writes,1);assert.equal(memo.getSnapshot().editing,false);
});
test('quota failure keeps editable raw memo in memory',async t=>{
  const {runtime,operations}=await setup(t),cache=createOperationsCache({roomId:'quota',storage:()=>({getItem:()=>null,setItem(){throw Error('quota');}})}),memo=createSettlementMemoController({runtime,operations,cache});t.after(memo.dispose);memo.edit();memo.setRaw('  控え  ');assert.equal(memo.getSnapshot().raw,'  控え  ');assert.ok(cache.getWarning());memo.cancel();assert.equal(memo.getSnapshot().editing,false);
});
