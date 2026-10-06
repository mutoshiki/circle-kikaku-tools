import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsFixture} from './helpers/settlement-operations-fixture.mjs';
import {inspectLocalHistory,previewHistoryRestore} from '../src/ui/project-history-model.js';
import {createApplicantSync} from '../src/sync/applicant-sync.js';
import {createProjectDomain} from '../src/services/project-domain.js';

test('form-linked history impact includes existing applicant reconciliation',async t=>{
  const r=await createOperationsFixture();t.after(r.dispose);const previous=globalThis.window;globalThis.window={};t.after(()=>{globalThis.window=previous;});
  const owner=createApplicantSync({store:r.runtime.store});owner.start();t.after(owner.dispose);
  const project=createProjectDomain({getRoom:r.runtime.store.getSnapshot,settlement:r.runtime.store.domain.settlement});
  const item={time:1,data:project.createFormLinkedSampleData()},preview=previewHistoryRestore({room:r.runtime.store.getSnapshot(),item});
  r.runtime.store.command('restore',{value:item.data});
  assert.equal(Object.keys(preview.candidate.allocations.car.groups).length,Object.keys(r.runtime.store.getSnapshot().allocations.car.groups).length);
  assert.deepEqual(Object.values(preview.candidate.participants).map(p=>p.name).sort(),Object.values(r.runtime.store.getSnapshot().participants).map(p=>p.name).sort());
});
test('restore preview uses existing command semantics without touching live state',async t=>{const r=await createOperationsFixture();t.after(r.dispose);const room=r.runtime.store.getSnapshot(),item=r.runtime.history.save(room);r.runtime.store.command('rename',{name:'変更後'});const before=r.runtime.store.getSnapshot(),preview=previewHistoryRestore({room:before,item});assert.equal(preview.available,true);assert.equal(preview.candidate.roomName,room.roomName);assert.equal(preview.candidate.resetGeneration,before.resetGeneration);assert.equal(r.runtime.store.getSnapshot(),before);assert.ok(preview.impact.length);});
test('unknown or broken history snapshots remain un-restorable',async t=>{const r=await createOperationsFixture();t.after(r.dispose);const room=r.runtime.store.getSnapshot();for(const data of [null,{},'invalid',{...room,schemaVersion:999}])assert.equal(previewHistoryRestore({room,item:{time:1,data}}).available,false);});
test('malformed canonical participants are not silently repaired into a restore',async t=>{const r=await createOperationsFixture();t.after(r.dispose);assert.equal(previewHistoryRestore({room:r.runtime.store.getSnapshot(),item:{data:{...r.runtime.store.getSnapshot(),participants:'corrupt'}}}).available,false);});

test('malformed optional history names remain unavailable rather than becoming React children',async t=>{
  const r=await createOperationsFixture();t.after(r.dispose);
  for(const roomName of [{bad:true},['bad'],17,true,null]){
    const item={time:1,data:{roomName,participants:{}}};
    assert.equal(previewHistoryRestore({room:r.runtime.store.getSnapshot(),item}).available,false);
  }
  assert.equal(previewHistoryRestore({room:r.runtime.store.getSnapshot(),item:{time:1,data:{participants:{}}}}).available,true);
});
test('history service read failure cannot be reported as a genuine empty list',()=>{const history={key:'history',read:()=>[]};assert.equal(inspectLocalHistory({history,storage:()=>({getItem:()=>JSON.stringify([{time:1,data:{cars:[]}}])})}).kind,'unavailable');});
test('corrupt history is not an empty history',async t=>{const r=await createOperationsFixture();t.after(r.dispose);r.rawStorage.setItem(r.runtime.history.key,'{broken');assert.equal(inspectLocalHistory({history:r.runtime.history,storage:()=>r.rawStorage}).kind,'corrupt');assert.equal(r.rawStorage.getItem(r.runtime.history.key),'{broken');});
test('history access denial differs from genuine empty history',async t=>{const r=await createOperationsFixture();t.after(r.dispose);assert.deepEqual(inspectLocalHistory({history:r.runtime.history,storage:()=>r.rawStorage}).items,[]);assert.equal(inspectLocalHistory({history:r.runtime.history,storage(){throw Error('denied');}}).kind,'unavailable');r.rawStorage.setItem(r.runtime.history.key,'{}');assert.equal(inspectLocalHistory({history:r.runtime.history,storage:()=>r.rawStorage}).kind,'corrupt');});
