import test from 'node:test';
import assert from 'node:assert/strict';
import { createVehicleCostDraft } from '../src/ui/vehicle-cost-draft.js';
import { createVehicleCostController } from '../src/ui/vehicle-cost-controller.js';
import { vehicleCostTargets } from '../src/ui/vehicle-cost-target.js';
import { createRoomStore } from '../src/store/room-store.js';
import { fixture } from './reference.mjs';
const storage = () => { const values = new Map(); return { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k), values }; };
const runtime = () => ({ store: createRoomStore({ initial: fixture }), sync: { getSnapshot: () => ({ kind: 'local' }), flush: async () => {} }, storage: { read: () => null } });
const cache = (s, key) => createVehicleCostDraft({ storage: () => s, roomId: 'F-DRAFT', carKey: key });

test('two car draft caches are isolated and failed storage preserves live input', () => {
  const s=storage(), a=cache(s,'participant:a'), b=cache(s,'participant:b');
  a.write({ fields: { movement: { dist: '日本語変換中' } } }); b.write({ fields: { movement: { dist: '250' } } });
  a.clear(); assert.equal(a.read(), null); assert.equal(b.read().fields.movement.dist, '250');
  const failed=cache({ getItem(){throw Error('denied');}, setItem(){throw Error('denied');}, removeItem(){throw Error('denied');} }, 'participant:failed');
  assert.equal(failed.write({ fields: { movement: { dist: '80' } } }),false);
  assert.equal(failed.read().fields.movement.dist,'80'); assert.equal(failed.isRecoverable(),false);
});

test('reload overlays only unfinished fields onto current canonical costs', () => {
  const r=runtime(), s=storage(), target=vehicleCostTargets(r.store.getSnapshot(),r.store.domain)[0], c=cache(s,target.key);
  const first=createVehicleCostController({runtime:r,target,cache:c});
  first.updateField('movement','dist','日本語入力'); first.dispose();
  const remote=structuredClone(r.store.getSnapshot()); remote.settlement.carsByParticipantId[target.car.participantId].price='200'; remote.settlement.rounding='10'; r.store.receiveRemote(remote);
  const second=createVehicleCostController({runtime:r,target,cache:c});
  assert.equal(second.getSnapshot().edit.state.cars[target.car.name].dist,'日本語入力');
  assert.equal(second.getSnapshot().edit.state.cars[target.car.name].price,'200');
  const record=c.read(); assert.equal(Object.hasOwn(record,'room'),false); assert.equal(Object.hasOwn(record,'state'),false); assert.equal(Object.hasOwn(record.fields.movement,'price'),false);
  second.cancel(); assert.equal(c.read(),null); assert.equal(r.store.domain.settlementInput(r.store.getSnapshot()).state.cars[target.car.name].price,'200'); second.dispose();
});

test('reset or changed original field holds recovered input without guessing a current write', async () => {
  for (const reset of [false,true]) {
    const r=runtime(), s=storage(), target=vehicleCostTargets(r.store.getSnapshot(),r.store.domain)[0], c=cache(s,target.key);
    const first=createVehicleCostController({runtime:r,target,cache:c}); first.updateField('movement','dist','125');first.dispose();
    const remote=structuredClone(r.store.getSnapshot());
    if(reset) remote.resetGeneration++; else remote.settlement.carsByParticipantId[target.car.participantId].dist='222';
    r.store.receiveRemote(remote);
    const second=createVehicleCostController({runtime:r,target,cache:c});
    assert.equal(second.getSnapshot().unavailable,true);
    assert.equal((await second.save()).disposition,'unavailable'); assert.equal(c.read().fields.movement.dist,'125'); second.dispose();
  }
});

test('extra removal and cancellation affect only one car draft', () => {
  const r=runtime(), s=storage(), targets=vehicleCostTargets(r.store.getSnapshot(),r.store.domain), before=JSON.stringify(r.store.getSnapshot());
  const a=createVehicleCostController({runtime:r,target:targets[0],cache:cache(s,targets[0].key)}), b=createVehicleCostController({runtime:r,target:targets[1],cache:cache(s,targets[1].key)});
  b.updateField('movement','dist','120');const key=a.addExtra();a.updateField(key,'name','入浴');a.updateField(key,'amount','400');a.removeExtra(key);a.cancel();
  assert.equal(JSON.stringify(r.store.getSnapshot()),before);assert.equal(b.getSnapshot().dirty,true);assert.equal(b.getSnapshot().edit.state.cars[targets[1].car.name].dist,'120'); a.dispose();b.dispose();
});

test('unfinished new extra survives refresh before any shared Save', () => {
  const r=runtime(),target=vehicleCostTargets(r.store.getSnapshot(),r.store.domain)[0],c=cache(storage(),target.key);
  const first=createVehicleCostController({runtime:r,target,cache:c}),key=first.addExtra();
  first.updateField(key,'name','入浴');first.updateField(key,'amount','400');first.dispose();
  const restored=createVehicleCostController({runtime:r,target,cache:c});
  assert.equal(restored.getSnapshot().unavailable,false);assert.equal(restored.getSnapshot().fees.find(f=>f.key===key).row.amount,'400');restored.dispose();
});

test('Times selection time fee and movement burden survive pre-save reload', () => {
  const r=runtime(),target=vehicleCostTargets(r.store.getSnapshot(),r.store.domain)[0],c=cache(storage(),target.key);
  const first=createVehicleCostController({runtime:r,target,cache:c}); first.setRentalType('times');
  const time=first.getSnapshot().fees.find(f=>f.kind==='times-time');first.updateField(time.key,'amount','2500');first.setMovementType('club');first.dispose();
  const restored=createVehicleCostController({runtime:r,target,cache:c});
  assert.equal(restored.getSnapshot().unavailable,false);assert.equal(restored.getSnapshot().fees.find(f=>f.kind==='times-time').row.amount,'2500');
  assert.equal(restored.getSnapshot().fees.find(f=>f.kind==='movement').row.type,'club');restored.dispose();
});
