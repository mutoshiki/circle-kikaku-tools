import test from 'node:test';
import assert from 'node:assert/strict';
import { createVehicleRouteController } from '../src/ui/vehicle-route-controller.js';
import { createRouteService } from '../src/route/service.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const place=n=>({placeId:n,name:n,latitude:35,longitude:139});
const tick=()=>new Promise(r=>setTimeout(r,200));
function make(service={},working=null) {
  const writes=[];
  const c=createVehicleRouteController({roomId:'LOCAL-F',carKey:'participant:a',service,working,routeDraft:{read:()=>({}),write:value=>writes.push(value)},rememberWorking:value=>writes.push(value)});
  return {c,writes};
}

// Minimal connected tree at the external SDK boundary; the real route service
// still constructs maps, overlays and bounds against the node it is given.
function mapHost(){
  const document={createElement(){return {ownerDocument:document,parent:null,children:[],style:{},get isConnected(){return !!this.parent?.isConnected;},appendChild(child){child.parent=this;this.children.push(child);},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}};}};
  const host=document.createElement();Object.defineProperty(host,'isConnected',{value:true});return host;
}

test('delayed real map rendering cannot draw an obsolete route into the connected page',async()=>{
  for(const change of ['stops','selection','context','dispose']){
    const sdk=deferred(),host=mapHost(),drawn=[];
    const service=createRouteService({loadLibraries:()=>sdk.promise});
    const {c}=make(service,{origin:place('s'),destination:place('e'),routes:[{distanceMeters:12345,path:[{lat:35,lng:139}]},{distanceMeters:18000,path:[{lat:36,lng:140}]}],selectedRouteIndex:0});
    c.setContext({task:'route'});const pending=c.renderMap(host);
    if(change==='stops')c.setStops({destination:null});
    if(change==='selection')c.selectRoute(1);
    if(change==='context')c.setContext({task:'expense'});
    if(change==='dispose')c.dispose();
    sdk.resolve({maps:{Map:class{constructor(element){this.element=element;}fitBounds(){drawn.push(this.element);}},Polyline:class{constructor({map}){drawn.push(map.element);}setMap(){}},LatLngBounds:class{extend(){}isEmpty(){return false;}}}});
    await pending;
    assert.ok(drawn.length>0,'real service attempted to draw');
    assert.equal(drawn.some(node=>node.isConnected),false,change);
    if(change!=='dispose')c.dispose();
  }
});

test('entering a restored search owns initialization before the next typed query',async()=>{
  const {c}=make({search:async q=>[place(q)]},{searchQuery:'previous'});
  c.setContext({task:'route-search',stopKey:'origin'});
  assert.equal(c.getSnapshot().search.status,'pending');
  c.setQuery('typed');await tick();
  assert.equal(c.getSnapshot().search.query,'typed');
  assert.equal(c.getSnapshot().search.predictions[0].name,'typed');
  c.setContext({task:'route'});c.setContext({task:'route-search',stopKey:'destination'});
  assert.equal(c.getSnapshot().search.status,'pending');
  await tick();assert.equal(c.getSnapshot().search.predictions[0].name,'typed');c.dispose();
});
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
  live.setContext({task:'route'});await live.calculate();await live.renderMap(mapHost());assert.equal(live.getSnapshot().map.status,'error');assert.equal(live.applyValue(),'12.3');live.dispose();
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
