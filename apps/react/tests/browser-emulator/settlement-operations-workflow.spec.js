import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createRoomStore} from '../../src/store/room-store.js';
import {fixture,semanticRoom,createReference,plain} from '../reference.mjs';
import {vehicleCostTargets} from '../../src/ui/vehicle-cost-target.js';
import {navigateToProjectSection} from '../browser/project-navigation.js';

const base='http://127.0.0.1:9008',ns='demo-circle-react-default-rtdb',headers={Authorization:'Bearer owner'};
const urlFor=id=>`${base}/rooms/${id}.json?ns=${ns}`,rulesUrl=`${base}/.settings/rules.json?ns=${ns}`;
const originalRules=JSON.parse(readFileSync(new URL('../../../../firebase/database.rules.json',import.meta.url)));
const domain=createRoomStore().domain;
const complete=page=>page.getByRole('definition').filter({hasText:/^同期完了$/});
const local=(page,id,owner='room')=>page.evaluate(({id,owner})=>JSON.parse(localStorage.getItem(`sanpo-react:v1:${encodeURIComponent(id)}:${owner}`)),{id,owner});
const cacheKey=id=>`sanpo-ui:settlement-operations:v1:${encodeURIComponent(id)}`;
const cached=(page,id)=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)||'null'),cacheKey(id));
const shared=async(request,id)=>domain.migrate(await(await request.get(urlFor(id),{headers})).json());
const idFor=(info,suffix)=>`HOPS${suffix}${info.project.name.startsWith('webkit')?'WK':'CH'}${info.testId.slice(-12)}`;
function data(room){const value=structuredClone(room);delete value.activeAllocationType;delete value.trayMinimized;return value;}
function setup(standalone=false){
  const store=createRoomStore({initial:fixture});
  if(standalone){const state=domain.settlementInput(store.getSnapshot()).state;state.standalone={enabled:true,driverCount:'2',memberCount:'3',driverNames:['名前だけA','名前だけB']};for(const name of state.standalone.driverNames)state.cars[name]={dist:'100',eco:'10',price:'150',extras:[]};store.command('settlement',{state});}
  return store.getSnapshot();
}
async function seed(request,id,room){expect((await request.put(urlFor(id),{headers,data:data(room)})).ok()).toBe(true);}
async function enter(page,id,task='collection',section='settlement'){
  await page.goto(`/?room=${id}&section=${section}${task?`&task=${task}`:''}`);await expect(complete(page)).toBeVisible();
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
}
async function quiescent(page,id){await expect(complete(page)).toBeVisible();await expect.poll(()=>local(page,id,'outbox')).toBeNull();}
async function record(page,name){const box=page.getByRole('checkbox',{name,exact:true});await box.focus();await box.press('Space');}
async function accepted(page,request,id){
  await expect.poll(async()=>(await cached(page,id))?.operation?.receipt?.operationId).toBeTruthy();
  const op=(await cached(page,id)).operation;await quiescent(page,id);
  await expect.poll(async()=>(await shared(request,id)).syncOperations?.[op.receipt.operationId]).toBeTruthy();
  expect((await cached(page,id)).operation.receipt.disposition).toBe('saved');return op;
}
function parity(room){const {data,state}=domain.settlementInput(room);expect(plain(domain.settlement.calculateSettlement(data,state))).toEqual(plain(createReference().calculateSettlement(data,state)));}
function protectedExcept(room,fields){const copy=data(room);for(const key of fields)delete copy.settlement[key];return semanticRoom(copy);}
const moneyFields=['paidByParticipantId','paidByName','paidCollectorByParticipantId','paidCollectorByName','driverPaidByParticipantId','driverPaidByName'];
async function deny(request,id){const rules=structuredClone(originalRules);rules.rules.rooms.$roomId['.write']+=` && $roomId != '${id}'`;expect((await request.put(rulesUrl,{headers,data:rules})).ok()).toBe(true);}
async function restoreRules(request){expect((await request.put(rulesUrl,{headers,data:originalRules})).ok()).toBe(true);expect(await(await request.get(rulesUrl,{headers})).json()).toEqual(originalRules);}
async function heldSocket(page,direction='out'){
  let held=false;const queue=[];
  await page.routeWebSocket(/127\.0\.0\.1:9008\/\.ws/,socket=>{
    const server=socket.connectToServer(),source=direction==='out'?socket:server,destination=direction==='out'?server:socket;
    source.onMessage(message=>{if(held)queue.push(()=>destination.send(message));else destination.send(message);});
  });
  return {hold(){held=true;},count:()=>queue.length,release(){held=false;queue.splice(0).forEach(send=>send());}};
}
async function cleanup(request,id,contexts=[],sockets=[]){
  for(const socket of sockets)socket?.release();
  try{for(const context of contexts)await context.close();}
  finally{await restoreRules(request);expect((await request.delete(urlFor(id),{headers})).ok()).toBe(true);expect(await(await request.get(urlFor(id),{headers})).json()).toBeNull();}
}
async function twoClients(browser,info){const a=await browser.newContext(info.project.use),b=await browser.newContext(info.project.use);return {a,b,pa:await a.newPage(),pb:await b.newPage()};}
async function rename(page,name){await navigateToProjectSection(page,'概要');await page.getByRole('button',{name:'企画情報を編集',exact:true}).click();await page.getByRole('textbox',{name:'企画名',exact:true}).fill(name);await page.getByRole('form',{name:'企画情報を編集'}).getByRole('button',{name:'保存',exact:true}).click();}
async function approveDialog(page,label){const dialog=page.getByRole('dialog'),box=dialog.getByRole('checkbox');await box.focus();await box.press('Space');await dialog.getByRole('button',{name:label,exact:true}).click();await expect(dialog).toHaveCount(0);}

test('concurrent collection and other-car costs survive reload on both clients',async({browser,request},info)=>{
  const id=idFor(info,'COST');await seed(request,id,setup());const {a,b,pa,pb}=await twoClients(browser,info);
  try{
    await enter(pa,id);const before=await shared(request,id),target=vehicleCostTargets(before,domain)[1];
    await pb.goto(`/?room=${id}&section=vehicle-costs&car=${encodeURIComponent(target.key)}&task=expense&expense=movement`);await expect(complete(pb)).toBeVisible();
    await pb.getByRole('textbox',{name:'走行距離（km）',exact:true}).fill('222');
    await record(pa,'仮参加者Cの集金済み');const operation=await accepted(pa,request,id);
    expect(Object.keys(operation.receipt.patch).filter(path=>path.startsWith('settlement/'))).toEqual(['settlement/paidByParticipantId/p_1wuz4uj']);
    await pb.getByRole('button',{name:'車両費用を保存',exact:true}).click();await quiescent(pb,id);
    const after=await shared(request,id);expect(after.participants).toEqual(before.participants);expect(after.allocations).toEqual(before.allocations);
    expect(after.settlement.paidByParticipantId.p_1wuz4uj).toBe(true);expect(after.settlement.carsByParticipantId[target.car.participantId].dist).toBe('222');
    expect(after.settlement.driverPaidByParticipantId).toEqual(before.settlement.driverPaidByParticipantId);parity(after);
    await Promise.all([pa.reload(),pb.reload()]);await Promise.all([quiescent(pa,id),quiescent(pb,id)]);
    for(const page of [pa,pb])expect(semanticRoom(await local(page,id))).toEqual(semanticRoom(after));
  }finally{await cleanup(request,id,[a,b]);}
});

test('separate-row recording and same-row correction never reverse another participant',async({browser,request},info)=>{
  const id=idFor(info,'ROWS');await seed(request,id,setup());const {a,b,pa,pb}=await twoClients(browser,info);
  try{
    await Promise.all([enter(pa,id),enter(pb,id)]);const before=await shared(request,id);
    await record(pa,'仮参加者Cの集金済み');await accepted(pa,request,id);
    await record(pb,'仮参加者Eの集金済み');await accepted(pb,request,id);
    await pb.getByRole('tab',{name:'すべて',exact:true}).click();await expect(pb.getByRole('checkbox',{name:'仮参加者Cの集金済み',exact:true})).toBeChecked();
    await record(pb,'仮参加者Cの集金済み');await accepted(pb,request,id);
    const after=await shared(request,id);expect(after.settlement.paidByParticipantId.p_1wuz4uj).toBe(false);expect(after.settlement.paidByParticipantId.p_1yiwr0d).toBe(true);
    expect(protectedExcept(after,moneyFields)).toEqual(protectedExcept(before,moneyFields));parity(after);
    await pa.reload();await quiescent(pa,id);expect(semanticRoom(await local(pa,id))).toEqual(semanticRoom(after));
    await expect(pa.getByRole('status').filter({hasText:'記録が更新されています'})).toBeVisible();
  }finally{await cleanup(request,id,[a,b]);}
});

test('vehicle payment survives parallel rules and memo-only publication',async({browser,request},info)=>{
  const id=idFor(info,'PAY');await seed(request,id,setup());const {a,b,pa,pb}=await twoClients(browser,info);
  try{
    await enter(pa,id,'payments');await enter(pb,id,'rules');const before=await shared(request,id);
    await pb.getByRole('textbox',{name:'1台あたりの協力代（円）',exact:true}).fill('900');
    await record(pa,'仮参加者D車の支払い済み');await accepted(pa,request,id);
    await pb.getByRole('button',{name:'精算ルールを保存',exact:true}).click();await quiescent(pb,id);
    await enter(pa,id,'');await pa.getByRole('button',{name:'精算メモを編集',exact:true}).click();await pa.getByRole('textbox',{name:'精算メモ',exact:true}).fill('集金後の連絡');
    await pa.getByRole('button',{name:'メモを保存',exact:true}).click();await accepted(pa,request,id);
    const after=await shared(request,id);expect(after.settlement.driverPaidByParticipantId.p_1y8x5be).toBe(true);expect(after.settlement.driverReward).toBe('900');expect(after.settlement.memo).toBe('集金後の連絡');
    expect(protectedExcept(after,[...moneyFields,'driverReward','memo'])).toEqual(protectedExcept(before,[...moneyFields,'driverReward','memo']));parity(after);
    await Promise.all([pa.reload(),pb.reload()]);await Promise.all([quiescent(pa,id),quiescent(pb,id)]);
    for(const page of [pa,pb])expect(semanticRoom(await local(page,id))).toEqual(semanticRoom(after));
  }finally{await cleanup(request,id,[a,b]);}
});

test('standalone changed slot population retains raw draft but cannot publish it',async({browser,request},info)=>{
  const id=idFor(info,'SLOT');await seed(request,id,setup(true));const {a,b,pa,pb}=await twoClients(browser,info);
  try{
    await enter(pa,id);const box=pa.getByRole('checkbox').first();await box.focus();await box.press('Space');const input=pa.getByRole('textbox',{name:'集金した人',exact:true});await input.fill('  入力中の名前  ');
    await enter(pb,id,'rules');await pb.getByRole('textbox',{name:'同乗者の人数',exact:true}).fill('4');await pb.getByRole('button',{name:'精算ルールを保存',exact:true}).click();await quiescent(pb,id);
    await expect(pa.getByRole('button',{name:'記録',exact:true})).toBeDisabled();await expect(input).toHaveValue('  入力中の名前  ');
    const before=await shared(request,id);await pa.reload();await expect(input).toHaveValue('  入力中の名前  ');await expect(pa.getByRole('button',{name:'記録',exact:true})).toBeDisabled();
    expect(semanticRoom(await shared(request,id))).toEqual(semanticRoom(before));expect((await cached(pa,id)).collectorDraft.raw).toBe('  入力中の名前  ');
    await pa.getByRole('button',{name:'キャンセル',exact:true}).click();await enter(pb,id,'rules');await pb.getByText('登録した参加者で精算',{exact:true}).click();await pb.getByRole('button',{name:'精算ルールを保存',exact:true}).click();await quiescent(pb,id);
    expect(domain.settlementInput(await shared(request,id)).state.standalone.enabled).toBe(false);
  }finally{await cleanup(request,id,[a,b]);}
});

test('accepted standalone recording clears the draft after navigating away without stealing focus',async({browser,request},info)=>{
  const id=idFor(info,'SLOTNAV');await seed(request,id,setup(true));const a=await browser.newContext(info.project.use),pa=await a.newPage(),socket=await heldSocket(pa,'in');
  try{
    await enter(pa,id);const box=pa.getByRole('checkbox').first();await box.focus();await box.press('Space');
    const input=pa.getByRole('textbox',{name:'集金した人',exact:true});await input.fill('  担当  ');socket.hold();await input.press('Enter');
    await expect.poll(()=>socket.count()).toBeGreaterThan(0);await navigateToProjectSection(pa,'概要');
    const title=pa.getByRole('heading',{level:1,name:'概要',exact:true});await expect(title).toBeFocused();socket.release();await accepted(pa,request,id);await expect(title).toBeFocused();
    expect((await cached(pa,id)).collectorDraft).toBeNull();await enter(pa,id);await expect(input).toHaveCount(0);await expect(pa.getByRole('checkbox').first()).toBeEnabled();
    await pa.reload();await expect(input).toHaveCount(0);await expect(pa.getByRole('checkbox').first()).toBeEnabled();parity(await shared(request,id));
  }finally{await cleanup(request,id,[a],[socket]);}
});

test('failed standalone recording keeps raw input through refresh then exact retry clears it',async({browser,request},info)=>{
  const id=idFor(info,'SLOTRETRY');await seed(request,id,setup(true));const a=await browser.newContext(info.project.use),pa=await a.newPage();
  try{
    await enter(pa,id);const before=await shared(request,id),box=pa.getByRole('checkbox').first();await box.focus();await box.press('Space');
    const input=pa.getByRole('textbox',{name:'集金した人',exact:true});await input.fill('  担当  ');await deny(request,id);await input.press('Enter');
    await expect(pa.getByRole('button',{name:'同じ内容を再試行',exact:true})).toBeVisible();const failed=await cached(pa,id);expect(failed.collectorDraft.raw).toBe('  担当  ');
    await pa.reload();await expect(input).toHaveValue('  担当  ');await restoreRules(request);await pa.getByRole('button',{name:'同じ内容を再試行',exact:true}).click();const op=await accepted(pa,request,id);
    expect(op.receipt.patch).toEqual(failed.operation.receipt.patch);expect((await cached(pa,id)).collectorDraft).toBeNull();await expect(input).toHaveCount(0);await expect(pa.getByRole('checkbox').first()).toBeEnabled();
    const after=await shared(request,id);expect(protectedExcept(after,moneyFields)).toEqual(protectedExcept(before,moneyFields));parity(after);
  }finally{await cleanup(request,id,[a]);}
});

test('rejected monetary receipt retries its exact patch after refresh',async({browser,request},info)=>{
  const id=idFor(info,'RETRY');await seed(request,id,setup());const context=await browser.newContext(info.project.use),page=await context.newPage(),socket=await heldSocket(page);
  try{
    await enter(page,id,'payments');const before=await shared(request,id);await deny(request,id);socket.hold();await record(page,'仮参加者D車の支払い済み');
    await expect.poll(socket.count).toBeGreaterThan(0);const original=(await cached(page,id)).operation.receipt;
    await expect(page.getByRole('checkbox',{name:'仮参加者D車の支払い済み',exact:true})).toBeDisabled();socket.release();
    await expect.poll(async()=>(await cached(page,id)).operation.receipt.canRetry).toBe(true);await page.reload();
    await expect(page.getByRole('button',{name:'同じ内容を再試行',exact:true})).toBeEnabled();expect((await cached(page,id)).operation.receipt.patch).toEqual(original.patch);
    expect(semanticRoom(await shared(request,id))).toEqual(semanticRoom(before));await restoreRules(request);
    await page.getByRole('button',{name:'同じ内容を再試行',exact:true}).click();const operation=await accepted(page,request,id);expect(operation.receipt.patch).toEqual(original.patch);
    const after=await shared(request,id);expect(after.settlement.driverPaidByParticipantId.p_1y8x5be).toBe(true);expect(protectedExcept(after,moneyFields)).toEqual(protectedExcept(before,moneyFields));
  }finally{await cleanup(request,id,[context],[socket]);}
});

test('unknown replaced outbox does not permit reverse write',async({browser,request},info)=>{
  const id=idFor(info,'UNKNOWN');await seed(request,id,setup());const {a,b,pa,pb}=await twoClients(browser,info),socket=await heldSocket(pa);
  try{
    await enter(pa,id);await deny(request,id);socket.hold();await record(pa,'仮参加者Cの集金済み');await expect.poll(socket.count).toBeGreaterThan(0);
    const outbox=await local(pa,id,'outbox');socket.release();await expect.poll(async()=>(await cached(pa,id)).operation.receipt.canRetry).toBe(true);
    const recovery=await cached(pa,id);recovery.operation.receipt.canRetry=false;recovery.operation.receipt.disposition='unresolved';
    await pa.evaluate(({id,key,recovery})=>{localStorage.removeItem(`sanpo-react:v1:${id}:outbox`);sessionStorage.setItem(key,JSON.stringify(recovery));},{id,key:cacheKey(id),recovery});await restoreRules(request);await pa.reload();await quiescent(pa,id);
    await rename(pa,'別操作の受理');await quiescent(pa,id);await enter(pa,id);await pa.getByRole('tab',{name:'すべて',exact:true}).click();
    const box=pa.getByRole('checkbox',{name:'仮参加者Cの集金済み',exact:true});await expect(box).toBeDisabled();await expect(pa.getByRole('status').filter({hasText:'保存結果を確認できません'})).toBeVisible();
    const before=await shared(request,id);expect(before.syncOperations?.[outbox.id]).toBeUndefined();await box.dispatchEvent('change');expect(semanticRoom(await shared(request,id))).toEqual(semanticRoom(before));
    // Recover the actual protected outbox through another real SDK client;
    // do not inject a fabricated server acceptance marker.
    await pb.addInitScript(({id,outbox})=>{localStorage.setItem(`sanpo-react:v1:${id}:room`,JSON.stringify(outbox.snapshot));localStorage.setItem(`sanpo-react:v1:${id}:base`,JSON.stringify(outbox.baseSnapshot));localStorage.setItem(`sanpo-react:v1:${id}:outbox`,JSON.stringify(outbox));},{id,outbox});
    await enter(pb,id);await quiescent(pb,id);await expect.poll(async()=>(await shared(request,id)).syncOperations?.[outbox.id]).toBeTruthy();
    await expect(box).toBeEnabled();await expect(box).toBeChecked();await record(pa,'仮参加者Cの集金済み');await accepted(pa,request,id);
    expect((await shared(request,id)).settlement.paidByParticipantId.p_1wuz4uj).toBe(false);expect((await shared(request,id)).roomName).toBe('別操作の受理');
  }finally{await cleanup(request,id,[a,b],[socket]);}
});

test('memo conflict preserves input through refresh and rebases without reverting paid state',async({browser,request},info)=>{
  const id=idFor(info,'MEMO');await seed(request,id,setup());const {a,b,pa,pb}=await twoClients(browser,info);
  try{
    await Promise.all([enter(pa,id,''),enter(pb,id,'')]);for(const page of [pa,pb])await page.getByRole('button',{name:'精算メモを編集',exact:true}).click();
    await pa.getByRole('textbox',{name:'精算メモ',exact:true}).fill('  控え\n ');await pb.getByRole('textbox',{name:'精算メモ',exact:true}).fill('別端末のメモ');await pb.getByRole('button',{name:'メモを保存',exact:true}).click();await accepted(pb,request,id);
    await expect(pa.getByRole('textbox',{name:'精算メモ',exact:true})).toHaveAttribute('aria-invalid','true');const before=await shared(request,id);
    await pa.getByRole('button',{name:'メモを保存',exact:true}).click();expect(semanticRoom(await shared(request,id))).toEqual(semanticRoom(before));await pa.reload();await expect(pa.getByRole('textbox',{name:'精算メモ',exact:true})).toHaveValue('  控え\n ');
    await enter(pb,id);await record(pb,'仮参加者Cの集金済み');await accepted(pb,request,id);
    await pa.getByRole('button',{name:'控えを残して現在のメモから編集し直す',exact:true}).click();await pa.getByRole('button',{name:'メモを保存',exact:true}).click();await accepted(pa,request,id);
    const after=await shared(request,id);expect(after.settlement.memo).toBe('  控え\n ');expect(after.settlement.paidByParticipantId.p_1wuz4uj).toBe(true);parity(after);
  }finally{await cleanup(request,id,[a,b]);}
});

test('shared sample deep link never writes',async({browser,request},info)=>{
  const id=idFor(info,'SAMPLE'),store=createRoomStore({initial:setup()});store.command('syncApplicantDetails');await seed(request,id,store.getSnapshot());const context=await browser.newContext(info.project.use),page=await context.newPage();
  try{
    const before=await shared(request,id);await enter(page,id,'sample','history-settings');await expect(page).not.toHaveURL(/task=sample/);await expect(page.getByRole('heading',{name:'履歴',level:1,exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'サンプルデータ',exact:true})).toHaveCount(0);await page.reload();await quiescent(page,id);
    expect(await shared(request,id)).toEqual(before);expect(await local(page,id,'outbox')).toBeNull();expect((await cached(page,id))?.operation??null).toBeNull();
  }finally{await cleanup(request,id,[context]);}
});

test('foreign cost outbox blocks payment and late acceptance does not steal navigation focus',async({browser,request},info)=>{
  const id=idFor(info,'FOREIGN');await seed(request,id,setup());const context=await browser.newContext(info.project.use),page=await context.newPage(),socket=await heldSocket(page);
  try{
    await enter(page,id,'payments');const before=await shared(request,id),target=vehicleCostTargets(before,domain)[1];
    await page.goto(`/?room=${id}&section=vehicle-costs&car=${encodeURIComponent(target.key)}&task=expense&expense=movement`);await expect(complete(page)).toBeVisible();
    await page.getByRole('textbox',{name:'走行距離（km）',exact:true}).fill('333');socket.hold();await page.getByRole('button',{name:'車両費用を保存',exact:true}).click();await expect.poll(socket.count).toBeGreaterThan(0);
    const foreign=await local(page,id,'outbox');await navigateToProjectSection(page,'精算');await page.getByRole('link',{name:'支払いを確認',exact:true}).click();
    const box=page.getByRole('checkbox',{name:'仮参加者D車の支払い済み',exact:true}),heading=page.getByRole('heading',{name:'支払い',level:1,exact:true});
    await expect(box).toBeDisabled();expect((await cached(page,id))?.operation??null).toBeNull();expect((await local(page,id,'outbox')).id).toBe(foreign.id);
    expect(semanticRoom(await shared(request,id))).toEqual(semanticRoom(before));await expect(heading).toBeFocused();socket.release();await quiescent(page,id);await expect(heading).toBeFocused();await expect(box).toBeEnabled();
    await expect.poll(async()=>(await shared(request,id)).syncOperations?.[foreign.id]).toBeTruthy();await record(page,'仮参加者D車の支払い済み');await accepted(page,request,id);
    const after=await shared(request,id);expect(after.settlement.carsByParticipantId[target.car.participantId].dist).toBe('333');expect(after.settlement.driverPaidByParticipantId.p_1y8x5be).toBe(true);parity(after);
  }finally{await cleanup(request,id,[context],[socket]);}
});

test('expired real outbox remains a failed record and retries only its original paths',async({browser,request},info)=>{
  const id=idFor(info,'EXPIRED');await seed(request,id,setup());const context=await browser.newContext(info.project.use),page=await context.newPage(),socket=await heldSocket(page);
  try{
    await enter(page,id);const before=await shared(request,id);await deny(request,id);socket.hold();await record(page,'仮参加者Cの集金済み');await expect.poll(socket.count).toBeGreaterThan(0);
    const originalOutbox=await local(page,id,'outbox');socket.release();await expect.poll(async()=>(await cached(page,id)).operation.receipt.canRetry).toBe(true);await restoreRules(request);
    const recovery=await cached(page,id),originalPatch=recovery.operation.receipt.patch;
    originalOutbox.createdAt=Date.now()-25*60*60*1000;recovery.operation.receipt.disposition='pending';recovery.operation.receipt.canRetry=false;recovery.operation.receipt.diagnosticCount=0;
    await page.evaluate(({id,key,outbox,recovery})=>{localStorage.setItem(`sanpo-react:v1:${id}:outbox`,JSON.stringify(outbox));sessionStorage.setItem(key,JSON.stringify(recovery));},{id,key:cacheKey(id),outbox:originalOutbox,recovery});await page.reload();
    await expect(page.getByRole('button',{name:'同じ内容を再試行',exact:true})).toBeEnabled();await expect.poll(()=>local(page,id,'outbox')).toBeNull();expect(semanticRoom(await shared(request,id))).toEqual(semanticRoom(before));
    await page.getByRole('button',{name:'同じ内容を再試行',exact:true}).click();const operation=await accepted(page,request,id);expect(operation.receipt.patch).toEqual(originalPatch);expect(operation.receipt.operationId).not.toBe(originalOutbox.id);
    const after=await shared(request,id);expect(after.syncOperations?.[originalOutbox.id]).toBeUndefined();expect(after.settlement.paidByParticipantId.p_1wuz4uj).toBe(true);expect(protectedExcept(after,moneyFields)).toEqual(protectedExcept(before,moneyFields));
  }finally{await cleanup(request,id,[context],[socket]);}
});

test('reset fences held payment while accepted ID-backed payment follows rename and deletion',async({browser,request},info)=>{
  const id=idFor(info,'RESET');await seed(request,id,setup());const context=await browser.newContext(info.project.use),page=await context.newPage(),socket=await heldSocket(page);
  try{
    await enter(page,id,'payments');const before=await shared(request,id);socket.hold();await record(page,'仮参加者D車の支払い済み');await expect.poll(socket.count).toBeGreaterThan(0);
    const reset=structuredClone(before);reset.resetGeneration++;await seed(request,id,reset);socket.release();await expect(page.getByRole('status').filter({hasText:'企画がリセットされました'})).toBeVisible();
    expect((await shared(request,id)).settlement.driverPaidByParticipantId.p_1y8x5be).toBe(before.settlement.driverPaidByParticipantId.p_1y8x5be);await page.getByRole('button',{name:'現在の内容を確認',exact:true}).click();await quiescent(page,id);
    await record(page,'仮参加者D車の支払い済み');await accepted(page,request,id);await page.getByRole('tab',{name:'すべて',exact:true}).click();
    const renamed=createRoomStore({initial:await shared(request,id)});renamed.command('editParticipant',{id:'p_1y8x5be',changes:{name:'改名した運転手'}});await seed(request,id,renamed.getSnapshot());
    await expect(page.getByRole('checkbox',{name:'改名した運転手車の支払い済み',exact:true})).toBeChecked();expect((await shared(request,id)).settlement.driverPaidByParticipantId.p_1y8x5be).toBe(true);
    const deleted=createRoomStore({initial:await shared(request,id)});deleted.command('deleteParticipant',{id:'p_1y8x5be'});await seed(request,id,deleted.getSnapshot());await expect(page.getByRole('checkbox',{name:'改名した運転手車の支払い済み',exact:true})).toHaveCount(0);
    await page.reload();await quiescent(page,id);expect(semanticRoom(await shared(request,id))).toEqual(semanticRoom(deleted.getSnapshot()));parity(await shared(request,id));
  }finally{await cleanup(request,id,[context],[socket]);}
});

test('restore confirmation detects foreign costs and acceptance with a new participant cannot enable undo',async({browser,request},info)=>{
  const id=idFor(info,'RESTORE');await seed(request,id,setup());const {a,b,pa,pb}=await twoClients(browser,info),socket=await heldSocket(pa);
  try{
    await enter(pa,id,'','history-settings');await pa.getByRole('button',{name:'現在の状態を保存',exact:true}).click();
    await enter(pb,id,'');await rename(pb,'復元前の変更');await quiescent(pb,id);await expect.poll(async()=>(await local(pa,id)).roomName).toBe('復元前の変更');
    await pa.getByRole('button',{name:'この状態を復元',exact:true}).first().click();
    const target=vehicleCostTargets(await shared(request,id),domain)[1];await pb.goto(`/?room=${id}&section=vehicle-costs&car=${encodeURIComponent(target.key)}&task=expense&expense=movement`);await expect(complete(pb)).toBeVisible();
    await pb.getByRole('textbox',{name:'走行距離（km）',exact:true}).fill('444');await pb.getByRole('button',{name:'車両費用を保存',exact:true}).click();await quiescent(pb,id);
    await expect(pa.getByRole('dialog').getByRole('button',{name:'この状態を復元',exact:true})).toBeDisabled();await expect(pa.getByRole('dialog').getByRole('alert')).toBeVisible();await pa.getByRole('dialog').press('Escape');
    await pa.getByRole('button',{name:'この状態を復元',exact:true}).first().click();socket.hold();await approveDialog(pa,'この状態を復元');await expect.poll(socket.count).toBeGreaterThan(0);
    const compact=(await cached(pa,id)).operation;expect(Object.keys(compact).every(key=>['kind','targetKey','resetGeneration','operationId','historyTime','disposition','acknowledged'].includes(key))).toBe(true);
    expect(compact.operationId).toBeTruthy();const remote=createRoomStore({initial:await shared(request,id)});remote.command('addParticipants',{people:[{name:'復元中に追加した人',grade:1}]});await seed(request,id,remote.getSnapshot());socket.release();await quiescent(pa,id);
    await expect.poll(async()=>(await shared(request,id)).syncOperations?.[compact.operationId]).toBeTruthy();expect(Object.values((await shared(request,id)).participants).some(person=>person.name==='復元中に追加した人')).toBe(true);
    await expect(pa.getByRole('button',{name:'復元を取り消す',exact:true})).toHaveCount(0);await pa.reload();await expect(pa.getByRole('button',{name:'復元を取り消す',exact:true})).toHaveCount(0);
    await expect(pa.getByRole('button',{name:'現在の内容を確認',exact:true})).toBeVisible();await pa.getByRole('button',{name:'現在の内容を確認',exact:true}).click();parity(await shared(request,id));
  }finally{await cleanup(request,id,[a,b],[socket]);}
});

test('same-runtime shared restore undo succeeds but later cost changes and refresh fence it',async({browser,request},info)=>{
  const id=idFor(info,'UNDO');await seed(request,id,setup());const {a,b,pa,pb}=await twoClients(browser,info);
  try{
    await enter(pa,id,'','history-settings');await pa.getByRole('button',{name:'現在の状態を保存',exact:true}).click();const savedName=(await shared(request,id)).roomName;
    await enter(pb,id,'');await rename(pb,'取り消し対象');await quiescent(pb,id);await expect.poll(async()=>(await local(pa,id)).roomName).toBe('取り消し対象');
    await pa.getByRole('button',{name:'この状態を復元',exact:true}).first().click();await approveDialog(pa,'この状態を復元');await quiescent(pa,id);
    await pa.getByRole('button',{name:'復元を取り消す',exact:true}).click();await approveDialog(pa,'復元を取り消す');await quiescent(pa,id);expect((await shared(request,id)).roomName).toBe('取り消し対象');
    await pa.getByRole('button',{name:'この状態を復元',exact:true}).first().click();await approveDialog(pa,'この状態を復元');await quiescent(pa,id);expect((await shared(request,id)).roomName).toBe(savedName);
    await pa.getByRole('button',{name:'復元を取り消す',exact:true}).click();const target=vehicleCostTargets(await shared(request,id),domain)[1];
    await pb.goto(`/?room=${id}&section=vehicle-costs&car=${encodeURIComponent(target.key)}&task=expense&expense=movement`);await expect(complete(pb)).toBeVisible();await pb.getByRole('textbox',{name:'走行距離（km）',exact:true}).fill('555');await pb.getByRole('button',{name:'車両費用を保存',exact:true}).click();await quiescent(pb,id);
    await expect(pa.getByRole('dialog').getByRole('button',{name:'復元を取り消す',exact:true})).toBeDisabled();await pa.getByRole('dialog').press('Escape');await expect(pa.getByRole('button',{name:'復元を取り消す',exact:true})).toHaveCount(0);
    await pa.reload();await expect(pa.getByRole('button',{name:'復元を取り消す',exact:true})).toHaveCount(0);expect((await shared(request,id)).settlement.carsByParticipantId[target.car.participantId].dist).toBe('555');parity(await shared(request,id));
  }finally{await cleanup(request,id,[a,b]);}
});

test('held acknowledgement resumes after reload with the same accepted operation',async({browser,request},info)=>{
  const id=idFor(info,'ACK');await seed(request,id,setup());const context=await browser.newContext(info.project.use),page=await context.newPage(),socket=await heldSocket(page,'in');
  try{
    await enter(page,id);const before=await shared(request,id);socket.hold();await record(page,'仮参加者Cの集金済み');await expect.poll(socket.count).toBeGreaterThan(0);
    const original=(await cached(page,id)).operation.receipt;await expect.poll(async()=>(await shared(request,id)).syncOperations?.[original.operationId]).toBeTruthy();
    await page.reload();socket.release();await quiescent(page,id);await expect.poll(async()=>(await cached(page,id)).operation.receipt.disposition).toBe('saved');
    const recovered=(await cached(page,id)).operation.receipt;expect(recovered.operationId).toBe(original.operationId);expect(recovered.patch).toEqual(original.patch);
    const after=await shared(request,id);expect(Object.keys(after.syncOperations).length).toBe(Object.keys(before.syncOperations||{}).length+1);expect(after.settlement.paidByParticipantId.p_1wuz4uj).toBe(true);expect(protectedExcept(after,moneyFields)).toEqual(protectedExcept(before,moneyFields));
    await page.getByRole('tab',{name:'すべて',exact:true}).click();await expect(page.getByRole('checkbox',{name:'仮参加者Cの集金済み',exact:true})).toBeEnabled();
  }finally{await cleanup(request,id,[context],[socket]);}
});

test('rejected undo consumes its backup and retry sends the exact captured patch once',async({browser,request},info)=>{
  const id=idFor(info,'UNDORETRY');await seed(request,id,setup());const {a,b,pa,pb}=await twoClients(browser,info),socket=await heldSocket(pa);
  try{
    await enter(pa,id,'','history-settings');await pa.getByRole('button',{name:'現在の状態を保存',exact:true}).click();await enter(pb,id,'');await rename(pb,'Undoで戻す企画名');await quiescent(pb,id);await expect.poll(async()=>(await local(pa,id)).roomName).toBe('Undoで戻す企画名');
    await pa.getByRole('button',{name:'この状態を復元',exact:true}).first().click();await approveDialog(pa,'この状態を復元');await quiescent(pa,id);const restored=await shared(request,id);
    await pa.getByRole('button',{name:'復元を取り消す',exact:true}).click();await deny(request,id);socket.hold();await approveDialog(pa,'復元を取り消す');await expect.poll(socket.count).toBeGreaterThan(0);const original=await local(pa,id,'outbox');
    const compact=(await cached(pa,id)).operation;expect(compact.kind).toBe('undo');expect(compact.receipt).toBeUndefined();expect(compact.patch).toBeUndefined();socket.release();
    await expect(pa.getByRole('button',{name:'同じ内容を再試行',exact:true})).toBeEnabled();await expect(pa.getByRole('button',{name:'復元を取り消す',exact:true})).toHaveCount(0);expect(semanticRoom(await shared(request,id))).toEqual(semanticRoom(restored));
    await restoreRules(request);await pa.getByRole('button',{name:'同じ内容を再試行',exact:true}).click();await quiescent(pa,id);const after=await shared(request,id);
    expect(after.roomName).toBe('Undoで戻す企画名');expect(after.participants).toEqual(restored.participants);expect(after.allocations).toEqual(restored.allocations);expect(after.settlement).toEqual(restored.settlement);
    const operation=(await cached(pa,id)).operation;expect(after.syncOperations[operation.operationId]).toBeTruthy();expect(operation.operationId).not.toBe(original.id);expect(after.syncOperations?.[original.id]).toBeUndefined();await expect(pa.getByRole('button',{name:'復元を取り消す',exact:true})).toHaveCount(0);parity(after);
  }finally{await cleanup(request,id,[a,b],[socket]);}
});
