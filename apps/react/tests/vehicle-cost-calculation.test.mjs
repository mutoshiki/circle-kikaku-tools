import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, createReference, plain } from './reference.mjs';
import { createRoomStore } from '../src/store/room-store.js';
import { vehicleCostTargets } from '../src/ui/vehicle-cost-target.js';
import { createVehicleCostController } from '../src/ui/vehicle-cost-controller.js';
import { createVehicleCostDraft } from '../src/ui/vehicle-cost-draft.js';

for(const mode of ['private','times','standalone','offset','zero-and-blank'])test(`full protected calculation parity before Save and reload: ${mode}`,async()=>{
  const input=structuredClone(fixture);
  Object.assign(input.settlement,{organizerFree:true,driverCollectionOffset:mode==='offset',driverCollectionFree:mode!=='offset',rounding:'10',driverReward:'700',driverRewardType:'club'});
  if(mode==='standalone')input.settlement.standalone={enabled:true,driverCount:'1',memberCount:'3',driverNames:['独立車']};
  const store=createRoomStore({initial:input}),domain=store.domain,targets=vehicleCostTargets(store.getSnapshot(),domain), target=targets[0];
  const values=new Map(), cache=createVehicleCostDraft({roomId:`CALC-${mode}`,carKey:target.key,storage:()=>({getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)})});
  const runtime={store,sync:{getSnapshot:()=>({kind:'local'}),flush:async()=>{}},storage:{read:()=>null}};
  const controller=createVehicleCostController({runtime,target,cache});
  controller.setRentalType(mode==='times'?'times':'private');
  for(const [key,value] of Object.entries({dist:mode==='zero-and-blank'?'0':'100',eco:mode==='zero-and-blank'?'':'20',price:mode==='zero-and-blank'?'':'160'}))controller.updateField('movement',key,value);
  if(mode==='times'){const row=controller.getSnapshot().fees.find(f=>f.kind==='times-time');controller.updateField(row.key,'amount','2000');}
  for(const [i,type] of ['split','club','split-minus','club-minus'].entries()){const key=controller.addExtra();controller.updateField(key,'name',`費用${i}`);controller.updateField(key,'amount',i===0?'0':'100');controller.updateField(key,'type',type);}
  const snap=controller.getSnapshot(),{data,state}=domain.settlementInput(store.getSnapshot());
  const draftState={...state,cars:{...state.cars,[target.car.name]:snap.edit.state.cars[target.car.name]}};
  assert.deepEqual(plain(snap.preview),plain(createReference().calculateSettlement(data,domain.settlement.normalizeSettlementState(draftState))));
  if(mode==='zero-and-blank'){assert.equal((await controller.save()).disposition,'invalid');controller.cancel();}
  else assert.equal((await controller.save()).disposition,'local');
  const reloaded=createRoomStore({initial:store.getSnapshot()}),read=reloaded.domain.settlementInput(reloaded.getSnapshot());
  assert.deepEqual(plain(reloaded.domain.settlement.calculateSettlement(read.data,read.state)),plain(createReference().calculateSettlement(read.data,read.state)));
  controller.dispose();
});
