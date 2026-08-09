import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const entitySource=fs.readFileSync(new URL('../assets/js/core/entity-state-v5.js',import.meta.url),'utf8');
const ec=vm.createContext({window:{SanpoClock:{now:()=>Date.now(),isServerAligned:()=>true}},console,Date,JSON,Math,Object,Array,Set,Map,String,Number,parseInt,encodeURIComponent,decodeURIComponent});
vm.runInContext(`${entitySource}\n;globalThis.E=window.SanpoCanonicalState`,ec); const E=ec.E;
const syncSource=fs.readFileSync(new URL('../assets/js/core/sync-controller.js',import.meta.url),'utf8');
const sc=vm.createContext({window:{SanpoCanonicalState:E,SanpoClock:{now:()=>Date.now(),isServerAligned:()=>true}},console,Date,JSON,Math,Object,Array,Set,String,Number,parseInt,encodeURIComponent,decodeURIComponent,APP_SCHEMA_VERSION:5,CFG:{STORE:'x'},roomId:'R',myClientId:'sim',migrateAppData:v=>E.migrate(v||{}),safeJsonParse:JSON.parse,L:{getItem:()=>null,setItem(){},removeItem(){}},J:JSON,isRemoteUpdate:false,dbRef:null,lastSyncedData:null,lastSyncedRevision:0,pendingRemoteSettlementData:null,pendingRemoteRoomData:null,saveRequestVersion:0,saveTimer:null,syncWriteInFlight:false,isSettlementInputProtected:()=>false,isDraggingCards:false,manualCardDrag:null,manualSheetDrag:null,updateStatus(){},restore(){},getData:()=>({}),queueMicrotask:f=>f(),requestAnimationFrame:f=>f(),editLockEnabled:false,editLockPassphrase:'',editLockScopes:{},carPlans:[],activeCarPlanId:'',lastAutoAssignLabel:'',rememberTrustedDevice(){},updateEditLockButton(){},refreshRoomTitle(){},updateUI(){},hideAppLoadingSkeleton(){},requestPassphrasePanel:async()=>'',getTrustedDeviceKey:()=>'',location:{reload(){}},set:async()=>{},update:async()=>{},onValue(){}});
vm.runInContext(`${syncSource}\n;globalThis.S=window.SanpoEntitySyncTest`,sc); const S=sc.S;
const clone=structuredClone, keys=o=>Object.keys(o||{});
const offset=Number(process.env.SEED_OFFSET||0), seeds=Number(process.env.SEEDS||40), steps=Number(process.env.STEPS||180);
const rngFor=s0=>{let s=s0>>>0;return()=>{s=Math.imul(s^(s>>>15),1|s);s^=s+Math.imul(s^(s>>>7),61|s);return ((s^(s>>>14))>>>0)/4294967296;}};
const pick=(r,a)=>a.length?a[Math.floor(r()*a.length)]:null;
let operations=0, commits=0, deliveries=0, invariantChecks=0;
function makeRoom(n=24){let r=E.emptyRoom();for(let i=0;i<n;i++)E.ensureParticipant(r.participants,{name:`P${i+1}`,grade:(i%4)+1,gender:['unknown','male','female'][i%3]});r=E.migrate(r);const ids=keys(r.participants);for(let j=0;j<4;j++){const id=ids[j],gid=`g${j}`;r.allocations.car.groups[gid]={id:gid,ownerId:id,capacity:3,order:j,createdAt:1,updatedAt:1};r.allocations.car.placements[id]={kind:'driver',groupId:gid,order:j,updatedAt:1}}E.ensureAllParticipantsPlaced(r.allocations.car,r.participants);E.ensureAllParticipantsPlaced(r.allocations.team,r.participants);return E.migrate(r)}
function invariant(raw){const r=E.migrate(raw), ids=new Set(keys(r.participants));for(const t of ['car','team']){const a=r.allocations[t], ownerIds=new Set();for(const [gid,g] of Object.entries(a.groups||{})){assert.ok(ids.has(g.ownerId),`${t} missing owner`);assert.ok(!ownerIds.has(g.ownerId),`${t} duplicate driver group`);ownerIds.add(g.ownerId);const op=a.placements[g.ownerId];assert.ok(op&&op.kind==='driver'&&op.groupId===gid,`${t} owner placement mismatch`);const count=Object.values(a.placements).filter(p=>p?.kind==='member'&&p.groupId===gid).length;assert.ok(count<=Number(g.capacity||0),`${t} capacity overflow`)}for(const id of ids)assert.ok(a.placements[id],`${t} participant missing placement`);for(const [id,p] of Object.entries(a.placements||{})){assert.ok(ids.has(id),`${t} orphan placement`);if(['driver','member'].includes(p.kind))assert.ok(a.groups[p.groupId],`${t} dangling group`)}}for(const f of ['carsByParticipantId','paidByParticipantId','paidCollectorByParticipantId','driverPaidByParticipantId'])for(const id of keys(r.settlement?.[f]))assert.ok(ids.has(id),`settlement orphan ${f}`);for(const id of keys(r.participantTombstones))assert.equal(r.participants[id],undefined,'tombstone resurrection');invariantChecks++;return r}
function commit(server,p){const local=E.migrate(p.local);local.lastUpdatedBy=p.clientId;local.lastUpdatedAt=p.actionTime;const patch=S.buildEntityPatch(p.base,local);const out=S.applyVersionedEntityPatch(server,p.base,local,patch,p.seq);commits++;return invariant(out)}
function deletePerson(r,id,time){if(!r.participants[id])return;r.participantTombstones||={};r.participantTombstones[id]={deletedAt:time};delete r.participants[id];for(const t of ['car','team']){const a=r.allocations[t];delete a.placements[id];for(const [gid,g] of Object.entries(a.groups||{}))if(g.ownerId===id){delete a.groups[gid];for(const [pid,p] of Object.entries(a.placements||{}))if(p.groupId===gid)a.placements[pid]={kind:'waiting',groupId:'',order:999,updatedAt:time}}}for(const f of ['carsByParticipantId','paidByParticipantId','paidCollectorByParticipantId','driverPaidByParticipantId'])delete r.settlement?.[f]?.[id]}
function op(client,r,time,serial){const ids=keys(client.local.participants);const kind=Math.floor(r()*17);const id=pick(r,ids);if(kind===0&&id){client.local.participants[id].grade=Math.floor(r()*5);client.local.participants[id].updatedAt=time}
else if(kind===1&&id){client.local.participants[id].memo=`memo-${serial}-${Math.floor(r()*9999)}`;client.local.participants[id].updatedAt=time}
else if(kind===2&&id){client.local.participants[id].flag=pick(r,['none','blue','purple','yellow','red']);client.local.participants[id].updatedAt=time}
else if(kind===3&&id){client.local.participants[id].name=`${client.local.participants[id].name.split('-')[0]}-${client.id}-${serial}`;client.local.participants[id].updatedAt=time}
else if(kind===4){const name=`N-${client.id}-${serial}`;const nid=E.ensureParticipant(client.local.participants,{name,grade:1,updatedAt:time},'',client.local.participantTombstones||{});for(const t of ['car','team'])E.ensureAllParticipantsPlaced(client.local.allocations[t],client.local.participants);if(nid)client.local.participants[nid].updatedAt=time}
else if(kind===5&&id&&ids.length>8)deletePerson(client.local,id,time)
else if((kind===6||kind===7)&&id){const t=kind===6?'car':'team',a=client.local.allocations[t],gids=keys(a.groups).filter(g=>a.groups[g].ownerId!==id);if(gids.length&&r()<.7){const gid=pick(r,gids);a.placements[id]={kind:'member',groupId:gid,order:Math.floor(r()*4),updatedAt:time}}else a.placements[id]={kind:'waiting',groupId:'',order:serial,updatedAt:time};a.updatedAt=time}
else if(kind===8&&id){const a=client.local.allocations.car,gid=`g_car_${id}`;if(!Object.values(a.groups).some(g=>g.ownerId===id)){a.groups[gid]={id:gid,ownerId:id,capacity:3,order:keys(a.groups).length,createdAt:time,updatedAt:time};a.placements[id]={kind:'driver',groupId:gid,order:keys(a.groups).length-1,updatedAt:time};a.updatedAt=time}}
else if(kind===9){const a=client.local.allocations.car,gid=pick(r,keys(a.groups));if(gid){a.groups[gid].capacity=1+Math.floor(r()*6);a.groups[gid].updatedAt=time;a.updatedAt=time}}
else if(kind===10&&id){client.local.settlement.carsByParticipantId||={};client.local.settlement.carsByParticipantId[id]={dist:String(10+Math.floor(r()*600)),eco:String(8+Math.floor(r()*15)),price:String(150+Math.floor(r()*60)),extras:[{name:`経費${serial%9}`,amount:String(Math.floor(r()*5000)),type:pick(r,['split','club','split-minus','club-minus'])}],updatedAt:time}}
else if(kind===11&&id){client.local.settlement.paidByParticipantId||={};client.local.settlement.paidByParticipantId[id]=r()<.5}
else if(kind===12){client.local.settlement.rounding=pick(r,['1','10','100','500','1000']);client.local.settlement.driverReward=String(Math.floor(r()*5000));client.local.settlement.driverRewardType=pick(r,['split','club'])}
else if(kind===13){client.local.roomName=`Room-${serial}`}
else if(kind===14){client.local.editLockScopes={allocation:r()<.5,settlement:r()<.5}}
else if(kind===15){client.local.overview={...(client.local.overview||{}),[`k${serial%7}`]:`v${serial}`}}
else {client.local.activeAllocationType=r()<.5?'car':'team';client.local.trayMinimized=r()<.5}
client.local.lastUpdatedAt=time;client.local.lastUpdatedBy=client.id;client.dirty=true;operations++}
for(let seedIndex=0;seedIndex<seeds;seedIndex++){
 const seed=offset+seedIndex+1,r=rngFor(seed*2654435761),baseServer=makeRoom(),clients=Array.from({length:5},(_,i)=>({id:`D${i+1}`,seq:0,base:clone(baseServer),local:clone(baseServer),dirty:false,offline:false,modal:false,pending:0}));let server=clone(baseServer),network=[],serial=0,clock=seed*1_000_000;
 for(let step=0;step<steps;step++){
   clock+=10;
   // delayed/reordered packets
   const due=network.filter(p=>p.at<=step).sort(()=>r()-.5);network=network.filter(p=>p.at>step);
   for(const p of due){server=commit(server,p);deliveries++;const c=clients.find(x=>x.id===p.clientId);c.pending=Math.max(0,c.pending-1);if(!c.dirty&&c.pending===0&&!c.modal&&!c.offline){c.base=clone(server);c.local=clone(server)}}
   if(r()<.08){const c=pick(r,clients);c.offline=!c.offline}
   if(r()<.08){const c=pick(r,clients);c.modal=!c.modal;if(!c.modal&&!c.dirty&&c.pending===0&&!c.offline){c.base=clone(server);c.local=clone(server)}}
   const actors=[...clients].sort(()=>r()-.5).slice(0,1+Math.floor(r()*5));
   for(const c of actors){serial++;op(c,r,++clock,serial)}
   for(const c of clients){if(c.dirty&&!c.offline&&r()<.48){c.seq++;network.push({clientId:c.id,seq:c.seq,base:clone(c.base),local:clone(c.local),actionTime:Number(c.local.lastUpdatedAt||clock),at:step+Math.floor(r()*9)});c.pending++;c.dirty=false}if(!c.offline&&!c.modal&&!c.dirty&&c.pending===0&&r()<.3){c.base=clone(server);c.local=clone(server)}}
 }
 // submit dirty offline/modal drafts, then deliver every packet in deliberately shuffled order
 for(const c of clients){c.offline=false;c.modal=false;if(c.dirty){c.seq++;network.push({clientId:c.id,seq:c.seq,base:clone(c.base),local:clone(c.local),actionTime:Number(c.local.lastUpdatedAt||++clock),at:steps});c.pending++;c.dirty=false}}
 for(const p of network.sort(()=>r()-.5)){server=commit(server,p);deliveries++}
 server=invariant(server);
 // All five clients eventually converge when network is idle.
 const domain=x=>{const c=E.migrate(x);return {roomName:c.roomName,participants:c.participants,participantTombstones:c.participantTombstones,allocations:c.allocations,editLockScopes:c.editLockScopes,settlement:c.settlement,overview:c.overview}};
 for(const c of clients){c.base=clone(server);c.local=clone(server);assert.deepEqual(domain(c.local),domain(server),`seed ${seed}: ${c.id} failed final convergence`)}
}
console.log(`Five-device network soak v46: PASS seeds=${seeds} steps=${steps} operations=${operations} commits=${commits} deliveries=${deliveries} invariantChecks=${invariantChecks}`);
