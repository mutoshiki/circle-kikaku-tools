import { distanceKilometers, rememberPlace } from '../route/service.js';

const empty = {origin:null,destination:null,waypoints:[],routes:[],selectedRouteIndex:0,avoidTolls:true,avoidHighways:true,avoidFerries:false,roundTrip:false,recentPlaces:[]};
const clone = value => JSON.parse(JSON.stringify(value));
let sequence=0;
const stopId=()=>`waypoint:${++sequence}:${globalThis.crypto?.randomUUID?.() || Date.now()}`;

// UI request ownership only. Service requests, ranking and distance conversion
// are kept in their existing owners.
export function createVehicleRouteController({roomId,carKey,service,routeDraft,working,rememberWorking}) {
  const seed=working || routeDraft.read(empty);
  let state={...empty,...clone(seed || {}),roundTrip:false};
  state.waypoints=Array.isArray(state.waypoints)?state.waypoints:[];
  state.routes=Array.isArray(state.routes)?state.routes:[];
  const seededFromPrevious=!working && !!(state.origin || state.destination || state.waypoints.length);
  let stopKeys={origin:'origin',destination:'destination',waypoints:working?.stopKeys?.waypoints?.length === state.waypoints.length ? [...working.stopKeys.waypoints] : state.waypoints.map(stopId)};
  delete state.stopKeys;delete state.searchQuery;
  let revision=0,context={task:'',stopKey:''},contextVersion=0,disposed=false,timer;
  let searchToken=0,resolveToken=0,calculationToken=0,mapToken=0;
  let search={query:working?.searchQuery || '',predictions:[],status:'idle',error:''};
  let calculation={status:state.routes.length?'ready':'idle',error:''},map={status:'idle',error:''},snapshot;
  const listeners=new Set();
  const emit=()=>{snapshot={state,stopKeys,search,calculation,map,revision,seededFromPrevious};if(!disposed)for(const listener of listeners)listener();};
  const persist=()=>{const serialized=clone(state);routeDraft.write(serialized);rememberWorking({...serialized,stopKeys:clone(stopKeys),searchQuery:search.query});};
  const stamp=()=>({roomId,carKey,revision,contextVersion});
  const current=s=>!disposed && s.roomId===roomId && s.carKey===carKey && s.revision===revision && s.contextVersion===contextVersion;
  function invalidate() { revision++;resolveToken++;calculationToken++;mapToken++;state={...state,routes:[],selectedRouteIndex:0,roundTrip:false};calculation={status:'idle',error:''};map={status:'idle',error:''}; }
  function setContext(next) {
    if (disposed || context.task===next.task && context.stopKey===(next.stopKey || '')) return;
    context={task:next.task,stopKey:next.stopKey || ''};contextVersion++;searchToken++;resolveToken++;calculationToken++;mapToken++;clearTimeout(timer);
    search={...search,predictions:[],status:'idle',error:''};
    if(calculation.status==='pending')calculation={status:'idle',error:''};
    if(map.status==='pending')map={status:'idle',error:''};
    emit();
  }
  function setQuery(query) {
    if(disposed)return;
    clearTimeout(timer);const token=++searchToken;++resolveToken;
    search={query:String(query),predictions:[],status:query.trim()?'pending':'idle',error:''};persist();emit();
    if(!query.trim())return;
    const owner=stamp();
    timer=setTimeout(async()=>{
      try {
        const predictions=await service.search(query.trim());
        if(!current(owner) || token!==searchToken)return;
        search={query,predictions,status:predictions.length?'ready':'empty',error:''};emit();
      } catch(error) { if(current(owner) && token===searchToken){search={query,predictions:[],status:'error',error:'場所を検索できませんでした。検索語を確認して再試行してください。'};emit();} }
    },180);
  }
  function targetExists(key) { return key==='origin' || key==='destination' || key==='new-waypoint' && state.waypoints.length<25 || stopKeys.waypoints.includes(key); }
  async function resolveStop(key,prediction) {
    if(disposed || context.task!=='route-search' || context.stopKey!==key || !targetExists(key))return false;
    const owner=stamp(),token=++resolveToken;search={...search,status:'pending',error:''};emit();
    try {
      const place=prediction.placeId && prediction.latitude!=null ? clone(prediction) : await service.resolve(prediction);
      if(!current(owner) || token!==resolveToken || !targetExists(key))return false;
      invalidate();
      if(key==='origin' || key==='destination')state={...state,[key]:place};
      else if(key==='new-waypoint'){state={...state,waypoints:[...state.waypoints,place]};stopKeys={...stopKeys,waypoints:[...stopKeys.waypoints,stopId()]};}
      else {const index=stopKeys.waypoints.indexOf(key);state={...state,waypoints:state.waypoints.map((p,i)=>i===index?place:p)};}
      state={...state,recentPlaces:rememberPlace(state.recentPlaces,place)};search={...search,predictions:[],status:'idle',error:''};persist();emit();return true;
    } catch(error) {if(current(owner) && token===resolveToken){search={...search,status:'error',error:'場所を確認できませんでした。別の候補を選ぶか再試行してください。'};emit();}return false;}
  }
  function setStops({origin=state.origin,destination=state.destination,waypoints=state.waypoints,waypointKeys=stopKeys.waypoints}={}) {
    if(disposed)return;
    if(waypoints.length>25)throw Error('経由地は25地点までです。');
    invalidate();state={...state,origin,destination,waypoints:[...waypoints]};
    stopKeys={...stopKeys,waypoints:waypoints.map((_,i)=>waypointKeys[i] || stopId())};persist();emit();
  }
  function setOptions(options) {if(disposed)return;invalidate();for(const field of ['avoidTolls','avoidHighways','avoidFerries'])if(Object.hasOwn(options,field))state={...state,[field]:!!options[field]};persist();emit();}
  function selectRoute(index) {if(disposed || calculation.status!=='ready' || !state.routes[index])return;state={...state,selectedRouteIndex:index};mapToken++;map={status:'idle',error:''};persist();emit();}
  async function calculate() {
    if(disposed || !state.origin || !state.destination)return;
    const owner=stamp(),token=++calculationToken;calculation={status:'pending',error:''};emit();
    try {
      const result=await service.calculate(clone({...state,roundTrip:false}));
      if(!current(owner) || token!==calculationToken)return;
      state={...state,routes:clone(result.routes || []),selectedRouteIndex:result.selectedRouteIndex || 0,calculatedAt:result.calculatedAt,roundTrip:false};
      calculation={status:state.routes.length?'ready':'empty',error:''};persist();emit();
    } catch(error) {if(current(owner) && token===calculationToken){state={...state,routes:[]};calculation={status:'error',error:'ルートを計算できませんでした。地点・通信環境を確認して再試行してください。'};emit();}}
  }
  async function renderMap(element) {
    if(disposed || !element?.isConnected || calculation.status!=='ready')return;
    const owner=stamp(),token=++mapToken;map={status:'pending',error:''};emit();
    try {if(!service.renderMap)throw Error('map unavailable');await service.renderMap(element,clone(state));if(current(owner) && token===mapToken && element.isConnected){map={status:'ready',error:''};emit();}}
    catch(error){if(current(owner) && token===mapToken && element.isConnected){map={status:'error',error:'地図を表示できません。文字のルート候補、または走行距離の直接入力を使用できます。'};emit();}}
  }
  emit();
  return {getSnapshot:()=>snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},setContext,setQuery,resolveStop,setStops,setOptions,selectRoute,calculate,renderMap,
    applyValue(){const value=calculation.status==='ready' && distanceKilometers(state);return value>0?String(value):null;},
    dispose(){disposed=true;clearTimeout(timer);searchToken++;resolveToken++;calculationToken++;mapToken++;listeners.clear();},
  };
}
