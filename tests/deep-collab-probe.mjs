import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const entitySource=fs.readFileSync(new URL('../assets/js/core/entity-state-v5.js',import.meta.url),'utf8');
const ec=vm.createContext({window:{},console,Date,JSON,Math,Object,Array,Set,Map,String,Number,parseInt});
vm.runInContext(`${entitySource}\n;globalThis.E=window.SanpoCanonicalState`,ec); const E=ec.E;
const syncSource=fs.readFileSync(new URL('../assets/js/core/sync-controller.js',import.meta.url),'utf8');
const sc=vm.createContext({window:{SanpoCanonicalState:E},console,JSON,Object,Array,Set,String,Number,Date,Math,APP_SCHEMA_VERSION:5,CFG:{STORE:'x'},roomId:'R',myClientId:'sim',migrateAppData:v=>E.migrate(v),safeJsonParse:JSON.parse,L:{getItem:()=>null,setItem(){},removeItem(){}},J:JSON,isRemoteUpdate:false,dbRef:null,lastSyncedData:null,lastSyncedRevision:0,pendingRemoteSettlementData:null,pendingRemoteRoomData:null,saveRequestVersion:0,saveTimer:null,syncWriteInFlight:false,isSettlementInputProtected:()=>false,isDraggingCards:false,manualCardDrag:null,updateStatus(){},restore(){},getData:()=>({}),queueMicrotask:f=>f(),editLockEnabled:false,editLockPassphrase:'',editLockScopes:{},carPlans:[],activeCarPlanId:'',lastAutoAssignLabel:'',rememberTrustedDevice(){},updateEditLockButton(){},refreshRoomTitle(){},updateUI(){},hideAppLoadingSkeleton(){},requestPassphrasePanel:async()=>'',getTrustedDeviceKey:()=>'',location:{reload(){}},set:async()=>{},update:async()=>{},onValue(){}});
vm.runInContext(`${syncSource}\n;globalThis.S={buildEntityPatch,applyEntityPatchToObject}`,sc); const S=sc.S;
const c=v=>structuredClone(v);
function baseRoom(){let r=E.emptyRoom(); for(const n of ['D','A','B','C','X','Y']) E.ensureParticipant(r.participants,{name:n}); r=E.migrate(r); const ids=Object.fromEntries(Object.entries(r.participants).map(([id,p])=>[p.name,id])); const gid='g1'; r.allocations.car.groups[gid]={id:gid,ownerId:ids.D,capacity:3,order:0,createdAt:1,updatedAt:1}; r.allocations.car.placements[ids.D]={kind:'driver',groupId:gid,order:0,updatedAt:1}; r.allocations.car.placements[ids.A]={kind:'member',groupId:gid,order:0,updatedAt:1}; r.allocations.car.placements[ids.B]={kind:'member',groupId:gid,order:1,updatedAt:1}; for(const n of ['C','X','Y']) r.allocations.car.placements[ids[n]]={kind:'waiting',groupId:'',order:10,updatedAt:1}; return {r:E.migrate(r),ids,gid}; }
const results=[];
{
 const {r,ids,gid}=baseRoom(); const a=c(r),b=c(r); a.allocations.car.placements[ids.C]={kind:'member',groupId:gid,order:2,updatedAt:100}; b.allocations.car.placements[ids.X]={kind:'member',groupId:gid,order:2,updatedAt:101}; let server=S.applyEntityPatchToObject(r,S.buildEntityPatch(r,a)); server=S.applyEntityPatchToObject(server,S.buildEntityPatch(r,b)); server=E.migrate(server); const members=Object.entries(server.allocations.car.placements).filter(([_,p])=>p.kind==='member'&&p.groupId===gid).map(([id])=>id); results.push({name:'concurrent last-seat moves',pass:members.length<=3,detail:`capacity=3 members=${members.length}`});
}
{
 const {r,ids}=baseRoom(); const a=c(r),b=c(r); a.participants[ids.A].grade=2; a.participants[ids.A].updatedAt=100; b.participants[ids.A].grade=3; b.participants[ids.A].updatedAt=200; const pa=S.buildEntityPatch(r,a),pb=S.buildEntityPatch(r,b); let server=S.applyEntityPatchToObject(r,pb); server=S.applyEntityPatchToObject(server,pa); server=E.migrate(server); results.push({name:'out-of-order same-field update',pass:server.participants[ids.A].grade===3,detail:`expected newest(updatedAt=200) grade=3, got ${server.participants[ids.A].grade}, participant.updatedAt=${server.participants[ids.A].updatedAt}`});
}
{
 const {r,ids}=baseRoom(); const del=c(r),edit=c(r); del.participantTombstones[ids.A]={deletedAt:200}; delete del.participants[ids.A]; for(const t of ['car','team']) delete del.allocations[t].placements[ids.A]; edit.participants[ids.A].memo='late'; edit.participants[ids.A].updatedAt=300; let server=S.applyEntityPatchToObject(r,S.buildEntityPatch(r,del)); server=S.applyEntityPatchToObject(server,S.buildEntityPatch(r,edit)); server=E.migrate(server); results.push({name:'delete vs stale edit',pass:!server.participants[ids.A],detail:`deleted remains=${!server.participants[ids.A]}`});
}
for(const x of results) console.log(`${x.pass?'PASS':'FAIL'} ${x.name}: ${x.detail}`);
if(results.some(x=>!x.pass)) process.exitCode=2;
