import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsFixture,resultOf} from './helpers/settlement-operations-fixture.mjs';
import {createOperationsCache} from '../src/ui/settlement-operations-draft.js';
import {resolveMoneyTarget} from '../src/ui/settlement-operations-model.js';
import {createSettlementOperationController} from '../src/ui/settlement-operation-controller.js';

async function setup(t,options) {
  const r=await createOperationsFixture(options);
  const cache=createOperationsCache({roomId:r.runtime.roomId,storage:()=>r.rawStorage});
  const controller=createSettlementOperationController({runtime:r.runtime,cache});
  t.after(()=>{controller.dispose();r.dispose();});
  const target=kind=>resolveMoneyTarget({room:r.runtime.store.getSnapshot(),domain:r.runtime.store.domain,kind,key:r.keys[kind].key});
  return {...r,cache,controller,target};
}

test('one local row record emits one intent without changing the calculated amount',async t=>{
  const r=await setup(t);let commands=0;r.runtime.store.subscribeIntents(()=>commands++);
  const amountBefore=resultOf(r.runtime).perPerson;
  const result=await r.controller.toggle({target:r.target('collection'),checked:true});
  assert.equal(result.disposition,'local'); assert.equal(commands,1);
  assert.equal(resultOf(r.runtime).perPerson,amountBefore);
  assert.ok(Object.keys(result.receipt.patch).filter(p=>!['revision','lastUpdatedAt','lastUpdatedBy'].includes(p)).every(p=>/^settlement\/paid/.test(p)));
  await r.controller.toggle({target:r.target('payment'),checked:true});
  await r.controller.toggle({target:r.target('collection'),checked:false});
  const state=r.runtime.store.domain.settlementInput(r.runtime.store.getSnapshot()).state;
  assert.equal(state.driverPaid[r.keys.payment.name],true);assert.equal(state.paid[r.keys.collection.name],false);
});

test('stale target identity, reset and canonical name collisions stop before writing',async t=>{
  const r=await setup(t);const target=r.target('collection');let commands=0;
  r.runtime.store.command('editParticipant',{id:target.participantId,changes:{name:'別の名前'}});
  r.runtime.store.subscribeIntents(()=>commands++);
  assert.equal((await r.controller.toggle({target,checked:true})).disposition,'unavailable');
  assert.equal(commands,0);
});

test('foreign outbox blocks money and memo but does not mutate recovery or room',async t=>{
  const r=await setup(t);r.runtime.storage.write('outbox',{id:'foreign'});
  const before=r.runtime.store.getSnapshot();
  assert.equal((await r.controller.toggle({target:r.target('collection'),checked:true})).disposition,'unavailable');
  assert.equal((await r.controller.publishMemo({openingMemo:before.settlement.memo || '',raw:'新',resetGeneration:before.resetGeneration})).disposition,'unavailable');
  assert.equal(r.runtime.store.getSnapshot(),before);
  assert.equal(r.runtime.storage.read('outbox').id,'foreign');
});

test('unknown compact broad operation after reload blocks reverse writes without persisting payloads',async t=>{
  const r=await setup(t),record=r.cache.read();
  record.operation={kind:'restore',targetKey:'history',resetGeneration:0,operationId:'unknown-op',historyTime:1,disposition:'pending'};
  r.cache.write(record,{expectedRevision:record.revision});r.controller.dispose();
  const restored=createSettlementOperationController({runtime:r.runtime,cache:r.cache});t.after(restored.dispose);
  assert.equal((await restored.observe()).disposition,'unresolved');
  assert.equal(restored.getSnapshot().blocked,true);assert.equal(restored.confirmCurrent(),false);
  assert.equal((await restored.toggle({target:r.target('payment'),checked:false})).disposition,'unavailable');
});

test('broad local write stores only compact receipt and never reruns on retry',async t=>{
  const r=await setup(t);const item=r.runtime.history.save(r.runtime.store.getSnapshot());r.runtime.store.command('rename',{name:'変更'});
  let commands=0;
  const result=await r.controller.publishHistory({kind:'restore',historyTime:item.time,perform:()=>{commands++;return r.runtime.history.restore(r.runtime.store,item);}});
  assert.equal(result.disposition,'local');assert.equal(commands,1);
  await r.controller.retry();assert.equal(commands,1);
  const op=r.cache.read().operation;assert.equal(op.kind,'restore');assert.equal(op.receipt,undefined);assert.equal(op.patch,undefined);
});

test('accepted record is not replayed over a newer current value',async t=>{
  const r=await setup(t,{shared:true});
  const result=await r.controller.toggle({target:r.target('payment'),checked:true});
  assert.equal(result.disposition,'saved');assert.ok(result.receipt.operationId);
  const remote=structuredClone(r.runtime.store.getSnapshot());remote.settlement.driverPaidByParticipantId[r.target('payment').participantId]=false;
  r.runtime.store.receiveRemote(remote);
  const writes=r.server.writes();await r.controller.retry();assert.equal(r.server.writes(),writes);
  assert.equal(r.controller.getSnapshot().operation.receipt.disposition,'adjusted');
  assert.equal(r.controller.confirmCurrent(),true);
});

test('double submit while transport is held produces one command',async t=>{
  const r=await setup(t,{shared:true});const original=r.transport.transaction;let release;
  const held=new Promise(resolve=>{release=resolve;});r.transport.transaction=async updater=>{await held;return original(updater);};
  let commands=0;r.runtime.store.subscribeIntents(()=>commands++);
  const first=r.controller.toggle({target:r.target('payment'),checked:true});
  await r.controller.toggle({target:r.target('payment'),checked:true});assert.equal(commands,1);
  release();assert.equal((await first).disposition,'saved');
});

test('rejected row recording retries exact patch without rerunning its command or changing other costs',async t=>{
  const r=await setup(t,{shared:true});r.transport.failOnce(Error('permission_denied'));
  let commands=0;r.runtime.store.subscribeIntents(()=>commands++);
  const before=structuredClone(r.runtime.store.getSnapshot());
  const first=await r.controller.toggle({target:r.target('payment'),checked:true});
  assert.equal(first.disposition,'failed');assert.equal(first.receipt.canRetry,true);
  const second=await r.controller.retry();assert.equal(second.disposition,'saved');assert.equal(commands,1);
  assert.deepEqual(r.runtime.store.getSnapshot().settlement.carsByParticipantId,before.settlement.carsByParticipantId);
  assert.deepEqual(r.runtime.store.getSnapshot().allocations,before.allocations);
});

test('same-value row recording is a genuine no-op, not another intent',async t=>{
  const r=await setup(t);let commands=0;r.runtime.store.subscribeIntents(()=>commands++);
  const result=await r.controller.toggle({target:r.target('payment'),checked:false});
  assert.equal(result.disposition,'unchanged');assert.equal(commands,0);
});

test('memo publication only changes the memo and blocks stale opening values',async t=>{
  const r=await setup(t),before=structuredClone(r.runtime.store.getSnapshot());let lastIntent;
  r.runtime.store.subscribeIntents(intent=>{lastIntent=intent;});
  const result=await r.controller.publishMemo({openingMemo:before.settlement.memo || '',raw:' 新しいメモ ',resetGeneration:before.resetGeneration});
  assert.equal(result.disposition,'local');
  assert.deepEqual(Object.keys(lastIntent.patch).filter(p=>!['revision','lastUpdatedAt','lastUpdatedBy'].includes(p)),['settlement/memo']);
  assert.deepEqual(r.runtime.store.getSnapshot().settlement.driverPaidByParticipantId,before.settlement.driverPaidByParticipantId);
  const count=lastIntent.sequence;
  assert.equal((await r.controller.publishMemo({openingMemo:'stale',raw:'上書き',resetGeneration:before.resetGeneration})).disposition,'unavailable');
  assert.equal(lastIntent.sequence,count);
});

test('mode and reset changes invalidate recovered collector context before publication',async t=>{
  const r=await setup(t,{standalone:true}), target=r.target('collection');
  const room=structuredClone(r.runtime.store.getSnapshot());room.resetGeneration++;
  r.runtime.store.receiveRemote(room);let intents=0;r.runtime.store.subscribeIntents(()=>intents++);
  assert.equal((await r.controller.toggle({target,checked:true,collector:'控え'})).disposition,'unavailable');assert.equal(intents,0);
});

test('a newer cache operation is never erased by an older disposed controller completion',async t=>{
  const r=await setup(t,{shared:true}), original=r.transport.transaction;let release;
  const held=new Promise(resolve=>{release=resolve;});r.transport.transaction=async updater=>{await held;return original(updater);};
  const result=r.controller.toggle({target:r.target('payment'),checked:true});
  r.controller.dispose();const newer=r.cache.read();
  newer.memoDraft={raw:'新しい控え',openingMemo:'',resetGeneration:0};
  r.cache.write(newer,{expectedRevision:newer.revision});
  const recoveryBefore=r.cache.read();release();await result;
  assert.deepEqual(r.cache.read(),recoveryBefore);
});
