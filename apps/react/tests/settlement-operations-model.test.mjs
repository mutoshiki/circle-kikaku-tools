import test from 'node:test';
import assert from 'node:assert/strict';
import { createOperationsFixture, resultOf } from './helpers/settlement-operations-fixture.mjs';
import { projectSettlementOperations, resolveMoneyTarget, sameBusinessState } from '../src/ui/settlement-operations-model.js';

test('read-only money projection retains existing amounts and explicit driver roles', async t => {
  const r = await createOperationsFixture(); t.after(r.dispose);
  const room = r.runtime.store.getSnapshot(), before = structuredClone(room), result = resultOf(r.runtime);
  const view = projectSettlementOperations({ room, domain: r.runtime.store.domain });
  assert.deepEqual(r.runtime.store.getSnapshot(), before);
  assert.equal(view.collections.length, Object.keys(room.participants).length);
  assert.equal(view.payments.length, result.cars.length);
  assert.deepEqual(view.payments.map(row => row.amount), result.cars.map(car => car.adjustedTotalPay));
  assert.deepEqual(view.payments.map(row => row.drivers), result.cars.map(car => car.driverNames));
  assert.equal(view.summary.checksComplete, false);
});

test('payment rows preserve signed domain amounts including zero and negative', async t => {
  const r = await createOperationsFixture({ standalone: true }); t.after(r.dispose);
  const { state } = r.runtime.store.domain.settlementInput(r.runtime.store.getSnapshot());
  state.driverReward = '0'; state.driverCollectionOffset = false; state.driverCollectionFree = false;
  state.cars['仮運転手'] = { dist:'0', extras:[{id:'refund',name:'返金',amount:'500',type:'split-minus'}] };
  r.runtime.store.command('settlement',{state});
  const view = projectSettlementOperations({ room:r.runtime.store.getSnapshot(), domain:r.runtime.store.domain });
  assert.equal(view.payments[0].amount, -500);
  assert.equal(view.payments[0].paid, false);
  assert.equal(view.summary.paymentRemainingCount, 1);
  assert.equal(view.summary.paymentRemainingAmount, -500);
});

test('canonical-equivalent people remain visible but are unsafe money targets', async t => {
  const r = await createOperationsFixture(); t.after(r.dispose);
  r.runtime.store.command('editParticipant',{id:'p_1xeyc8h',changes:{name:'Alex'}});
  r.runtime.store.command('editParticipant',{id:'p_1y8x5be',changes:{name:' ALEX '}});
  const room = r.runtime.store.getSnapshot(), domain = r.runtime.store.domain;
  const view = projectSettlementOperations({room,domain});
  const rows = view.collections.filter(row => /alex/i.test(row.target.name));
  assert.equal(rows.length,2);
  assert.ok(rows.every(row => !row.target.editable && row.target.reason));
  assert.equal(resolveMoneyTarget({room,domain,kind:'collection',key:'participant:missing'}),null);
});

test('business equality ignores sync bookkeeping but not locks, application metadata or participants', async t => {
  const r = await createOperationsFixture(); t.after(r.dispose);
  const before = r.runtime.store.getSnapshot(), after = structuredClone(before), domain = r.runtime.store.domain;
  after.revision++; after.lastUpdatedAt++; after.syncOperations={ bookkeeping:{} };
  assert.equal(sameBusinessState({before,after,domain}),true);
  after.editLockPassphrase='changed'; assert.equal(sameBusinessState({before,after,domain}),false);
  const meta = structuredClone(before); meta.meta ||= {}; meta.meta.applicantParticipantIds = {answer:'changed'};
  assert.equal(sameBusinessState({before,after:meta,domain}),false);
});

test('outstanding projection retains a failed checked record for recovery', async t => {
  const r = await createOperationsFixture(); t.after(r.dispose);
  const view = projectSettlementOperations({room:r.runtime.store.getSnapshot(),domain:r.runtime.store.domain,operation:{kind:'collection',targetKey:r.keys.collection.key,receipt:{disposition:'failed'}}});
  assert.equal(view.collections.find(row=>row.target.key===r.keys.collection.key).retained,true);
});

test('zero payments remain unchecked and unsafe standalone names cannot become write targets', async t => {
  const r=await createOperationsFixture({standalone:true}); t.after(r.dispose);
  const {state}=r.runtime.store.domain.settlementInput(r.runtime.store.getSnapshot());
  state.driverReward='0'; state.standalone.driverNames=['unsafe/name'];
  r.runtime.store.command('settlement',{state});
  const view=projectSettlementOperations({room:r.runtime.store.getSnapshot(),domain:r.runtime.store.domain});
  assert.equal(view.payments[0].amount,0); assert.equal(view.payments[0].paid,false);
  assert.equal(view.payments[0].target.editable,false); assert.ok(view.payments[0].target.reason);
  assert.equal(view.summary.checksComplete,false);
});
