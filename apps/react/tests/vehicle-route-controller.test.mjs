import test from 'node:test';
import assert from 'node:assert/strict';
import { createVehicleRouteController } from '../src/ui/vehicle-route-controller.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const place=n=>({placeId:n,name:n,latitude:35,longitude:139});
const tick=()=>new Promise(r=>setTimeout(r,200));
function make(service={},working=null) {
  const writes=[];
  const c=createVehicleRouteController({roomId:'LOCAL-F',carKey:'participant:a',service,working,routeDraft:{read:()=>({}),write:value=>writes.push(value)},rememberWorking:value=>writes.push(value)});
  return {c,writes};
}
test('search A after B cannot replace current query result or clear its pending status',async()=>{
  const a=deferred(),b=deferred();const {c,writes}=make({search:q=>q==='A'?a.promise:b.promise});
  c.setContext({task:'route-search',stopKey:'origin'});c.setQuery('A');await tick();c.setQuery('B');await tick();
  a.resolve([place('A')]);await Promise.resolve();assert.equal(c.getSnapshot().search.status,'pending');
  b.resolve([{...place('B'),toPlace(){}}]);await Promise.resolve();
  assert.equal(c.getSnapshot().search.query,'B');assert.equal(c.getSnapshot().search.predictions[0].name,'B');
  assert.equal(JSON.stringify(writes).includes('predictions'),false);c.dispose();
});
test('removed or reordered repeated stops fence resolution rather than updating a stale index',async()=>{
  const resolve=deferred(),p=place('same');const {c}=make({resolve:()=>resolve.promise},{origin:place('start'),destination:place('end'),waypoints:[p,p]});
  const keys=c.getSnapshot().stopKeys.waypoints;
  c.setContext({task:'route-search',stopKey:keys[0]});const pending=c.resolveStop(keys[0],{});
  c.setStops({waypoints:[p,p],waypointKeys:[keys[1],keys[0]]});resolve.resolve(place('wrong'));await pending;
  assert.deepEqual(c.getSnapshot().state.waypoints.map(p=>p.name),['same','same']);c.dispose();
});
test('option change invalidates alternatives and old finally cannot clear newer calculation',async()=>{
  const a=deferred(),b=deferred();let count=0;const {c}=make({calculate:()=>++count===1?a.promise:b.promise},{origin:place('s'),destination:place('e')});
  c.setContext({task:'route'});const first=c.calculate();c.setOptions({avoidTolls:false});const second=c.calculate();
  a.resolve({routes:[{distanceMeters:99999}],selectedRouteIndex:0});await first;
  assert.equal(c.getSnapshot().calculation.status,'pending');assert.equal(c.applyValue(),null);
  b.resolve({routes:[{distanceMeters:12345},{distanceMeters:18000}],selectedRouteIndex:0});await second;
  assert.equal(c.applyValue(),'12.3');c.selectRoute(1);assert.equal(c.applyValue(),'18');assert.equal(c.getSnapshot().state.roundTrip,false);c.dispose();
});
test('leave or disposal fences old car completion and map errors do not block text Apply',async()=>{
  const delayed=deferred();const {c}=make({calculate:()=>delayed.promise},{origin:place('s'),destination:place('e')});
  c.setContext({task:'route'});const request=c.calculate();c.setContext({task:'expense'});delayed.resolve({routes:[{distanceMeters:1000}]});await request;assert.equal(c.applyValue(),null);c.dispose();
  const live=make({calculate:async()=>({routes:[{distanceMeters:12345}]}),renderMap:async()=>{throw Error('SDK failed');}},{origin:place('s'),destination:place('e')}).c;
  live.setContext({task:'route'});await live.calculate();await live.renderMap({isConnected:true});assert.equal(live.getSnapshot().map.status,'error');assert.equal(live.applyValue(),'12.3');live.dispose();
});
test('local cache seed, waypoint bound, recent places and disconnected map preserve service contract',async()=>{
  let request;const writes=[];
  const c=createVehicleRouteController({roomId:'R',carKey:'name:車',routeDraft:{read:()=>({origin:place('s'),destination:place('e'),roundTrip:true,avoidFerries:true}),write:s=>writes.push(s)},rememberWorking:s=>writes.push(s),service:{calculate:async s=>{request=s;return {...s,routes:[{distanceMeters:12345}]};},resolve:async p=>p,renderMap:()=>{throw Error('must not render');}}});
  assert.equal(c.getSnapshot().seededFromPrevious,true);assert.equal(c.getSnapshot().state.roundTrip,false);
  assert.throws(()=>c.setStops({waypoints:Array(26).fill(place('w'))}),/25/);
  c.setContext({task:'route'});await c.calculate();assert.equal(request.avoidFerries,true);assert.equal(request.roundTrip,false);
  await c.renderMap({isConnected:false});assert.notEqual(c.getSnapshot().map.status,'error');
  c.setContext({task:'route-search',stopKey:'origin'});await c.resolveStop('origin',place('new'));assert.equal(c.getSnapshot().state.recentPlaces[0].name,'new');
  assert.equal(Object.hasOwn(writes.at(-1),'predictions'),false);c.dispose();
});
