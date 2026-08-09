import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const entitySource = fs.readFileSync(new URL('../assets/js/core/entity-state-v5.js', import.meta.url), 'utf8');
const entityContext = vm.createContext({ window: {}, console, Date, JSON, Math, Object, Array, Set, Map, String, Number, parseInt });
vm.runInContext(`${entitySource}\n;globalThis.__entity = window.SanpoCanonicalState;`, entityContext);
const entity = entityContext.__entity;

const syncSource = fs.readFileSync(new URL('../assets/js/core/sync-controller.js', import.meta.url), 'utf8');
const syncContext = vm.createContext({
  window: { SanpoCanonicalState: entity }, console, JSON, Object, Array, Set, String, Number, Date, Math,
  APP_SCHEMA_VERSION: 5, CFG: { STORE: 'test' }, roomId: 'ROOM', myClientId: 'sim',
  migrateAppData: v => entity.migrate(v), safeJsonParse: JSON.parse,
  L: { getItem: () => null, setItem() {}, removeItem() {} }, J: JSON,
  isRemoteUpdate: false, dbRef: null, lastSyncedData: null, lastSyncedRevision: 0,
  pendingRemoteSettlementData: null, pendingRemoteRoomData: null,
  saveRequestVersion: 0, saveTimer: null, syncWriteInFlight: false,
  isSettlementInputProtected: () => false, isDraggingCards: false, manualCardDrag: null,
  updateStatus() {}, restore() {}, getData: () => ({}), queueMicrotask: fn => fn(),
  editLockEnabled: false, editLockPassphrase: '', editLockScopes: {}, carPlans: [], activeCarPlanId: '', lastAutoAssignLabel: '',
  rememberTrustedDevice() {}, updateEditLockButton() {}, refreshRoomTitle() {}, updateUI() {}, hideAppLoadingSkeleton() {},
  requestPassphrasePanel: async () => '', getTrustedDeviceKey: () => '', location: { reload() {} }, set: async () => {}, update: async () => {}, onValue() {}
});
vm.runInContext(`${syncSource}\n;globalThis.__sync = { buildEntityPatch, applyEntityPatchToObject, patchHasDomainChanges };`, syncContext);
const sync = syncContext.__sync;

const clone = v => structuredClone(v);
const rngFor = seed0 => { let s = seed0 >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 1 | s), s ^= s + Math.imul(s ^ (s >>> 7), 61 | s), ((s ^ (s >>> 14)) >>> 0) / 4294967296)); };
const pick = (r, a) => a[Math.floor(r() * a.length)];
const keys = o => Object.keys(o || {});

function legacyRoom(n = 12) {
  const names = Array.from({length:n}, (_,i)=>`P${String(i+1).padStart(2,'0')}`);
  const carDrivers = names.slice(0,3);
  const carMembers = names.slice(3,9);
  return {
    schemaVersion:4, roomName:'Chaos', activeCarPlanId:'plan-car',
    carPlans:[
      {id:'plan-car', templateType:'car', name:'車割', waiting:names.slice(9).map(name=>({name})), cars:carDrivers.map((name,i)=>({name,capacity:3,members:carMembers.slice(i*2,i*2+2).map(name=>({name}))}))},
      {id:'plan-team', templateType:'team', name:'班割', waiting:names.map(name=>({name})), cars:[]}
    ],
    settlement:{cars:{P01:{dist:'100',eco:'15',price:'170',extras:[]}},paid:{P10:true},driverPaid:{}},
    editLockScopes:{allocation:false,settlement:false}
  };
}

function normalize(room) { return entity.migrate(room); }
function pruneParticipant(room,id) {
  if (!room.participants[id]) return;
  room.participantTombstones ||= {};
  room.participantTombstones[id] = { deletedAt: Date.now() };
  delete room.participants[id];
  for (const type of ['car','team']) {
    const a=room.allocations[type];
    delete a.placements[id];
    for (const [gid,g] of Object.entries(a.groups)) if (g.ownerId===id) {
      delete a.groups[gid];
      for (const [pid,p] of Object.entries(a.placements)) if (p.groupId===gid) a.placements[pid]={kind:'waiting',groupId:'',order:999,updatedAt:Date.now()};
    }
  }
  for (const field of ['carsByParticipantId','paidByParticipantId','paidByNameByParticipantId','driverPaidByParticipantId']) delete room.settlement?.[field]?.[id];
  if (room.settlement?.organizerParticipantId===id) room.settlement.organizerParticipantId='';
}
function ensurePlacements(room){ for(const t of ['car','team']) entity.ensureAllParticipantsPlaced(room.allocations[t],room.participants); }
function addPerson(room, name){
  const id=entity.ensureParticipant(room.participants,{name,grade:1,gender:'unknown'}); room.participantTombstones ||= {}; delete room.participantTombstones[id]; ensurePlacements(room); return id;
}
function movePerson(room,r,type){
  const a=room.allocations[type]; const driverIds=new Set(Object.values(a.groups).map(g=>g.ownerId)); const ids=keys(room.participants).filter(id=>!driverIds.has(id)); if(!ids.length)return; const id=pick(r,ids);
  const gids=keys(a.groups).filter(gid=>a.groups[gid].ownerId!==id);
  if(r()<0.45 || !gids.length) a.placements[id]={kind:'waiting',groupId:'',order:Math.floor(r()*50),updatedAt:Date.now()};
  else { const gid=pick(r,gids); a.placements[id]={kind:'member',groupId:gid,order:Math.floor(r()*8),updatedAt:Date.now()}; }
}
function makeDriver(room,r,type){
  const ids=keys(room.participants); if(!ids.length)return; const id=pick(r,ids); const a=room.allocations[type];
  for(const [gid,g] of Object.entries(a.groups)) if(g.ownerId===id){ delete a.groups[gid]; }
  const gid=`g_${type}_${id}`; a.groups[gid]={id:gid,ownerId:id,capacity:type==='team'?5:3,order:keys(a.groups).length,createdAt:Date.now(),updatedAt:Date.now()};
  a.placements[id]={kind:'driver',groupId:gid,order:keys(a.groups).length-1,updatedAt:Date.now()};
}
function deleteGroup(room,r,type){
  const a=room.allocations[type], gids=keys(a.groups); if(!gids.length)return; const gid=pick(r,gids); delete a.groups[gid];
  for(const [id,p] of Object.entries(a.placements)) if(p.groupId===gid) a.placements[id]={kind:'waiting',groupId:'',order:999,updatedAt:Date.now()};
}
function settlementEdit(room,r){
  const ids=keys(room.participants); if(!ids.length)return; const id=pick(r,ids); room.settlement ||= {}; const field=pick(r,['car','paid','driverPaid','organizer']);
  if(field==='car'){ room.settlement.carsByParticipantId ||= {}; const c=room.settlement.carsByParticipantId[id] ||= {dist:'',eco:'',price:'',rentalType:'private',extras:[]}; const sub=pick(r,['dist','eco','price','extra']); if(sub==='extra') c.extras=[...(c.extras||[]),{name:`E${Math.floor(r()*10)}`,amount:String(Math.floor(r()*9000)),type:pick(r,['split','club','split-minus','club-minus'])}]; else c[sub]=String(1+Math.floor(r()*400)); }
  if(field==='paid'){ room.settlement.paidByParticipantId ||= {}; room.settlement.paidByParticipantId[id]=r()<0.5; }
  if(field==='driverPaid'){ room.settlement.driverPaidByParticipantId ||= {}; room.settlement.driverPaidByParticipantId[id]=r()<0.5; }
  if(field==='organizer') room.settlement.organizerParticipantId=id;
}
function mutate(room,r,seq){
  const ops=['add','delete','rename','meta','moveCar','moveTeam','driverCar','driverTeam','delGroupCar','delGroupTeam','settlement','roomName','lock'];
  const op=pick(r,ops); const ids=keys(room.participants);
  if(op==='add') addPerson(room,`N${seq}_${Math.floor(r()*1e6)}`);
  else if(op==='delete'&&ids.length) pruneParticipant(room,pick(r,ids));
  else if(op==='rename'&&ids.length){ const id=pick(r,ids); room.participants[id].name=`R${seq}_${Math.floor(r()*1e5)}`; room.participants[id].updatedAt=Date.now(); }
  else if(op==='meta'&&ids.length){ const id=pick(r,ids),p=room.participants[id]; p.grade=Math.floor(r()*5); p.gender=pick(r,['male','female','unknown']); p.flag=pick(r,['none','blue','purple','yellow','red']); p.memo=`m${seq}`; p.updatedAt=Date.now(); }
  else if(op==='moveCar') movePerson(room,r,'car'); else if(op==='moveTeam') movePerson(room,r,'team');
  else if(op==='driverCar') makeDriver(room,r,'car'); else if(op==='driverTeam') makeDriver(room,r,'team');
  else if(op==='delGroupCar') deleteGroup(room,r,'car'); else if(op==='delGroupTeam') deleteGroup(room,r,'team');
  else if(op==='settlement') settlementEdit(room,r); else if(op==='roomName') room.roomName=`Room-${seq}-${Math.floor(r()*99)}`;
  else if(op==='lock'){ room.editLockScopes={allocation:r()<.5,settlement:r()<.5}; room.editLockEnabled=room.editLockScopes.allocation||room.editLockScopes.settlement; }
  ensurePlacements(room); return op;
}
function check(room,label){
  const c=normalize(room); assert.equal(c.schemaVersion,5,`${label}: schema`); assert.equal('carPlans' in c,false,`${label}: legacy carPlans leaked`); assert.equal('waiting' in c,false,`${label}: legacy waiting leaked`); assert.equal('cars' in c,false,`${label}: legacy cars leaked`);
  const ids=new Set(keys(c.participants));
  for(const type of ['car','team']){
    const a=c.allocations[type];
    for(const [id,p] of Object.entries(a.placements)){ assert.ok(ids.has(id),`${label}: ${type} placement -> missing participant ${id}`); if(['member','driver'].includes(p.kind)) assert.ok(a.groups[p.groupId],`${label}: ${type} placement -> missing group`); }
    for(const id of ids) assert.ok(a.placements[id],`${label}: ${type} missing placement ${id}`);
    for(const [gid,g] of Object.entries(a.groups)){ assert.ok(ids.has(g.ownerId),`${label}: ${type} group missing owner`); assert.equal(a.placements[g.ownerId]?.kind,'driver',`${label}: ${type} owner not driver`); assert.equal(a.placements[g.ownerId]?.groupId,gid,`${label}: ${type} driver wrong group`); }
  }
  for(const field of ['carsByParticipantId','paidByParticipantId','paidByNameByParticipantId','driverPaidByParticipantId']) for(const id of keys(c.settlement?.[field])) assert.ok(ids.has(id),`${label}: settlement ${field} -> deleted participant`);
  for(const id of keys(c.participantTombstones)) assert.ok(!c.participants[id],`${label}: tombstoned participant resurrected ${id}`);
  return c;
}

const scenarioTarget = Math.max(1, Number(process.env.CHAOS_SCENARIOS || 50));
const stepsPerScenario = Math.max(1, Number(process.env.CHAOS_STEPS || 100));
let scenarios=0, operations=0, commits=0;
for(let seed=1; seed<=scenarioTarget; seed++){
  const r=rngFor(seed*7919); let server=normalize(legacyRoom(12));
  const clients=Array.from({length:5},(_,i)=>({id:`D${i+1}`,base:clone(server),local:clone(server),offline:false,dirty:false}));
  for(let step=0;step<stepsPerScenario;step++){
    // Random network state changes and 1-5 concurrent local actions.
    if(r()<.08){ const c=pick(r,clients); c.offline=!c.offline; }
    const actors=[...clients].sort(()=>r()-.5).slice(0,1+Math.floor(r()*5));
    for(const c of actors){ mutate(c.local,r,seed*1000+step*10+operations); c.local=check(c.local,`seed${seed}/step${step}/${c.id}/local`); c.dirty=true; operations++; }
    // Randomly commit dirty online clients in random order, allowing real races.
    const writers=clients.filter(c=>c.dirty&&!c.offline&&r()<.72).sort(()=>r()-.5);
    for(const c of writers){ const patch=sync.buildEntityPatch(c.base,c.local); server=sync.applyEntityPatchToObject(server,patch); server=check(server,`seed${seed}/step${step}/${c.id}/server`); c.base=clone(server); c.local=clone(server); c.dirty=false; commits++; }
    // Deliver latest server snapshot to idle clients with packet loss/delay.
    for(const c of clients){ if(!c.offline&&!c.dirty&&r()<.65){ c.base=clone(server); c.local=clone(server); } }
    // Occasionally reconnect every device and flush all outstanding local edits.
    if(step%37===36){
      for(const c of clients){ c.offline=false; if(c.dirty){ const patch=sync.buildEntityPatch(c.base,c.local); server=check(sync.applyEntityPatchToObject(server,patch),`seed${seed}/flush/${c.id}`); c.dirty=false; commits++; } c.base=clone(server); c.local=clone(server); }
    }
  }
  // Final convergence.
  for(const c of clients){ if(c.dirty){ server=check(sync.applyEntityPatchToObject(server,sync.buildEntityPatch(c.base,c.local)),`seed${seed}/final/${c.id}`); commits++; } c.dirty=false; }
  server=check(server,`seed${seed}/final-server`); for(const c of clients){ c.base=clone(server); c.local=clone(server); assert.equal(JSON.stringify(c.local),JSON.stringify(server),`seed${seed}: device failed to converge`); }
  scenarios++;
}
console.log(`Five-device chaos: PASS scenarios=${scenarios}, operations=${operations}, commits=${commits}`);
