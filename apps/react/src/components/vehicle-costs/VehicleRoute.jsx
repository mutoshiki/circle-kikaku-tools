import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, Checkbox, ContainedList, ContainedListItem, IconButton, InlineLoading, Link, RadioButton, RadioButtonGroup } from '@carbon/react';
import { ArrowDown, ArrowUp, Close } from '@carbon/icons-react';

export const routeStopId=key=>`vehicle-route-stop-${encodeURIComponent(key)}`;
export default function VehicleRoute({controller,onSearch,onApply,blockedReason=''}) {
  const snapshot=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const {state,stopKeys,calculation,map,revision}=snapshot;
  const [mapOpen,setMapOpen]=useState(false),[optionsOpen,setOptionsOpen]=useState(false),[announcement,setAnnouncement]=useState('');
  const mapRef=useRef(null);
  useEffect(()=>{if(state.origin && state.destination && calculation.status==='idle')void controller.calculate();},[controller,revision,calculation.status,!!state.origin,!!state.destination]);
  useEffect(()=>{if(mapOpen && calculation.status==='ready')void controller.renderMap(mapRef.current);},[controller,mapOpen,state.selectedRouteIndex,calculation.status,revision]);
  function move(key,direction){const index=stopKeys.waypoints.indexOf(key),next=index+direction;if(next<0 || next>=state.waypoints.length)return;
    const waypoints=[...state.waypoints],keys=[...stopKeys.waypoints];[waypoints[index],waypoints[next]]=[waypoints[next],waypoints[index]];[keys[index],keys[next]]=[keys[next],keys[index]];
    controller.setStops({waypoints,waypointKeys:keys});setAnnouncement('経由地の順序を変更しました。');
    requestAnimationFrame(()=>document.getElementById(`${routeStopId(key)}-${next===0?'down':'up'}`)?.focus());
  }
  function remove(key){if(key==='origin' || key==='destination')controller.setStops({[key]:null});else{const index=stopKeys.waypoints.indexOf(key);controller.setStops({waypoints:state.waypoints.filter((_,i)=>i!==index),waypointKeys:stopKeys.waypoints.filter((_,i)=>i!==index)});}
    setAnnouncement('地点を削除しました。');requestAnimationFrame(()=>document.getElementById(key==='origin' || key==='destination'?routeStopId(key):'vehicle-route-add')?.focus());
  }
  const stops=[{key:'origin',label:'出発地',place:state.origin},...state.waypoints.map((place,index)=>({key:stopKeys.waypoints[index],label:`経由地 ${index+1}`,place,index})),{key:'destination',label:'目的地',place:state.destination}];
  const selected=state.routes[state.selectedRouteIndex] || state.routes[0];
  return <div className="vehicle-route-page">
    <div className="vehicle-route-privacy"><p>地点とルートはこの端末の入力履歴です。</p><p>検索・計算にはGoogleへ地点情報を送信します。自宅住所ではなく近くの施設を指定してください。共有される費用の距離は、適用後に車両費用を保存した値です。</p>{snapshot.seededFromPrevious && <p>以前この端末で使ったルートを表示しています。この車の共有ルートではありません。</p>}</div>
    <ContainedList label="ルート地点" size="lg">{stops.map(stop=><ContainedListItem key={stop.key} action={<div className="vehicle-route-stop-actions">{stop.index!=null && <><IconButton id={`${routeStopId(stop.key)}-up`} kind="ghost" size="lg" label={`${stop.label}を上へ`} disabled={stop.index===0} onClick={()=>move(stop.key,-1)}><ArrowUp /></IconButton><IconButton id={`${routeStopId(stop.key)}-down`} kind="ghost" size="lg" label={`${stop.label}を下へ`} disabled={stop.index===state.waypoints.length-1} onClick={()=>move(stop.key,1)}><ArrowDown /></IconButton></>}{stop.place && <IconButton kind="ghost" size="lg" label={`${stop.label}を削除`} onClick={()=>remove(stop.key)}><Close /></IconButton>}</div>}><div className="vehicle-route-stop"><strong>{stop.label}</strong><span>{stop.place?.name || '未選択'}</span><span>{stop.place?.address}</span><Link id={routeStopId(stop.key)} href={onSearch.href(stop.key)} onClick={event=>{if(event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey){event.preventDefault();onSearch(stop.key);}}}>{stop.label}を検索</Link></div></ContainedListItem>)}</ContainedList>
    {state.waypoints.length<25 ? <Link id="vehicle-route-add" href={onSearch.href('new-waypoint')} onClick={event=>{if(event.button===0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey){event.preventDefault();onSearch('new-waypoint');}}}>経由地を追加</Link> : <p>経由地は25地点までです。</p>}
    <p role="status">{announcement}</p>
    <div className="vehicle-cost-actions"><Button kind="tertiary" aria-expanded={optionsOpen} aria-controls="vehicle-route-options" onClick={()=>setOptionsOpen(v=>!v)}>{optionsOpen?'ルート設定を閉じる':'ルート設定'}</Button><Button kind="tertiary" aria-expanded={mapOpen} aria-controls="vehicle-route-map" onClick={()=>setMapOpen(v=>!v)}>{mapOpen?'地図を閉じる':'地図を表示'}</Button></div>
    {optionsOpen && <fieldset id="vehicle-route-options" className="vehicle-cost-fields"><legend>ルート設定</legend><Checkbox id="vehicle-route-tolls" labelText="有料道路を使う" checked={!state.avoidTolls} onChange={(_, {checked})=>controller.setOptions({avoidTolls:!checked})} /><Checkbox id="vehicle-route-highways" labelText="高速道路を使う" checked={!state.avoidHighways} onChange={(_, {checked})=>controller.setOptions({avoidHighways:!checked})} /></fieldset>}
    <section aria-label="ルート候補">
      {calculation.status==='pending' && <InlineLoading description="ルート候補を計算しています" />}
      <p role="status">{calculation.status==='error'?calculation.error:calculation.status==='empty'?'ルートが見つかりません。地点や道路設定を変更してください。':!state.origin || !state.destination?'出発地と目的地を選択してください。':''}</p>
      {(calculation.status==='error' || calculation.status==='empty') && <Button kind="tertiary" onClick={()=>controller.calculate()}>ルートを再計算</Button>}
      {calculation.status==='ready' && <RadioButtonGroup name="vehicle-route-candidate" legendText="ルート候補" orientation="vertical" valueSelected={String(state.selectedRouteIndex)} onChange={value=>controller.selectRoute(Number(value))}>{state.routes.map((route,index)=><RadioButton key={route.id || index} id={`vehicle-route-candidate-${index}`} value={String(index)} labelText={`${route.label || route.description || `候補${index+1}`} ${(Number(route.distanceMeters)/1000).toFixed(1)}km · ${Math.round(Number(route.durationSeconds || 0)/60)}分${route.tollPrice?` · ${route.tollPrice}`:''}`} />)}</RadioButtonGroup>}
      {selected && calculation.status==='ready' && <div className="vehicle-route-summary"><h2>選択したルート</h2><p>適用する距離 {controller.applyValue()}km</p>{selected.legs?.map((leg,index)=><p key={index}>{leg.fromName || `地点${index+1}`} → {leg.toName || `地点${index+2}`}　{(Number(leg.distanceMeters)/1000).toFixed(1)}km</p>)}</div>}
    </section>
    {mapOpen && <section id="vehicle-route-map" aria-label="ルート地図"><p role="status">{map.error || (map.status==='pending'?'地図を表示しています':'地図が使えない場合も文字のルートを使用できます。')}</p><div className="vehicle-route-map" ref={mapRef} /></section>}
    {blockedReason && <p role="status">{blockedReason}</p>}
    <Button disabled={!!blockedReason || !controller.applyValue()} onClick={()=>{if(!blockedReason)onApply(controller.applyValue());}}>この距離を適用</Button>
  </div>;
}
