import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsFixture} from './helpers/settlement-operations-fixture.mjs';
import {inspectLocalHistory} from '../src/ui/project-history-model.js';
test('corrupt history is not an empty history',async t=>{const r=await createOperationsFixture();t.after(r.dispose);r.rawStorage.setItem(r.runtime.history.key,'{broken');assert.equal(inspectLocalHistory({history:r.runtime.history,storage:()=>r.rawStorage}).kind,'corrupt');assert.equal(r.rawStorage.getItem(r.runtime.history.key),'{broken');});
test('history access denial differs from genuine empty history',async t=>{const r=await createOperationsFixture();t.after(r.dispose);assert.deepEqual(inspectLocalHistory({history:r.runtime.history,storage:()=>r.rawStorage}).items,[]);assert.equal(inspectLocalHistory({history:r.runtime.history,storage(){throw Error('denied');}}).kind,'unavailable');r.rawStorage.setItem(r.runtime.history.key,'{}');assert.equal(inspectLocalHistory({history:r.runtime.history,storage:()=>r.rawStorage}).kind,'corrupt');});
