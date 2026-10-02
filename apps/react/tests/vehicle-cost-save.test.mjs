import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore } from '../src/store/room-store.js';
import { createRoomSync } from '../src/sync/room-sync.js';
import { fixture } from './reference.mjs';
import { memoryStorage,createFixtureServer } from './helpers/fixture-transport.mjs';
import { vehicleCostTargets } from '../src/ui/vehicle-cost-target.js';
import { createVehicleCostController } from '../src/ui/vehicle-cost-controller.js';
import { createVehicleCostDraft } from '../src/ui/vehicle-cost-draft.js';
import { beginVehicleCostEdit,publishVehicleCostEdit,settleVehicleCostSave } from '../src/ui/vehicle-cost-save.js';
function cacheFor(target) { const values=new Map();return createVehicleCostDraft({roomId:crypto.randomUUID(),carKey:target.key,storage:()=>({getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)})}); }
async function client(shared=true) {
  let tick=100000;
  const clock={now:()=>++tick,isServerAligned:()=>true}, store=createRoomStore({initial:fixture,clock,clientId:'F-cost'}), storage=memoryStorage();
  const server=createFixtureServer(store.getSnapshot()),transport=server.connect();
  const sync=shared?createRoomSync({store,storage,transport,clientId:'F-cost',clock,legacyLoadWrites:false}):{getSnapshot:()=>({kind:'local'}),flush:async()=>{},dispose:()=>{}};
  if(shared){sync.start();await Promise.resolve();}
  return {store,storage,server,transport,sync};
}

test('ID save emits only selected car paths and preserves concurrent settings and other car',async()=>{
  const r=await client(false), target=vehicleCostTargets(r.store.getSnapshot(),r.store.domain)[0];
  const edit=beginVehicleCostEdit(r,target);edit.state.cars[target.car.name].dist='135';
  const remote=structuredClone(r.store.getSnapshot());remote.settlement.rounding='10';remote.settlement.carsByParticipantId.p_1y8x5be.dist='999';r.store.receiveRemote(remote);
  const receipt=publishVehicleCostEdit(r,edit);
  assert.ok(Object.keys(receipt.patch).length>0);assert.ok(Object.keys(receipt.patch).every(p=>p.startsWith('settlement/carsByParticipantId/p_1xeyc8h/')));
  assert.equal(r.store.getSnapshot().settlement.rounding,'10');assert.equal(r.store.getSnapshot().settlement.carsByParticipantId.p_1y8x5be.dist,'999');
  assert.equal((await settleVehicleCostSave(r,receipt)).disposition,'local');
});

test('standalone Save uses only the exact existing name-backed car path',async()=>{
  const r=await client(false), state=r.store.domain.settlementInput(r.store.getSnapshot()).state;
  state.standalone={enabled:true,driverCount:'2',memberCount:'3',driverNames:['名前だけの車','別車']};r.store.command('settlement',{state});
  const target=vehicleCostTargets(r.store.getSnapshot(),r.store.domain)[0],edit=beginVehicleCostEdit(r,target);
  Object.assign(edit.state.cars[target.car.name],{dist:'100',eco:'10',price:'150'});
  const receipt=publishVehicleCostEdit(r,edit);
  assert.ok(Object.keys(receipt.patch).length>0);
  assert.ok(Object.keys(receipt.patch).every(p=>p==='settlement/carsByName/名前だけの車'||p.startsWith('settlement/carsByName/名前だけの車/')));
  assert.equal(r.store.getSnapshot().settlement.standalone.driverCount,'2');
});

test('standalone exact participant-name match uses the existing canonical ID path only',async()=>{
  const r=await client(false), state=r.store.domain.settlementInput(r.store.getSnapshot()).state;
  state.standalone={enabled:true,driverCount:'1',memberCount:'3',driverNames:['仮参加者A']};r.store.command('settlement',{state});
  const target=vehicleCostTargets(r.store.getSnapshot(),r.store.domain)[0],edit=beginVehicleCostEdit(r,target);
  assert.equal(target.key,'name:仮参加者A');edit.state.cars[target.car.name].dist='135';
  const receipt=publishVehicleCostEdit(r,edit);
  assert.ok(Object.keys(receipt.patch).length>0);assert.ok(Object.keys(receipt.patch).every(p=>p.startsWith('settlement/carsByParticipantId/p_1xeyc8h/')));
});

test('rejected Save freezes payload across reload and retries without duplicate extras',async()=>{
  const r=await client(),target=vehicleCostTargets(r.store.getSnapshot(),r.store.domain)[0],cache=cacheFor(target);
  try {
    let intents=0;r.store.subscribeIntents(()=>intents++);
    const c=createVehicleCostController({runtime:r,target,cache}),key=c.addExtra();c.updateField(key,'name','入浴');c.updateField(key,'amount','400');
    r.transport.failOnce(Error('permission denied'));
    const first=await c.save();assert.equal(first.disposition,'failed');assert.equal(c.getSnapshot().frozen,true);
    c.updateField(key,'amount','999');assert.equal(c.getSnapshot().fees.find(f=>f.key===key).row.amount,'400');c.dispose();
    const restored=createVehicleCostController({runtime:r,target,cache});
    const retried=await restored.retry();assert.equal(retried.disposition,'saved');assert.equal(intents,1);
    const rows=r.store.domain.settlementInput(r.server.get()).state.cars[target.car.name].extras.filter(e=>e.id===key.slice(6));
    assert.equal(rows.length,1);assert.equal(rows[0].amount,'400');assert.equal(cache.read(),null);restored.dispose();
  } finally {r.sync.dispose();}
});

test('IME and simultaneous submit create one local intent, not multiple saves',async()=>{
  const r=await client(false),target=vehicleCostTargets(r.store.getSnapshot(),r.store.domain)[0],c=createVehicleCostController({runtime:r,target,cache:cacheFor(target)});
  let intents=0;r.store.subscribeIntents(()=>intents++);c.updateField('movement','dist','135');
  assert.equal((await c.save({composing:true})).disposition,'composing');assert.equal(intents,0);
  await Promise.all([c.save(),c.save()]);assert.equal(intents,1);assert.equal(c.getSnapshot().status,'この端末に保存');c.dispose();
});

test('empty outbox is not proof and an accepted receipt never replays a later edit',async()=>{
  const r=await client(),target=vehicleCostTargets(r.store.getSnapshot(),r.store.domain)[0];
  try {
    const edit=beginVehicleCostEdit(r,target);edit.state.cars[target.car.name].dist='135';const receipt=publishVehicleCostEdit(r,edit);await r.sync.flush();
    const base=r.storage.read('base'),proof=base.syncOperations[receipt.operationId];delete base.syncOperations[receipt.operationId];r.storage.write('base',base);
    const writes=r.server.writes();assert.equal((await settleVehicleCostSave(r,receipt,{retry:true})).disposition,'unresolved');assert.equal(r.server.writes(),writes);
    base.syncOperations[receipt.operationId]=proof;r.storage.write('base',base);const accepted=await settleVehicleCostSave(r,receipt);
    const later=beginVehicleCostEdit(r,target);later.state.cars[target.car.name].dist='250';publishVehicleCostEdit(r,later);await r.sync.flush();const after=r.server.writes();
    await settleVehicleCostSave(r,accepted.receipt,{retry:true});assert.equal(r.server.writes(),after);assert.equal(r.store.domain.settlementInput(r.server.get()).state.cars[target.car.name].dist,'250');
  }finally{r.sync.dispose();}
});
