import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRoomStore } from '../../src/store/room-store.js';
import { fixture, semanticRoom } from '../reference.mjs';
import { vehicleCostTargets } from '../../src/ui/vehicle-cost-target.js';
import { editFee, costNav } from '../browser/vehicle-cost-fixture.js';

const base='http://127.0.0.1:9008', ns='demo-circle-react-default-rtdb';
const headers={Authorization:'Bearer owner'};
const urlFor=id=>`${base}/rooms/${id}.json?ns=${ns}`;
const rulesUrl=`${base}/.settings/rules.json?ns=${ns}`;
const originalRules=JSON.parse(readFileSync(new URL('../../../../firebase/database.rules.json',import.meta.url)));
const domain=createRoomStore().domain;
const complete=page=>page.getByRole('definition').filter({hasText:/^同期完了$/});
const local=(page,id)=>page.evaluate(id=>JSON.parse(localStorage.getItem(`sanpo-react:v1:${id}:room`)),id);
const cacheKey=(id,key)=>`sanpo-ui:vehicle-cost:v1:${encodeURIComponent(id)}:${encodeURIComponent(key)}`;
const cached=(page,id,key)=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)||'null'),cacheKey(id,key));
const shared=async(request,id)=>domain.migrate(await(await request.get(urlFor(id),{headers})).json());
function data(room){const copy=structuredClone(room);delete copy.activeAllocationType;delete copy.trayMinimized;return copy;}
function setup(standalone=false){
  const store=createRoomStore({initial:fixture});
  if(standalone){
    const state=store.domain.settlementInput(store.getSnapshot()).state;
    state.standalone={enabled:true,driverCount:'2',memberCount:'3',driverNames:['名前だけA','名前だけB']};
    for(const name of state.standalone.driverNames)state.cars[name]={dist:'100',eco:'10',price:'150',extras:[]};
    store.command('settlement',{state});
  }
  return {initial:store.getSnapshot(),targets:vehicleCostTargets(store.getSnapshot(),store.domain)};
}
async function seed(request,id,initial){expect((await request.put(urlFor(id),{headers,data:data(initial)})).ok()).toBe(true);}
async function enter(page,id,key,task='expense'){
  page.on('pageerror',error=>{throw error;});
  page.on('console',message=>{if(['error','warning'].includes(message.type()))console.log('Vehicle cost browser:',message.text());});
  await page.goto(`/?room=${id}&section=vehicle-costs&car=${encodeURIComponent(key)}${task?'&task=expense&expense=movement':''}`);
  await expect(complete(page)).toBeVisible();
  if(task)await expect(page.getByRole('textbox',{name:'走行距離（km）',exact:true})).toBeVisible();
}
async function deny(request,id){const rules=structuredClone(originalRules);rules.rules.rooms.$roomId['.write']+=` && $roomId != '${id}'`;expect((await request.put(rulesUrl,{headers,data:rules})).ok()).toBe(true);}
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
  try{
    for(const context of contexts)for(const page of context.pages())await page.close();
    for(const context of contexts)await context.close();
  }finally{
    expect((await request.put(rulesUrl,{headers,data:originalRules})).ok()).toBe(true);
    expect(await(await request.get(rulesUrl,{headers})).json()).toEqual(originalRules);
    expect((await request.delete(urlFor(id),{headers})).ok()).toBe(true);
    expect(await(await request.get(urlFor(id),{headers})).json()).toBeNull();
  }
}
const distance=page=>page.getByRole('textbox',{name:'走行距離（km）',exact:true});
const save=page=>page.getByRole('button',{name:'車両費用を保存',exact:true});
const paidFields=['paidByParticipantId','paidByName','paidCollectorByParticipantId','paidCollectorByName','driverPaidByParticipantId','driverPaidByName'];

for(const standalone of [false,true])test(`${standalone?'name-backed':'ID-backed'} parallel drivers preserve each car and remote rules/payment`,async({browser,request},info)=>{
  const id=`FCOSTPAR${standalone?'NAME':'ID'}${info.project.name.startsWith('webkit')?'WK':'CH'}`;
  const {initial,targets}=setup(standalone);
  await seed(request,id,initial);
  const a=await browser.newContext(info.project.use),b=await browser.newContext(info.project.use),sockets=[];
  try{
    const pa=await a.newPage(),pb=await b.newPage();
    sockets.push(await heldSocket(pa),await heldSocket(pb));
    await Promise.all([enter(pa,id,targets[0].key),enter(pb,id,targets[1].key)]);
    const before=await shared(request,id);
    await distance(pa).fill('200');await distance(pb).fill('77');
    const updated=structuredClone(before);updated.settlement.rounding='10';updated.settlement.paidByParticipantId.p_1wkzj5k=false;
    await seed(request,id,updated);
    await expect.poll(async()=> (await local(pa,id)).settlement.rounding).toBe('10');
    await expect.poll(async()=> (await local(pb,id)).settlement.rounding).toBe('10');
    sockets.forEach(s=>s.hold());await save(pa).click();await save(pb).click();
    await expect.poll(sockets[0].count).toBeGreaterThan(0);await expect.poll(sockets[1].count).toBeGreaterThan(0);
    sockets[0].release();await expect(complete(pa)).toBeVisible();sockets[1].release();await expect(complete(pb)).toBeVisible();
    await expect(pa.getByRole('heading',{level:1,name:'車両費用',exact:true})).toBeVisible();
    await expect(pb.getByRole('heading',{level:1,name:'車両費用',exact:true})).toBeVisible();
    const result=await shared(request,id),projection=domain.settlementInput(result).state;
    expect(projection.cars[targets[0].car.name].dist).toBe('200');expect(projection.cars[targets[1].car.name].dist).toBe('77');
    expect(result.settlement.rounding).toBe('10');
    for(const key of paidFields)expect(result.settlement[key]).toEqual(updated.settlement[key]);
    for(const key of ['participants','allocations','meta','resetGeneration'])expect(semanticRoom(result[key])).toEqual(semanticRoom(before[key]));
    if(standalone){expect(result.settlement.standalone).toEqual(before.settlement.standalone);expect(result.settlement.carsByParticipantId).toEqual(before.settlement.carsByParticipantId);}
    expect(await cached(pa,id,targets[0].key)).toBeNull();expect(await cached(pb,id,targets[1].key)).toBeNull();
  }finally{await cleanup(request,id,[a,b],sockets);}
});

test('same-car distinct fields/extras merge; same-field later intent follows existing owner',async({browser,request},info)=>{
  const id=`FCOSTMERGE${info.project.name.startsWith('webkit')?'WK':'CH'}`,{initial,targets}=setup(),target=targets[0];
  await seed(request,id,initial);const a=await browser.newContext(info.project.use),b=await browser.newContext(info.project.use);
  try{
    const pa=await a.newPage(),pb=await b.newPage();await Promise.all([enter(pa,id,target.key),enter(pb,id,target.key)]);
    const before=await shared(request,id);
    await distance(pa).fill('300');await editFee(pb,'高速代');await pb.getByRole('textbox',{name:'金額（円）',exact:true}).fill('2500');
    await save(pa).click();await expect(pa.getByRole('heading',{level:1,name:'車両費用',exact:true})).toBeVisible();
    await expect.poll(async()=> (await local(pb,id)).settlement.carsByParticipantId[target.car.participantId].dist).toBe('300');
    await save(pb).click();await expect(pb.getByRole('status').filter({hasText:'同時編集により内容が変わりました'})).toBeVisible();
    await pb.getByRole('button',{name:'現在の費用を確認',exact:true}).click();
    await expect(pb.getByRole('heading',{level:1,name:'車両費用',exact:true})).toBeVisible();
    let result=await shared(request,id),car=result.settlement.carsByParticipantId[target.car.participantId];
    expect(car.dist).toBe('300');expect(car.extras.find(e=>e.id==='extra-highway-a').amount).toBe('2500');
    expect(result.settlement.carsByParticipantId[targets[1].car.participantId]).toEqual(before.settlement.carsByParticipantId[targets[1].car.participantId]);
    await Promise.all([enter(pa,id,target.key),enter(pb,id,target.key)]);
    await distance(pa).fill('350');await distance(pb).fill('400');
    await save(pa).click();await expect(pa.getByRole('heading',{level:1,name:'車両費用',exact:true})).toBeVisible();
    await expect.poll(async()=> (await local(pb,id)).settlement.carsByParticipantId[target.car.participantId].dist).toBe('350');
    await save(pb).click();await expect(complete(pb)).toBeVisible();
    await expect.poll(async()=>{const record=await cached(pb,id,target.key);return !record || record.data.receipt?.acknowledged===true;}).toBe(true);
    const conflict=(await cached(pb,id,target.key))?.data?.receipt;
    if(conflict){expect(conflict.disposition).toBe('adjusted');expect(conflict.canRetry).toBe(false);await pb.getByRole('button',{name:'現在の費用を確認',exact:true}).click();}
    await expect(pb.getByRole('heading',{level:1,name:'車両費用',exact:true})).toBeVisible();
    result=await shared(request,id);expect(result.settlement.carsByParticipantId[target.car.participantId].dist).toBe('400');
    for(const key of paidFields)expect(result.settlement[key]).toEqual(before.settlement[key]);
  }finally{await cleanup(request,id,[a,b]);}
});

test('denied double-submit freezes one payload; reload retry registers the original extra once',async({page,request},info)=>{
  const id=`FCOSTRETRY${info.project.name.startsWith('webkit')?'WK':'CH'}`,{initial,targets}=setup(),target=targets[0];
  await seed(request,id,initial);const socket=await heldSocket(page);
  try{
    await enter(page,id,target.key);await page.getByRole('button',{name:'費用を追加',exact:true}).click();
    await page.getByRole('textbox',{name:'費用名',exact:true}).fill('入浴');await page.getByRole('textbox',{name:'金額（円）',exact:true}).fill('400');
    await deny(request,id);socket.hold();await page.getByRole('form').dispatchEvent('submit');await page.getByRole('form').dispatchEvent('submit');
    await expect.poll(socket.count).toBeGreaterThan(0);
    await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toBeDisabled();
    const original=(await cached(page,id,target.key)).data;
    expect(original.added).toHaveLength(1);expect(original.receipt.patch).toBeTruthy();
    socket.release();await expect.poll(async()=> (await cached(page,id,target.key))?.data?.receipt?.canRetry).toBe(true);
    await expect(page.getByRole('button',{name:'共有保存を再試行',exact:true})).toBeEnabled();
    await costNav(page,'車両費用');
    const recoveryRow=page.getByRole('listitem').filter({has:page.getByRole('link',{name:`${target.label}の費用を入力`,exact:true})});
    await expect(recoveryRow.getByText('共有保存に失敗',{exact:true})).toBeVisible();
    await expect(recoveryRow.getByText(/^保存済み合計/)).toHaveCount(0);
    await expect(recoveryRow.getByText(/^現在の合計（共有保存を確認）/)).toBeVisible();
    const extraUrl=new URL(page.url());extraUrl.searchParams.set('car',target.key);extraUrl.searchParams.set('task','expense');extraUrl.searchParams.set('expense',`extra:${original.added[0].id}`);await page.goto(extraUrl.href);
    expect((await shared(request,id)).settlement.carsByParticipantId[target.car.participantId].extras.some(e=>e.id===original.added[0].id)).toBe(false);
    await page.reload();await expect(page.getByRole('status').filter({hasText:/共有保存に失敗しました|保存結果を確認できません/})).toBeVisible();
    await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toHaveValue('400');await expect(page.getByRole('textbox',{name:'金額（円）',exact:true})).toBeDisabled();
    expect((await cached(page,id,target.key)).data.receipt.patch).toEqual(original.receipt.patch);
    expect((await request.put(rulesUrl,{headers,data:originalRules})).ok()).toBe(true);
    await page.getByRole('button',{name:'共有保存を再試行',exact:true}).click();
    await expect(page.getByRole('heading',{level:1,name:'車両費用',exact:true})).toBeVisible();
    const result=await shared(request,id),extras=result.settlement.carsByParticipantId[target.car.participantId].extras;
    expect(extras.filter(e=>e.id===original.added[0].id)).toEqual([expect.objectContaining({name:'入浴',amount:'400'})]);
    expect(await cached(page,id,target.key)).toBeNull();
  }finally{socket.release();await page.close();await cleanup(request,id);}
});

test('route Apply has no shared write; an unresolved submitted car cannot apply another distance',async({page,request},info)=>{
  const id=`FCOSTROUTE${info.project.name.startsWith('webkit')?'WK':'CH'}`,{initial,targets}=setup(),target=targets[0];
  await seed(request,id,initial);
  await page.addInitScript(()=>{window.__REACT_ROUTE_ADAPTER__={search:async query=>[{placeId:query,name:query}],resolve:async p=>({...p,latitude:35,longitude:139}),calculate:async s=>({...s,routes:[{distanceMeters:12345,durationSeconds:1200}],selectedRouteIndex:0}),renderMap:async()=>{}};});
  try{
    await enter(page,id,target.key);const before=await shared(request,id);
    await page.getByRole('button',{name:'ルートから距離を計算',exact:true}).click();
    for(const label of ['出発地','目的地']){await page.getByRole('link',{name:`${label}を検索`,exact:true}).click();await page.getByRole('searchbox',{name:'場所を検索',exact:true}).fill(label);await page.getByRole('button',{name:label,exact:true}).click();}
    await page.getByRole('button',{name:'この距離を適用',exact:true}).click();await expect(distance(page)).toHaveValue('12.3');
    expect(semanticRoom(await shared(request,id))).toEqual(semanticRoom(before));
    await deny(request,id);await save(page).click();await expect(page.getByRole('button',{name:'共有保存を再試行',exact:true})).toBeVisible();
    const url=new URL(page.url());url.searchParams.set('task','route');url.searchParams.delete('expense');await page.goto(url.href);
    await expect(page.getByRole('status').filter({hasText:/共有保存に失敗しました|保存結果を確認できません/})).toBeVisible();
    await expect(page.getByRole('button',{name:'この距離を適用',exact:true})).toBeDisabled();
    await expect(page.getByText('送信済みの入力は変更できません。共有保存の結果を確認してください。',{exact:true})).toBeVisible();
    expect((await cached(page,id,target.key)).data.fields.movement.dist).toBe('12.3');
  }finally{await page.close();await cleanup(request,id);}
});

test('late acknowledgement after leaving cannot steal focus; accepted stale receipt never replays later costs',async({page,request},info)=>{
  const id=`FCOSTLATE${info.project.name.startsWith('webkit')?'WK':'CH'}`,{initial,targets}=setup(),target=targets[0];
  await seed(request,id,initial);const socket=await heldSocket(page,'in');
  try{
    await enter(page,id,target.key);await distance(page).fill('222');socket.hold();await save(page).click();await expect.poll(socket.count).toBeGreaterThan(0);
    const record=await cached(page,id,target.key);
    await costNav(page,'参加者');await page.getByRole('button',{name:'参加者を追加',exact:true}).click();
    const field=page.getByRole('textbox',{name:'参加者（改行区切り）',exact:true});await field.fill('次の操作を継続');
    socket.release();await expect(complete(page)).toBeVisible();await expect(field).toBeFocused();await expect(field).toHaveValue('次の操作を継続');
    await expect.poll(async()=> (await shared(request,id)).settlement.carsByParticipantId[target.car.participantId].dist).toBe('222');
    const later=await shared(request,id);later.settlement.carsByParticipantId[target.car.participantId].dist='999';await seed(request,id,later);
    await page.evaluate(({key,record})=>sessionStorage.setItem(key,JSON.stringify(record)),{key:cacheKey(id,target.key),record});
    await enter(page,id,target.key);await expect(distance(page)).toHaveValue('222');await expect(distance(page)).toBeDisabled();
    await expect(page.getByRole('status').filter({hasText:'同時編集により内容が変わりました'})).toBeVisible();
    expect((await shared(request,id)).settlement.carsByParticipantId[target.car.participantId].dist).toBe('999');
    expect((await cached(page,id,target.key)).data.receipt.canRetry).toBe(false);
    await page.getByRole('button',{name:'現在の費用を確認',exact:true}).click();await enter(page,id,target.key);
    await expect(distance(page)).toHaveValue('999');await expect(distance(page)).toBeEnabled();
  }finally{socket.release();await page.close();await cleanup(request,id);}
});

test('reset and removed cost targets retain recovery without stale success or guessed writes',async({page,request},info)=>{
  const id=`FCOSTRESET${info.project.name.startsWith('webkit')?'WK':'CH'}`,{initial,targets}=setup(),target=targets[1];
  await seed(request,id,initial);const socket=await heldSocket(page);
  try{
    await enter(page,id,target.key);await distance(page).fill('120');socket.hold();await save(page).click();await expect.poll(socket.count).toBeGreaterThan(0);
    const reset=structuredClone(initial);reset.resetGeneration++;await seed(request,id,reset);socket.release();
    await expect(page.getByRole('status').filter({hasText:'企画がリセットされました'})).toBeVisible();await expect(save(page)).toBeDisabled();
    expect((await shared(request,id)).settlement.carsByParticipantId[target.car.participantId].dist).toBe('41.5');
    const store=createRoomStore({initial:await shared(request,id)});store.command('deleteParticipant',{id:target.car.participantId});
    await seed(request,id,store.getSnapshot());
    await expect(page).not.toHaveURL(/car=/);await expect(page.getByText('対象車が見つかりません。車両費用の一覧を確認してください。',{exact:true})).toBeVisible();
    expect((await cached(page,id,target.key)).data.receipt).toBeTruthy();
    expect((await shared(request,id)).participants[target.car.participantId]).toBeUndefined();
  }finally{socket.release();await page.close();await cleanup(request,id);}
});
